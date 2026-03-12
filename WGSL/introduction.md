# WGSL 是什么

WGSL（WebGPU Shading Language）是 **WebGPU 使用的着色器语言**。

你可以先把它理解成一句话：

- **JavaScript 负责准备资源和提交命令**
- **WGSL 负责告诉 GPU 具体要计算什么**

也就是说，WebGPU 不是只写 JavaScript，也不是只写 WGSL，而是两者配合完成渲染和计算。

## WGSL 主要做什么

在 WebGPU 里，WGSL 主要用来编写 3 类着色器：

- **顶点着色器**：决定顶点的位置
- **片元着色器**：决定片元最终输出什么颜色
- **计算着色器**：执行通用并行计算

图形程序通常至少会用到前两种；做通用 GPU 计算时，则会用到计算着色器。

## WGSL 长什么样

WGSL 是一门**强类型语言**。常见类型包括：

- 标量：`bool`、`i32`、`u32`、`f32`
- 向量：`vec2f`、`vec3f`、`vec4f`
- 矩阵：`mat3x3f`、`mat4x4f`
- 结构体：`struct`

下面是一段最小示例：

```wgsl
@vertex
fn vs(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f {
    let pos = array<vec2f, 3>(
        vec2f(0.0, 0.5),
        vec2f(-0.5, -0.5),
        vec2f(0.5, -0.5),
    );
    return vec4f(pos[i], 0.0, 1.0);
}

@fragment
fn fs() -> @location(0) vec4f {
    return vec4f(1.0, 0.4, 0.2, 1.0);
}
```

这段代码里：

- `@vertex` 表示这是顶点着色器入口
- `@fragment` 表示这是片元着色器入口
- `vs` 返回顶点位置
- `fs` 返回片元颜色

函数名可以自己起，但入口类型必须用 `@vertex`、`@fragment` 或 `@compute` 标出来。

## 初学时先记住 3 点

1. **WGSL 运行在 GPU 上，不运行在 CPU 上**
2. **WGSL 是强类型语言，类型必须写清楚**
3. **WGSL 往往会和 buffer、纹理、绑定一起使用**
