<script setup>
import TriangleGridCanvas from '../components/TriangleGridCanvas.vue'
</script>

# 基础知识

本文将向您介绍 WebGPU 的基础知识。

WebGPU 是一个应用程序接口，可让您做两件基本的事情。

1. 图形渲染，在 HTML Canvas 中显示图形。
2. 在GPU上执行计算。

## 图形渲染

图形渲染的目标是将三维空间中的点转换为二维屏幕上的像素。空间中的这些点称为顶点，我们至少需要指定每个顶点的位置。

WebGPU 只能够绘制点、线段和三角形，绘制一个点需要一个顶点，绘制一条线段需要两个顶点，绘制一个三角形需要3个顶点。值得一体的是一个复杂的形状是由多个三角形拼接而成的。

此外，我们还可以提供顶点的颜色、纹理坐标和法向量分量等信息。这些顶点数据称为属性数据。

对于初次接触图形编程的人来说，这可能有点令人困惑。下面用一个简单的绘制三角形到纹理的例子来展示如何使用 WebGPU 进行图形渲染。你会知道 WebGPU 进行图形渲染的流程。

### 绘制三角形

首先我们需要创建和配置 WebGPU。

这需要以下步骤：

1. 访问浏览器的 Navigator 以查看是否支持 WebGPU。
2. 如果支持 WebGPU，则使用 Navigator 获取 GPUAdapter。
3. 使用 GPUAdapter 获取 GPUDevice。

```javascript
const adapter = await navigator.gpu.requestAdapter();
const device = await adapter.requestDevice();
if (!device) {
    throw new Error('need a browser that supports WebGPU');
}
```

`navigator` 是浏览器提供的全局对象，用于访问浏览器的功能和信息。在 WebGPU 中，我们使用 `navigator.gpu` 来检查浏览器是否支持 WebGPU。
如果存在，gpu 属性提供了两个重要方法：

- `requestAdapter()`—返回一个 Promise，该 Promise 满足时会提供一个 GPUAdapter
- `getPreferredCanvasFormat()`—返回一个字符串，标识浏览器画布中图形的最佳格式

浏览器支持 WebGPU，并不意味着客户端的硬件支持 WebGPU 渲染和计算。这是因为：

1. **软件与硬件的差异**：浏览器可以在软件层面实现 WebGPU API，但实际的图形渲染和并行计算需要硬件（GPU）的支持。一些设备可能只有集成显卡或不支持现代 GPU 特性的老旧显卡。

2. **驱动程序兼容性**：即使硬件支持 WebGPU 功能，也需要相应的驱动程序版本。过时的驱动程序可能无法提供 WebGPU 所需的底层 API 支持。

3. **功能级别差异**：不同的 GPU 支持不同的功能级别。某些 GPU 可能支持基本的渲染功能，但不支持高级的计算着色器或特定的纹理格式。

4. **操作系统限制**：某些操作系统可能对 GPU 功能的访问有限制，或者需要特定的权限才能使用 WebGPU。

为了确保这些功能可用，应用程序需要通过调用 `navigator` 的 `gpu` 属性的 `requestAdapter` 方法来获取一个 `GPUAdapter`。

`requestAdapter()` 方法的作用是检查当前系统是否有可用的、兼容的 GPU 硬件，并返回一个代表该硬件的适配器对象。如果该方法返回 `null`，则表示虽然浏览器支持 WebGPU API，但系统没有可用的兼容硬件。

GPUDevice 是与客户端 GPU 的逻辑连接，在 WebGPU 开发中起着核心作用。

举一个简单的例子，让你大概明白 GPUDevice 的作用：

现在我们想在3D场景中绘制一个三角形，那么我们需要三角形的三个顶点的坐标信息。

对于顶点位置，我们可以在 javascript 中创建一个数组来存储：

```javascript
const vertices = [
    -0.5, -0.5, 0.0,
     0.5, -0.5, 0.0,
     0.0,  0.5, 0.0,
];
```

但是`vertices`是存储在CPU内存中的，我们需要将它传输到GPU内存中，才能被GPU访问和使用。那么怎样将数据传输到GPU内存中呢？这就需要使用到`GPUDevice`。

将图像渲染所需要的数据传输到GPU内存中是`GPUDevice`的核心功能之一。

现在你应该明白`GPUDevice`的作用了。

目前我们已经成功创建和配置了 WebGPU 运行时环境。接下来我们将创建一个`Canvas`并绑定 `GPUDevice`。

```javascript
const canvas = document.querySelector('canvas');
const context = canvas.getContext('webgpu');
const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
context.configure({
    device,
    format: presentationFormat,
});
```

我们从画布中获取一个 "webgpu" 上下文。我们会询问系统首选的画布格式是什。可能是 `rgba8unorm` 或 `bgra8unorm`。合适的选择可以让用户的系统以最快的速度运行。

::: tip rgba8unorm vs bgra8unorm
`rgba8unorm` 和 `bgra8unorm` 都是 8 位无符号整数格式，每个分量占用 8 位，取值范围是 0 到 255。它们的主要区别在于颜色分量的排列顺序。

- `rgba8unorm`：红色(R)、绿色(G)、蓝色(B)、透明度(A) 分量按此顺序排列。
- `bgra8unorm`：蓝色(B)、绿色(G)、红色(R)、透明度(A) 分量按此顺序排列。

不同的 GPU 架构可能对不同的格式有不同的性能表现，因此选择合适的格式可以提高渲染性能。

另外 `unorm` 中的 `u` 表示无符号整数格式，`norm` 表示归一化，即将0-255的取值范围映射到0-1。
:::

然后我们通过调用 `configure` 将 `format` 传入 webgpu 画布上下文。我们还将 `device` 传入画布，从而将画布与我们刚刚创建的设备关联起来。

现在我们已经做好了准备工作。在开始写第一个示例之前，建议先通读一遍“图形渲染流程”这一章，建立从顶点到像素的整体直觉：

[图形渲染流程](/WebGPU/graphicsRendering)





## Syntax Highlighting

VitePress provides Syntax Highlighting powered by [Shiki](https://github.com/shikijs/shiki), with additional features like line-highlighting:

**Input**

````md
```js{4}
export default {
  data () {
    return {
      msg: 'Highlighted!'
    }
  }
}
```
````

**Output**

```js{4}
export default {
  data () {
    return {
      msg: 'Highlighted!'
    }
  }
}
```

## Custom Containers

**Input**

```md
::: info
This is an info box.
:::

::: tip
This is a tip.
:::

::: warning
This is a warning.
:::

::: danger
This is a dangerous warning.
:::

::: details
This is a details block.
:::
```

**Output**

::: info
This is an info box.
:::

::: tip
This is a tip.
:::

::: warning
This is a warning.
:::

::: danger
This is a dangerous warning.
:::

::: details
This is a details block.
:::

## More

Check out the documentation for the [full list of markdown extensions](https://vitepress.dev/guide/markdown).
