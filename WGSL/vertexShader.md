# 顶点着色器（Vertex Shader）

顶点着色器是渲染管线里最早参与工作的可编程阶段之一。GPU 会对**每一个待处理的顶点**执行一次顶点着色器，因此它的核心任务非常明确：

- 计算当前顶点最终要交给流水线的位置
- 把后续阶段还需要的逐顶点数据继续传下去

如果把渲染过程看成一条流水线，那么顶点着色器做的是“**先处理顶点，再把结果交给后面的阶段**”。  
它不直接给出最终像素颜色，也不直接决定某个片元最后显示成什么样；这些事情通常发生在更后面的[片元着色器](./fragmentShader.md)阶段。

## 先看一个最小例子

```wgsl
@vertex
fn vsMain(@location(0) pos2d: vec2f) -> @builtin(position) vec4f {
    return vec4f(pos2d, 0.0, 1.0);
}
```

这段代码已经包含了顶点着色器最重要的 4 个要点：

1. `@vertex` 表示这是顶点阶段的入口函数
2. `@location(0)` 表示这个参数从顶点输入槽位 0 读取数据
3. 输入是 `vec2f`，也就是两个 `f32`，通常可理解为 `(x, y)`
4. 返回值必须标记为 `@builtin(position)`，类型通常是 `vec4f`

这里把二维坐标 `pos2d` 扩成了四维向量：

- 前两个分量是输入的 `x` 和 `y`
- 第三个分量这里写成 `0.0`
- 第四个分量这里写成 `1.0`

对初学阶段的二维示例来说，这是最常见、也最容易理解的写法。

## 顶点着色器到底在“处理什么”

顶点着色器处理的不是“整个三角形”，而是**一个一个的顶点**。

例如，一个三角形有 3 个顶点，那么顶点着色器至少会执行 3 次；如果有 1000 个顶点，就会执行 1000 次。  
每次执行时，它只关心“当前这个顶点的数据是什么、该输出到哪里、还要带什么额外信息出去”。

可以先建立下面这条主线：

```text
顶点缓冲中的数据
    ↓
顶点着色器逐顶点处理
    ↓
GPU 组装图元（点、线、三角形）
    ↓
光栅化
    ↓
片元着色器
```

所以顶点着色器的职责更接近：

- 接收当前顶点的属性
- 生成这个顶点的位置
- 顺手打包一些后续要用的数据

## 输入从哪里来：`@location(...)`

顶点着色器最常见的输入来自[顶点缓冲](../WebGPU/vertexBuffer.md)。  
WGSL 通过 `@location(n)` 把函数参数和顶点缓冲布局连接起来。

例如，我们希望每个顶点都带两类数据：

- 位置：2 个浮点数
- 颜色：3 个浮点数

那么 JavaScript 一侧通常会先定义顶点缓冲布局：

```js
const vertexBufferLayout = {
    arrayStride: 20,
    attributes: [
        { shaderLocation: 0, offset: 0, format: "float32x2" },
        { shaderLocation: 1, offset: 8, format: "float32x3" },
    ],
};
```

这段配置的含义是：

- 每个顶点总共占 `20` 字节
- 槽位 `0` 从偏移 `0` 开始读取两个 `f32`
- 槽位 `1` 从偏移 `8` 开始读取三个 `f32`

对应的 WGSL 输入就应该这样写：

```wgsl
@vertex
fn vsMain(
    @location(0) position: vec2f,
    @location(1) color: vec3f,
) -> @builtin(position) vec4f {
    return vec4f(position, 0.0, 1.0);
}
```

可以把这层对应关系直接记成表：

| JavaScript 侧 | WGSL 侧 |
| --- | --- |
| `shaderLocation: 0` | `@location(0)` |
| `shaderLocation: 1` | `@location(1)` |
| `format: "float32x2"` | `vec2f` |
| `format: "float32x3"` | `vec3f` |
| `offset` | 当前属性在单个顶点内的起始字节位置 |
| `arrayStride` | 一个顶点跨到下一个顶点时前进的字节数 |

::: tip 一个非常重要的对应关系
`shaderLocation` 和 `@location(...)` 必须一一对上。  
如果 JavaScript 里写的是 `shaderLocation: 1`，WGSL 却写成 `@location(2)`，GPU 就会读错数据，甚至直接报错。
:::

## 输出里最重要的内容：`@builtin(position)`

顶点着色器最基本的任务，是告诉 GPU：**这个顶点最终的位置是什么**。

WGSL 用 `@builtin(position)` 表示这个特殊输出。最常见的写法有两种。

### 直接返回位置

当你只需要输出位置时，可以直接返回：

```wgsl
@vertex
fn vsMain(@location(0) position: vec2f) -> @builtin(position) vec4f {
    return vec4f(position, 0.0, 1.0);
}
```

这种写法最简单，适合：

- 入门示例
- 只画纯色几何体
- 暂时不需要把别的数据传给片元着色器

### 返回结构体

当你不仅要给出位置，还要把颜色、纹理坐标或别的逐顶点数据继续传下去时，更常见的做法是返回一个结构体：

```wgsl
struct VertexOut {
    @builtin(position) clipPos: vec4f,
    @location(0) color: vec3f,
};

@vertex
fn vsMain(
    @location(0) position: vec2f,
    @location(1) color: vec3f,
) -> VertexOut {
    var out: VertexOut;
    out.clipPos = vec4f(position, 0.0, 1.0);
    out.color = color;
    return out;
}
```

这时顶点着色器就做了两件事：

- 把顶点位置写进 `@builtin(position)`
- 把颜色写进 `@location(0)`，交给后续阶段继续使用

## 顶点着色器里常见的内建值

除了用 `@location(...)` 读取顶点属性外，顶点着色器还经常会用到几个内建值。

| 内建值 | 类型 | 读写 | 作用 |
| --- | --- | --- | --- |
| `@builtin(position)` | `vec4f` | 写 | 当前顶点输出位置 |
| `@builtin(vertex_index)` | `u32` | 读 | 当前顶点的索引 |
| `@builtin(instance_index)` | `u32` | 读 | 当前实例的索引 |

### `vertex_index`

当你想根据“这是第几个顶点”来决定行为时，就可以读取它。

例如，你不一定非要把所有坐标都提前塞进顶点缓冲，也可以根据索引从着色器内部的数组中取值：

```wgsl
@vertex
fn vsMain(@builtin(vertex_index) vid: u32) -> @builtin(position) vec4f {
    let positions = array<vec2f, 3>(
        vec2f(0.0, 0.6),
        vec2f(-0.6, -0.4),
        vec2f(0.6, -0.4),
    );
    return vec4f(positions[vid], 0.0, 1.0);
}
```

这种方式很适合最小示例，因为它甚至可以不依赖顶点缓冲。

### `instance_index`

当一次绘制要生成多个实例时，它就很有用。  
你可以让同一份几何数据，根据实例编号产生不同位置：

```wgsl
@vertex
fn vsMain(
    @location(0) localPos: vec2f,
    @builtin(instance_index) iid: u32,
) -> @builtin(position) vec4f {
    let xOffset = f32(iid) * 0.25;
    return vec4f(localPos + vec2f(xOffset, 0.0), 0.0, 1.0);
}
```

这里有一个很容易忽略的点：`instance_index` 是 `u32`，如果要参与浮点运算，需要显式写 `f32(iid)`。

## 为什么很多时候要“返回结构体”

一个很常见的问题是：**片元着色器能不能直接去读顶点缓冲里的颜色？**

通常不能直接这样理解。更稳妥的思路是：

1. 顶点着色器先读取逐顶点数据
2. 顶点着色器把需要继续传递的值写进输出
3. GPU 在图元内部对这些逐顶点值进行插值
4. 片元着色器再读取插值后的结果

这就是为什么“返回结构体”非常常见。它相当于告诉流水线：

- 这个字段是顶点位置
- 这个字段是后面片元阶段还要继续用的数据

下面是一组完整但很短的配合示例：

```wgsl
struct VertexOut {
    @builtin(position) clipPos: vec4f,
    @location(0) color: vec3f,
};

@vertex
fn vsMain(
    @location(0) position: vec2f,
    @location(1) color: vec3f,
) -> VertexOut {
    var out: VertexOut;
    out.clipPos = vec4f(position, 0.0, 1.0);
    out.color = color;
    return out;
}

@fragment
fn fsMain(inData: VertexOut) -> @location(0) vec4f {
    return vec4f(inData.color, 1.0);
}
```

这段代码的结果是：

- 每个顶点自带自己的颜色
- 顶点着色器把颜色传出去
- 片元着色器接收颜色并输出最终颜色

::: tip 记忆方法
顶点着色器不只是“算位置”，它还是**顶点数据向后续阶段流动的第一站**。
:::

这种将顶点着色器的内容传到片元着色器中的方法叫做[Inter-stage](../WebGPU/inter-stage.md)。

## 它怎样接到 render pipeline 上

WGSL 写好了，还要在 JavaScript 里把它挂到渲染管线上。最关键的是 `vertex` 这一段配置：

```js
const pipeline = device.createRenderPipeline({
    layout: "auto",
    vertex: {
        module: shaderModule,
        entryPoint: "vsMain",
        buffers: [vertexBufferLayout],
    },
    fragment: {
        module: shaderModule,
        entryPoint: "fsMain",
        targets: [{ format: canvasFormat }],
    },
});
```

这里至少要看懂 3 个点：

- `module`：顶点着色器所在的 shader module
- `entryPoint`：顶点着色器入口函数名
- `buffers`：这个顶点着色器要从哪些顶点缓冲布局里读数据

也就是说，**WGSL 里的 `@location(...)`，要靠这里的 `buffers` 配置才能真正接上外部数据。**

## 可以这样理解整件事

学顶点着色器时，最重要的不是先记住所有语法细节，而是先抓住这条主线：

1. 顶点数据从顶点缓冲进入 GPU
2. 顶点着色器通过 `@location(...)` 读取当前顶点的数据
3. 顶点着色器必须输出 `@builtin(position)`
4. 如果后续阶段还要用到别的数据，就把它们一起写进输出
5. render pipeline 负责把 WGSL 入口、缓冲布局和渲染过程连接起来

当这条主线清楚以后，顶点着色器就不会再显得零散。你看到的大多数 WGSL 顶点代码，本质上都只是在回答两个问题：

- **这个顶点应该放到哪里？**
- **这个顶点还要把什么信息传下去？**

## 小结

顶点着色器可以先记成一句话：

> **逐顶点读取输入，逐顶点计算位置，并按需要把数据传给后续阶段。**

只要把下面 4 点记牢，后面读 WebGPU 示例会轻松很多：

- `@vertex` 标记顶点着色器入口
- `@location(...)` 负责接收顶点属性
- `@builtin(position)` 是最关键的输出
- 需要传给片元着色器的数据，通常通过返回结构体继续传递

如果你已经理解了这里的输入、输出和数据传递方式，接下来再看 uniform、变换矩阵、实例化渲染时，会顺畅很多。
