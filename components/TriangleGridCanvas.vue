<template>
    <div class="triangle-grid-root">
        <div ref="contentEl" class="triangle-grid-canvas-wrapper">
            <canvas ref="canvasEl" class="triangle-grid-canvas"></canvas>
        </div>
        <p class="triangle-grid-hint">提示：拖动圆点改变三角形的形状</p>
    </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";

const cellSize = 20; // 格子大小
const insideCellColor = 'rgba(99, 102, 241, 0.12)'; // 在三角形内部的格子颜色
const gridColor = 'rgba(148, 163, 184, 0.35)'; // 网格线颜色
const cellPointColor = 'rgba(148, 163, 184, 0.45)'; // 网格中心点颜色
const cellPointRadius = 2; // 网格中心点大小
const draggableDotSize = 4; // 可拖拽点的大小
const draggableDotPadding = 6; // 拖拽检测范围
const draggableDotColor = 'rgba(99, 102, 241, 0.95)'; // 可拖拽点的颜色
const triangleColor = "rgba(99, 102, 241, 0.85)"; // 三个可拖拽点的连线颜色

const TAU = Math.PI * 2;

type Vec2 = { x: number; y: number; };
const dragDots: Vec2[] = [];

let canvasCssWidth = 0;
let canvasCssHeight = 0;
let draggingIndex: number | null = null;
let hoveringIndex: number | null = null;

const canvasEl = ref<HTMLCanvasElement>();
const contentEl = ref<HTMLDivElement>();
const dpr = Math.max(1, Math.floor(((typeof window !== 'undefined' ? window.devicePixelRatio : 1) || 1)));

let ro: ResizeObserver;
let raHandle: number | null = null;
let ctx: CanvasRenderingContext2D | null;
let gridCanvas: HTMLCanvasElement | null = null;
let gridCtx: CanvasRenderingContext2D | null = null;


const cross = (a: Vec2, b: Vec2, c: Vec2) => {
    return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
};

const cellPointInTriangle = (cell: Vec2) => {
    // 同向叉积法
    const [a, b, c] = dragDots;

    const d1 = cross(a, b, cell);
    const d2 = cross(b, c, cell);
    const d3 = cross(c, a, cell);

    return (d1 >= 0.0 && d2 >= 0.0 && d3 >= 0.0) || (d1 <= 0.0 && d2 <= 0.0 && d3 <= 0.0);
};

const drawTriangle = () => {
    if (!ctx) {
        return;
    }
    ctx.beginPath();
    ctx.strokeStyle = triangleColor;
    ctx.lineWidth = 2;
    ctx.moveTo(dragDots[0].x, dragDots[0].y);
    ctx.lineTo(dragDots[1].x, dragDots[1].y);
    ctx.lineTo(dragDots[2].x, dragDots[2].y);
    ctx.closePath();
    ctx.stroke();
};

const drawDraggableDots = () => {
    if (!ctx) {
        return;
    }

    for (const dot of dragDots) {
        ctx.beginPath();
        ctx.fillStyle = 'rgba(255, 255, 255, 1)';
        ctx.arc(dot.x, dot.y, draggableDotPadding, 0, TAU);
        ctx.fill();

        ctx.beginPath();
        ctx.fillStyle = draggableDotColor;
        ctx.arc(dot.x, dot.y, draggableDotSize, 0, TAU);
        ctx.fill();
    }
};

const drawStaticGrid = (colCellNum: number, rowCellNum: number) => {
    if (!gridCtx || !gridCanvas) {
        return;
    }
    gridCtx.setTransform(1, 0, 0, 1, 0, 0);
    gridCtx.clearRect(0, 0, gridCanvas.width, gridCanvas.height);
    gridCtx.scale(dpr, dpr);
    gridCtx.beginPath();
    gridCtx.strokeStyle = gridColor;
    gridCtx.lineWidth = 1;
    for (let i = 0; i < colCellNum + 1; i++) {
        gridCtx.moveTo(i * cellSize, 0);
        gridCtx.lineTo(i * cellSize, canvasCssHeight);
    }
    for (let i = 0; i < rowCellNum + 1; i++) {
        gridCtx.moveTo(0, i * cellSize);
        gridCtx.lineTo(canvasCssWidth, i * cellSize);
    }
    gridCtx.stroke();

    for (let i = 0; i < colCellNum; i++) {
        for (let j = 0; j < rowCellNum; j++) {
            gridCtx.beginPath();
            gridCtx.fillStyle = cellPointColor;
            gridCtx.arc((i + 0.5) * cellSize, (j + 0.5) * cellSize, cellPointRadius, 0, TAU);
            gridCtx.fill();
        }
    }
};

const drawInsideCells = (colCellNum: number, rowCellNum: number) => {
    if (!ctx) {
        return;
    }

    for (let i = 0; i < colCellNum; i++) {
        for (let j = 0; j < rowCellNum; j++) {
            if (cellPointInTriangle({ x: (i + 0.5) * cellSize, y: (j + 0.5) * cellSize })) {
                ctx.beginPath();
                ctx.fillStyle = insideCellColor;
                ctx.fillRect(i * cellSize, j * cellSize, cellSize, cellSize);
                ctx.fill();
            }
        }
    }
};

const drawGride = () => {
    if (!canvasEl.value || !ctx) {
        return;
    }

    const colCellNum = Math.floor(canvasCssWidth / cellSize);
    const rowCellNum = Math.floor(canvasCssHeight / cellSize);

    if (gridCanvas) {
        ctx.drawImage(gridCanvas, 0, 0, gridCanvas.width, gridCanvas.height, 0, 0, canvasCssWidth, canvasCssHeight);
    }
    drawInsideCells(colCellNum, rowCellNum);
};

const draw = () => {
    if (!ctx) {
        return;
    }
    ctx.clearRect(0, 0, canvasCssWidth, canvasCssHeight);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    drawGride();
    drawTriangle();
    drawDraggableDots();
    raHandle = null;
};

const requestDraw = () => {
    if (raHandle === null) {
        raHandle = requestAnimationFrame(draw);
    }
};

const resizeCanvas = () => {
    if (!contentEl.value || !canvasEl.value) {
        return;
    }
    let { width, height } = contentEl.value.getBoundingClientRect();
    width = width - width % cellSize;
    height = height - height % cellSize;
    canvasCssWidth = width;
    canvasCssHeight = height;
    canvasEl.value.style.height = `${height}px`;
    canvasEl.value.style.width = `${width}px`;
    canvasEl.value.height = height * dpr;
    canvasEl.value.width = width * dpr;

    if (typeof document !== 'undefined') {
        if (!gridCanvas) {
            gridCanvas = document.createElement('canvas');
        }
        gridCanvas.width = canvasEl.value.width;
        gridCanvas.height = canvasEl.value.height;
        gridCtx = gridCanvas.getContext('2d');
        if (gridCtx) {
            const colCellNum = Math.floor(canvasCssWidth / cellSize);
            const rowCellNum = Math.floor(canvasCssHeight / cellSize);
            drawStaticGrid(colCellNum, rowCellNum);
        }
    }

    if (!dragDots.length) {
        const dot1 = { x: canvasCssWidth * 0.5, y: canvasCssHeight * 0.25 };
        const dot2 = { x: canvasCssWidth * 0.25, y: canvasCssHeight * 0.75 };
        const dot3 = { x: canvasCssWidth * 0.75, y: canvasCssHeight * 0.75 };
        dragDots.push(dot1, dot2, dot3);
    }

    for (const dot of dragDots) {
        if (dot.x > canvasCssWidth) {
            dot.x = canvasCssWidth;
        }
        if (dot.y > canvasCssHeight) {
            dot.y = canvasCssHeight;
        }
    }
    requestDraw();
};

const dist2 = (v1: Vec2, v2: Vec2) => {
    return (v1.x - v2.x) * (v1.x - v2.x) + (v1.y - v2.y) * (v1.y - v2.y);
};

const onPointerDown = (e: PointerEvent) => {
    if (!canvasEl.value || hoveringIndex === null) {
        return;
    }

    draggingIndex = hoveringIndex;
    canvasEl.value.style.cursor = "grabbing";
    try {
        canvasEl.value.setPointerCapture(e.pointerId);
    } catch { }
};

const onPointerMove = (e: PointerEvent) => {
    if (!canvasEl.value) {
        return;
    }
    const { left, top } = canvasEl.value.getBoundingClientRect();
    const pos = { x: e.clientX - left, y: e.clientY - top };
    if (draggingIndex === null) {
        for (let i = 0; i < dragDots.length; i++) {
            const dot = dragDots[i];
            if (dist2(pos, dot) <= draggableDotPadding * draggableDotPadding) {
                hoveringIndex = i;
                canvasEl.value.style.cursor = "grab";
                return;
            }
        }
        hoveringIndex = null;
        return;
    }

    const draggingDot = dragDots[draggingIndex];
    draggingDot.x = Math.max(draggableDotSize, Math.min(canvasCssWidth - draggableDotSize, pos.x));
    draggingDot.y = Math.max(draggableDotSize, Math.min(canvasCssHeight - draggableDotSize, pos.y));

    requestDraw();
};

const onEndDrag = (e: PointerEvent) => {
    if (!canvasEl.value) {
        return;
    }
    draggingIndex = null;
    canvasEl.value.style.cursor = hoveringIndex === null ? "" : "grab";
    try {
        canvasEl.value.releasePointerCapture(e.pointerId);
    } catch { }
};

onMounted(() => {
    if (!canvasEl.value || !contentEl.value) {
        return;
    }
    ctx = canvasEl.value.getContext('2d');
    if (!ctx) {
        return;
    }

    ro = new ResizeObserver(resizeCanvas);
    ro.observe(contentEl.value);
    canvasEl.value.addEventListener("pointerdown", onPointerDown);
    canvasEl.value.addEventListener("pointermove", onPointerMove);
    canvasEl.value.addEventListener("pointerup", onEndDrag);
    canvasEl.value.addEventListener("pointerleave", onEndDrag);
    canvasEl.value.addEventListener('pointercancel', onEndDrag);
});

onBeforeUnmount(() => {
    if (ro) {
        ro.disconnect();
    }
    if (raHandle !== null) {
        cancelAnimationFrame(raHandle);
        raHandle = null;
    }

    if (canvasEl.value) {
        canvasEl.value.removeEventListener("pointerdown", onPointerDown);
        canvasEl.value.removeEventListener("pointermove", onPointerMove);
        canvasEl.value.removeEventListener("pointerup", onEndDrag);
        canvasEl.value.removeEventListener("pointerleave", onEndDrag);
        canvasEl.value.removeEventListener('pointercancel', onEndDrag);
    }
});

</script>

<style scoped>
.triangle-grid-root {
    width: 100%;
    height: 420px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
}

.triangle-grid-canvas-wrapper {
    width: 100%;
    flex: 1;
}

.triangle-grid-canvas {
    display: block;
    width: 100%;
    height: 100%;
    touch-action: none;
}

.triangle-grid-hint {
    margin: 0;
    font-size: 12px;
    line-height: 1.4;
    color: #6b7280;
}
</style>
