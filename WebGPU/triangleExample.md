<script setup>
import WebGpuTrianglePlayground from '../components/WebGpuTrianglePlayground.vue';
</script>

# 绘制一个三角形

这一章我们做一件图形编程里最经典的事：**用 WebGPU 在画布上画出一个三角形。**

别看结果简单，这个例子几乎把 WebGPU 渲染最核心的几步都串起来了：

1. 获取 GPU 设备
2. 配置 Canvas
3. 编写 WGSL 着色器
4. 创建渲染管线
5. 编码并提交绘制命令

理解了这一章，后面再看顶点缓冲、uniform、纹理和光照，就会顺很多。

## 第一步：获取 `GPUDevice`

WebGPU 的入口是 `navigator.gpu`。  
一个最小的初始化流程通常是：

```js
if (!navigator.gpu) {
    throw new Error("WebGPU not supported.");
}

const adapter = await navigator.gpu.requestAdapter();
if (!adapter) {
    throw new Error("Failed to get GPUAdapter.");
}

const device = await adapter.requestDevice();
```

这里有两个关键对象：

- `GPUAdapter`：浏览器为当前页面选择的可用 GPU 适配器
- `GPUDevice`：真正负责创建资源、编码命令、提交工作的核心对象

你可以把它理解成：

- `adapter` 负责“选中哪块 GPU / 哪个后端”
- `device` 负责“开始真正干活”

## 第二步：配置 Canvas

接下来要把 `GPUDevice` 和 `<canvas>` 连接起来：

```html
<canvas width="300" height="150"></canvas>
```

```js
const canvas = document.querySelector("canvas");
const context = canvas.getContext("webgpu");

if (!context) {
    throw new Error("Failed to get WebGPU canvas context.");
}

const presentationFormat = navigator.gpu.getPreferredCanvasFormat();

context.configure({
    device,
    format: presentationFormat,
});
```

这里的 `context.configure(...)` 很重要，它告诉浏览器：

- 这块画布由哪个 `device` 驱动
- 画布最终显示颜色时采用什么像素格式

`getPreferredCanvasFormat()` 返回当前环境下更合适的画布格式，通常是 `rgba8unorm` 或 `bgra8unorm`。选择首选格式通常会有更好的兼容性与性能。

::: tip rgba8unorm vs bgra8unorm
`rgba8unorm` 和 `bgra8unorm` 都是 8 位无符号整数格式，每个分量占用 8 位，取值范围是 0 到 255。它们的主要区别在于颜色分量的排列顺序。

- `rgba8unorm`：红色(R)、绿色(G)、蓝色(B)、透明度(A) 分量按此顺序排列。
- `bgra8unorm`：蓝色(B)、绿色(G)、红色(R)、透明度(A) 分量按此顺序排列。

不同的 GPU 架构可能对不同的格式有不同的性能表现，因此选择合适的格式可以提高渲染性能。

另外 `unorm` 中的 `u` 表示无符号整数格式，`norm` 表示归一化，即将 0-255 的取值范围映射到 0-1。
:::

## 第三步：写一个最小着色器

WebGPU 不会替你“自动画图”，你必须提供着色器。  
这个例子里我们直接把三角形顶点硬编码在 WGSL 中：

```js
const module = device.createShaderModule({
    label: "triangle shader module",
    code: `
        @vertex
        fn vs(@builtin(vertex_index) vertexIndex: u32) -> @builtin(position) vec4f {
            let positions = array(
                vec4f(0.0, 0.5, 0.0, 1.0),
                vec4f(-0.5, -0.5, 0.0, 1.0),
                vec4f(0.5, -0.5, 0.0, 1.0),
            );
            return positions[vertexIndex];
        }

        @fragment
        fn fs() -> @location(0) vec4f {
            return vec4f(1.0, 0.0, 0.0, 1.0);
        }
    `,
});
```

这段 WGSL 里有两个入口函数：

- `vs`：顶点着色器
- `fs`：片元着色器

### 顶点着色器在做什么

`vs` 使用 `@builtin(vertex_index)` 读取当前顶点索引。  
当我们后面调用 `draw(3)` 时，它会依次拿到：

- `0`
- `1`
- `2`

然后从 `positions` 数组里取出对应顶点位置并返回。`->` 表示 `vs` 函数的返回值类型为 `@builtin(position) vec4f`。`@builtin(position)` 是 WGSL 中的一个内建变量，用于指定顶点着色器的输出位置。

也就是说，这里并没有使用顶点缓冲区，而是直接在着色器里写死了三角形的 3 个点。

### 片元着色器在做什么

`fs` 非常简单：它返回固定红色。

```wgsl
return vec4f(1.0, 0.0, 0.0, 1.0);
```

这表示输出 RGBA：

- 红色 `1.0`
- 绿色 `0.0`
- 蓝色 `0.0`
- Alpha `1.0`

::: tip
在这个例子里：

- 顶点着色器执行 3 次，对应 3 个顶点
- 片元着色器会对被三角形覆盖到的每个片元执行一次
:::

## 第四步：创建渲染管线

着色器写好后，还要告诉 WebGPU：这次渲染该如何组织。

```js
const pipeline = device.createRenderPipeline({
    label: "triangle pipeline",
    layout: "auto",
    vertex: {
        module,
        entryPoint: "vs",
    },
    fragment: {
        module,
        entryPoint: "fs",
        targets: [{ format: presentationFormat }],
    },
});
```

这里最关键的是三部分：

- `vertex`：使用哪个顶点着色器入口
- `fragment`：使用哪个片元着色器入口
- `targets`：片元着色器的输出要写到什么格式的颜色目标中

其中：

```js
targets: [{ format: presentationFormat }]
```

必须和 `context.configure(...)` 使用的画布格式一致，否则 pipeline 无法正确工作。

`entryPoint` 用于指定着色器模块中的入口函数名。这里我们将它设置为 `"vs"` 和 `"fs"`，表示顶点着色器和片元着色器的入口函数分别是 `vs` 和 `fs`。`entryPoint` 可以省略前提是你的 WGSL 里有只有一个顶点着色器入口和一个片元着色器入口，如果有多个顶点着色器入口或者多个片元着色器入口那你必须写明 `entryPoint`。 

## 第五步：编码绘制命令

到这里为止，我们只是“准备好了渲染规则”，但还没有真正开始绘制。  
真正的绘制发生在命令编码阶段：

```js
const commandEncoder = device.createCommandEncoder();

const passEncoder = commandEncoder.beginRenderPass({
    colorAttachments: [
        {
            view: context.getCurrentTexture().createView(),
            loadOp: "clear",
            clearValue: { r: 0, g: 1, b: 0, a: 1 },
            storeOp: "store",
        },
    ],
});

passEncoder.setPipeline(pipeline);
passEncoder.draw(3);
passEncoder.end();

const commandBuffer = commandEncoder.finish();
device.queue.submit([commandBuffer]);
```

这段代码可以按顺序理解：

### 1. 创建命令编码器

```js
const commandEncoder = device.createCommandEncoder();
```

你可以把它理解为“开始录制一组 GPU 命令”。

### 2. 开始一个 render pass

```js
const passEncoder = commandEncoder.beginRenderPass({...});
```

render pass 描述的是：  
这一次渲染要把结果写到哪里，以及开始渲染前如何处理这块目标区域。

### 3. 指定颜色附件

```js
{
  view: context.getCurrentTexture().createView(),
  loadOp: "clear",
  clearValue: { r: 0, g: 1, b: 0, a: 1 },
  storeOp: "store",
}
```

这里最重要的几个字段是：

- `view`
  - 指向这次渲染要写入的目标纹理视图
  - `context.getCurrentTexture()` 取到当前帧对应的画布纹理
  - `createView()` 则创建这个纹理的 `GPUTextureView`

- `loadOp: "clear"`
  - 表示绘制前先清空颜色附件

- `clearValue`
  - 指定清空成什么颜色
  - 本例里是绿色背景

- `storeOp: "store"`
  - 表示 render pass 结束后，把结果保留下来用于显示

::: tip 几个“0”的对应关系
```wgsl
@fragment
fn fs() -> @location(0) vec4f {
    return vec4f(1.0, 0.0, 0.0, 1.0);
}
```

上面代码中的 `@location(0)` 的“0”对应render pass中 `colorAttachments[0]`, 表示顶点着色器将颜色输出到 `colorAttachments[0]` 这个颜色附件。 `pipeline.fragment.targets[0]` 片元着色器的输出要写到什么格式的 `colorAttachments[0]` 颜色附件中。
:::

### 4. 设置管线并发出 draw

```js
passEncoder.setPipeline(pipeline);
passEncoder.draw(3);
```

`setPipeline(...)` 表示当前 render pass 使用哪条渲染管线。

`draw(3)` 表示绘制 3 个顶点。  
由于本例里没有索引缓冲、也没有顶点缓冲，WebGPU 会让顶点着色器按 `vertex_index = 0, 1, 2` 执行三次，正好组成一个三角形。

### 5. 结束、完成、提交

```js
passEncoder.end();
const commandBuffer = commandEncoder.finish();
device.queue.submit([commandBuffer]);
```

这三步分别表示：

- render pass 结束
- 命令录制完成
- 把命令提交到 GPU 队列执行

到这里，三角形才会真正出现在画布上。

## 这一章的最小心智模型

画这个三角形时，你实际上做了下面这些事：

1. 拿到 `device`
2. 配好 `canvas`
3. 写了顶点着色器和片元着色器
4. 用它们创建 render pipeline
5. 开一个 render pass
6. 调用 `draw(3)`
7. 提交命令给 GPU

如果你能把这 7 步串起来，就已经掌握了 WebGPU 渲染最基础的骨架。

## 在线编辑与预览

<WebGpuTrianglePlayground />

现在你可以直接修改代码并观察结果。建议优先尝试：

1. 修改 `clearValue`，观察背景颜色变化
2. 修改 `fs` 返回值，观察三角形颜色变化
3. 修改 `positions` 数组，观察三角形位置变化

## 最后再看一眼顶点坐标

本例中的三角形顶点是：

```wgsl
let positions = array(
    vec4f(0.0, 0.5, 0.0, 1.0),
    vec4f(-0.5, -0.5, 0.0, 1.0),
    vec4f(0.5, -0.5, 0.0, 1.0),
);
```

这些坐标不是像素坐标。  
在这个例子里，`w = 1.0`，所以它们可以直接按裁剪空间 / NDC 的直觉来理解：

- `x`、`y` 大致落在 `[-1, 1]`
- `(0, 0)` 在画布中心附近
- `0.5` 表示偏向右边或上边
- `-0.5` 表示偏向左边或下边

所以不管 canvas 是 `300 × 150`，还是更大的尺寸，这组顶点描述的都仍然是“画面中心附近的一个三角形”。

如果你对这些坐标的意义还不够直观，建议回头再看一遍[图形渲染流程](./graphicsRendering.md)里关于标准化设备坐标的部分。
