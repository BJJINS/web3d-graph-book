type WgslVarLayout = {
    size: number;
    align: number;
    color: string;
};

const s2a2 = { size: 2, align: 2, color: "#ec4899" };
const s4a4 = { size: 4, align: 4, color: "#ef4444" };
const s6a8 = { size: 6, align: 8, color: "#d946ef" };
const s8a4 = { size: 8, align: 4, color: "#22c55e" };
const s8a8 = { size: 8, align: 8, color: "#f97316" };
const s16a4 = { size: 16, align: 4, color: "#8b5cf6" };
const s16a8 = { size: 16, align: 8, color: "#84cc16" };
const s12a16 = { size: 12, align: 16, color: "#f59e0b" };
const s16a16 = { size: 16, align: 16, color: "#eab308" };
const s24a8 = { size: 24, align: 8, color: "#10b981" };
const s12a4 = { size: 12, align: 4, color: "#14b8a6" };
const s32a8 = { size: 32, align: 8, color: "#06b6d4" };
const s32a16 = { size: 32, align: 16, color: "#0ea5e9" };
const s48a16 = { size: 48, align: 16, color: "#3b82f6" };
const s64a16 = { size: 64, align: 16, color: "#6366f1" };

const WgslVarLayoutMap = {
    "i32": s4a4,
    "u32": s4a4,
    "f32": s4a4,
    "f16": s2a2,

    "atomic<u32>": s4a4,
    "atomic<i32>": s4a4,
    "vec2<i32>": s8a8,
    "vec2i": s8a8,
    "vec2<u32>": s8a8,
    "vec2u": s8a8,
    "vec2<f32>": s8a8,
    "vec2f": s8a8,
    "vec2<f16>": s4a4,
    "vec2h": s4a4,
    "vec3<i32>": s12a16,
    "vec3i": s12a16,
    "vec3<u32>": s12a16,
    "vec3u": s12a16,
    "vec3<f32>": s12a16,
    "vec3f": s12a16,
    "vec3<f16>": s6a8,
    "vec3h": s6a8,
    "vec4<i32>": s16a16,
    "vec4i": s16a16,
    "vec4<u32>": s16a16,
    "vec4u": s16a16,
    "vec4<f32>": s16a16,
    "vec4f": s16a16,
    "vec4<f16>": s8a8,
    "vec4h": s8a8,

    "mat2x2<f32>": s16a8,
    "mat2x2f": s16a8,
    "mat2x2<f16>": s8a4,
    "mat2x2h": s8a4,
    "mat3x2<f32>": s24a8,
    "mat3x2f": s24a8,
    "mat3x2<f16>": s12a4,
    "mat3x2h": s12a4,
    "mat4x2<f32>": s32a8,
    "mat4x2f": s32a8,
    "mat4x2<f16>": s16a4,
    "mat4x2h": s16a4,
    "mat2x3<f32>": s32a16,
    "mat2x3f": s32a16,
    "mat2x3<f16>": s16a8,
    "mat2x3h": s16a8,
    "mat3x3<f32>": s48a16,
    "mat3x3f": s48a16,
    "mat3x3<f16>": s24a8,
    "mat3x3h": s24a8,
    "mat4x3<f32>": s64a16,
    "mat4x3f": s64a16,
    "mat4x3<f16>": s32a8,
    "mat4x3h": s32a8,
    "mat2x4<f32>": s32a16,
    "mat2x4f": s32a16,
    "mat2x4<f16>": s16a8,
    "mat2x4h": s16a8,
    "mat3x4<f32>": s48a16,
    "mat3x4f": s48a16,
    "mat3x4<f16>": s24a8,
    "mat3x4h": s24a8,
    "mat4x4<f32>": s64a16,
    "mat4x4f": s64a16,
    "mat4x4<f16>": s32a8,
    "mat4x4h": s32a8
} as const satisfies Record<string, WgslVarLayout>;

export default WgslVarLayoutMap;
export type WgslVarType = keyof typeof WgslVarLayoutMap;

