# 绘制一个三角形

本章节我们将使用 WebGPU 渲染一个三角形。

## 准备工作

首先我们需要先做一些准备工作：

1. 访问浏览器的 Navigator 以查看是否支持 WebGPU。
2. 如果支持 WebGPU，则使用 Navigator 获取 GPUAdapter。
3. 使用 GPUAdapter 获取 GPUDevice。

```javascript
if (!navigator.gpu) {
    throw Error("WebGPU not supported.");
}

const adapter = await navigator.gpu.requestAdapter();
if (!adapter) {
    throw Error("Couldn't request WebGPU adapter.");
}

const device = await adapter.requestDevice();
if (!device) {
    throw new Error("need a browser that supports WebGPU");
}
```

`navigator` 是浏览器提供的全局对象，用于访问浏览器的功能和信息。在 WebGPU 中，我们使用 `navigator.gpu` 来检查浏览器是否支持 WebGPU。
如果存在，gpu 属性提供了两个重要方法：

- `requestAdapter()`—返回一个 Promise，该 Promise 满足时会提供一个 GPUAdapter
- `getPreferredCanvasFormat()`—返回一个字符串，标识浏览器画布中图形的最佳格式

`requestAdapter` 方法来获取一个 `GPUAdapter`，`GPUAdapter` 代表了实际的物理 GPU。大多数设备仅有一个 GPU，但有些设备不止一个。假如你使用的是 Windows 且有 2 个显卡（集成显卡 + 独立显卡），则至少有 4 个适配器可供使用。

`requestAdapter()` 方法还可以接受一个可选参数，用于指定适配器的类型。默认值为 `undefined`，表示返回任何类型的适配器。

`GPUDevice` 是应用间的逻辑设备，具有应用间隔离的意义。可以认为，`GPUDevice` 是底层硬件适配器 `GPUAdapter` 为你的应用划分出来的一个子逻辑设备。所以，打一个不恰当的比方，`GPUAdapter `和 `GPUDevice` 就好像物理内存和逻辑内存的关系一样，前者是客观真实的，后者是软件层面逻辑划分的。

举一个简单的例子，让你大概明白 `GPUDevice` 的作用：

现在我们想在 3D 场景中绘制一个三角形，那么我们需要三角形的三个顶点的坐标信息。

对于顶点位置，我们可以在 javascript 中创建一个数组来存储：

```javascript
const vertices = [-0.5, -0.5, 0.0, 0.5, -0.5, 0.0, 0.0, 0.5, 0.0];
```

但是 `vertices` 是存储在 CPU 内存中的，我们需要将它传输到 GPU 内存中，才能被 GPU 访问和使用。那么怎样将数据传输到 GPU 内存中呢？这就需要使用到 `GPUDevice` 。

将图像渲染所需要的数据传输到 GPU 内存中是 `GPUDevice` 的核心功能之一。

现在你应该明白 `GPUDevice` 的作用了。

目前我们已经成功创建和配置了 WebGPU 运行时环境。接下来我们将创建一个 `Canvas` 并绑定 `GPUDevice` 。

```html
<canvas height="150" width="300"></canvas>
```

```javascript
const canvas = document.querySelector("canvas");
const context = canvas.getContext("webgpu");
const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
context.configure({
    device,
    format: presentationFormat,
});
```

我们从画布中获取一个 “webgpu” 上下文。我们会询问系统首选的画布格式是什。可能是 `rgba8unorm` 或 `bgra8unorm`。合适的选择可以让用户的系统以最快的速度运行。

::: tip rgba8unorm vs bgra8unorm
`rgba8unorm` 和 `bgra8unorm` 都是 8 位无符号整数格式，每个分量占用 8 位，取值范围是 0 到 255。它们的主要区别在于颜色分量的排列顺序。

- `rgba8unorm`：红色(R)、绿色(G)、蓝色(B)、透明度(A) 分量按此顺序排列。
- `bgra8unorm`：蓝色(B)、绿色(G)、红色(R)、透明度(A) 分量按此顺序排列。

不同的 GPU 架构可能对不同的格式有不同的性能表现，因此选择合适的格式可以提高渲染性能。

另外 `unorm` 中的 `u` 表示无符号整数格式，`norm` 表示归一化，即将 0-255 的取值范围映射到 0-1。
:::

然后我们通过调用 `configure` 将 `format` 传入 webgpu 画布上下文。我们还将 `device` 传入画布，从而将画布与我们刚刚创建的设备关联起来。

现在我们已经做好了准备工作。在开始写示例之前，建议先通读一遍[图形渲染流程](/WebGPU/graphicsRendering)这一章，建立从顶点到像素的整体直觉。

## 渲染管线

在一个工厂中，我们可以将原材料输送到车间流水线，经过流水线各个站点的加工后，最终产出产品。

在 WebGPU 中，渲染管线就像一个工厂中的车间流水线。它将顶点数据作为输入，经过一系列的处理和转换，最终输出渲染到屏幕上的像素。

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

现在我们使用 `GPUDevice` 创建了一个渲染管线 `GPURenderPipeline` 。 `label` 是一个可选参数，用于给渲染管线起一个名字。这里我们将它设置为 “triangle pipeline”。

`layout` 是一个可选参数，用于指定渲染管线的布局。这里我们将它设置为 “auto”，表示让 WebGPU 自动选择布局。实际上，我们也可以手动指定布局，但是手动指定布局需要我们对 WebGPU 的布局系统有一定的了解，这里我们先不展开。

`vertex` 和 `fragment` 用来**配置**上一章[图形渲染流程](/WebGPU/graphicsRendering)的顶点着色器和片元着色器。

`module` 是一个 `GPUShaderModule` 对象，用于存储 WGSL(WebGPU Shader Language)着色器代码。我们稍后会创建 `module` ，并在其中定义顶点着色器和片元着色器。

`entryPoint` 是一个可选参数，用于指定着色器模块中的入口函数。这里我们将它设置为 “vs” 和 “fs”，表示顶点着色器和片元着色器的入口函数分别是 “vs” 和 “fs”。

`targets` 定义片元着色器（Fragment Shader）最终要把颜色输出到哪里、以及输出的格式和规则 的核心配置项。

你可以把它想象成：片元着色器是 “画师”，`targets` 就是告诉画师 “要把画（颜色）画在哪个画布上、画布支持什么颜色格式、需不需要混合 / 透明效果”。

这里我们将 `format` 传入，指定输出目标的颜色格式，并且必须和目标纹理的格式完全匹配，也就是我们在 `context.configure` 配置的 `format` ，否则会报错。

下一步我们来创建 `GPUShaderModule` 。

## 创建 GPUShaderModule

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
        // WGSL 片元着色器：输出 @location(0) 对应 targets[0]
        @fragment
        fn fs() -> @location(0) vec4f {
            return vec4f(1.0, 0.0, 0.0, 1.0);
        }
    `,
});
```

`module` 是一个 `GPUShaderModule` 对象，用于存储 WGSL（WebGPU Shader Language）着色器代码。 WGSL 是在 GPU 中运行的着色器语言，所以我们需要将 WGSL 代码以字符串的形式传入 `module` 中。

`@vertex` 和 `@fragment` 是 WGSL 中的装饰器（Decorator），用于标记顶点着色器函数。 上面的 `vs` 函数就是一个顶点着色器入口函数，上面的 `fs` 函数就是一个片元着色器入口函数。

**vs 函数**

上一章的渲染流程中，我们说过，渲染一个三角形，需要输入三个顶点数据，顶点着色器会依次处理这三个顶点。上面代码中我们将这三个顶点数据存储在 `positions` 数组中，然后根据 `vertexIndex` 来返回对应的顶点数据。

什么是 `vertexIndex` 呢？请看下面的伪代码：

```js
[1,2,3].forEach(fn vs(_, vertexIndex) => {
  let positions = [
        [0.0, 0.5, 0.0, 1.0],
        [-0.5, -0.5, 0.0, 1.0],
        [0.5, -0.5, 0.0, 1.0],
    ];
    return positions[vertexIndex];
})
```

`vs` 函数会执行 3 次，`vertexIndex` 就是每次执行时的索引，分别是 0, 1, 2。

`@builtin(vertex_index) vertexIndex: u32`：

`@builtin(vertex_index)` 是 WGSL 中的一个内建变量（Built-in Variable），用于获取当前顶点的索引，我们给它命名为 `vertexIndex`。

`vertexIndex` 类型为 `u32` 32 位无符号整型。

`->` 表示 `vs` 函数的返回值类型为 `@builtin(position) vec4f`。`@builtin(position)` 是 WGSL 中的一个内建变量，用于指定顶点着色器的输出位置。

**vs 函数总结**

本例的 `vs` 函数的作用仅仅只是将三角形的三个顶点数据硬编码到 WGSL 代码中。然后根据 `vertexIndex` 来返回对应的顶点数据到对应的内建变量中。

**fs 函数**

上一章的渲染流程中，我们说过片元着色器对“每个片元”执行一次，用来计算最终写入颜色目标的值。

`fn fs() -> @location(0) vec4f {`：

`fs` 函数是一个片元着色器入口函数，它的返回值类型为 `@location(0) vec4f`。`@location(0)` 用于指定片元着色器的输出位置。

**fs 函数总结**

本例的 `fs` 函数的作用仅仅只是将每个片元的颜色设置为红色。

::: tip
`fs` 和 `vs` 函数的执行次数是不同的。`vs` 函数会对每个顶点执行一次，而 `fs` 函数会对每个片元执行一次。

`vec4f` 是 WGSL 中的一个向量类型，用于表示一个四维向量，既可以表示位置信息也可以表示颜色信息。

在 `fs` 函数中是一个 RGBA 颜色值，分别表示红色、绿色、蓝色、透明度。这里我们将它设置为红色，透明度为 1.0。

在 `vs` 函数中，分别表示顶点的位置坐标 x, y, z, w。x, y, z 分别表示顶点在 3 维空间中的位置坐标，w 表示顶点的齐次坐标。现在我们不需要知道 w 的含义，设置为 1 即可，只需要知道 x, y, z。
:::

::: tip
WGSL 代码中的 `vs` 函数对应 `pipeline` 中的 `vertex.entryPoint` 配置项。 `fs` 函数对应 `pipeline` 中的 `fragment.entryPoint` 配置项。

```js
const pipeline = device.createRenderPipeline({
  ...
  vertex: {
    module,
    entryPoint: "vs",
  },
  fragment: {
    module,
    entryPoint: "fs",
    targets: [{ format: presentationFormat }],
  },
  ...
});
```

一个 WGSL 代码中可以定义多个顶点着色器和多个片元着色器入口函数。如果你有多个顶点着色器和多个片元着色器入口函数，就需要手动指定 `entryPoint` 。

在本例中 `entryPoint` 可以省略，因为我们的 WGSL 代码中只有一个顶点着色器和一个片元着色器入口函数，所以 WebGPU 可以自动识别。
:::

## 绘制命令

上面的渲染管线只是配置了渲染流程。我们需要创建绘制命令（Draw Command）来告诉 GPU 如何绘制。

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
    // 如果 pipeline.targets 有第二个 target，那么这里也需要提供第二个 colorAttachment
});
passEncoder.setPipeline(pipeline);
passEncoder.draw(3);
passEncoder.end();
const commandBuffer = commandEncoder.finish();
device.queue.submit([commandBuffer]);
```

首先使用 `device.createCommandEncoder()` 创建一个命令编码器（Command Encoder）。命令编码器的作用是将渲染命令编码为 GPU 可以理解的指令序列。

然后使用 `commandEncoder.beginRenderPass()` 创建一个渲染通道编码器（Render Pass Encoder）。渲染通道编码器的作用是将渲染命令编码为渲染通道指令序列。

`passEncoder.setPipeline(pipeline)` 用于设置渲染通道编码器的渲染管线（Render Pipeline）。渲染管线是一个包含了渲染流程配置的对象，我们在前面已经创建了一个渲染管线 `pipeline`，现在需要将它设置到渲染通道编码器中。

`passEncoder.draw(3)` 用于绘制 3 个顶点。这里的 3 表示绘制执行 3 次，`vs` 函数执行 3 次。

`passEncoder.end()` 用于结束渲染通道编码器。

`commandEncoder.finish()` 用于将渲染通道编码器编码的指令序列提交给命令编码器。

`device.queue.submit([commandBuffer])` 用于将命令缓冲区（Command Buffer）提交给 GPU 队列（Queue）。队列是一个 FIFO（First-In-First-Out）队列，用于存储待执行的命令缓冲区。

提交命令缓冲区后，GPU 会按照队列中的顺序执行这些命令缓冲区。

我们需要重点关注的是 `colorAttachments` 数组：

```js
{
  view: context.getCurrentTexture().createView(),
  loadOp: "clear",
  clearValue: { r: 0, g: 1, b: 0, a: 1 },
  storeOp: "store",
}
```

`view` 用于指定渲染目标（Render Target），这里我们使用 `context.getCurrentTexture().createView()` 创建一个渲染目标视图（Render Target View）。

直接说“渲染目标视图”，你可能会感到困惑。我们来解释一下：

`context` WebGPU 上下文对象，`getCurrentTexture()` 方法用于获取一张**纹理**。现在你可以理解为获取了一张**图片**。该图片的尺寸和 canvas 的尺寸是一致的。

```html
<canvas width="400" height="300"></canvas>
// getCurrentTexture() 返回的图片尺寸是 400x300

<canvas width="1000" height="500"></canvas>
// getCurrentTexture() 返回的图片尺寸是 1000x500
```

`createView()` 方法用于创建一个渲染目标视图，渲染目标视图让 GPU 可以将渲染结果绘制到上面说的图片中。
::: info
createView 方法是可选的，也就是说：view 可以直接等于 context.getCurrentTexture()。
如果你写 `view = context.getCurrentTexture()`，那么 WebGPU 会在内部调用 `createView` 方法创建一个渲染目标视图。
:::

`loadOp` 用于指定渲染目标的加载操作（Load Operation），可选值有 `"clear"` 和 `"load"`。
这里我们设置为 `"clear"`，表示在绘制前将渲染目标清除为 `clearValue` 本例中为绿色。
`"load"` 表示在绘制前将渲染目标的内容加载到内存中。

`storeOp` 用于指定渲染目标的存储操作（Store Operation），可选值有 `"store"` 和 `"discard"`。
这里我们设置为 `"store"`，表示在绘制完成后将渲染目标的内容存储到内存中。
`"discard"` 表示在绘制完成后将渲染目标的内容丢弃，不存储到内存中。


::: tip
你应该注意到了`colorAttachments`、`pipeline.fragment.targets` 都是数组，并且我们只定义了第一个元素，实际上它们也是有关系的。

`pipeline.fragment.targets` 定义了渲染管线的“输出槽（output slots）”——也就是每个颜色输出的格式（format）、混合（blend）等状态；而在开始 render pass 时，`colorAttachments` 数组则把具体的纹理视（GPUTextureView）绑定到这些输出槽上。两者按索引一一对应。

在 WGSL 着色器程序中：

```wgsl
@fragment
fn fs() -> @location(0) vec4f {
    return vec4f(1.0, 0.0, 0.0, 1.0);
}
```

`@location(n)` 对应第 n 个输出槽（即 `pipeline.fragment.targets[n]`），render pass 中 `colorAttachments[n]` 则是该槽当前绑定的目标纹理视图。

更准确的说法是：`pipeline` 定义“槽”的格式和行为，render pass 的 `colorAttachments` 绑定“具体的画布/纹理”。
:::

## 在线编辑与预览

<WebGpuTrianglePlayground />

现在你可以在在线编辑区编辑代码，试着修改 `loadOp` 、`storeOp` 等参数然后点击“更新预览”按钮即可预览渲染结果。

另外，本列中的 canvas 的 width 和 height 分别是 `300` 和 `150`。

三角形的三个顶点是：

```wgsl
let positions = array(
    vec4f(0.0, 0.5, 0.0, 1.0),
    vec4f(-0.5, -0.5, 0.0, 1.0),
    vec4f(0.5, -0.5, 0.0, 1.0),
);
```

你应该发现了，在 WGSL 中我们定义顶点的时候没有使用像素，因为不管你的 canvas 的尺寸是多大，顶点的x、y都是归一化的，范围是 `[-1, 1]`。结合上一章的[标准化设备坐标](./graphicsRendering.md#标准化设备坐标)，你可以尝试修改 `positions` 数组中的值来改变三角形的位置。
