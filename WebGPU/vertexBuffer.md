<script setup>
import WebGpuVertexBufferPlayground from '../components/WebGpuVertexBufferPlayground.vue';
</script>

# 顶点缓冲区（Vertex Buffers）

本章节我们将基于上一章的[绘制一个三角形](/WebGPU/triangleExample)，把“在 WGSL 里硬编码三角形顶点”的方式，改造成使用**顶点缓冲区**从 JavaScript 把顶点数据传给 GPU。

你会在这一章掌握 3 个核心点：

1. 在 CPU 侧用 `Float32Array` 组织顶点数据
2. 用 `device.createBuffer` 创建 `GPUBuffer`，并把数据写入 GPU
3. 在 `createRenderPipeline` 里描述顶点数据布局，并在绘制前调用 `passEncoder.setVertexBuffer(...)` 绑定

## 顶点数据长什么样

绘制一个三角形，我们至少需要每个顶点的位置（position）。这里我们只传 position，且每个 position 由两个32位浮点数（`f32`）组成：`x, y`。

三角形 3 个顶点：

```js
// 3 vertices * 2 floats (x, y)
const vertexData = new Float32Array([
    0.0, 0.5, // vertex 0
    -0.5, -0.5, // vertex 1
    0.5, -0.5, // vertex 2
]);
```

::: tip 什么是 `Float32Array`
`Float32Array` 是 JavaScript 中的一种类型化数组，用于存储 32 位浮点数。`Float32Array` 的每个元素都是 4 字节的浮点数。

为什么我们要使用 `Float32Array`？

因为 WebGPU 要求顶点数据以**字节**为单位传输，而 `Float32Array` 是最直接的方式，它能确保数据以 4 字节的浮点数格式存储在内存中，与 GPU 的期望格式一致。

如果你想了解更多关于 `Float32Array` 的知识，可以参考 [MDN 文档](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Float32Array)。
:::

## 创建并写入 GPUBuffer

顶点数组在 CPU 内存里，GPU 不能直接访问。我们需要创建一个 `GPUBuffer`，并使用 `device.queue.writeBuffer` 把 `vertexData` 写入进去。

`device.queue.writeBuffer` 是 WebGPU 中用于将数据从 CPU 内存复制到 GPU 内存的方法。它接受以下参数：

- `buffer`: 要写入的 GPUBuffer
- `bufferOffset`: 缓冲区中的偏移量（以字节为单位），我们可以在一个大的 buffer 中存多种数据，所以可以在 buffer 的什么位置开始写入数据。
- `data`: 要写入的数据（可以是 ArrayBuffer、ArrayBufferView 或 ArrayBufferLike）
- `dataOffset`: 数据中的偏移量（以字节为单位），默认是 0。同样我们提供的数据也可以是多种数据的结合体，我们可以选择将数据的一部分传到 buffer。
- `size`: 要写入的字节数，默认是 data 的长度

```js
const vertexBuffer = device.createBuffer({
    label: "triangle vertex buffer",
    size: vertexData.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
});

device.queue.writeBuffer(vertexBuffer, 0, vertexData);
```

这里有两个细节值得强调：

1. `size` 以**字节**为单位，所以用 `vertexData.byteLength`
2. `usage` 里必须包含 `GPUBufferUsage.VERTEX`，表示它会作为顶点输入使用；我们用 `queue.writeBuffer` 将数据（`vertexData`）写入到 GPUBuffer，所以还需要 `GPUBufferUsage.COPY_DST`，DST 是 Destination 的缩写。

## 用 WGSL 接收顶点输入

上一章的顶点着色器靠 `@builtin(vertex_index)` 在 WGSL 内部查表得到位置。现在我们希望顶点着色器的输入直接来自 vertex buffer。

```js
const module = device.createShaderModule({ 
    label: "vertex buffer shader module",
    code: `
        @vertex
        fn vs(@location(0) position: vec2f) -> @builtin(position) vec4f {
            return vec4f(position, 0.0, 1.0);
        }

        @fragment
        fn fs() -> @location(0) vec4f {
            return vec4f(1.0, 0.0, 0.0, 1.0);
        }
    `,
});
```

`vs` 函数的 `@location(0) position: vec2f` 表示：顶点输入的第 0 个 attribute（你也可以理解为第 0 个“插槽”）会被当作 `vec2f position` 读入。

attribute 在 pipeline 的 `vertex.buffers` 中进行配置。


接下来就要在 pipeline 里告诉 WebGPU：你的 vertex buffer 里，每个顶点的字节布局到底是什么样的。

## 在渲染管线中描述顶点布局

`createRenderPipeline` 的 `vertex.buffers` 用来描述“顶点缓冲区的布局”。

我们当前的布局非常简单：每个顶点只有 `x, y` 两个 `f32`。

- 每个 `f32` 4 字节
- 每个顶点 2 个 `f32`，所以一个顶点占 `2 * 4 = 8` 字节

这 8 字节就是 `arrayStride`，表示每个顶点在缓冲区中的字节跨度。

<img v-if="!isDark" alt="arrayStride" src="/webgpu/vertex-buffer-one.svg" />
<img v-else alt="arrayStride" src="/webgpu/vertex-buffer-one-dark.svg" />

```js
const pipeline = device.createRenderPipeline({
    label: "triangle pipeline (vertex buffer)",
    layout: "auto",
    vertex: {
        module,
        entryPoint: "vs",
        buffers: [
            {
                arrayStride: 2 * 4,
                attributes: [
                    {
                        shaderLocation: 0,
                        offset: 0,
                        format: "float32x2",
                    },
                ],
            },
        ],
    },
    fragment: {
        module,
        entryPoint: "fs",
        targets: [{ format: presentationFormat }],
    },
});
```

这一段最关键的是 `buffers[0].attributes[0]`：

- `shaderLocation: 0`
    - 对应 WGSL 里的 `vs` 函数的 `@location(0)`
- `format: "float32x2"`
    - 表示每个顶点在这个 attribute 上，连续读取两个 `f32`
- `offset: 0`
    - 表示该 attribute 从顶点数据的起始处开始读

也就是说：WebGPU 在取第 `i` 个顶点时，会在 buffer 中跳到 `i * arrayStride + offset` 的位置，按 `format` 解释数据，并把它填充到着色器的 `@location(shaderLocation)` 上。

`format` 字段可以是以下类型之一
| Vertex format | Data type | Components | Byte size | Example WGSL type |
| --- | --- | --- | --- | --- |
| `uint8x2` | unsigned int | 2 | 2 | `vec2<u32>`, `vec2u` |
| `uint8x4` | unsigned int | 4 | 4 | `vec4<u32>`, `vec4u` |
| `sint8x2` | signed int | 2 | 2 | `vec2<i32>`, `vec2i` |
| `sint8x4` | signed int | 4 | 4 | `vec4<i32>`, `vec4i` |
| `unorm8x2` | unsigned normalized | 2 | 2 | `vec2<f32>`, `vec2f` |
| `unorm8x4` | unsigned normalized | 4 | 4 | `vec4<f32>`, `vec4f` |
| `snorm8x2` | signed normalized | 2 | 2 | `vec2<f32>`, `vec2f` |
| `snorm8x4` | signed normalized | 4 | 4 | `vec4<f32>`, `vec4f` |
| `uint16x2` | unsigned int | 2 | 4 | `vec2<u32>`, `vec2u` |
| `uint16x4` | unsigned int | 4 | 8 | `vec4<u32>`, `vec4u` |
| `sint16x2` | signed int | 2 | 4 | `vec2<i32>`, `vec2i` |
| `sint16x4` | signed int | 4 | 8 | `vec4<i32>`, `vec4i` |
| `unorm16x2` | unsigned normalized | 2 | 4 | `vec2<f32>`, `vec2f` |
| `unorm16x4` | unsigned normalized | 4 | 8 | `vec4<f32>`, `vec4f` |
| `snorm16x2` | signed normalized | 2 | 4 | `vec2<f32>`, `vec2f` |
| `snorm16x4` | signed normalized | 4 | 8 | `vec4<f32>`, `vec4f` |
| `float16x2` | float | 2 | 4 | `vec2<f16>`, `vec2h` |
| `float16x4` | float | 4 | 8 | `vec4<f16>`, `vec4h` |
| `float32` | float | 1 | 4 | `f32` |
| `float32x2` | float | 2 | 8 | `vec2<f32>`, `vec2f` |
| `float32x3` | float | 3 | 12 | `vec3<f32>`, `vec3f` |
| `float32x4` | float | 4 | 16 | `vec4<f32>`, `vec4f` |
| `uint32` | unsigned int | 1 | 4 | `u32` |
| `uint32x2` | unsigned int | 2 | 8 | `vec2<u32>`, `vec2u` |
| `uint32x3` | unsigned int | 3 | 12 | `vec3<u32>`, `vec3u` |
| `uint32x4` | unsigned int | 4 | 16 | `vec4<u32>`, `vec4u` |
| `sint32` | signed int | 1 | 4 | `i32` |
| `sint32x2` | signed int | 2 | 8 | `vec2<i32>`, `vec2i` |
| `sint32x3` | signed int | 3 | 12 | `vec3<i32>`, `vec3i` |
| `sint32x4` | signed int | 4 | 16 | `vec4<i32>`, `vec4i` |

## 绘制命令：绑定顶点缓冲区

有了 pipeline 和 vertexBuffer，绘制时需要在 `draw` 前调用 `setVertexBuffer` 绑定。

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
passEncoder.setVertexBuffer(0, vertexBuffer);
passEncoder.draw(3);
passEncoder.end();

const commandBuffer = commandEncoder.finish();
device.queue.submit([commandBuffer]);
```

`setVertexBuffer(0, vertexBuffer)` 的第一个参数 `0` 表示：把这个 buffer 绑定到 `vertex.buffers[0]` 这一槽位上。

到这里为止，我们已经完成了从“WGSL 硬编码顶点”到“通过 vertex buffer 提供顶点”的迁移。

## 在线编辑与预览

<WebGpuVertexBufferPlayground />

现在你可以在在线编辑区修改 `vertexData`，或者尝试：

1. 把每个顶点从 2D 扩展成 3D（`x, y, z`），并同步修改 `arrayStride / format / WGSL`
2. 为顶点增加颜色 attribute（例如 `position + color` 交错存储），并在片元着色器里输出颜色
