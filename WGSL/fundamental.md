# WGSL 基础

WGSL 是 WebGPU 的着色器语言。JavaScript 负责准备数据、创建资源、提交命令；WGSL 负责告诉 GPU：**这些数据该怎样被计算**。

如果把 WebGPU 想成一条流水线，那么 WGSL 就像挂在流水线旁边的工艺卡：

- 输入是什么类型
- 每一步怎么计算
- 输出要写到哪里

它最大的特点不是“语法像不像某门传统语言”，而是：**强类型、偏数学、面向并行执行**。

这一章先不讨论复杂的绑定和完整渲染流程，而是把 WGSL 最常用的基础积木讲清楚：

- 变量与常量：`let`、`const`、`override`、`var`
- 标量、向量、矩阵这三组核心数值类型
- 最常用的内置运算符与数值函数
- 着色器中最常见的向量运算：`dot`、`cross`、`normalize`、`length` 等

读完后，你应该能比较从容地读懂下面这种 WGSL：

```wgsl
@group(0) @binding(0) var<uniform> camera: CameraUniform;

fn lambert(normal: vec3f, lightDir: vec3f) -> f32 {
    let n = normalize(normal);
    let l = normalize(lightDir);
    return max(dot(n, l), 0.0);
}
```

## 先建立一个直觉：WGSL 是强类型语言

在 JavaScript 里，很多值会在运行时自动转换；但 WGSL 不喜欢暧昧。它要求你尽可能明确地告诉编译器：

- 这是 `i32`、`u32` 还是 `f32`
- 这是一个标量，还是 `vec3f`
- 这是局部不可变值，还是一块真正可写的变量存储
- 这是普通常量，还是由 pipeline 在创建时覆写的 `override`

这会让代码看起来“更硬”，但回报也很直接：

- 类型错误更早暴露
- GPU 更容易高效执行
- buffer 与着色器之间的契约更清晰

::: tip 一个非常重要的习惯
在 WGSL 里，**“看起来都是数字”不代表它们能直接混算**。`i32`、`u32`、`f32` 之间不会像 JavaScript 那样随手帮你转换。必要时，请显式写出转换：

```wgsl
let count: u32 = 8u;
let width: f32 = f32(count) * 0.5;
```
:::

## 变量、值与存储：`let`、`const`、`override`、`var`

WGSL 里最容易混淆的一件事是：**并不是每个“名字”都表示同一种东西**。

有的名字只是一个不可变值绑定；有的名字是真正可读写的变量；有的名字甚至会在创建 pipeline 时才被外部设置。

先看一张总表：

| 关键字 | 是否可变 | 常见作用域 | 典型用途 |
| --- | --- | --- | --- |
| `let` | 否 | 函数内 | 局部中间值、一次性计算结果 |
| `const` | 否 | 模块级 / 函数内 | 编译期常量 |
| `override` | 否（但可被外部覆写） | 模块级 | pipeline 创建时注入的常量 |
| `var` | 是 | 函数内 / 模块级 | 真正可读写的变量、资源入口 |

### `let`：函数内的不可变值

`let` 最像“起了名字的计算结果”。

```wgsl
fn brighten(color: vec3f) -> vec3f {
    let gain = 1.2;
    let result = color * gain;
    return result;
}
```

这里的 `gain` 和 `result` 都不会被重新赋值。`let` 适合表达：

- 某一步计算得到的中间结果
- 不希望后续再被修改的局部值
- 让公式更有可读性的命名

`let` 只能在函数内部使用。

### `const`：编译期常量

`const` 表示**在编译阶段就能确定**的常量。

```wgsl
const PI: f32 = 3.1415926;
const HALF: f32 = 0.5;
```

它和 `let` 的差别，不只是“不能改”，更关键的是：`const` 更强调**编译期就已经固定**。

适合放进 `const` 的内容通常是：

- 数学常数
- 固定比例因子
- 不依赖运行时输入的配置值

### `override`：可由 pipeline 覆写的常量

`override` 很适合“**大体固定，但希望在创建 pipeline 时可替换**”的值。

```wgsl
override MAX_LIGHTS: u32 = 4u;
override USE_TONEMAP: bool = true;
```

它本质上仍然是常量，但值可以由 JavaScript 在创建 pipeline 时提供。这样做的好处是：

- 不必改 WGSL 源码
- 不必用 uniform buffer 只为了传几个简单标量
- 可以把同一份着色器做成多个编译变体

`override` 需要声明在模块顶层，而不是函数内部。

JavaScript 侧通常在 programmable stage 的 `constants` 中传入这些值。

```js
const pipeline = device.createRenderPipeline({
    layout: "auto",
    vertex: {
        module,
        entryPoint: "vs",
        constants: {
            MAX_LIGHTS: 8,
        },
    },
    fragment: {
        module,
        entryPoint: "fs",
    },
});
```

### `var`：真正的变量

`var` 才是真正“可以改”的变量声明方式。

```wgsl
fn accumulate(a: f32, b: f32) -> f32 {
    var sum = a;
    sum = sum + b;
    return sum;
}
```

和 `let`、`const` 不同，`var` 需要考虑**它存在哪个地址空间里**。

### `var` 的地址空间

WGSL 不只区分“能不能改”，还区分“数据放在哪里”。这就是地址空间（address space）。

| 地址空间 | 常见写法 | 说明 |
| --- | --- | --- |
| `function` | `var x = ...`（函数内默认） | 函数内部临时变量 |
| `private` | `var<private> x: f32;` | 模块级私有可变状态 |
| `uniform` | `var<uniform> camera: CameraUniform;` | 只读 uniform buffer 数据 |
| `storage` | `var<storage, read_write> particles: array<Particle>;` | storage buffer 数据，可读或读写 |
| `workgroup` | `var<workgroup> cache: array<vec4f, 64>;` | compute shader 工作组共享内存 |
| `handle` | 纹理 / 采样器变量隐式使用 | 用于纹理和 sampler 这类资源 |

两个非常实用的记忆点：

- **函数内的 `var`**，默认在 `function` 地址空间
- **模块顶层的 `var`**，默认在 `private` 地址空间

例如：

```wgsl
var<private> time: f32 = 0.0;

struct CameraUniform {
    viewProj: mat4x4f,
};

@group(0) @binding(0)
var<uniform> camera: CameraUniform;
```

::: tip 先把问题分清
不是所有 WGSL 变量都需要你在 JavaScript 里手动排字节。

真正和 CPU 侧 `ArrayBuffer`、`GPUBuffer` 布局强相关的，通常是：

- `var<uniform>`
- `var<storage>`

关于这些类型如何落到字节上，可以接着看下一章：[数据内存布局](/WGSL/dataMemoryLayout)。
:::

## 标量类型：WGSL 的最小数值单位

标量是最基础的数值类型。WGSL 常用的标量不多，但每个都很重要。

| 类型 | 含义 | 说明 |
| --- | --- | --- |
| `bool` | 布尔值 | `true` / `false` |
| `i32` | 32 位有符号整数 | 可表示正负整数 |
| `u32` | 32 位无符号整数 | 只表示非负整数 |
| `f32` | 32 位浮点数 | 最常用的浮点类型 |
| `f16` | 16 位浮点数 | 需要设备支持 `shader-f16` |

### 要点 1：没有“万能 number”

JavaScript 里几乎什么数字都叫 `number`，但 WGSL 不是。`1`、`1u`、`1.0`、`f32(1)` 在语义上并不完全相同。

这意味着你要经常思考：

- 这个值是拿来做计数，还是做几何计算？
- 它需要无符号吗？
- 它是否要参与浮点运算？

### 要点 2：整数和浮点不会自动互转

```wgsl
let index: u32 = 3u;
let scale: f32 = 0.25;
let value = f32(index) * scale;
```

如果不显式转换，很多看起来“理所当然”的写法都会报错。WGSL 宁可让你多写一个构造函数，也不愿让隐式转换把着色器行为搞模糊。

### 要点 3：`f16` 是优化选项，不是入门默认值

`f16` 能减少带宽和存储压力，在某些 GPU 上还能带来性能收益；但它依赖设备特性支持。入门时优先掌握 `f32`，通常更稳妥。

## 向量类型：把多个同类值打包在一起

GPU 很擅长同时处理一组同类型的数据。把 2 到 4 个同类标量打包成向量，是着色器最自然的写法之一。

你可以把向量理解成：

- 一个位置：`vec3f`
- 一个颜色：`vec4f`
- 一组纹理坐标：`vec2f`
- 一个法线方向：`vec3f`

### 向量的写法

WGSL 的向量类型写作 `vecN<T>`，其中：

- `N` 是分量个数，只能是 `2`、`3` 或 `4`
- `T` 是每个分量的标量类型

例如：

- `vec2<f32>`：两个 `f32`
- `vec3<i32>`：三个 `i32`
- `vec4<bool>`：四个 `bool`

为了更好写，WGSL 提供了常用别名：

| 别名 | 完整写法 | 含义 |
| --- | --- | --- |
| `vec2f` | `vec2<f32>` | 2 维浮点向量 |
| `vec3f` | `vec3<f32>` | 3 维浮点向量 |
| `vec4f` | `vec4<f32>` | 4 维浮点向量 |
| `vec2i` | `vec2<i32>` | 2 维有符号整数向量 |
| `vec3i` | `vec3<i32>` | 3 维有符号整数向量 |
| `vec4i` | `vec4<i32>` | 4 维有符号整数向量 |
| `vec2u` | `vec2<u32>` | 2 维无符号整数向量 |
| `vec3u` | `vec3<u32>` | 3 维无符号整数向量 |
| `vec4u` | `vec4<u32>` | 4 维无符号整数向量 |
| `vec2h` / `vec3h` / `vec4h` | `vecN<f16>` | 半精度浮点向量 |

### 创建向量

```wgsl
let uv = vec2f(0.25, 0.75);
let normal = vec3f(0.0, 0.0, 1.0);
let color = vec4f(1.0, 0.6, 0.2, 1.0);
let mask = vec4<bool>(true, false, true, false);
```

向量构造函数要把每个分量都交代清楚。对 GPU 来说，向量不是“模糊的一组值”，而是类型、长度、分量顺序都完全明确的一段数据。

### 访问向量分量

WGSL 提供三种常见访问方式。

#### 1. 用下标访问

```wgsl
let x = normal[0];
let z = normal[2];
```

这和数组很像，都是从 `0` 开始。

#### 2. 用 `x/y/z/w` 访问

```wgsl
let x = normal.x;
let yz = normal.yz;
let yx = uv.yx;
```

这组命名更适合表示几何含义：位置、方向、法线、坐标轴。

#### 3. 用 `r/g/b/a` 访问

```wgsl
let red = color.r;
let rgb = color.rgb;
let bgra = color.bgra;
```

这组命名更适合颜色语义。

### Swizzle：从一个向量拼出另一个向量

像 `normal.yz`、`uv.yx`、`color.rgb` 这样的写法，通常统称为 swizzle。

它非常实用，因为你可以：

- 取子向量：`pos.xy`
- 调整顺序：`uv.yx`
- 重组颜色通道：`color.bgra`

也就是说，一个 `vec4f` 不只是“四个数字”，它还是一组可以灵活重排的分量集合。

### `vec3f` 是最常见、也最容易踩坑的向量

`vec3f` 很符合直觉：位置、法线、方向都常用三个分量。但一旦它进入 buffer 布局，就要格外小心。

::: warning `vec3f` 的“3 个数”不等于“按 12 字节随便排”
从值的角度看，`vec3f` 确实是 3 个 `f32`，也就是 12 字节。

但在很多内存布局场景里，它的对齐要按 **16 字节边界** 思考。也正因为如此，`vec3f` 常常会带来 padding。

如果你在 JavaScript 侧写 buffer 时遇到“值明明对了，读出来却不对”的问题，第一时间就该怀疑这里。
:::

## 矩阵类型：向量的进一步组织方式

如果说向量是在“一次打包多个标量”，那么矩阵就是在“进一步组织多组向量”。

在图形学里，矩阵最常见的用途不是“展示成表格”，而是：

- 缩放
- 旋转
- 平移（配合齐次坐标）
- 坐标空间变换

### 矩阵只能存浮点数

WGSL 的矩阵元素类型只能是浮点数，也就是：

- `f32`
- `f16`

你不能声明 `mat4x4<i32>` 这样的矩阵。

### 矩阵的写法

WGSL 的矩阵类型写作 `matCxR<T>`，更准确地说是：

- `C`：列数（columns）
- `R`：行数（rows）
- `T`：元素类型，只能是浮点数

例如：

- `mat2x2f`：2 列 2 行
- `mat3x3f`：3 列 3 行
- `mat4x4f`：4 列 4 行
- `mat3x2f`：3 列 2 行

::: warning 一个特别容易记反的点
`mat3x2f` 不是“3 行 2 列”，而是 **3 列 2 行**。

WGSL 的矩阵按“列数 × 行数”命名，并且采用 **列主序（column-major）** 思维。
:::

### 常见矩阵别名

| 类型 | 含义 | 常见用途 |
| --- | --- | --- |
| `mat2x2f` | 2 列 2 行浮点矩阵 | 简单 2D 线性变换 |
| `mat3x3f` | 3 列 3 行浮点矩阵 | 旋转、法线空间变换 |
| `mat4x4f` | 4 列 4 行浮点矩阵 | 3D 模型、视图、投影变换 |
| `mat2x2h` ~ `mat4x4h` | 半精度矩阵 | 需要 `shader-f16` |

### 矩阵按列构造、按列索引

这是 WGSL 矩阵最关键的直觉。

```wgsl
let m = mat3x2f(
    vec2f(1.0, 0.0),
    vec2f(0.0, 1.0),
    vec2f(2.0, 3.0),
);
```

这段代码的含义是：

- `m` 有 3 列、2 行
- `m[0]` 是第一列，也就是 `vec2f(1.0, 0.0)`
- `m[1]` 是第二列，也就是 `vec2f(0.0, 1.0)`
- `m[2]` 是第三列，也就是 `vec2f(2.0, 3.0)`

因此：

```wgsl
let col0 = m[0];    // vec2f(1.0, 0.0)
let value = m[2][1]; // 3.0
```

这里的 `m[2][1]` 可以读成：

- 先取第 3 列
- 再取这列的第 2 个元素

### 最常见的矩阵：`mat4x4f`

在 WebGPU 图形程序里，`mat4x4f` 出场频率极高。模型矩阵、视图矩阵、投影矩阵、MVP 矩阵，几乎都围绕它展开。

一个单位矩阵可以写成：

```wgsl
let identity = mat4x4f(
    vec4f(1.0, 0.0, 0.0, 0.0),
    vec4f(0.0, 1.0, 0.0, 0.0),
    vec4f(0.0, 0.0, 1.0, 0.0),
    vec4f(0.0, 0.0, 0.0, 1.0),
);
```

## 内置运算符和函数：WGSL 的数学工具箱

WGSL 自带了大量数值运算能力。你不需要自己去写一遍 `sin`、`sqrt`、`clamp`，大多数基础运算都已经内建好了。

### 常见运算符

| 类别 | 常见形式 | 说明 |
| --- | --- | --- |
| 算术 | `+` `-` `*` `/` `%` | 基础数值运算 |
| 比较 | `==` `!=` `<` `<=` `>` `>=` | 比较大小或相等性 |
| 逻辑 | `&&` `\|\|` `!` | 布尔逻辑 |
| 位运算 | `&` `\|` `^` `~` `<<` `>>` | 主要用于整数类型 |

### 常见数值函数

| 类别 | 代表函数 | 典型作用 |
| --- | --- | --- |
| 三角函数 | `sin` `cos` `tan` | 波动、旋转、周期变化 |
| 幂和对数 | `pow` `exp` `exp2` `log` `log2` | 指数增长、衰减、映射 |
| 开方相关 | `sqrt` `inverseSqrt` | 长度、归一化、衰减 |
| 取整与逼近 | `round` `floor` `ceil` `trunc` `fract` | 取整、采样、离散化 |
| 范围控制 | `min` `max` `clamp` | 限制数值区间 |
| 插值辅助 | `mix` `step` `smoothstep` | 过渡、阈值、平滑变化 |
| 绝对值与符号 | `abs` `sign` | 幅度与方向判断 |

很多函数不只支持标量，也支持向量。对向量来说，它们通常**按分量逐个作用**。

```wgsl
let a = vec3f(-1.2, 0.4, 1.8);
let b = abs(a);                         // (1.2, 0.4, 1.8)
let c = clamp(a, vec3f(0.0), vec3f(1.0)); // (0.0, 0.4, 1.0)
```

也就是说，GPU 并不把 `vec3f` 当成“神秘对象”；它更像是“三个同类型分量一起参加运算”。

::: tip 对向量来说，很多函数默认是“逐分量”的
例如：

- `abs(vec3f(...))` 会对每个分量取绝对值
- `min(vec3f(...), vec3f(...))` 会逐分量取更小值
- `clamp(vec4f(...), low, high)` 会逐分量限幅

但几何意义更强的函数，比如 `dot`、`cross`、`length`、`normalize`，就不是简单的逐分量处理，而是把整个向量当作一个几何对象来计算。
:::

## 向量运算和函数：WGSL 中最常用的数学动作

这一部分是 WGSL 入门的重中之重。

因为在实际着色器里，你几乎每天都在和这些操作打交道：

- 颜色混合是向量运算
- 顶点位置变换要和向量配合
- 光照方向、法线、视线，都是向量
- 插值后的结果，仍然经常是向量

### 1. 分量级运算：`+`、`-`、`*`、`/`

向量之间的普通算术运算，默认按分量进行。

```wgsl
let a = vec3f(1.0, 2.0, 3.0);
let b = vec3f(4.0, 5.0, 6.0);

let sum = a + b;          // (5.0, 7.0, 9.0)
let diff = b - a;         // (3.0, 3.0, 3.0)
let scaled = a * 2.0;     // (2.0, 4.0, 6.0)
let ratio = b / 2.0;      // (2.0, 2.5, 3.0)
let prod = a * b;         // (4.0, 10.0, 18.0)
```

这里最值得强调的是最后一行：

```wgsl
let prod = a * b;
```

它不是点积，而是**逐分量相乘**。

::: warning `a * b` 不是点积
很多初学者会本能地把 `vec3 * vec3` 想成数学里的点积，但在 WGSL 里，这只是逐分量乘法。

真正的点积必须写成：

```wgsl
dot(a, b)
```
:::

### 2. `length(v)`：求向量长度

`length(v)` 返回向量的长度，也就是几何上“箭头有多长”。

```wgsl
let v = vec3f(3.0, 4.0, 0.0);
let len = length(v); // 5.0
```

它常用于：

- 测距离
- 做衰减
- 判断某个方向向量是否接近零

### 3. `normalize(v)`：只保留方向，把长度变成 1

`normalize(v)` 返回一个与 `v` 方向相同、长度为 1 的向量。

```wgsl
let dir = normalize(vec3f(2.0, 0.0, 0.0));
// dir = (1.0, 0.0, 0.0)
```

它在图形学里几乎无处不在，因为很多时候我们只关心“方向”，不关心“原始长度”。

典型场景包括：

- 单位法线
- 光照方向
- 视线方向
- 反射方向计算前的标准化

::: tip 对可能接近零的向量要更谨慎
如果一个向量长度非常小，直接做 `normalize` 通常不是个好习惯。更稳妥的方式是先检查长度是否足够大，再决定是否归一化。
:::

### 4. `distance(a, b)`：求两点之间的距离

`distance(a, b)` 可以理解成：把 `a` 和 `b` 当成空间中的两个点，返回它们之间的距离。

```wgsl
let p0 = vec3f(0.0, 0.0, 0.0);
let p1 = vec3f(0.0, 3.0, 4.0);
let d = distance(p0, p1); // 5.0
```

从概念上讲，它等价于：

```wgsl
length(a - b)
```

但直接写 `distance(a, b)` 更清楚，也更像“在表达意图”。

### 5. `dot(a, b)`：方向关系最重要的函数之一

`dot(a, b)` 返回点积，结果是一个标量。

```wgsl
let a = vec3f(1.0, 0.0, 0.0);
let b = vec3f(0.0, 1.0, 0.0);
let c = dot(a, b); // 0.0
```

点积非常重要，因为它能告诉我们两个方向有多接近：

- `dot > 0`：方向大体相近
- `dot = 0`：互相垂直
- `dot < 0`：方向大体相反

如果两个向量都已经归一化，那么 `dot(a, b)` 就等于它们夹角的余弦值。这正是它在光照计算中极其常见的原因：

```wgsl
let n = normalize(normal);
let l = normalize(lightDir);
let ndotl = max(dot(n, l), 0.0);
```

这就是 Lambert 漫反射里最核心的一步。

### 6. `cross(a, b)`：得到垂直于两者的方向

`cross(a, b)` 返回叉积，结果是一个 `vec3f`（或更一般的三维浮点向量类型）。它只适用于三维向量。

```wgsl
let xAxis = vec3f(1.0, 0.0, 0.0);
let yAxis = vec3f(0.0, 1.0, 0.0);
let zAxis = cross(xAxis, yAxis); // (0.0, 0.0, 1.0)
```

它的几何意义是：

- 返回一个**垂直于 `a` 与 `b` 所在平面**的方向
- 方向遵循右手法则

在图形学里，`cross` 常用来：

- 从两个方向构造法线
- 计算切线 / 副切线基
- 构造局部坐标系

### 7. `fma(a, b, c)`：把乘法和加法合成一步

`fma(a, b, c)` 表示：

```wgsl
a * b + c
```

但它不是简单的语法糖。很多硬件会把它当成一条融合指令执行，因此往往有两个优点：

- 舍入误差更少
- 执行更高效

```wgsl
let base = vec3f(0.8, 0.5, 0.3);
let lit = vec3f(0.6, 0.6, 0.6);
let ambient = vec3f(0.1, 0.1, 0.1);

let color = fma(base, lit, ambient);
// 等价于 base * lit + ambient
```

当你在写颜色组合、多项式近似、迭代更新时，`fma` 会是一个非常顺手的工具。

## 矩阵运算和函数：把“线性变换”真正算起来

矩阵不像普通向量那样频繁做各种花哨操作，但它在图形学中的地位极高，因为**几乎所有空间变换都依赖矩阵乘法**。

### 矩阵的基本运算

```wgsl
let a = mat3x3f(
    vec3f(1.0, 0.0, 0.0),
    vec3f(0.0, 1.0, 0.0),
    vec3f(0.0, 0.0, 1.0),
);

let b = a * 2.0;        // 每个元素乘 2
let c = a + a;          // 对应元素相加
let v = a * vec3f(1.0, 2.0, 3.0);
```

可以先这样理解：

- `matrix + matrix`：逐元素相加
- `matrix - matrix`：逐元素相减
- `matrix * scalar`：每个元素都乘以这个标量
- `matrix * vector`：把向量变换到新的坐标或基底下
- `matrix * matrix`：把多个变换组合起来

### `matrix * vector`

这是图形程序里最重要的矩阵运算。

```wgsl
let clipPos = mvp * vec4f(position, 1.0);
```

这意味着：把一个位置向量送入矩阵，得到变换后的结果。它是“顶点从模型空间一路走到裁剪空间”的核心动作。

### `matrix * matrix`

矩阵之间也能相乘，用来组合多个变换：

```wgsl
let mvp = proj * view * model;
```

顺序不能随便交换。一般来说：

```wgsl
A * B != B * A
```

矩阵乘法通常**不满足交换律**。这也是为什么图形程序里“变换顺序错一点，结果就完全不对”。

### `transpose(m)` 与 `determinant(m)`

WGSL 还提供了一些矩阵函数，其中最常见的两个是：

- `transpose(m)`：转置矩阵，把行和列对调
- `determinant(m)`：返回方阵的行列式

```wgsl
let mt = transpose(a);
let det = determinant(a);
```

在入门阶段，你只需要先记住：

- `transpose` 常用于调整矩阵形式或配合某些线性代数推导
- `determinant` 常用于判断矩阵是否可逆、变换是否退化

## 一段把概念串起来的小例子

下面这段代码没有完整渲染上下文，但足够把本章的关键点串起来：

```wgsl
const AMBIENT: f32 = 0.08;

override USE_GAMMA: bool = true;

fn shade(baseColor: vec3f, normal: vec3f, lightDir: vec3f) -> vec3f {
    let n = normalize(normal);
    let l = normalize(lightDir);

    let diffuse = max(dot(n, l), 0.0);
    var color = fma(baseColor, vec3f(diffuse), vec3f(AMBIENT));
    color = clamp(color, vec3f(0.0), vec3f(1.0));

    if (USE_GAMMA) {
        color = pow(color, vec3f(1.0 / 2.2));
    }

    return color;
}
```

这里包含了本章几乎所有核心概念：

- `const`：固定环境光系数
- `override`：是否启用 gamma 校正，可在外部覆写
- `vec3f`：颜色、法线、光照方向都天然是三维向量
- `normalize`：把方向统一成单位向量
- `dot`：计算法线和光照方向的一致程度
- `fma`：一次完成乘加
- `clamp`：把颜色约束在合理范围内
- `pow`：做简单的 gamma 变换

这类代码就是 WGSL 的日常：**类型明确、公式直接、数学意义很强。**