 # 跨阶段数据传递（Inter-stage）

现在我们思考一个问题，在 WGSL 中我们如何将顶点着色器的输出传递给片元着色器呢？

这就是 **inter-stage（跨阶段接口）**：**顶点着色器输出 -> 片元着色器输入** 的那条数据通道。

本章你会掌握 4 个核心点：

1. 用 `@location(n)` 定义跨阶段变量（varyings）
2. 理解插值发生在哪里，以及为什么一个三角形能出现渐变色
3. 避开最常见的坑：`location` 必须匹配、类型必须匹配、以及与 vertex buffer `format` 的对应关系

接下来我们根据上一个章节的例子来演示如何实现跨阶段数据传递。

上一章中我们将三角形的颜色硬编码在 WGSL 片元着色器中，现在我们使用 JavaScript 创建颜色然后通过顶点缓冲区将颜色数据传到顶点着色器，接着使用 inter-stage 将颜色数值从顶点着色器传到片元着色器。

## 创建顶点数据

首先我们使用 JavaScript 创建一个内存块，用于存储顶点数据，每个顶点包含位置和颜色信息。结构如下：
![](/webgpu/inter-stage-vertex-data-layout.svg)


```js
const vertexSize = 2 * 4 + 4; // 2 floats (position) * 4 bytes + 4 bytes (color)
const vertexData = new ArrayBuffer(vertexSize * 3);
const f32 = new Float32Array(vertexData);
const u8 = new Uint8Array(vertexData);

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
    f32[i * 3] = positions[i * 2];
    f32[i * 3 + 1] = positions[i * 2 + 1];
    const colorBase = i * vertexSize + 8;
    u8[colorBase + 0] = colors[i * 4 + 0];
    u8[colorBase + 1] = colors[i * 4 + 1];
    u8[colorBase + 2] = colors[i * 4 + 2];
    u8[colorBase + 3] = colors[i * 4 + 3];
}
```

## Inter-stage 到底在“传什么”

你可以把渲染过程想成三步：

1. **顶点着色器**：对每个顶点执行一次，输出：
   - `@builtin(position)`：这个顶点的裁剪空间位置（必需，给光栅化用）
   - `@location(...)`：你希望传给下一个阶段的自定义值
2. **光栅化（Rasterization）**：把 3 个顶点组成的三角形“铺到屏幕网格上”
   - 对三角形内部每个像素点，计算它在三个顶点之间的权重
   - 对 `@location` 输出做插值
3. **片元着色器**：对每个像素执行一次，读取插值后的输入，输出最终颜色

要点：

- `@builtin(position)` 是管线固定功能所需的输出，不是给 fragment 随意“传参”的通道
- `@location(n)` 才是跨阶段变量，它们会被插值后送入 fragment

## 顺带一提：片元输出的 `@location(0)` 是什么

 在片元函数里你还会看到类似：

 ```wgsl
 fn fs(...) -> @location(0) vec4f
 ```

 这表示“把片元着色器的输出写到第 0 个颜色附件（color target 0）”。

 它对应 JavaScript 里 pipeline 的：

 - `fragment.targets[0]`

 如果你将来启用 multiple render targets（MRT），就会出现 `@location(0) / @location(1) ...` 多个输出位置。

## 用 struct 组织顶点输出（推荐写法）

在 WGSL 里，顶点着色器可以返回一个 struct。struct 的每个字段用 attribute 标注它的语义。

下面这段来自项目根目录的 `index.html` 示例：

```wgsl
struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(1) color: vec3f,
};
```

含义是：

- `position` 交给 GPU 做裁剪、透视除法、视口变换等固定流程
- `color` 通过 `@location(1)` 作为一个 varying 传给 fragment，并参与插值

`@location` 的数字只是编号：不要求从 0 开始，也不要求连续；但**必须与下游阶段严格匹配**。

## 顶点输出如何对上片元输入

同一个示例里的片元函数是：

```wgsl
@fragment
fn fs(@location(1) color: vec3f) -> @location(0) vec4f {
  return vec4f(color, 1.0);
}
```

这里有两条“接口规则”：

1. **同一个 `@location(n)` 上的类型必须一致**
2. **vertex 输出的 `@location(n)` 必须能在 fragment 输入里找到对应的 `@location(n)`**

你可以把 `@location(1)` 想成一根编号为 1 的数据线：

- vertex 往 `location(1)` 写
- 光栅化阶段负责插值
- fragment 从 `location(1)` 读

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

如果你想跨阶段传整数（例如 `u32`），通常需要用 `@interpolate(flat)` 之类的显式插值修饰，否则会报错。
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

## 最常见的坑

 在你遇到奇怪报错前，建议先用下面这张清单快速自查：

 - **location 是否一致**
   - vertex 输出 `@location(n)` 必须能在 fragment 输入里找到同一个 `@location(n)`
 - **类型是否一致**
   - 同一个 `@location(n)` 上，标量类型（f32/i32/u32）、向量维度（vec2/vec3/vec4）都必须匹配
 - **插值规则是否一致/是否允许**
   - 浮点默认可插值
   - 整数通常需要 `@interpolate(flat)`
 - **vertex buffer format 与 WGSL 输入是否匹配**
   - 例如 `unorm8x4` 应接收为 `vec4f`，再按需取 `.rgb`

### 1) location 对不上

顶点输出是 `@location(1)`，片元输入却写成 `@location(0)`，不会“自动对齐”。一般会在 pipeline 校验时报错。

### 2) 类型对不上

同一个 location 上，`vec3f` 和 `vec4f` 也不能混用，必须严格一致。

### 3) 顶点缓冲的 format 与 WGSL 类型写错

例如 `unorm8x4`：

- 正确接收类型：`vec4f`
- 常见错误：写成 `vec4u` / `vec3f` 直接读

想要 `vec3f` 也没问题，但应先读 `vec4f` 再取 `.rgb`（就像示例这样）。