<script setup>
import WebGpuVertexBufferPlayground from '../components/WebGpuVertexBufferPlayground.vue';
</script>

# 顶点缓冲区（Vertex Buffers）

上一章里，我们直接把三角形的 3 个顶点写死在 WGSL 中。那种写法很适合入门，但它有一个明显问题：

> **顶点数据被写在着色器里，JavaScript 无法灵活地替换它。**

真实的渲染程序通常会把顶点坐标、颜色、法线、纹理坐标等数据先组织在 JavaScript 中，再通过 **vertex buffer** 传给 GPU。  
这一章要做的，就是把“着色器里硬编码顶点”升级成“从缓冲区读取顶点”。

你会掌握 3 个核心点：

1. 在 JavaScript 中组织顶点数据
2. 创建 `GPUBuffer` 并把数据写入 GPU
3. 在 pipeline 里描述这块 buffer 的布局，让顶点着色器正确读取

## 顶点缓冲区是什么

你可以先把 buffer 理解为一段可以交给 GPU 读取的内存区域。  
在图形渲染里，最常见的几类缓冲区是：

- **vertex buffer**：存每个顶点的数据，比如坐标、颜色
- **index buffer**：存顶点访问顺序
- **uniform / storage buffer**：存着色器读取的其他数据

这一章我们只处理最简单的一种：**vertex buffer**。

## 第一步：在 JavaScript 中准备顶点数据

我们还是画一个三角形，只不过这次把每个顶点的位置放到 `Float32Array` 里。

每个顶点只包含两个分量：

- `x`
- `y`

所以 3 个顶点的数据可以写成：

```js
const vertexData = new Float32Array([
    0.0, 0.5,   // vertex 0
    -0.5, -0.5, // vertex 1
    0.5, -0.5,  // vertex 2
]);
```

这里用 `Float32Array` 的原因很直接：

- 每个 `f32` 正好占 4 字节
- GPU 读取这类浮点顶点数据很自然
- `vertexData.byteLength` 能直接告诉我们这段数据一共占多少字节

在这个例子里：

- 每个顶点有 2 个 `f32`
- 每个 `f32` 占 4 字节
- 所以每个顶点占 `2 × 4 = 8` 字节

## 第二步：创建 `GPUBuffer`

JavaScript 里的 `Float32Array` 在 CPU 内存中，GPU 不能直接把它当成顶点输入来读。  
我们需要创建一个 `GPUBuffer`：

```js
const vertexBuffer = device.createBuffer({
    label: "triangle vertex buffer",
    size: vertexData.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
});
```

这里最重要的是两个字段：

### `size`

`size` 的单位是**字节**，所以要写：

```js
size: vertexData.byteLength
```

而不是元素个数。

### `usage`

`usage` 告诉 WebGPU：这块 buffer 会被拿来做什么。

```js
GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
```

表示：

- `VERTEX`：它会作为顶点缓冲区使用
- `COPY_DST`：我们会把数据拷贝到它里面

`usage` 是一个按位组合的标志集合，所以这里用 `|` 把两种用途拼在一起。

## 第三步：把数据写进 buffer

有了 `GPUBuffer` 之后，再把 `vertexData` 写进去：

```js
device.queue.writeBuffer(vertexBuffer, 0, vertexData);
```

这行代码做的事情很简单：

- 把 `vertexData` 的内容
- 从第 0 个字节开始
- 复制到 `vertexBuffer`

对于本章这样的简单例子，记住这个最常见写法就够了。

## 第四步：让 WGSL 接收顶点输入

上一章的顶点着色器靠 `@builtin(vertex_index)` 去数组里查顶点。  
现在我们希望顶点位置直接来自 vertex buffer，因此 WGSL 要改成这样：

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

这里的关键是：

```wgsl
@location(0) position: vec2f
```

意思是：

- 顶点着色器要从 **location 0**
- 读入一个 `vec2f`
- 把它命名为 `position`

但仅仅写这行还不够。  
WGSL 只说了“我想读一个 `vec2f`”，至于这个 `vec2f` 在 buffer 里从哪里开始、占多少字节，还得由 pipeline 告诉 GPU。

## 第五步：在 pipeline 中描述顶点布局

这一步是 vertex buffer 的核心。

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

这一段告诉 WebGPU：**如何把一串原始字节解释成顶点属性。**

### `arrayStride`

```js
arrayStride: 2 * 4
```

表示相邻两个顶点之间的字节跨度是 8。

也就是说：

- 第 0 个顶点从字节 0 开始
- 第 1 个顶点从字节 8 开始
- 第 2 个顶点从字节 16 开始

<img v-if="!isDark" alt="arrayStride" src="/webgpu/vertex-buffer-one.svg" />
<img v-else alt="arrayStride" src="/webgpu/vertex-buffer-one-dark.svg" />

### `attributes`

`attributes` 描述“一个顶点内部有哪些属性”。

本例中只有一个属性：

```js
{
    shaderLocation: 0,
    offset: 0,
    format: "float32x2",
}
```

分别表示：

- `shaderLocation: 0`
  - 对应 WGSL 中的 `@location(0)`

- `offset: 0`
  - 表示这个属性从每个顶点的起始位置开始读取

- `format: "float32x2"`
  - 表示读取两个连续的 `f32`
  - 因此 WGSL 中应当用 `vec2f`

所以本例的读取规则可以直接理解为：

> 每次读取一个顶点时，从该顶点起始字节开始，取两个 `f32`，送给 `@location(0)`。

如果把它写成公式，就是：

```txt
第 i 个顶点的 attribute 地址 = i * arrayStride + offset
```

## `format` 要和 WGSL 类型匹配

本章最常见的一组搭配是：

| `format` | 每个顶点读取内容 | 对应 WGSL 类型 |
| --- | --- | --- |
| `float32x2` | 2 个 `f32` | `vec2f` |
| `float32x3` | 3 个 `f32` | `vec3f` |
| `float32x4` | 4 个 `f32` | `vec4f` |
| `float32` | 1 个 `f32` | `f32` |

后面做颜色、法线或压缩格式时，你还会见到像 `unorm8x4` 这样的格式。  
但对这一章来说，只要先把 `float32x2 ↔ vec2f` 这组关系记牢就够了。

## 第六步：绑定 vertex buffer 并绘制

前面的步骤只是定义“数据长什么样”。  
真正绘制时，还要把 `vertexBuffer` 绑定到 render pass：

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

关键新增的是这一句：

```js
passEncoder.setVertexBuffer(0, vertexBuffer);
```

这里的 `0` 表示：

- 把这块 buffer 绑定到第 0 个顶点缓冲槽位
- 它对应 `vertex.buffers[0]`

于是当 `draw(3)` 执行时，WebGPU 就会：

1. 从 `vertexBuffer` 中读取第 0、1、2 个顶点
2. 按 `arrayStride / offset / format` 解释数据
3. 把结果传给顶点着色器的 `@location(0) position`

到这一步，我们就完成了从“WGSL 硬编码顶点”到“通过 vertex buffer 提供顶点”的迁移。

## 这一章最重要的一句话

如果只记一句话，请记这句：

> **vertex buffer 存的是原始字节，而 pipeline 负责说明这些字节应该怎样被解释成顶点属性。**

这正是 WebGPU 里“数据”和“解释规则”分离的一个典型例子。

## 在线编辑与预览

<WebGpuVertexBufferPlayground />

现在你可以在在线编辑区直接修改 `vertexData`，建议优先尝试：

1. 改变三个顶点的位置，观察三角形形状变化
2. 把每个顶点从 `vec2f` 扩展成 `vec3f`，同步修改 `format` 和 WGSL
3. 继续为顶点增加颜色属性，为下一章的 inter-stage 做准备
