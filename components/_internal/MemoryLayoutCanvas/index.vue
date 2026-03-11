<template>
    <canvas ref="canvasEl" class="memory_canvas"></canvas>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import WgslVarLayoutMap, { type WgslVarType } from "./dataMemoryLayout";

const props = defineProps<{ layout?: Record<string, WgslVarType> }>();
const { layout } = props;
const canvasEl = ref<HTMLCanvasElement | null>(null);
let dpr = Math.min(2, window.devicePixelRatio || 1);
console.log("dpr :>> ", WgslVarLayoutMap);
</script>

<style scoped>
.memory_canvas {
  width: 510px;
}
</style>
