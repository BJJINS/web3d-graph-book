# 数据内存布局

在 WebGPU 中，你提交给 GPU 的并不是“对象”，而是一段段**原始字节**。  
GPU 不会关心你的 JavaScript 变量名叫 `camera` 还是 `light`，它只关心：

- 第 0 个字节开始放了什么
- 第 16 个字节开始又放了什么
- 这段数据是否满足着色器要求的对齐规则

如果说前面几章讨论的是“数据怎样流入着色器”，那么这一章讨论的就是另一个更底层的问题：**数据进入 GPU 之前，字节到底该怎么排。**

在 WGSL 中，我们经常会定义 `struct`。它看起来有点像 JavaScript 对象：都有成员名，也都能把几项数据打包在一起。但两者有一个非常关键的区别：

- JavaScript 对象更像“语义容器”
- WGSL `struct` 更像“内存蓝图”

你不但要写出每个成员的名字和类型，还必须清楚地知道：**这个成员在 buffer 里的偏移量（offset）是多少，占多少字节，前后有没有 padding（填充字节，填充字节不会存储任何数据，就是一块空内存，存在的意义就是让存入的数据对齐格式）**。

本章你会掌握 6 个核心点：

1. `size`、`alignment`、`padding` 分别是什么意思
2. 标量、向量、矩阵、数组、结构体在 WGSL 里的常见布局规则
3. 为什么 `vec3f` 明明只有 3 个浮点数，却经常要按 16 字节节奏来思考
4. `@align` 和 `@size` 如何显式干预结构体成员的布局
5. 如何在 JavaScript 里用 `ArrayBuffer` / TypedArray 把数据正确写进 GPUBuffer
6. 为什么 `uniform` buffer 往往要比你直觉里“更保守”地布局

## 为什么这件事绕不过去

在 JavaScript 里，我们很少直接思考对象的内存布局。你写：

```js
const camera = {
    eye: [0, 1, 2],
    exposure: 1.2,
};
```

通常不会去关心 `eye` 是从第几个字节开始、`exposure` 又落在第几个字节上。

但在 WebGPU 里，情况完全不同。比如你在 WGSL 中写了：

```wgsl
struct CameraUniform {
    eye: vec3f,
    exposure: f32,
};
```

那你在 JavaScript 侧就必须提供一段**布局一致**的二进制数据。  
一旦你写进去的偏移不对，轻则颜色错乱、矩阵失真，重则直接触发着色器校验错误。

所以你可以把“数据内存布局”理解成一份契约：

- WGSL 负责声明“我期待什么样的字节排列”
- JavaScript 负责严格按这份排列把数据写进去

只要两边有一侧理解错了，GPU 就会毫不留情地把结果画歪。

## 先分清：不是所有 WGSL 变量都需要你手动排字节

一个很容易被忽略、但对理解本章特别关键的点是：

> **WGSL 里的变量，并不都对应一块需要你在 JavaScript 里手动排布的 buffer 内存。**

这句话听起来有点绕，但它能帮你一下子分清“哪些地方需要算 offset，哪些地方根本不用算”。

例如下面这段代码：

```wgsl
fn doSomething() {
    var temp = vec3f(1.0, 2.0, 3.0);
    let scale = 0.5;
}
```

这里的 `temp` 和 `scale` 都是函数里的局部变量。  
它们属于 WGSL 的**函数地址空间（function address space）**，只在着色器执行期间临时存在。对于这类变量，你通常**不需要**去想：

- JavaScript 该怎么写 `ArrayBuffer`
- offset 从多少开始
- 有没有 padding

因为它们压根不是“由 CPU 先写好，再交给 GPU 读”的那类数据。

真正会把“类型定义”变成“字节契约”的，通常是下面这两类资源变量：

```wgsl
struct CameraUniform {
    eye: vec3f,
    exposure: f32,
    viewProj: mat4x4f,
};

@group(0) @binding(0) var<uniform> camera: CameraUniform;
```

```wgsl
struct Particle {
    position: vec4f,
    velocity: vec4f,
};

@group(0) @binding(1) var<storage, read> particles: array<Particle>;
```

这时事情就变了：

- `var<uniform>` 表示数据来自 **uniform buffer**
- `var<storage>` 表示数据来自 **storage buffer**

而 buffer 里的数据，恰恰就是你在 JavaScript 里用 `ArrayBuffer`、`Float32Array`、`Uint32Array` 等工具提前写好的那串字节。

所以你可以先建立一个非常实用的判断标准：

- **函数内临时变量**：主要是 WGSL 自己在运行时使用，你通常不用亲自计算它在 CPU 侧的布局
- **uniform / storage 资源变量**：必须和外部 buffer 对齐，这时就必须认真对待 `size`、`alignment`、`padding`

::: tip 这章真正关心的是哪一类变量？
本章重点讨论的，其实不是“WGSL 里所有变量怎么放”，而是：

- `struct` 如何映射到 **uniform buffer**
- `struct` / `array` 如何映射到 **storage buffer**

也就是那些**要从 JavaScript 写进 GPUBuffer**的数据。
:::

## 先建立 3 个关键词：size、alignment、padding

理解内存布局，先记住这 3 个词。

### size：这个值本身占多少字节

比如：

- `f32` 占 4 字节
- `vec2f` 占 8 字节
- `vec3f` 占 12 字节
- `vec4f` 占 16 字节

这里的 `size` 只回答一个问题：**如果只看这个值自己，它需要多大空间。**

### alignment：这个值必须从几的倍数位置开始放

这往往是新手最容易忽略的点。

例如：

- `f32` 的对齐通常是 4
- `vec2f` 的对齐通常是 8
- `vec3f` 的对齐是 16
- `vec4f` 的对齐也是 16

注意：**`vec3f` 的大小是 12，但对齐是 16。**  
这正是很多布局 bug 的起点。

“对齐是 16” 的意思不是它一定占 16 字节，而是说：**它的起始 offset 必须是 16 的倍数。**

### padding：为了满足对齐规则，被迫塞进去的空白字节

当下一个成员需要更严格的对齐时，前一个成员后面可能会多出一段没人使用的空白区域，这段区域就是 padding。

你可以把它想象成搬家时塞在箱子里的泡沫填充物：  
它不承载业务数据，但没有它，整体摆放就不整齐，也不符合运输要求。

沿着这 3 个概念继续往下走，WGSL 还提供了两个非常实用的结构体成员属性：

- `@align(...)`：显式抬高某个成员的对齐要求
- `@size(...)`：显式增大某个成员在结构体中的占位大小

它们本质上不是“新类型”，而是**对既有 `size` / `alignment` 规则的手动改写**。后面会专门展开。

## WGSL 布局的基本思路

计算一个 `struct` 的成员偏移时，可以按下面这套心智模型来理解：

1. 按声明顺序一个成员一个成员往后排
2. 放某个成员之前，先把当前 offset 向上补齐到该成员的对齐倍数
3. 放下这个成员后，offset 再向后移动它的 `size`
4. 所有成员放完后，整个 `struct` 的总大小还要再向上补齐到“该结构体最大对齐值”的倍数

如果你愿意，可以把它记成下面这个伪代码：

```js
offset = 0
for member in structMembers:
    offset = roundUp(offset, align(member))
    member.offset = offset
    offset += size(member)

structAlign = max(align(each member))
structSize = roundUp(offset, structAlign)
```

例如：

- `roundUp(12, 16) = 16`
- `roundUp(20, 8) = 24`
- `roundUp(64, 16) = 64`

也就是说，`roundUp` 做的事情就是：**把当前位置推到下一个合法对齐点。**

## struct 先是“数据分组”，然后才是“布局对象”

`struct` 首先是为了把**彼此相关的数据组织在一起**。

例如一个复数可以写成：

```wgsl
struct Complex {
    real: f32,
    imag: f32,
};
```

这时候你可以把它先理解为“两个相关数值被打包成一个整体”。

从表达语义的角度看，这和 JavaScript 里把两个字段放进同一个对象很像。

但 WGSL 比 JavaScript 多走了一步：  
它不只是在“概念上”把数据打包，还会直接决定这组数据在 buffer 中怎样落位。

像 `Complex` 这样只有两个 `f32` 的结构体，布局很直观：

- `real` 在 offset 0
- `imag` 在 offset 4
- 总大小 8 字节

可一旦成员里出现 `vec3f`、矩阵、数组，事情就不再这么朴素了。  
也正因为如此，**WGSL 的 `struct` 既是语义结构，也是内存结构**。

## 常见类型速查表

下面这张表先记住最常用的几项，已经能覆盖你在 WebGPU 入门阶段的大多数场景。

| WGSL 类型 | 大小（size） | 对齐（alignment） | 说明 |
| --- | --- | --- | --- |
| `f32` / `u32` / `i32` | 4 | 4 | 最基本的标量 |
| `vec2f` | 8 | 8 | 两个 `f32` |
| `vec3f` | 12 | 16 | 最容易踩坑：不是 12 对齐，而是 16 对齐 |
| `vec4f` | 16 | 16 | 最整齐的 16 字节块 |
| `mat3x3f` | 48 | 16 | 可看成 3 个按 16 字节步进的列向量 |
| `mat4x4f` | 64 | 16 | 4 列，每列一个 `vec4f` |
| `array<vec3f, N>` | `N × 16` | 16 | 每个元素实际 stride 为 16，而不是 12 |

::: tip 一个非常重要的直觉
看到 `vec3f` 时，先不要只想到“3 个 float = 12 字节”，而要立刻联想到：

- 它自己的 `size` 是 12
- 但它所在的位置必须按 16 字节对齐
- 它出现在数组、矩阵列、结构体边界附近时，往往会带出 padding
:::

## 例子一：只有标量时，世界很美好

先看一个最简单的例子：

```wgsl
struct Particle {
    x: f32,
    y: f32,
    life: f32,
};
```

这三个成员都是 `f32`，每个：

- 大小 4
- 对齐 4

所以布局非常顺：

| 成员 | 类型 | offset | size |
| --- | --- | --- | --- |
| `x` | `f32` | 0 | 4 |
| `y` | `f32` | 4 | 4 |
| `life` | `f32` | 8 | 4 |

总大小是 12，结构体最大对齐也是 4，所以最终结构体大小还是 12。

这个例子几乎没有任何戏剧性，因为所有成员都按 4 字节节奏前进。  
真正的故事，通常从 `vec3f` 开始。

## 例子二：`vec3f` 登场后，布局突然变“拧巴”

来看一个更接近真实项目的例子：

```wgsl
struct CameraUniform {
    eye: vec3f,
    exposure: f32,
    viewProj: mat4x4f,
};
```

先分别看这 3 个成员：

- `eye: vec3f`
  - `size = 12`
  - `align = 16`
- `exposure: f32`
  - `size = 4`
  - `align = 4`
- `viewProj: mat4x4f`
  - `size = 64`
  - `align = 16`

现在一步一步排：

1. `eye` 是第一个成员，所以从 `offset = 0` 开始放，合法  
2. `eye` 占 12 字节，因此下一个空闲位置来到 `offset = 12`
3. `exposure` 只要求 4 字节对齐，而 12 本来就是 4 的倍数，所以它正好可以放在 `offset = 12`
4. `exposure` 再占 4 字节后，当前位置来到 `offset = 16`
5. `viewProj` 要求 16 字节对齐，所以它从 `offset = 16` 开始放，完全合法

结果如下：

| 成员 | 类型 | 对齐 | 大小 | offset | 备注 |
| --- | --- | --- | --- | --- | --- |
| `eye` | `vec3f` | 16 | 12 | 0 | 占前 12 字节 |
| `exposure` | `f32` | 4 | 4 | 12 | 正好把 `vec3f` 后面的 4 字节空隙填满 |
| `viewProj` | `mat4x4f` | 16 | 64 | 16 | 从下一个 16 字节边界开始 |

整个结构体最后结束在 `16 + 64 = 80`，最大对齐值是 16，而 80 本身就是 16 的倍数，所以最终大小就是 **80 字节**。

![CameraUniform 的内存布局示意图](/webgpu/wgsl-struct-layout.svg)

这个例子特别值得记住，因为它说明了一件很实用的事：

> `vec3f` 后面如果恰好跟一个 `f32`，这个 `f32` 往往可以把“看似浪费掉”的 4 字节空隙利用起来。

也就是说，下面这种排法：

```wgsl
position: vec3f,
intensity: f32,
color: vec3f,
range: f32,
```

通常比把所有 `vec3f` 和所有 `f32` 分开写更紧凑，也更容易读懂。

## 数组：最容易低估成本的地方

结构体里最常见的误判之一，是把数组元素的 stride 错看成元素的 size。

先看这个类型：

```wgsl
array<vec3f, 3>
```

很多人第一反应会说：“3 个 `vec3f`，每个 12 字节，所以总共 36 字节。”

这个结论是错的。

原因在于：数组不是简单地把元素首尾相接，而是每个元素都要按自己的对齐要求占据一个**步长（stride）**。

对于 `vec3f`：

- `size = 12`
- `align = 16`

所以它在数组中的 stride 是：

```txt
roundUp(12, 16) = 16
```

于是：

- 第 0 个元素从 `offset = 0` 开始
- 第 1 个元素从 `offset = 16` 开始
- 第 2 个元素从 `offset = 32` 开始

总大小就是 `3 × 16 = 48`，而不是 36。

![array&lt;vec3f, 3&gt; 的 stride 示意图](/webgpu/wgsl-array-stride.svg)

所以你可以把数组理解成一排固定宽度的储物柜：

- `vec3f` 真正使用其中 12 字节
- 剩下 4 字节虽然空着，但这个柜子的位置已经被它占掉了

### JavaScript 侧该怎么写这种数组

如果你要在 JavaScript 中写一个 `array<vec3f, 3>`，最稳妥的思路不是准备 9 个 float，而是准备 **12 个 float**：

```js
const data = new Float32Array(3 * 4);

// element 0
data[0] = 1;
data[1] = 2;
data[2] = 3;
// data[3] 是 padding

// element 1
data[4] = 4;
data[5] = 5;
data[6] = 6;
// data[7] 是 padding

// element 2
data[8] = 7;
data[9] = 8;
data[10] = 9;
// data[11] 是 padding
```

这样写的好处是：你的 JavaScript 数组步长和 GPU 看到的数组步长完全一致，不容易在后续扩展时出错。

::: warning 别把“元素大小”和“数组步长”混为一谈
很多布局 bug 并不是出在“类型不认识”，而是出在：

- 你知道 `vec3f` 是 12 字节
- 但你忘了它在数组里的 stride 是 16

这两件事同时成立，而且必须同时记住。
:::

## 矩阵：请把它看成“列向量数组”

矩阵也经常让人误判大小。  
WGSL 中的矩阵最好这样理解：

> 一个 `matCxR<T>`，本质上可以看成 **C 个列向量 `vecR<T>`**。

例如：

- `mat4x4f` = 4 个 `vec4f`
- `mat3x3f` = 3 个 `vec3f`

这意味着矩阵的布局，不是简单地“行 × 列 × 每个标量大小”，而是还要受到**列向量对齐**的影响。

### `mat4x4f`：最规整的情况

`mat4x4f` 由 4 个 `vec4f` 组成：

- 每列大小 16
- 每列对齐 16

所以总大小就是：

```txt
4 × 16 = 64
```

这也是为什么我们在相机、模型、投影矩阵的例子里，经常直接把 `Float32Array(16)` 写进 buffer，它恰好和 `mat4x4f` 完全对上。

### `mat3x3f`：最容易“以为是 36，其实是 48”

`mat3x3f` 看起来像 9 个 `f32`，很多人会先算出：

```txt
9 × 4 = 36
```

但这又是一个经典误判。

因为它是 3 个 `vec3f` 列向量，而每个 `vec3f` 列向量都要按 16 字节步进，所以：

```txt
3 × 16 = 48
```

也就是说，`mat3x3f` 的真实大小是 **48 字节**，不是 36。

例如：

```wgsl
struct ShadingUniform {
    normalMatrix: mat3x3f,
    tint: vec3f,
    roughness: f32,
};
```

它的布局就可以这样算：

| 成员 | 类型 | offset | size |
| --- | --- | --- | --- |
| `normalMatrix` | `mat3x3f` | 0 | 48 |
| `tint` | `vec3f` | 48 | 12 |
| `roughness` | `f32` | 60 | 4 |

最终总大小是 64 字节。

你会发现，`roughness` 再次扮演了那个“填满 `vec3f` 尾部空隙”的角色。

::: tip 矩阵这件事，脑子里请始终保留“列主序”这个词
WGSL 里的矩阵适合按**列**来理解，而不是按“我在纸上看到几行几列”来理解。

所以在布局问题里：

- `mat4x4f` 像 4 个 `vec4f`
- `mat3x3f` 像 3 个 `vec3f`

只要把这个直觉建立起来，矩阵大小为什么会比“标量个数 × 4”更大，就不会再显得神秘。
:::

## struct 的总大小，也要对齐

很多人算完最后一个成员就收工了，但其实还有最后一步：

> **整个结构体的总大小，也要向上补齐到结构体最大对齐值的倍数。**

来看一个小例子：

```wgsl
struct Example {
    a: vec2f,
    b: vec4f,
};
```

先排成员：

- `a: vec2f`
  - `offset = 0`
  - `size = 8`
- `b: vec4f`
  - 要求 16 字节对齐
  - 所以不能放在 8，只能放在 16

于是：

| 成员 | offset | size |
| --- | --- | --- |
| `a` | 0 | 8 |
| padding | 8 | 8 |
| `b` | 16 | 16 |

最后结构体结束在 32，最大对齐值也是 16，所以总大小就是 32。

这个例子告诉你：**padding 不一定只会出现在结构体末尾，也可能出现在两个成员之间。**

## `@align` 和 `@size`：当默认布局不够用时，显式告诉 WGSL 该怎么排

到这里为止，我们讨论的都还是“**类型天然决定的布局**”：

- `vec3f` 天然按 16 对齐
- `mat3x3f` 天然像 3 个 16 字节步进的列向量
- `struct` 天然按成员顺序叠加并补齐

这已经足够覆盖大量场景。但工程里还有一种常见需求：

> **我不想改字段的语义类型，但我想显式改变它在内存里的起点或占位。**

例如：

- 想让一个 `f32` 单独占一个 16 字节槽位
- 想让一个嵌套 `struct` 在 uniform 里按 16 字节节奏摆放
- 想显式留出 padding，而不是额外声明一个“只为占位”的假字段

这时就轮到 `@align` 和 `@size` 出场了。

::: tip 它们是“成员属性”，不是“新数据类型”
`@align` 和 `@size` 主要写在 **struct 成员声明** 前面，用来改写该成员的布局要求。

它们不会改变成员在着色器里的值类型。例如：

```wgsl
struct Example {
    @size(16) exposure: f32,
}
```

这里的 `exposure` 读出来仍然是一个 `f32`，并不会变成 `vec4f`。  
变化的是：**它在内存里占位时，按 16 字节来算。**
:::

### `@align(N)`：改“从哪里开始放”

`@align(N)` 的作用可以简单记成一句话：

> **把这个成员的起始 offset，抬高到至少按 `N` 对齐。**

也就是说，它主要影响的是“**成员从哪个字节开始**”。

来看一个例子：

```wgsl
struct ExampleAlign {
    a: f32,
    @align(16) b: f32,
    c: f32,
};
```

先看默认情况：

- `a` 是 `f32`，放在 `offset = 0`
- `a` 占 4 字节，所以下一个空闲位置是 `offset = 4`

但 `b` 前面加了 `@align(16)`，所以它不能从 4 开始，只能跳到下一个 16 的倍数：

- `b` 的 `offset = 16`

再往后：

- `b` 仍然只是一个 `f32`，自己的值大小还是 4
- 所以 `c` 可以放在 `offset = 20`

结果如下：

| 成员 | 类型 | offset | 占位大小 |
| --- | --- | --- | --- |
| `a` | `f32` | 0 | 4 |
| padding | — | 4 | 12 |
| `b` | `f32` | 16 | 4 |
| `c` | `f32` | 20 | 4 |

整个结构体的最大对齐值变成了 16，因此最终结构体大小会补齐到 **32 字节**。

这个例子很适合帮你记住：

- `@align` 改的是**起点**
- 它会在成员前面制造 padding
- 它**不会**把 `f32` 变成 16 字节大小的值

### `@size(N)`：改“这个成员算占多大位置”

如果说 `@align` 管的是“从哪里开始放”，那 `@size` 管的就是：

> **这个成员在结构体里，要按多大的脚印往后挪。**

来看例子：

```wgsl
struct ExampleSize {
    @size(16) a: f32,
    b: f32,
};
```

这里的 `a` 仍然是一个 `f32`，但它在结构体中的占位被显式提高到了 16 字节。因此：

- `a` 从 `offset = 0` 开始
- 放完 `a` 之后，当前位置直接跳到 `offset = 16`
- `b` 是普通 `f32`，所以它放在 `offset = 16`

结果如下：

| 成员 | 类型 | offset | 占位大小 |
| --- | --- | --- | --- |
| `a` | `f32` | 0 | 16 |
| `b` | `f32` | 16 | 4 |

这个例子说明：

- `@size` 主要影响的是**后续成员从哪里接着排**
- 它更像是在成员尾部**显式补出一段 padding**
- 它适合表达“这个成员虽然值很小，但在布局上我要给它留更大的槽位”

### 一个管起点，一个管占位

把它们并排看，区别会更清楚：

| 属性 | 主要影响 | 直觉理解 |
| --- | --- | --- |
| `@align(N)` | 成员的起始 offset | 让成员“从更整齐的边界开始” |
| `@size(N)` | 成员在结构体中的占位大小 | 让成员“虽然值不大，但多占几个字节” |

你也可以把它们记成一句很实用的话：

- `@align` 更像“**前补 padding**”
- `@size` 更像“**后补 padding**”

### 两个属性可以一起用

很多时候，你需要的不是单独抬高起点，也不是单独拉大占位，而是：

> **让某个成员既从 16 字节边界开始，又整个按 16 字节块来占位。**

这时就可以把两者叠在一起写：

```wgsl
struct Inner {
    a: f32,
    b: f32,
};

struct Outer {
    @align(16) @size(16) inner: Inner,
    c: f32,
};
```

先看 `Inner`：

- 自然大小是 8 字节
- 自然对齐是 4 字节

但在 `Outer` 里，我们显式要求：

- `inner` 至少按 16 字节对齐开始
- `inner` 在 `Outer` 中占满 16 字节槽位

于是：

- `inner` 放在 `offset = 0`
- `c` 不再接着放在 8，而是从 `offset = 16` 开始

这类写法在 uniform 相关布局里尤其有用，因为它能把“我脑子里想要的 16 字节节奏”直接写进类型定义里。

### 为什么这很有用：它比“把类型改大”更精细

书里的光照示例里，为了避开 `vec3f` 的 16 字节对齐陷阱，采用了一种很朴素也很稳妥的办法：  
**直接把很多本来可以写成 `vec3f` 的字段改成 `vec4f`**。

这么做当然有效，因为 `vec4f` 本来就是规整的 16 字节块。  
但它也有一个代价：**类型语义被一起改大了**。

而 `@align` / `@size` 提供的是更细粒度的控制：

- 你可以继续保留原来的字段类型
- 只在布局层面把它摆成你想要的节奏

也就是说：

- `vec4f` 方案更直接、更朴素
- `@align` / `@size` 方案更精细、更显式

### 什么时候该用，什么时候别乱用

`@align` 和 `@size` 很有用，但也不建议一上来就到处加。一个比较稳妥的经验是：

#### 适合使用的时候

- 你需要和某个既定的 CPU 侧布局严格匹配
- 你想显式表达 16 字节节奏，而不是靠“插一个假字段”凑出来
- 你想保留原有字段类型，不想为了对齐把 `vec3f` 统统改成 `vec4f`

#### 不适合滥用的时候

- 默认自然布局已经足够清晰
- 团队成员还不熟悉内存布局，过多属性反而让结构体更难读
- 你只是想“试试看能不能修好 bug”，但并没有先算清楚 offset

::: warning 两个非常重要的边界
1. `@align` 和 `@size` 的作用是**抬高**布局要求，不是把类型“压缩得更紧”。
2. 它们改变的是**布局契约**，所以一旦你在 WGSL 里加了它们，JavaScript 侧写 buffer 的 offset 和总大小也必须同步调整。
:::

## 当你看到 `@group` / `@binding` 时，就该切换到“字节思维”

WGSL 章节里还反复强调了一个实践习惯：  
着色器里的资源不是凭空出现的，而是通过绑定关系和外部资源连起来的。

例如：

```wgsl
struct CameraUniform {
    eye: vec3f,
    exposure: f32,
    viewProj: mat4x4f,
};

@group(0) @binding(0) var<uniform> camera: CameraUniform;
```

当你看到这样的声明时，应该立刻在脑子里切换模式：

- 这不再只是“WGSL 类型练习题”
- 它已经变成了“JavaScript 必须按同样规则准备字节”的接口定义

也就是说：

1. WGSL `struct` 定义了字段顺序和类型
2. `var<uniform>` / `var<storage>` 决定它会从哪种资源中读取
3. JavaScript 必须用同样的布局把数据写进 `GPUBuffer`

你可以把 `@group` / `@binding` 看成一座桥：

- 桥的一边是 WGSL 里的类型系统
- 桥的另一边是 JavaScript 准备好的原始字节

这座桥一旦接上，布局就不再是“建议”，而是“必须一致”的硬约束。

## JavaScript 侧如何把数据写进去

知道了 WGSL 的布局规则，下一步就是在 JavaScript 里老老实实把同样的字节排出来。

最常用的工具有三个：

- `ArrayBuffer`：一整块原始内存
- TypedArray（如 `Float32Array`、`Uint32Array`）：用特定类型去解释同一块内存
- `DataView`：当你需要更细粒度、按字节偏移读写时特别有用

下面我们用上面那个 `CameraUniform` 举例：

```wgsl
struct CameraUniform {
    eye: vec3f,
    exposure: f32,
    viewProj: mat4x4f,
};
```

它总共 80 字节，所以 JavaScript 可以这样准备：

```js
const CAMERA_UNIFORM_SIZE = 80;
const cameraRaw = new ArrayBuffer(CAMERA_UNIFORM_SIZE);
const f32 = new Float32Array(cameraRaw);

function writeCamera(eye, exposure, viewProjMatrix) {
    // eye: offset 0 ~ 11
    f32[0] = eye[0];
    f32[1] = eye[1];
    f32[2] = eye[2];

    // exposure: offset 12 ~ 15
    f32[3] = exposure;

    // viewProj: offset 16 ~ 79
    // 16 bytes = 4 个 float，因此从索引 4 开始写
    f32.set(viewProjMatrix, 4);
}

const cameraBuffer = device.createBuffer({
    label: "camera uniform buffer",
    size: CAMERA_UNIFORM_SIZE,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
});

writeCamera(
    [0, 1, 5],
    1.0,
    new Float32Array(16),
);

device.queue.writeBuffer(cameraBuffer, 0, cameraRaw);
```

这段代码里最关键的点不是 API，而是**索引和字节偏移的换算**：

- `f32[3]` 对应的是字节偏移 `3 × 4 = 12`
- `f32.set(viewProjMatrix, 4)` 对应的是字节偏移 `4 × 4 = 16`

所以当你在 JavaScript 侧写 buffer 时，脑子里要同时有两套刻度：

1. **字节偏移**：WGSL 和 WebGPU API 真正关心的
2. **TypedArray 下标**：你在 JavaScript 代码里实际操作的

### 什么时候该用多个 view

如果一段共享内存里既有浮点数，又有整型标志位，你可以给同一个 `ArrayBuffer` 建多个视图：

```js
const raw = new ArrayBuffer(16);
const f32 = new Float32Array(raw);
const u32 = new Uint32Array(raw);
```

这样：

- `f32` 负责写浮点数据
- `u32` 负责写无符号整数数据

它们看到的是**同一块底层内存**，只是解释方式不同。

::: tip 关于 `bool`
虽然 WGSL 里 `bool` 也有自己的布局规则，但在 CPU/GPU 共享的 buffer 设计中，实践里更常见的做法是直接使用 `u32` 或 `i32` 表示开关：

- `0` 表示 `false`
- `1` 表示 `true`

这样在 JavaScript 侧更容易写，也更容易调试。
:::

## uniform 布局要求

> **为了兼容更广泛的实现，uniform buffer 往往需要按 16 字节节奏来布局数组和嵌套 struct。**

uniform 主要用来放：

- 变换矩阵
- 相机参数
- 材质常量
- 灯光参数

这类数据会被 shader 高频读取，而且很多底层图形 API / GPU 实现对这类“常量缓冲区”的布局要求本来就比较保守。

数组元素的 stride，以及嵌套 struct 的布局，通常需要满足 16 字节节奏，因此工程上常把 uniform buffer 按 16 字节块来设计。

也就是说，在最保守、最不容易踩坑的 uniform 写法里：

- 数组元素 stride 通常要是 16 的倍数
- 嵌套 struct 的起始位置也通常要按 16 对齐

```wgsl
struct Inner {
    a: f32,
    b: f32,
}

struct Outer {
    inner: Inner,
    c: f32,
}
```

先看 Inner：

- a 4 字节
- b 4 字节
- 所以 Inner 自己大小是 8 字节

你可能会觉得：

- inner 放在 0
- c 放在 8

但在 uniform 的保守规则下，通常要把 inner 这个嵌套结构体看成一个按 16 字节节奏占位的块，于是：

- inner 在 0
- c 往往不能接着放在 8
- 而要放到 16

于是整个 Outer 会比你直觉里更大。

## 小结

数据内存布局这件事，一开始常常让人觉得非常“反人类”——明明写的是一个结构体，为什么还要去数每个字节？

但一旦你建立起下面这套直觉，很多问题就会突然变得非常顺：

- 先看 `size`
- 再看 `alignment`
- 需要时插入 `padding`
- 需要显式抬高布局要求时，用 `@align` / `@size`
- 数组看 `stride`，不是只看元素大小
- 矩阵按“列向量数组”去理解
- uniform 默认按 16 字节节奏思考，通常更安全

掌握这些规则后，你会发现：

- 你不再只是“把数据传给 GPU”
- 而是真正知道**GPU 将如何解释这段数据**

这正是从“会调用 WebGPU API”走向“能稳定写对 WebGPU 程序”的关键一步。
