<script setup>
import WebGpuTransformByUniformPlayground from '../components/WebGpuTransformByUniformPlayground.vue';
</script>

# 用 Uniform 传值，让三角形平移和缩放

这一章只讨论一件事：**怎样把一小块数据从 JavaScript 传到着色器里，并让它真正参与绘制。**

为了把重点放在“怎么用”上，这里**先不使用矩阵**，而是只传两个很直观的参数：

- 一个 `offset`：控制三角形平移多少
- 一个 `scale`：控制三角形缩放多少

如果你还不熟悉 uniform 是什么，可以先看：[Uniform](../WGSL/uniform.md)。  
这一章默认你已经知道：

- uniform 通过 `@group(...) @binding(...)` 访问
- JavaScript 侧要创建 uniform buffer 和 bind group

本章你会掌握 4 个关键动作：

1. 在 WGSL 中声明 uniform
2. 在 JavaScript 中准备 uniform 数据
3. 把 uniform buffer 绑定到 pipeline
4. 在顶点着色器里真正使用这些值

## 先说目标：把一个静止三角形变成“可平移、可缩放”的三角形

我们沿用前面[顶点缓冲区](./vertexBuffer.md)一章的思路，仍然从一个普通三角形出发。

原始顶点数据不变：

```js
const vertexData = new Float32Array([
    0.0, 0.5,
    -0.5, -0.5,
    0.5, -0.5,
]);
```

如果不做任何额外处理，顶点着色器通常只是直接返回它：

```wgsl
@vertex
fn vs(@location(0) position: vec2f) -> @builtin(position) vec4f {
    return vec4f(position, 0.0, 1.0);
}
```

现在我们要把它改成：

```text
先缩放
再平移
最后输出位置
```

也就是：

```wgsl
position * scale + offset
```

这个例子很简单，但它刚好能把 uniform 的完整使用链路串起来。

## 第一步：在 WGSL 里声明要读取的 uniform

为了不被复杂布局打断，这里把要传的数据控制在很小范围内：

- `offset`：`vec2f`
- `scale`：`f32`

对应的 WGSL 可以这样写：

```wgsl
struct TransformUniform {
    offset: vec2f,
    scale: f32,
    _padding: f32,
};

@group(0) @binding(0) var<uniform> transform: TransformUniform;
```

这里有一个你需要特别注意的小点：`_padding`。

它不是业务数据，只是为了让这一小块 uniform 数据在 CPU 和 GPU 两边都更容易按 **16 字节** 对齐来写。  
如果你对这件事的原因还不熟，可以回看：

- [uniform 布局要求](../WGSL/dataMemoryLayout.md#uniform-布局要求)

在本章里，你先把它理解成：

## 第二步：在顶点着色器里真正使用它

接着把顶点着色器改成下面这样：

```wgsl
struct TransformUniform {
    offset: vec2f,
    scale: f32,
    _padding: f32,
};

@group(0) @binding(0) var<uniform> transform: TransformUniform;

@vertex
fn vs(@location(0) position: vec2f) -> @builtin(position) vec4f {
    let moved = position * transform.scale + transform.offset;
    return vec4f(moved, 0.0, 1.0);
}

@fragment
fn fs() -> @location(0) vec4f {
    return vec4f(1.0, 0.3, 0.2, 1.0);
}
```

这里最关键的是这一行：

```wgsl
let moved = position * transform.scale + transform.offset;
```

它表达的意思很直接：

1. 先把顶点坐标按 `scale` 做统一缩放
2. 再把结果整体加上 `offset`

所以：

- `scale` 变小，三角形会缩小
- `scale` 变大，三角形会放大
- `offset.x` 改变，三角形左右移动
- `offset.y` 改变，三角形上下移动

::: tip 这行代码里的顺序是有意义的
`position * scale + offset` 和 `(position + offset) * scale` 的结果并不一样。

本章采用的是：

- 先围绕原点缩放
- 再整体平移

这种写法通常更容易得到直觉上的结果。
:::

## 第三步：在 JavaScript 中准备 uniform 数据

WGSL 已经声明好了 `TransformUniform`，接下来就要在 JavaScript 侧准备对应的数据。

```js
const uniformData = new Float32Array([
    0.25, 0.15, // offset.x, offset.y
    0.75, 0.0,  // scale, padding
]);
```

这 4 个浮点数分别表示：

- `0.25`：向右平移一点
- `0.15`：向上平移一点
- `0.75`：整体缩小到原来的 75%
- `0.0`：padding，占位用

这时你可以把 uniformData 理解成一小块“着色器参数包”：

| 索引 | 含义 |
| --- | --- |
| `0` | `offset.x` |
| `1` | `offset.y` |
| `2` | `scale` |
| `3` | padding |

## 第四步：创建 uniform buffer

有了 `uniformData` 之后，就可以创建 uniform buffer：

```js
const uniformBuffer = device.createBuffer({
    label: "triangle transform uniform buffer",
    size: uniformData.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
});
```

这里两个 usage 的作用分别是：

- `GPUBufferUsage.UNIFORM`
  - 说明这块 buffer 会被当成 uniform 使用

- `GPUBufferUsage.COPY_DST`
  - 说明后面允许把 `uniformData` 写进去

然后把数据真正写入 GPU：

```js
device.queue.writeBuffer(uniformBuffer, 0, uniformData);
```

到这里为止，数据已经进了 buffer，但**着色器还读不到它**。  
因为我们还没有把它接到 pipeline 上。

## 第五步：创建 render pipeline

这一步和前面三角形示例基本一致，重点还是 `layout: "auto"`：

```js
const pipeline = device.createRenderPipeline({
    layout: "auto",
    vertex: {
        module,
        entryPoint: "vs",
        buffers: [
            {
                arrayStride: 8,
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

这里不再展开顶点缓冲布局本身；如果你对 `arrayStride`、`shaderLocation`、`float32x2` 这些还不够熟，建议先看：

- [绘制一个三角形](./triangleExample.md)
- [顶点缓冲区](./vertexBuffer.md)

这一章真正新增的重点，是下面的 bind group。

## 第六步：创建 bind group，把 uniform buffer 接进来

因为 WGSL 里写的是：

```wgsl
@group(0) @binding(0) var<uniform> transform: TransformUniform;
```

所以 JavaScript 侧也必须按同样的编号来接。

先拿到 pipeline 自动推导出来的 bind group layout：

```js
const bindGroupLayout = pipeline.getBindGroupLayout(0);
```

然后创建 bind group：

```js
const bindGroup = device.createBindGroup({
    layout: bindGroupLayout,
    entries: [
        {
            binding: 0,
            resource: { buffer: uniformBuffer },
        },
    ],
});
```

这里最重要的对应关系是：

| WGSL | JavaScript |
| --- | --- |
| `@group(0)` | `setBindGroup(0, ...)` |
| `@binding(0)` | `entries` 中的 `binding: 0` |
| `var<uniform> transform` | `resource: { buffer: uniformBuffer }` |

只要这三层对得上，着色器就能在运行时读到我们传进去的值。

## 第七步：在 render pass 中设置 bind group

创建完 bind group 之后，还要在 render pass 里显式设置它：

```js
passEncoder.setPipeline(pipeline);
passEncoder.setVertexBuffer(0, vertexBuffer);
passEncoder.setBindGroup(0, bindGroup);
passEncoder.draw(3);
```

其中最容易忘的是这一行：

```js
passEncoder.setBindGroup(0, bindGroup);
```

如果少了它，即使你前面：

- 创建了 uniform buffer
- 写入了 uniformData
- 创建了 bindGroup

着色器依然不会真正拿到这份 uniform 数据。

## 把关键代码拼起来看一次

如果把和 uniform 相关的核心部分抽出来，大致就是下面这样：

```js
const module = device.createShaderModule({
    code: `
        struct TransformUniform {
            offset: vec2f,
            scale: f32,
            _padding: f32,
        };

        @group(0) @binding(0) var<uniform> transform: TransformUniform;

        @vertex
        fn vs(@location(0) position: vec2f) -> @builtin(position) vec4f {
            let moved = position * transform.scale + transform.offset;
            return vec4f(moved, 0.0, 1.0);
        }

        @fragment
        fn fs() -> @location(0) vec4f {
            return vec4f(1.0, 0.3, 0.2, 1.0);
        }
    `,
});

const uniformData = new Float32Array([
    0.25, 0.15,
    0.75, 0.0,
]);

const uniformBuffer = device.createBuffer({
    size: uniformData.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
});

device.queue.writeBuffer(uniformBuffer, 0, uniformData);

const pipeline = device.createRenderPipeline({
    layout: "auto",
    vertex: {
        module,
        entryPoint: "vs",
        buffers: [
            {
                arrayStride: 8,
                attributes: [
                    { shaderLocation: 0, offset: 0, format: "float32x2" },
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

const bindGroupLayout = pipeline.getBindGroupLayout(0);
const bindGroup = device.createBindGroup({
    layout: bindGroupLayout,
    entries: [
        {
            binding: 0,
            resource: { buffer: uniformBuffer },
        },
    ],
});

passEncoder.setPipeline(pipeline);
passEncoder.setVertexBuffer(0, vertexBuffer);
passEncoder.setBindGroup(0, bindGroup);
passEncoder.draw(3);
```

你会发现，uniform 真正新增的代码主要就集中在 4 个地方：

1. WGSL 的 `var<uniform>`
2. JavaScript 的 `uniformData`
3. `uniformBuffer`
4. `bindGroup`

## 如果你只改数值，会发生什么

这就是 uniform 很好用的地方：  
很多时候，你根本不用改着色器代码，只改传进去的数据就行。

例如：

### 向左移动一点

```js
const uniformData = new Float32Array([
    -0.2, 0.0,
    1.0, 0.0,
]);
```

### 放大一点

```js
const uniformData = new Float32Array([
    0.0, 0.0,
    1.2, 0.0,
]);
```

### 同时缩小并上移

```js
const uniformData = new Float32Array([
    0.0, 0.25,
    0.6, 0.0,
]);
```

所以你可以把 uniform 想成一种非常轻量的“调参入口”：

- shader 逻辑保持不变
- 外部参数改一下
- 图形结果立刻变化

## 在线编辑与预览

<WebGpuTransformByUniformPlayground />

你可以直接修改代码并观察结果。建议优先尝试：

1. 修改 `uniformData` 里的前两个值，观察三角形如何平移
2. 修改 `uniformData` 的第三个值，观察三角形如何缩放
3. 把 `position * transform.scale + transform.offset` 改成其他顺序，比较不同写法的结果
4. 修改 `fs` 返回值，确认片元颜色仍然可以单独控制

## 小结

这章其实只做了一件很重要的事：

> **把“写死在着色器里的参数”改成了“从 JavaScript 传进来的参数”。**

对于这个“平移 + 缩放三角形”的例子，最关键的链路是：

1. JavaScript 准备 `uniformData`
2. 创建 `uniformBuffer`
3. `writeBuffer(...)` 写入数据
4. 创建并设置 `bindGroup`
5. WGSL 在顶点着色器里读取 `transform`
6. 用 `position * scale + offset` 算出新位置

如果你已经理解了这条链路，后面把这个简单例子升级成：

- 用 uniform 传颜色
- 用 uniform 传时间
- 用 uniform 传矩阵

都会自然很多。
