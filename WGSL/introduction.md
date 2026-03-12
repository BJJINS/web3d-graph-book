# WGSL 是什么

WGSL（WebGPU Shading Language）是 **WebGPU 的着色器语言**。  
你可以把它理解为“写给 GPU 执行的程序语言”，用于告诉 GPU：

- 顶点该放到屏幕哪里（顶点着色器）
- 像素该显示什么颜色（片元着色器）
- 如何并行处理大量数据（计算着色器）

尽管角色不同，但每个 WebGPU 着色器都是用 WebGPU 着色器语言（简称 WGSL）编写的。WGSL 部分基于 JavaScript，部分基于 C 编程语言，但与 JavaScript 和 C 不同的是，WGSL 函数在 GPU 而非 CPU 上运行。

WGSL 需要和 JavaScript 配合使用：  

JavaScript 负责创建管线、准备数据、发出命令；WGSL 负责在 GPU 上执行具体计算。

## WGSL 在 WebGPU 里的位置

一个简化流程如下：

1. JavaScript 创建 `GPUBuffer`、`GPURenderPipeline` 等对象
2. JavaScript 把 WGSL 代码交给 GPU 编译和校验
3. GPU 按 WGSL 的入口函数执行渲染或计算
4. 结果写入屏幕（纹理）或缓冲区

所以，WebGPU 解决“怎么调度 GPU”，WGSL 解决“GPU 具体做什么”。

## 最小直觉示例

下面是一段最小 WGSL：顶点着色器输出位置，片元着色器输出固定颜色。

```wgsl
@vertex
fn vs(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f {
    let pos = array<vec2f, 3>(
        vec2f(0.0, 0.5),
        vec2f(-0.5, -0.5),
        vec2f(0.5, -0.5)
    );
    return vec4f(pos[i], 0.0, 1.0);
}

@fragment
fn fs() -> @location(0) vec4f {
    return vec4f(1.0, 0.4, 0.2, 1.0);
}
```

这段代码先定义三角形三个顶点的位置，再让每个像素输出同一种颜色。

## WGSL 的特点

1. 强类型：类型不匹配会在校验阶段直接报错  
2. 注解明确：通过 `@vertex`、`@fragment`、`@location`、`@builtin` 标注语义  
3. 面向现代 GPU：同时支持渲染管线和计算管线  
4. 与 WebGPU 一体化：资源绑定规则（`@group`/`@binding`）与 WebGPU API 直接对应
