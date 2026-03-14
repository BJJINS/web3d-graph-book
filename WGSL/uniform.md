# Uniform

在 WebGPU 里，不是所有数据都会“每个顶点都变一次”或者“每个片元都变一次”。  
有一类数据更适合这样理解：

- 这一批顶点都会用到它
- 这一批片元也可能都会用到它
- 在一次绘制过程中，它通常保持不变

这类数据最适合放进 **uniform buffer**。  
而在 WGSL 里，对这类数据最常见的访问方式就是：

```wgsl
@group(0) @binding(0) var<uniform> camera: CameraUniform;
```

如果把[顶点缓冲](../WebGPU/vertexBuffer.md)看成“每个顶点各带一份数据”，那么 uniform 更像是“这一批着色器执行共同读取的一份只读参数”。

## 先建立一个直觉：uniform 是“共享的只读参数”

最容易理解 uniform 的方式，是先和顶点数据对比。

顶点缓冲里的位置、颜色、法线这类数据，通常是**逐顶点变化**的。  
但有些数据并不需要每个顶点重复存一遍，例如：

- 当前物体的变换矩阵
- 相机矩阵
- 时间参数
- 屏幕尺寸
- 某个材质的统一颜色因子

这些值在一次 draw 中通常不会对每个顶点都不同。  
如果你把它们硬塞进顶点缓冲，就会出现很多无意义的重复。

所以 uniform 的核心用途可以先记成一句话：

> **把一批着色器执行都会反复读取、但不会逐顶点变化的参数，集中放到一块只读缓冲里。**

## 为什么不用顶点缓冲来装这些数据

例如，你想让一个正方形整体旋转。  
正方形的 4 个顶点坐标当然还是要放在顶点缓冲里，但“旋转规则”其实对 4 个顶点都一样。

这时更自然的做法是：

- 顶点缓冲提供每个顶点原始坐标
- uniform 提供一份大家共用的矩阵
- 顶点着色器把两者结合起来，算出变换后的位置

如果把同一份矩阵复制到每个顶点里：

- 数据会重复
- buffer 会变大
- 可读性也更差

因此，**逐顶点变化的数据放顶点缓冲，共享只读参数放 uniform**，这是一条非常重要的分工原则。

## uniform 在 WGSL 里长什么样

WGSL 中最常见的 uniform 声明有两种写法。

### 直接把 uniform 当成一个矩阵

```wgsl
@group(0) @binding(0) var<uniform> rotMat: mat4x4f;
```

这表示：

- 它属于第 `0` 个 bind group
- 它在这个 bind group 里的 binding 编号是 `0`
- 它来自 `uniform` 地址空间
- 着色器把它当成一个 `mat4x4f` 来读

### 把 uniform 定义成结构体

实际项目里，更常见的是把多个相关参数打包进 `struct`：

```wgsl
struct CameraUniform {
    viewProj: mat4x4f,
    time: f32,
    exposure: f32,
};

@group(0) @binding(0) var<uniform> camera: CameraUniform;
```

这样做的好处是很明显的：

- 语义更清楚
- 相关数据放在一起
- 后续扩展更方便

不过只要 uniform 里开始出现结构体成员，就一定要留意[数据内存布局](./dataMemoryLayout.md)，因为 CPU 侧写入 buffer 时必须和 WGSL 的布局规则一致。

还有一个很重要的规则：

> **这类 `@group(...) @binding(...) var<uniform> ...` 资源变量，通常要声明在模块顶层，而不是函数内部。**

因为它不是某次函数调用临时创建的局部值，而是着色器模块对外部 GPU 资源的访问入口。

## `@group(...)` 和 `@binding(...)` 到底在说什么

这两个属性常常是刚接触 uniform 时最容易混淆的地方。

可以把它们拆开理解：

- `@group(n)`：这个资源属于第几个 bind group
- `@binding(n)`：这个资源在该 bind group 里是第几个绑定槽位

例如：

```wgsl
@group(0) @binding(0) var<uniform> camera: CameraUniform;
```

它表达的不是“位置输入槽位”，而是：

- 到第 0 组资源里找
- 再到其中的 binding 0 找
- 把那里那块 uniform buffer 数据按 `CameraUniform` 的结构来解释

这和[顶点着色器](./vertexShader.md)里 `@location(...)` 的含义完全不同：

- `@location(...)` 主要连接顶点输入或跨阶段变量
- `@group(...) + @binding(...)` 主要连接 buffer / texture / sampler 这类资源

::: tip 可以这样区分
如果你看到的是 `@location(...)`，大概率是在说“值从哪个输入/输出槽位走”。  
如果你看到的是 `@group(...)` 和 `@binding(...)`，大概率是在说“资源从哪里取”。
:::

## uniform 最常见的用途：给顶点着色器提供变换矩阵

uniform 和几何变换几乎是天然搭档。

看一个最常见的例子：

```wgsl
@group(0) @binding(0) var<uniform> rotMat: mat4x4f;

@vertex
fn vsMain(@location(0) coords: vec2f) -> @builtin(position) vec4f {
    return rotMat * vec4f(coords, 0.0, 1.0);
}
```

这里发生了三件事：

1. 顶点缓冲提供二维顶点坐标 `coords`
2. uniform 提供一份统一的旋转矩阵 `rotMat`
3. 顶点着色器把顶点扩成 `vec4f`，再用矩阵做乘法，得到变换后的位置

这就是 uniform 在图形程序里最常见的工作方式之一。

### 为什么这里要把 `vec2f` 扩成 `vec4f`

因为图形渲染里常见的变换矩阵通常是 `4x4`。  
因此，一个二维或三维位置在参与这类矩阵运算前，往往会被扩展成四维向量。

在入门阶段，你先把它记成：

- `x`、`y` 来自原始坐标
- `z` 先补成 `0.0`
- `w` 常写成 `1.0`

至于为什么 4x4 矩阵能够统一处理平移、旋转、缩放这些变换，这部分原理你后面会在计算机图形学章节里系统展开；在这里，我们只需要先理解 **uniform 经常是这些变换参数的承载者**。

## uniform 不只给顶点阶段用，片元阶段也能读

虽然 uniform 最常见的入门示例是“给[顶点着色器](./vertexShader.md)传矩阵”，但它并不只服务于顶点阶段。  
[片元着色器](./fragmentShader.md)同样可以读取 uniform。

例如，你可以把一些统一材质参数放进去：

```wgsl
struct MaterialUniform {
    tint: vec4f,
};

@group(0) @binding(1) var<uniform> material: MaterialUniform;

@fragment
fn fsMain() -> @location(0) vec4f {
    return material.tint;
}
```

这种用法也很常见，因为很多材质参数本来就是“整批片元共享同一份数据”：

- 基础颜色因子
- 曝光参数
- 某些后处理开关
- 屏幕相关常量

所以从阶段角度看，你可以这样记：

- 顶点阶段常把 uniform 当成“变换参数”
- 片元阶段常把 uniform 当成“统一外观参数”

## 如何在 JavaScript 中使用 uniform

// todo！

## uniform 不是拿来装“大批量数据”的

uniform buffer 的容量通常比 storage buffer 更保守。  
具体上限要看设备提供的 limits，而不是一成不变的固定值。

因此，uniform 更适合存这类内容：

- 少量矩阵
- 少量向量
- 若干标量参数
- 一小组共享配置

而不是：

- 大量粒子数据
- 超大的对象数组
- 需要频繁随机读写的大块数据

所以你可以把 uniform 理解成：

> **轻量、共享、只读的参数通道。**

## 一个更贴近真实使用的例子

很多时候，我们不会只传一个矩阵，而是把相关参数放进结构体：

```wgsl
struct TransformUniform {
    model: mat4x4f,
    viewProj: mat4x4f,
};

@group(0) @binding(0) var<uniform> transform: TransformUniform;

@vertex
fn vsMain(@location(0) position: vec3f) -> @builtin(position) vec4f {
    let worldPos = transform.model * vec4f(position, 1.0);
    return transform.viewProj * worldPos;
}
```

这段代码非常典型：

- `model` 负责把模型坐标变到世界空间
- `viewProj` 负责再把它送到后续渲染需要的位置空间

你现在不需要把这些变换原理全部吃透，只需要先抓住一点：

**uniform 经常就是这些“统一变换参数”的容器。**

## 使用 uniform 时，最容易踩的坑

### 1. 把 `@group/@binding` 和 `@location` 混为一谈

这是最常见的错误之一。

- `@location(...)` 不是拿来声明 uniform 的
- uniform 一般通过 `@group(...) @binding(...)` 访问

### 2. 忘记 uniform 是只读的

`var<uniform>` 的数据是给着色器读取的，不是让你在着色器里随便改的。

### 3. CPU 侧写入的数据布局和 WGSL 不一致

这在 uniform 里非常常见，尤其是结构体里混合了：

- `f32`
- `vec3f`
- `mat4x4f`

这些类型时，很容易因为对齐和 padding 出错。  
这一类问题建议和[数据内存布局](./dataMemoryLayout.md)一起看。

### 4. 忘了给 buffer 加 `COPY_DST`

如果创建 buffer 时没加：

```js
GPUBufferUsage.COPY_DST
```

后面就没法直接用 `queue.writeBuffer(...)` 把数据写进去。

### 5. `@group(...)`、`@binding(...)` 和 JS 侧编号对不上

例如 WGSL 写的是：

```wgsl
@group(0) @binding(1)
```

但 JavaScript 侧实际创建 bind group 时资源却绑定在 `binding: 0`，那着色器就会读不到你以为的那块数据。

### 6. 手写矩阵时顺序想错

WGSL 矩阵常按列主序思考。  
如果你把矩阵值按错误顺序写进 `Float32Array`，最后的旋转、缩放或平移结果就会看起来“几乎对，但总是歪”。

## 可以这样记住 uniform

学 uniform 时，可以先把整件事压缩成这条主线：

1. CPU 侧准备一小块共享参数
2. 用 uniform buffer 把它交给 GPU
3. 用 bind group 把这块资源接到 pipeline 上
4. WGSL 通过 `@group(...) @binding(...) var<uniform> ...` 访问它
5. 顶点或片元着色器在执行时反复读取这份共享数据

当这条主线清楚以后，你就会发现 uniform 的角色非常稳定：

- 它不是逐顶点输入
- 它不是大批量存储容器
- 它是着色器共享读取参数的标准入口之一