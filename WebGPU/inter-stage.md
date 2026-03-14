<script setup>
  import WebGpuInterStagePlayground from "../components/WebGpuInterStagePlayground.vue";
</script>

# 跨阶段数据传递（Inter-stage）

上一章里，片元着色器直接返回固定红色。  
这次我们换一种方式：**把颜色放到顶点数据里，让顶点着色器把它传给片元着色器。**

这条“**顶点着色器输出 → 片元着色器输入**”的数据通道，就是常说的 **inter-stage**。

你可以先把它记成一句话：

> **顶点着色器负责把要继续往下传的数据写出来，片元着色器再把这些数据读进去。**

本章你会掌握 3 个核心点：

1. 如何用 `@location(n)` 声明跨阶段变量
2. 为什么三角形内部会出现渐变色
3. 最常见的匹配规则：`location`、类型、buffer 格式都必须对应

## 这一次，我们把颜色放进顶点数据

现在每个顶点包含两部分信息：

- `position`：位置，2 个 `f32`
- `color`：颜色，4 个 `u8`（RGBA）

也就是说，每个顶点占：

- 位置：8 字节
- 颜色：4 字节

总共 **12 字节**。

3 个顶点一共就是 **36 字节**。

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

这里有两个值得特别注意的点：

### 1. 同一块内存可以有多个“视图”

`posView` 和 `colorView` 指向的是同一个 `ArrayBuffer`，但解释方式不同：

- `Float32Array` 按 4 字节浮点数解释
- `Uint8Array` 按 1 字节无符号整数解释

这正适合本例这种“位置用浮点、颜色用字节”的交错数据。

### 2. `posView[i * 3]` 不是写错了

很多人第一次看到这里会疑惑：  
每个顶点不是只有两个位置分量吗，为什么步长是 `3`？

原因是：

- 每个顶点总共 12 字节
- 从 `Float32Array` 的角度看，12 字节正好是 **3 个 float 槽位**

其中：

- 前 2 个槽位放 `position.x`、`position.y`
- 第 3 个槽位的 4 个字节，被 `Uint8Array` 当成 `RGBA`

所以 `posView` 写位置时，顶点间隔自然就是 3 个 float 槽位。

## 然后告诉 pipeline：这块 buffer 该怎么读

顶点数据准备好以后，pipeline 还需要知道：

- 每个顶点多大
- 每个属性从哪里开始读
- 用什么格式解释

```js
buffers: [
    {
        arrayStride: vertexSize,
        attributes: [
            {
                shaderLocation: 0,
                offset: 0,
                format: "float32x2",
            },
            {
                shaderLocation: 1,
                offset: 2 * 4,
                format: "unorm8x4",
            },
        ],
    },
]
```

这段配置表示：

- `arrayStride: 12`
  - 相邻两个顶点之间相隔 12 字节

- 第 0 个属性
  - 从 `offset = 0` 开始
  - 按 `float32x2` 读取
  - 对应 `position`

- 第 1 个属性
  - 从 `offset = 8` 开始
  - 按 `unorm8x4` 读取
  - 对应 `color`

这里的 `unorm8x4` 非常关键。它的意思是：

- buffer 里实际存的是 4 个 `u8`
- 送进 shader 前会自动归一化到 `0 ~ 1`

所以在 WGSL 里，这个颜色应当按 **`vec4f`** 来接收，而不是 `vec4u`。

## 顶点着色器把颜色写出去，[片元着色器](../WGSL/fragmentShader.md)再读进来

接着修改 WGSL：

```wgsl
struct VertexOutput {
    @builtin(position) position: vec4f,
    @location(1) color: vec3f,
};

@vertex
fn vs(@location(0) position: vec2f, @location(1) color: vec4f) -> VertexOutput {
    var output: VertexOutput;
    output.position = vec4f(position, 0.0, 1.0);
    output.color = color.rgb;
    return output;
}

@fragment
fn fs(@location(1) color: vec3f) -> @location(0) vec4f {
    return vec4f(color, 1.0);
}
```

这段代码的逻辑很直接：

- 顶点着色器从 vertex buffer 读入 `position` 和 `color`
- `position` 写到 `@builtin(position)`，供后续光栅化使用
- `color` 写到 `@location(1)`，作为跨阶段输出
- 片元着色器再从 `@location(1)` 读回这个颜色

其中：

- `position` 是内建语义，不是我们这章讨论的自定义 inter-stage 变量
- `color` 才是这里真正的跨阶段变量

## `@location` 到底在连接什么

这一章里，最重要的匹配关系是：

```wgsl
// 顶点输出
@location(1) color: vec3f

// 片元输入
@location(1) color: vec3f
```

只要这两边：

- `location(n)` 中的 n 一致 （n 可以不是 0 开始，甚至可以不连续，但必须两边一致）
- 类型一致

> **inter-stage 变量只能写在 struct 中**

GPU 就知道它们是同一条跨阶段通道。

::: tip 不要把 3 种 `@location` 混在一起
在这一章里，`@location` 实际上出现在 3 个不同地方：

1. **顶点着色器输入**
   - 对应 vertex buffer 的 `shaderLocation`
   - 例如：`@location(1) color: vec4f`

2. **顶点着色器输出 / 片元着色器输入**
   - 这才是 inter-stage 变量本身
   - 例如：`@location(1) color: vec3f`

3. **片元着色器输出**
   - 对应颜色附件槽位
   - 例如：`-> @location(0) vec4f`

它们都叫 `location`，但描述的是不同接口。
:::

::: info 另一种写法

片元着色器也可以直接使用结构体作为参数：

```wgsl
struct VertexOutput {
    @builtin(position) position: vec4f,
    @location(1) color: vec3f,
};

@vertex
fn vs(@location(0) position: vec2f, @location(1) color: vec4f) -> VertexOutput {
    var output: VertexOutput;
    output.position = vec4f(position, 0.0, 1.0);
    output.color = color.rgb;
    return output;
}

@fragment // [!code focus:4]
fn fs(input: VertexOutput) -> @location(0) vec4f {
    return vec4f(input.color, 1.0);
}
```
:::

## 为什么三角形内部会出现渐变

这正是 inter-stage 最直观的效果。

本例的 3 个顶点分别是：

- 红色
- 绿色
- 蓝色

顶点着色器把这 3 个颜色值写出之后，接下来流水线会做两件事：

1. 把顶点组装成一个三角形 primitive
2. 对这个三角形进行 rasterization，生成片元

在生成片元的过程中，GPU 会根据片元相对三个顶点的位置，对顶点输出的颜色做插值。  
因此：

- 靠近红色顶点的区域更红
- 靠近绿色顶点的区域更绿
- 靠近蓝色顶点的区域更蓝
- 中间则自然混合成渐变

这就是为什么 inter-stage 不只是用来传颜色，它也常用于传：

- 纹理坐标
- 法线
- 世界空间位置
- 其他需要在片元阶段继续使用的顶点属性

## 这一章的完整数据链路

把整个过程串起来，就是：

1. **CPU** 在 JavaScript 中写入顶点数据  
   `position + color`

2. **Vertex Buffer Layout** 描述这段字节如何解释  
   `float32x2` + `unorm8x4`

3. **Vertex Shader Input** 从 `@location(0)` / `@location(1)` 读入数据

4. **Vertex Shader Output** 把 `color` 写到 `VertexOutput.@location(1)`

5. **Rasterization** 对这个 `color` 在三角形内部做插值

6. **Fragment Shader Input** 从 `@location(1)` 读取插值后的颜色

7. **Fragment Shader Output** 把颜色写到颜色附件

如果你能顺着这 7 步理解代码，就已经真正理解了 inter-stage。

## 在线编辑与预览

<WebGpuInterStagePlayground />

你可以在在线编辑区直接尝试下面几件事：

1. 修改 `colors` 数组，观察三角形颜色变化
2. 把 `@location(1)` 故意改错，再观察报错
3. 改 `format`，并同步修改 WGSL 输入类型，体会“字节布局”和“shader 类型”的对应关系
