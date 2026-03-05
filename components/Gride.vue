<template>
    <div ref="contentEl" class="triangle-grid-root">
        <canvas ref="canvasEl"></canvas>
    </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";

const cellSize = 48;
const Inside_Fill_Style = 'rgba(59, 130, 246, 0.14)';

const dragDots = [];


const canvasEl = ref<HTMLCanvasElement>();
const contentEl = ref<HTMLDivElement>();
const dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));


let ro: ResizeObserver;
let raIdx: number | null = null;
let ctx: CanvasRenderingContext2D | null;

const drawGride = () => {
    if (!canvasEl.value || !ctx) {
        return;
    }
    const { height, width } = canvasEl.value;
    const rowCells = height / cellSize;
    const colCells = width / cellSize;

    ctx.beginPath();
    ctx.strokeStyle = 'rgba(80, 80, 80, 0.25)';
    for (let i = 0; i < rowCells + 1; i++) {
        ctx.moveTo(0, i * cellSize);
        ctx.lineTo(colCells * cellSize, i * cellSize);
    }

    for (let i = 0; i < colCells + 1; i++) {
        ctx.moveTo(i * cellSize, 0);
        ctx.lineTo(i * cellSize, rowCells * cellSize);
    }
    ctx.stroke();

    ctx.fillStyle = 'rgba(30, 64, 175, 0.55)';

    for (let x = 0; x < rowCells; x++) {
        for (let y = 0; y < colCells; y++) {
            ctx.beginPath();
            ctx.arc((y + 0.5) * cellSize, (x + 0.5) * cellSize, 3, 0, Math.PI * 2);
            ctx.fill();
        }
    }

};

const update = () => {
    if (!canvasEl.value || !ctx) {
        return;
    }
    ctx.clearRect(0, 0, canvasEl.value.width, canvasEl.value.height)
    drawGride();
    raIdx = null;
};


const requestDraw = () => {
    if (raIdx === null) {
        raIdx = requestAnimationFrame(update);
    }
};


onMounted(() => {
    if (!canvasEl.value) {
        return
    }
    ctx = canvasEl.value.getContext("2d");
    if (!ctx) {
        return;
    }
    ro = new ResizeObserver((entries) => {
        for (const entry of entries) {
            let width = entry.contentBoxSize[0].inlineSize;
            let height = entry.contentBoxSize[0].blockSize;
            canvasEl.value!.setAttribute("style", `width: ${width}px; height: ${height};`);
            width *= dpr;
            height *= dpr;
            const canvasWidth = width - width % cellSize;
            const canvasHeight = height - height % cellSize;
            canvasEl.value!.height = canvasHeight;
            canvasEl.value!.width = canvasWidth;
            requestDraw();
        }
    });
    ro.observe(contentEl.value!);
});


onBeforeUnmount(() => {
    if (!contentEl.value) {
        return;
    }
    ro.unobserve(contentEl.value);
    if (raIdx !== null) {
        cancelAnimationFrame(raIdx);
    }
})


</script>

<style scoped>
.triangle-grid-root {
    width: 100%;
    height: 420px;
    border: 1px solid rgba(0, 0, 0, 0.12);
    border-radius: 10px;
    overflow: hidden;
    background: rgba(255, 255, 255, 0.9);
    display: flex;
    justify-content: center;
}
</style>