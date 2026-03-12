<script setup>
  import WebGpuInterStagePlayground from "../components/WebGpuInterStagePlayground.vue";
</script>

# 跨阶段数据传递（Inter-stage）

现在我们思考一个问题，在 WGSL 中我们如何将顶点着色器的输出传递给片元着色器呢？

这就是 **inter-stage（跨阶段接口）**：**顶点着色器输出 -> 片元着色器输入** 的那条数据通道。

本章你会掌握 3 个核心点：

1. 用 `@location(n)` 定义跨阶段变量（varyings）
2. 理解插值发生在哪里，以及为什么一个三角形能出现渐变色
3. 避开最常见的坑：`location` 必须匹配、类型必须匹配、以及与 vertex buffer `format` 的对应关系

接下来我们根据上一个章节的例子来演示如何实现跨阶段数据传递。

上一章中我们将三角形的颜色硬编码在 WGSL 片元着色器中，现在我们使用 JavaScript 创建颜色然后通过顶点缓冲区将颜色数据传到顶点着色器，接着使用 inter-stage 将颜色数值从顶点着色器传到片元着色器。

## 创建顶点数据

首先我们使用 JavaScript 创建一个内存块，用于存储顶点数据，每个顶点包含位置和颜色信息。结构如下：

我们按每个顶点 12 个字节来存储数据：前 8 个字节存储顶点位置，后 4 个字节存储顶点颜色（RGBA 四个通道，每个通道 1 个字节）。3 个顶点一共需要 36 个字节。

```js
const vertexSize = 2 * 4 + 4;
const vertexData = new ArrayBuffer(vertexSize * 3);
const posView = new Float32Array(vertexData);
const colorView = new Uint8Array(vertexData);

const positions = [
    0.0, 0.5,
    -0.5, -0.5,
    0.5, -0.5,
];

const colors = [
    255, 0, 0, 255,
    0, 255, 0, 255,
    0, 0, 255, 255,
];

for (let i = 0; i < 3; i++) {
    posView[i * 3] = positions[i * 2];
    posView[i * 3 + 1] = positions[i * 2 + 1];
    const colorBase = i * vertexSize + 8;
    colorView[colorBase + 0] = colors[i * 4 + 0];
    colorView[colorBase + 1] = colors[i * 4 + 1];
    colorView[colorBase + 2] = colors[i * 4 + 2];
    colorView[colorBase + 3] = colors[i * 4 + 3];
}
```

`vertexSize` 是每个顶点所需的字节数。`vertexData` 是创建出来的一块内存，长度为 `vertexSize * 3` 个字节。

`posView` 和 `colorView` 使用同一块内存，`posView`（`Float32Array`）和 `colorView`（`Uint8Array`）的区别在于：它们都是“视图（view）”，指向同一个 `ArrayBuffer`，但 **解释这段内存的粒度不同**。

- **`Float32Array`（`posView`）**
    - 以 4 个字节为一组来读写（IEEE 754 的 32 位浮点数）。
    - 写入 `posView[k] = 1.0` 时，实际会把 `vertexData` 中从 `k * 4` 开始的 4 个字节改掉。
    - 适合写入顶点位置、法线、UV 等需要小数精度的属性。

- **`Uint8Array`（`colorView`）**
    - 以 1 个字节为一组来读写（0~255 的无符号整数）。
    - 写入 `colorView[offset] = 255` 时，只会改动 `vertexData` 的某一个字节。
    - 特别适合写入颜色这种“每个通道 1 字节”的数据（RGBA 8-bit）。

因此这段代码会用 `posView` 写 `position`（两个 `f32`，占 8 字节），再用 `colorView` 从 `colorBase = i * vertexSize + 8` 这个 **字节偏移** 开始写 4 个颜色通道。

注意这里的一个关键点是：同一块 buffer 里混合存放 `posView` 和 `colorView` 时，你必须自己保证偏移与布局一致（例如 `position` 写了 8 字节后，颜色偏移应为 8 字节），并且在 `vertexBufferLayout.attributes[*].offset` / `format` 中用同样的规则告诉 GPU 该怎么解析。

## 然后设置 pipeline

```js
...
buffers: [
    {
    arrayStride: vertexSize,
    attributes: [
        {
            shaderLocation: 0,
            offset: 0,
            format: "float32x2",
        },
        { // [!code ++]
            shaderLocation: 1, // [!code ++]
            offset: 2 * 4, // [!code ++]
            format: "unorm8x4", // [!code ++]
        }, // [!code ++]
    ],
    },
]
...
```

我们新增了一个 `attributes` 来描述颜色数据的布局，其中：

- `offset: 2 * 4` 对应颜色数据偏移量，`2 * 4 = 8`，即从第 8 个字节开始读取颜色；前 8 个字节是位置数据（`position.xy`）。
- `format` 对应颜色数据格式。`unorm8x4` 表示 4 个 8 位无符号整数（`0-255`），每个通道占 1 个字节。`unorm` 表示把无符号整数归一化到 `0-1`；与之对应，`snorm` 会归一化到 `-1~1`。

## 然后修改 WGSL

```wgsl
struct VertexOutput { // [!code ++]
    @builtin(position) position: vec4f, // [!code ++]
    @location(1) color: vec3f, // [!code ++]
};// [!code ++]

@vertex
fn vs(@location(0) position: vec2f) -> @builtin(position) vec4f { // [!code --]
fn vs(@location(0) position: vec2f, @location(1) color: vec4f) -> VertexOutput { // [!code ++]
    var output: VertexOutput; // [!code ++]
    output.position = vec4f(position, 0.0, 1.0); // [!code ++]
    output.color = color.rgb; // [!code ++]
    return vec4f(position, 0.0, 1.0); // [!code --]
    return output; // [!code ++]
}

@fragment
fn fs() -> @location(0) vec4f { // [!code --]
    return vec4f(1.0, 0.0, 0.0, 1.0); // [!code --]
fn fs(@location(1) color: vec3f) -> @location(0) vec4f { // [!code ++]
    return vec4f(color, 1.0); // [!code ++]
}
```

`vs` 新增 `@location(1) color: vec4f`，对应上文顶点缓冲区里每个顶点后 4 字节的 RGBA 数据。`@location(1)` 中的 `1` 对应上面 pipeline 的 `shaderLocation: 1`。

新增 `VertexOutput`，同时携带 `@builtin(position)` 和 `@location(1) color`，明确区分“固定管线语义”（position）与“自定义 varying”（color）。

`output.color = color.rgb` 把顶点颜色写入 `@location(1)`，随后由光栅化阶段在三角形内部自动插值。

`fs` 从 `@location(1)` 读取 `vec3f color`，不再返回固定红色，而是输出 `vec4f(color, 1.0)`。

## inter-stage 变量通过 location 连接

WGSL 代码中的 `VertexOutput` 定义了 `@location(1) color: vec3f`，`fs` 函数也新增了参数 `@location(1) color: vec3f`，两者是一一对应的关系。`@location` 的数字只是编号：不要求从 0 开始，也不要求连续；但 **必须严格匹配**。

你可以在 `VertexOutput` 中使用 `@location` 定义多个 inter-stage 变量，例如：

```wgsl
struct VertexOutput {
    @builtin(position) position: vec4f, // 不是 inter-stage 变量
    @location(1) color: vec3f, // inter-stage 变量
    @location(2) uv: vec2f, // inter-stage 变量
    @location(7) normal: vec3f, // inter-stage 变量
};
```

那么你在片元着色器中想要获取对应的数据就必须这么写：

```wgsl
fn fs(@location(1) color: vec3f, @location(2) uv: vec2f, @location(7) normal: vec3f) -> @location(0) vec4f {
    return vec4f(color, 1.0); 
}

或者

fn fs(input: VertexOutput) -> @location(0) vec4f {
    // input.uv
    // input.normal
    return vec4f(input.color, 1.0); 
}
```
::: tip
inter-stage 变量通常定义在顶点着色器返回的 struct（如本例的 `VertexOutput`）里；片元着色器可以按 `@location` 分别接收，也可以用 struct 接收。

另外你应该发现了，不论是顶点着色器还是片元着色器都使用了 `@location`，你可能会搞混，我们来区分一下：

1. `@location` 在顶点着色器入参中表示从哪个 `shaderLocation` 读取数据。比如本例的 `position` 和 `color`：`fn vs(@location(0) position: vec2f, @location(1) color: vec4f)`
2. `@location` 定义在顶点输出 struct 中并由顶点着色器返回时，表示定义的是 inter-stage 变量
3. `@location` 在片元着色器入参中表示读取哪个 inter-stage 变量
4. 片元输出的 `@location(0)`，`fn fs(...) -> @location(0) vec4f` 表示把片元着色器的输出写到第 0 个颜色附件 `fragment.targets[0]`
:::

## 在线编辑与预览

<WebGpuInterStagePlayground />

现在你可以在在线编辑区直接改这章的关键代码，建议优先尝试：

1. 改 `colors` 里的 RGBA 数组，观察三角形颜色如何变化
2. 把 `@location(1)` 故意改错（例如改成 `@location(2)`），观察 pipeline 校验错误，再改回正确值
3. 把 `format: "unorm8x4"` 改成其他格式并同步修改 WGSL 输入类型，体会 buffer 格式与 shader 类型的匹配关系

## 插值：为什么会出现渐变

inter-stage 最直观的效果就是渐变色。

在示例里，三个顶点分别是红、绿、蓝。顶点着色器输出这三个顶点的 `color`。

当 GPU 在三角形内部取某个像素点时，它会计算这个点相对三个顶点的权重，并对 `color` 做组合，于是就产生：

- 靠近红色顶点更红
- 靠近绿色顶点更绿
- 中间自然过渡

这也是为什么我们常用 inter-stage 传：

- 顶点颜色
- 纹理坐标（uv）
- 法线（normal）
- 世界坐标/视图坐标位置（做光照、雾效等）

::: tip 关于整数插值
浮点 varying（`f32` / `vec*f`）默认会插值。

如果你想跨阶段传整数（例如 `u32`），必须使用 `@interpolate(flat)`（或等价的 `flat` 插值设置），否则会触发着色器校验错误。

对于如何进行插值，有两组设置可以更改。将它们设置为默认值以外的值并不常见。

插值类型:

- perspective: 以正确的透视方式插值 (默认)
- linear: 以线性、非透视正确的方式内插数值。
- flat: 不在图元内部做插值，值直接来自图元的某个顶点（由 `first`/`either` 控制）。

插值采样:

- center: 插值在像素中心进行 (默认)
- centroid: 插值是在当前基元中片段所覆盖的所有样本内的某一点上进行的。该值对基元中的所有样本都是相同的。
- sample: 每次采样时执行插值。应用此属性时，每次采样都会调用一次片段着色器。
- first: 只能在插值类型为 flat 时使用。（默认）绘制时采用图元第一个顶点的值。
- either: 只能在插值类型为 flat 时使用。绘制时可能采用图元第一个顶点或最后一个顶点的值。

你可以将其指定为属性。例如：

```wgsl
@location(2) @interpolate(linear, center) myVariableFoo: vec4f;
@location(3) @interpolate(flat) myVariableBar: vec4f;
```

如果将插值类型设置为 `flat`，那么传递给片元着色器的值来自一个顶点（默认是 `first`，即图元的第一个顶点）。

:::

## 结合示例：从顶点缓冲到 inter-stage 的完整链路

示例里每个顶点的数据是 position + color 交错存放：

- position：2 个 `f32`（8 字节）
- color：4 个 `u8`（4 字节，RGBA）

对应的 vertex buffer layout：

```js
{
  arrayStride: vertexSize,
  attributes: [
    { shaderLocation: 0, offset: 0, format: "float32x2" },
    { shaderLocation: 1, offset: 2 * 4, format: "unorm8x4" },
  ],
}
```

关键是 `unorm8x4`：

- buffer 中是 0~255 的 `u8`
- 读入 shader 时会自动归一化为 0~1 的浮点值
- 因此 WGSL 里应该用 `vec4f` 来接收

于是顶点着色器输入应写成：

```wgsl
@vertex
fn vs(@location(0) position: vec2f, @location(1) color: vec4f) -> VertexOutput {
  var output: VertexOutput;
  output.position = vec4f(position, 0.0, 1.0);
  output.color = color.rgb;
  return output;
}
```

这里 `color.rgb` 就把 `vec4f` 的 RGB 三个分量作为跨阶段输出传给 fragment。

把整个数据流串起来就是：

1. **CPU** 写入 vertex buffer（position + RGBA）
2. **Vertex Input**：`@location(0)`/`@location(1)` 从 buffer 读取
3. **Vertex Output**：写入 `VertexOutput.@location(1)`
4. **Rasterizer**：对 `@location(1)` 插值
5. **Fragment Input**：读取插值后的 `@location(1)` 并输出颜色
