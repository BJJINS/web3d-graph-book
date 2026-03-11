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

export type WgslFieldLayout = {
    name: string;
    type: WgslVarType;
    size: number;
    align: number;
    color: string;
    offset: number;
    paddingBefore: number;
};

export type WgslStructLayout = {
    fields: WgslFieldLayout[];
    optimalOrder: string[];
    structAlign: number;
    usedSize: number;
    rawSize: number;
    size: number;
    internalPadding: number;
    trailingPadding: number;
    padding: number;
};

const MAX_EXACT_FIELDS = 18;

const alignTo = (value: number, align: number) => Math.ceil(value / align) * align;

const buildHeuristicOrder = (fields: ReadonlyArray<WgslFieldLayout>) => {
    return [...fields].sort((a, b) => {
        if (b.align !== a.align) return b.align - a.align;
        if (b.size !== a.size) return b.size - a.size;
        return a.name.localeCompare(b.name);
    });
};

const buildExactOrder = (fields: ReadonlyArray<WgslFieldLayout>) => {
    const totalFields = fields.length;
    const totalStates = 1 << totalFields;
    const bestEnd = new Array<number>(totalStates).fill(Number.POSITIVE_INFINITY);
    const bestInternalPad = new Array<number>(totalStates).fill(Number.POSITIVE_INFINITY);
    const prevState = new Array<number>(totalStates).fill(-1);
    const prevFieldIndex = new Array<number>(totalStates).fill(-1);

    bestEnd[0] = 0;
    bestInternalPad[0] = 0;

    for (let state = 0; state < totalStates; state++) {
        if (!Number.isFinite(bestEnd[state])) continue;

        for (let index = 0; index < totalFields; index++) {
            if ((state & (1 << index)) !== 0) continue;

            const nextState = state | (1 << index);
            const field = fields[index];
            const alignedOffset = alignTo(bestEnd[state], field.align);
            const pad = alignedOffset - bestEnd[state];
            const nextEnd = alignedOffset + field.size;
            const nextInternalPad = bestInternalPad[state] + pad;

            const shouldReplace =
                nextEnd < bestEnd[nextState] ||
                (nextEnd === bestEnd[nextState] && nextInternalPad < bestInternalPad[nextState]) ||
                (nextEnd === bestEnd[nextState] &&
                    nextInternalPad === bestInternalPad[nextState] &&
                    (prevFieldIndex[nextState] < 0 || index < prevFieldIndex[nextState]));

            if (!shouldReplace) continue;
            bestEnd[nextState] = nextEnd;
            bestInternalPad[nextState] = nextInternalPad;
            prevState[nextState] = state;
            prevFieldIndex[nextState] = index;
        }
    }

    const order: WgslFieldLayout[] = [];
    let state = totalStates - 1;
    while (state > 0) {
        const index = prevFieldIndex[state];
        if (index < 0) {
            throw new Error("Failed to build exact WGSL layout order.");
        }
        order.push(fields[index]);
        state = prevState[state];
    }

    return order.reverse();
};

const withOffsets = (fields: ReadonlyArray<WgslFieldLayout>) => {
    let cursor = 0;
    return fields.map((field) => {
        const offset = alignTo(cursor, field.align);
        const paddingBefore = offset - cursor;
        cursor = offset + field.size;
        return {
            ...field,
            offset,
            paddingBefore,
        };
    });
};

// 计算 WGSL 结构体字段的最优内存排列（优先最小化 padding）。
export const calcLayout = (layout: Record<string, WgslVarType>): WgslStructLayout => {
    const baseFields: WgslFieldLayout[] = Object.entries(layout).map(([name, type]) => {
        const typeLayout = WgslVarLayoutMap[type];
        if (!typeLayout) {
            throw new Error(`Unknown WGSL type: ${type}`);
        }

        return {
            name,
            type,
            ...typeLayout,
            offset: 0,
            paddingBefore: 0,
        };
    });

    if (baseFields.length === 0) {
        return {
            fields: [],
            optimalOrder: [],
            structAlign: 1,
            usedSize: 0,
            rawSize: 0,
            size: 0,
            internalPadding: 0,
            trailingPadding: 0,
            padding: 0,
        };
    }

    const orderedFields =
        baseFields.length <= MAX_EXACT_FIELDS
            ? buildExactOrder(baseFields)
            : buildHeuristicOrder(baseFields);
    const fields = withOffsets(orderedFields);

    const usedSize = fields.reduce((sum, field) => sum + field.size, 0);
    const structAlign = Math.max(...fields.map((field) => field.align), 1);
    const rawSize = fields[fields.length - 1].offset + fields[fields.length - 1].size;
    const size = alignTo(rawSize, structAlign);
    const internalPadding = rawSize - usedSize;
    const trailingPadding = size - rawSize;
    const padding = size - usedSize;

    return {
        fields,
        optimalOrder: fields.map((field) => field.name),
        structAlign,
        usedSize,
        rawSize,
        size,
        internalPadding,
        trailingPadding,
        padding,
    };
};

export type WgslLayoutTestCase = {
    name: string;
    layout: Record<string, WgslVarType>;
};

export const WGSL_LAYOUT_TEST_CASES: WgslLayoutTestCase[] = [
    {
        name: "scalar_mixed",
        layout: {
            a: "f32",
            b: "u32",
            c: "i32",
            d: "f16",
        },
    },
    {
        name: "vec3_padding_trap",
        layout: {
            normal: "vec3f",
            metallic: "f32",
            roughness: "f32",
            ao: "f32",
        },
    },
    {
        name: "transform_like",
        layout: {
            model: "mat4x4f",
            color: "vec4f",
            uvScale: "vec2f",
            id: "u32",
        },
    },
    {
        name: "half_precision_mix",
        layout: {
            uv: "vec2h",
            normalOct: "vec3h",
            tangentSign: "f16",
            weights: "vec4h",
        },
    },
    {
        name: "atomic_counter_block",
        layout: {
            drawCount: "atomic<u32>",
            instanceCount: "u32",
            clusterOffset: "vec2u",
            flags: "vec4u",
        },
    },
    {
        name: "mat3_vec_mix",
        layout: {
            basis: "mat3x3f",
            position: "vec3f",
            padLikeValue: "f32",
            texCoord: "vec2f",
        },
    },
    {
        name: "camera_common",
        layout: {
            viewProj: "mat4x4f",
            eye: "vec3f",
            time: "f32",
            jitter: "vec2f",
            frameIndex: "u32",
        },
    },
    {
        name: "big_mixed",
        layout: {
            m0: "mat4x3f",
            m1: "mat3x4f",
            v0: "vec4f",
            v1: "vec3f",
            v2: "vec2f",
            s0: "f32",
            s1: "u32",
            s2: "f16",
        },
    },
];

console.log("111 :>> ", 111);
export const WGSL_LAYOUT_TEST_RESULTS = WGSL_LAYOUT_TEST_CASES.map((testCase) => ({
    ...testCase,
    result: calcLayout(testCase.layout),
}));

console.log("WGSL_LAYOUT_TEST_RESULTS :>> ", WGSL_LAYOUT_TEST_RESULTS);