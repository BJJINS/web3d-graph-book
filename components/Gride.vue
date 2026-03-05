<template>
    <div ref="contentEl" class="triangle-grid-root">
        <canvas ref="canvasEl"></canvas>
    </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";

const Cell_Size = 48;
const Gride_Stroke_Style = 'rgba(80, 80, 80, 0.25)';
const Inside_Fill_Style = 'rgba(59, 130, 246, 0.14)';
const Cell_Dot_Fill_Style = 'rgba(30, 64, 175, 0.55)';

const Cell_Point_Radius = 3;

const dragDots = [];


const canvasEl = ref<HTMLCanvasElement>();
const contentEl = ref<HTMLDivElement>();
const dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));


let ro: ResizeObserver;
let raIdx: number | null = null;

let ctx: CanvasRenderingContext2D;

const drawGride = () => {
    const { height, width } = canvasEl.value!;
    const rowCells = height / Cell_Size;
    const colCells = width / Cell_Size;

    ctx.beginPath();
    ctx.strokeStyle = Gride_Stroke_Style;
    for (let i = 0; i < rowCells + 1; i++) {
        ctx.moveTo(0, i * Cell_Size);
        ctx.lineTo(colCells * Cell_Size, i * Cell_Size);
    }

    for (let i = 0; i < colCells + 1; i++) {
        ctx.moveTo(i * Cell_Size, 0);
        ctx.lineTo(i * Cell_Size, rowCells * Cell_Size);
    }
    ctx.stroke();

    ctx.fillStyle = Cell_Dot_Fill_Style;

    for (let x = 0; x < rowCells; x++) {
        for (let y = 0; y < colCells; y++) {
            ctx.beginPath();
            ctx.arc((y + 0.5) * Cell_Size, (x + 0.5) * Cell_Size, Cell_Point_Radius, 0, Math.PI * 2);
            ctx.fill();
        }
    }

};

const update = () => {
    ctx.clearRect(0, 0, canvasEl.value!.width, canvasEl.value!.height)
    drawGride();
    raIdx = null;
};


const requestDraw = () => {
    if (raIdx === null) {
        raIdx = requestAnimationFrame(update);
    }
};


onMounted(() => {
    ctx = canvasEl.value!.getContext("2d")!;
    ro = new ResizeObserver((entries) => {
        for (const entry of entries) {
            let width = entry.contentBoxSize[0].inlineSize;
            let height = entry.contentBoxSize[0].blockSize;
            canvasEl.value!.setAttribute("style", `width: ${width}px; height: ${height};`);
            width *= dpr;
            height *= dpr;
            const canvasWidth = width - width % Cell_Size;
            const canvasHeight = height - height % Cell_Size;
            canvasEl.value!.height = canvasHeight;
            canvasEl.value!.width = canvasWidth;
            requestDraw();
        }
    });
    ro.observe(contentEl.value!);
});


onBeforeUnmount(() => {
    ro.unobserve(contentEl.value!);
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