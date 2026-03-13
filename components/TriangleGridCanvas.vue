<template>
  <div class="triangle-grid-root">
    <div class="triangle-grid-board">
      <section class="triangle-grid-stage">
        <div class="triangle-grid-toolbar">
          <span class="triangle-grid-chip">
            Primitive：1 个三角形
          </span>
          <span class="triangle-grid-chip">
            覆盖片元：{{ coveredFragmentCount }}
          </span>
          <span class="triangle-grid-chip">
            演示规则：中心采样近似
          </span>
        </div>

        <div ref="contentEl" class="triangle-grid-canvas-wrapper">
          <canvas ref="canvasEl" class="triangle-grid-canvas"></canvas>
        </div>

        <p class="triangle-grid-hint">
          拖动顶点改变图元形状；悬停方格查看一个片元候选样本以及它的插值颜色。
        </p>
      </section>

      <aside class="triangle-grid-sidebar">
        <section class="triangle-grid-card">
          <h3 class="triangle-grid-card-title">这张图在表达什么</h3>
          <ul class="triangle-grid-list">
            <li>彩色边框三角形表示一个 <strong>primitive（图元）</strong>。</li>
            <li>被高亮的方格表示光栅化后可能产生的 <strong>fragment（片元）</strong>。</li>
            <li>每个方格中心点表示这个演示使用的采样位置：中心点落在三角形内，就把该格视为被覆盖。</li>
          </ul>
        </section>

        <section class="triangle-grid-card">
          <h3 class="triangle-grid-card-title">片元样本</h3>

          <template v-if="hoveredGridCell && hoveredFragment && draggingIndex === null">
            <div class="triangle-grid-sample">
              <div class="triangle-grid-swatch" :style="sampleSwatchStyle"></div>
              <div class="triangle-grid-sample-meta">
                <div><strong>格子：</strong>{{ hoveredGridCell.col }}, {{ hoveredGridCell.row }}</div>
                <div>
                  <strong>采样点：</strong>
                  ({{ hoveredGridCell.center.x.toFixed(1) }}, {{ hoveredGridCell.center.y.toFixed(1) }})
                </div>
              </div>
            </div>

            <div class="triangle-grid-weight-list">
              <div class="triangle-grid-weight-row">
                <span>V0 权重</span>
                <strong>{{ formatPercent(hoveredFragment.weights[0]) }}</strong>
              </div>
              <div class="triangle-grid-weight-row">
                <span>V1 权重</span>
                <strong>{{ formatPercent(hoveredFragment.weights[1]) }}</strong>
              </div>
              <div class="triangle-grid-weight-row">
                <span>V2 权重</span>
                <strong>{{ formatPercent(hoveredFragment.weights[2]) }}</strong>
              </div>
            </div>

            <p class="triangle-grid-note">
              这个样本点位于三角形内部，因此会生成片元，并把插值后的属性交给片元着色器。
            </p>
          </template>

          <template v-else-if="hoveredGridCell">
            <div class="triangle-grid-sample-meta">
              <div><strong>格子：</strong>{{ hoveredGridCell.col }}, {{ hoveredGridCell.row }}</div>
              <div>
                <strong>采样点：</strong>
                ({{ hoveredGridCell.center.x.toFixed(1) }}, {{ hoveredGridCell.center.y.toFixed(1) }})
              </div>
            </div>
            <p class="triangle-grid-note">
              该格子的中心点没有落在三角形内，所以这个演示不会把它记作被覆盖的片元。
            </p>
          </template>

          <p v-else class="triangle-grid-note">
            把鼠标移到网格上，观察某个片元候选是如何由图元和采样位置决定的。
          </p>
        </section>

        <section class="triangle-grid-card">
          <h3 class="triangle-grid-card-title">顶点颜色</h3>
          <div class="triangle-grid-legend">
            <div
              v-for="item in vertexLegend"
              :key="item.label"
              class="triangle-grid-legend-item"
            >
              <span class="triangle-grid-legend-dot" :style="{ background: item.solid }"></span>
              <span>{{ item.label }}</span>
            </div>
          </div>
          <p class="triangle-grid-note">
            片元颜色按照三个顶点的权重混合，直观展示“插值”是怎么发生的。
          </p>
        </section>

        <section class="triangle-grid-card triangle-grid-card--grow">
          <h3 class="triangle-grid-card-title">当前统计</h3>
          <div class="triangle-grid-stats">
            <div class="triangle-grid-stat">
              <span class="triangle-grid-stat-label">顶点数</span>
              <strong>3</strong>
            </div>
            <div class="triangle-grid-stat">
              <span class="triangle-grid-stat-label">图元数</span>
              <strong>1</strong>
            </div>
            <div class="triangle-grid-stat">
              <span class="triangle-grid-stat-label">覆盖片元</span>
              <strong>{{ coveredFragmentCount }}</strong>
            </div>
            <div class="triangle-grid-stat">
              <span class="triangle-grid-stat-label">网格尺寸</span>
              <strong>{{ `${gridCols} × ${gridRows}` }}</strong>
            </div>
          </div>
          <p class="triangle-grid-note">
            片元只是候选像素。真实 GPU 后面还可能进行深度测试、模板测试与混合。
          </p>
        </section>
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";

const cellSize = 20;
const TAU = Math.PI * 2;
const EPSILON = 1e-6;

const dpr = Math.min(2, typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1);

type Vec2 = { x: number; y: number };
type Rgb = [number, number, number];
type FragmentSample = {
  row: number;
  col: number;
  center: Vec2;
  weights: [number, number, number];
  rgb: Rgb;
};

const vertexLegend = [
  { label: "V0 · 红色", rgb: [239, 68, 68] as Rgb, solid: "rgb(239, 68, 68)" },
  { label: "V1 · 绿色", rgb: [34, 197, 94] as Rgb, solid: "rgb(34, 197, 94)" },
  { label: "V2 · 蓝色", rgb: [59, 130, 246] as Rgb, solid: "rgb(59, 130, 246)" },
] as const;

const dragDots: Vec2[] = [];

const canvasEl = ref<HTMLCanvasElement | null>(null);
const contentEl = ref<HTMLDivElement | null>(null);

const coveredFragmentCount = ref(0);
const gridCols = ref(0);
const gridRows = ref(0);
const hoveredGridCell = ref<{ row: number; col: number; center: Vec2 } | null>(null);
const hoveredFragment = ref<FragmentSample | null>(null);

let canvasCssWidth = 0;
let canvasCssHeight = 0;
let draggingIndex: number | null = null;
let hoveringIndex: number | null = null;

let ro: ResizeObserver | null = null;
let raHandle: number | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let gridCanvas: HTMLCanvasElement | null = null;
let gridCtx: CanvasRenderingContext2D | null = null;

const fragmentCache = new Map<string, FragmentSample>();

const sampleSwatchStyle = computed(() => {
  if (!hoveredFragment.value) {
    return {};
  }

  const [r, g, b] = hoveredFragment.value.rgb;
  return {
    background: `rgb(${r}, ${g}, ${b})`,
    boxShadow: `0 0 0 1px rgba(${r}, ${g}, ${b}, 0.25) inset`,
  };
});

const keyOf = (row: number, col: number) => `${row}:${col}`;

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

const cross = (a: Vec2, b: Vec2, c: Vec2) => {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
};

const barycentricWeights = (point: Vec2): [number, number, number] | null => {
  const [a, b, c] = dragDots;
  const denominator = cross(a, b, c);

  if (Math.abs(denominator) < EPSILON) {
    return null;
  }

  const w0 = cross(b, c, point) / denominator;
  const w1 = cross(c, a, point) / denominator;
  const w2 = cross(a, b, point) / denominator;

  return [w0, w1, w2];
};

const isInsideTriangle = (weights: [number, number, number]) => {
  return weights.every((weight) => weight >= -EPSILON && weight <= 1 + EPSILON);
};

const interpolateRgb = (weights: [number, number, number]): Rgb => {
  let r = 0;
  let g = 0;
  let b = 0;

  for (let i = 0; i < 3; i++) {
    r += weights[i] * vertexLegend[i].rgb[0];
    g += weights[i] * vertexLegend[i].rgb[1];
    b += weights[i] * vertexLegend[i].rgb[2];
  }

  return [Math.round(r), Math.round(g), Math.round(b)];
};

const rgba = ([r, g, b]: Rgb, alpha: number) => `rgba(${r}, ${g}, ${b}, ${alpha})`;

const formatPercent = (value: number) => `${(clamp01(value) * 100).toFixed(1)}%`;

const updateHoveredFragment = () => {
  if (!hoveredGridCell.value) {
    hoveredFragment.value = null;
    return;
  }

  hoveredFragment.value = fragmentCache.get(keyOf(hoveredGridCell.value.row, hoveredGridCell.value.col)) ?? null;
};

const drawStaticGrid = () => {
  if (!gridCtx || !gridCanvas) {
    return;
  }

  gridCtx.setTransform(1, 0, 0, 1, 0, 0);
  gridCtx.clearRect(0, 0, gridCanvas.width, gridCanvas.height);
  gridCtx.scale(dpr, dpr);

  gridCtx.strokeStyle = "rgba(148, 163, 184, 0.34)";
  gridCtx.lineWidth = 1;
  gridCtx.beginPath();

  for (let i = 0; i < gridCols.value + 1; i++) {
    gridCtx.moveTo(i * cellSize, 0);
    gridCtx.lineTo(i * cellSize, canvasCssHeight);
  }

  for (let i = 0; i < gridRows.value + 1; i++) {
    gridCtx.moveTo(0, i * cellSize);
    gridCtx.lineTo(canvasCssWidth, i * cellSize);
  }

  gridCtx.stroke();

  for (let row = 0; row < gridRows.value; row++) {
    for (let col = 0; col < gridCols.value; col++) {
      gridCtx.beginPath();
      gridCtx.fillStyle = "rgba(148, 163, 184, 0.35)";
      gridCtx.arc((col + 0.5) * cellSize, (row + 0.5) * cellSize, 1.75, 0, TAU);
      gridCtx.fill();
    }
  }
};

const drawFragmentCells = () => {
  if (!ctx) {
    return;
  }

  fragmentCache.clear();

  let count = 0;

  for (let row = 0; row < gridRows.value; row++) {
    for (let col = 0; col < gridCols.value; col++) {
      const center = {
        x: (col + 0.5) * cellSize,
        y: (row + 0.5) * cellSize,
      };

      const weights = barycentricWeights(center);
      if (!weights || !isInsideTriangle(weights)) {
        continue;
      }

      const rgb = interpolateRgb(weights);
      const key = keyOf(row, col);
      const isHovered = hoveredGridCell.value?.row === row && hoveredGridCell.value?.col === col;

      fragmentCache.set(key, { row, col, center, weights, rgb });
      count += 1;

      ctx.fillStyle = rgba(rgb, isHovered ? 0.42 : 0.26);
      ctx.fillRect(col * cellSize, row * cellSize, cellSize, cellSize);
    }
  }

  coveredFragmentCount.value = count;
  updateHoveredFragment();
};

const drawHoveredCell = () => {
  if (!ctx || !hoveredGridCell.value) {
    return;
  }

  const { row, col, center } = hoveredGridCell.value;
  const fragment = hoveredFragment.value;
  const left = col * cellSize;
  const top = row * cellSize;

  ctx.save();
  ctx.lineWidth = 2;
  ctx.strokeStyle = fragment ? "rgba(255, 255, 255, 0.95)" : "rgba(148, 163, 184, 0.9)";
  ctx.setLineDash(fragment ? [] : [4, 4]);
  ctx.strokeRect(left + 1, top + 1, cellSize - 2, cellSize - 2);
  ctx.restore();

  ctx.beginPath();
  ctx.fillStyle = fragment ? "rgba(255, 255, 255, 0.95)" : "rgba(148, 163, 184, 0.85)";
  ctx.arc(center.x, center.y, 3.2, 0, TAU);
  ctx.fill();
};

const drawTriangle = () => {
  if (!ctx || dragDots.length < 3) {
    return;
  }

  ctx.beginPath();
  ctx.moveTo(dragDots[0].x, dragDots[0].y);
  ctx.lineTo(dragDots[1].x, dragDots[1].y);
  ctx.lineTo(dragDots[2].x, dragDots[2].y);
  ctx.closePath();
  ctx.fillStyle = "rgba(99, 102, 241, 0.08)";
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = "rgba(99, 102, 241, 0.88)";
  ctx.stroke();
};

const drawInterpolationGuides = () => {
  if (!ctx || !hoveredFragment.value) {
    return;
  }

  ctx.save();
  ctx.strokeStyle = "rgba(99, 102, 241, 0.45)";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([5, 5]);

  for (const dot of dragDots) {
    ctx.beginPath();
    ctx.moveTo(hoveredFragment.value.center.x, hoveredFragment.value.center.y);
    ctx.lineTo(dot.x, dot.y);
    ctx.stroke();
  }

  ctx.restore();
};

const drawVertices = () => {
  if (!ctx) {
    return;
  }

  for (let i = 0; i < dragDots.length; i++) {
    const dot = dragDots[i];
    const color = vertexLegend[i].solid;
    const isHovered = hoveringIndex === i || draggingIndex === i;

    ctx.beginPath();
    ctx.fillStyle = "rgba(255, 255, 255, 0.98)";
    ctx.arc(dot.x, dot.y, isHovered ? 10 : 8, 0, TAU);
    ctx.fill();

    ctx.beginPath();
    ctx.fillStyle = color;
    ctx.arc(dot.x, dot.y, isHovered ? 6.2 : 5, 0, TAU);
    ctx.fill();

    ctx.fillStyle = "rgba(15, 23, 42, 0.92)";
    ctx.font = "700 12px Inter, ui-sans-serif, system-ui, sans-serif";
    ctx.fillText(`V${i}`, dot.x + 10, dot.y - 10);
  }
};

const drawScene = () => {
  if (!ctx) {
    return;
  }

  ctx.clearRect(0, 0, canvasCssWidth, canvasCssHeight);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(dpr, dpr);

  if (gridCanvas) {
    ctx.drawImage(gridCanvas, 0, 0, gridCanvas.width, gridCanvas.height, 0, 0, canvasCssWidth, canvasCssHeight);
  }

  drawFragmentCells();
  drawHoveredCell();
  drawTriangle();
  drawInterpolationGuides();
  drawVertices();

  raHandle = null;
};

const requestDraw = () => {
  if (raHandle === null) {
    raHandle = requestAnimationFrame(drawScene);
  }
};

const resizeCanvas = () => {
  if (!canvasEl.value || !contentEl.value) {
    return;
  }

  let { width, height } = contentEl.value.getBoundingClientRect();
  width = Math.max(cellSize * 10, width - (width % cellSize));
  height = Math.max(cellSize * 10, height - (height % cellSize));

  canvasCssWidth = width;
  canvasCssHeight = height;
  gridCols.value = Math.floor(canvasCssWidth / cellSize);
  gridRows.value = Math.floor(canvasCssHeight / cellSize);

  canvasEl.value.style.width = `${width}px`;
  canvasEl.value.style.height = `${height}px`;
  canvasEl.value.width = Math.floor(width * dpr);
  canvasEl.value.height = Math.floor(height * dpr);

  if (typeof document !== "undefined") {
    if (!gridCanvas) {
      gridCanvas = document.createElement("canvas");
    }

    gridCanvas.width = canvasEl.value.width;
    gridCanvas.height = canvasEl.value.height;
    gridCtx = gridCanvas.getContext("2d");
    drawStaticGrid();
  }

  if (!dragDots.length) {
    dragDots.push(
      { x: canvasCssWidth * 0.52, y: canvasCssHeight * 0.20 },
      { x: canvasCssWidth * 0.23, y: canvasCssHeight * 0.76 },
      { x: canvasCssWidth * 0.78, y: canvasCssHeight * 0.70 },
    );
  }

  for (const dot of dragDots) {
    dot.x = Math.max(10, Math.min(canvasCssWidth - 10, dot.x));
    dot.y = Math.max(10, Math.min(canvasCssHeight - 10, dot.y));
  }

  updateHoveredFragment();
  requestDraw();
};

const dist2 = (a: Vec2, b: Vec2) => (a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y);

const updateHoverState = (pos: Vec2) => {
  hoveringIndex = null;

  for (let i = 0; i < dragDots.length; i++) {
    if (dist2(pos, dragDots[i]) <= 12 * 12) {
      hoveringIndex = i;
      break;
    }
  }

  const col = Math.floor(pos.x / cellSize);
  const row = Math.floor(pos.y / cellSize);

  if (col < 0 || row < 0 || col >= gridCols.value || row >= gridRows.value) {
    hoveredGridCell.value = null;
    hoveredFragment.value = null;
    return;
  }

  hoveredGridCell.value = {
    row,
    col,
    center: {
      x: (col + 0.5) * cellSize,
      y: (row + 0.5) * cellSize,
    },
  };

  updateHoveredFragment();
};

const syncCursor = () => {
  if (!canvasEl.value) {
    return;
  }

  if (draggingIndex !== null) {
    canvasEl.value.style.cursor = "grabbing";
    return;
  }

  if (hoveringIndex !== null) {
    canvasEl.value.style.cursor = "grab";
    return;
  }

  if (hoveredGridCell.value) {
    canvasEl.value.style.cursor = "crosshair";
    return;
  }

  canvasEl.value.style.cursor = "";
};

const getPointerPos = (e: PointerEvent): Vec2 | null => {
  if (!canvasEl.value) {
    return null;
  }

  const rect = canvasEl.value.getBoundingClientRect();
  return {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top,
  };
};

const onPointerDown = (e: PointerEvent) => {
  if (!canvasEl.value || hoveringIndex === null) {
    return;
  }

  draggingIndex = hoveringIndex;
  syncCursor();
  requestDraw();

  try {
    canvasEl.value.setPointerCapture(e.pointerId);
  } catch {
    // ignore
  }
};

const onPointerMove = (e: PointerEvent) => {
  const pos = getPointerPos(e);
  if (!pos) {
    return;
  }

  if (draggingIndex !== null) {
    dragDots[draggingIndex].x = Math.max(8, Math.min(canvasCssWidth - 8, pos.x));
    dragDots[draggingIndex].y = Math.max(8, Math.min(canvasCssHeight - 8, pos.y));
  }

  updateHoverState(pos);
  syncCursor();
  requestDraw();
};

const onPointerUp = (e: PointerEvent) => {
  if (!canvasEl.value) {
    return;
  }

  draggingIndex = null;
  syncCursor();
  requestDraw();

  try {
    canvasEl.value.releasePointerCapture(e.pointerId);
  } catch {
    // ignore
  }
};

const onPointerLeave = () => {
  if (draggingIndex !== null) {
    return;
  }

  hoveringIndex = null;
  hoveredGridCell.value = null;
  hoveredFragment.value = null;
  syncCursor();
  requestDraw();
};

onMounted(() => {
  if (!canvasEl.value || !contentEl.value) {
    return;
  }

  ctx = canvasEl.value.getContext("2d");
  if (!ctx) {
    return;
  }

  ro = new ResizeObserver(resizeCanvas);
  ro.observe(contentEl.value);

  canvasEl.value.addEventListener("pointerdown", onPointerDown);
  canvasEl.value.addEventListener("pointermove", onPointerMove);
  canvasEl.value.addEventListener("pointerup", onPointerUp);
  canvasEl.value.addEventListener("pointercancel", onPointerUp);
  canvasEl.value.addEventListener("pointerleave", onPointerLeave);
});

onBeforeUnmount(() => {
  ro?.disconnect();
  ro = null;

  if (raHandle !== null) {
    cancelAnimationFrame(raHandle);
    raHandle = null;
  }

  if (canvasEl.value) {
    canvasEl.value.removeEventListener("pointerdown", onPointerDown);
    canvasEl.value.removeEventListener("pointermove", onPointerMove);
    canvasEl.value.removeEventListener("pointerup", onPointerUp);
    canvasEl.value.removeEventListener("pointercancel", onPointerUp);
    canvasEl.value.removeEventListener("pointerleave", onPointerLeave);
  }
});
</script>

<style scoped>
.triangle-grid-root {
  width: 100%;
}

.triangle-grid-board {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 16px;
  align-items: stretch;
}

.triangle-grid-stage,
.triangle-grid-card {
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg-soft);
  border-radius: 18px;
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.06);
}

.triangle-grid-stage {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 14px;
}

.triangle-grid-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.triangle-grid-chip {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 6px 10px;
  font-size: 12px;
  line-height: 1;
  color: var(--vp-c-text-2);
  background: rgba(99, 102, 241, 0.08);
  border: 1px solid rgba(99, 102, 241, 0.14);
}

.triangle-grid-canvas-wrapper {
  width: 100%;
  min-height: 420px;
  flex: 1;
  overflow: hidden;
  border-radius: 14px;
  background:
    radial-gradient(circle at top left, rgba(99, 102, 241, 0.08), transparent 40%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.56), rgba(255, 255, 255, 0.24));
}

.dark .triangle-grid-canvas-wrapper {
  background:
    radial-gradient(circle at top left, rgba(99, 102, 241, 0.14), transparent 40%),
    linear-gradient(180deg, rgba(15, 23, 42, 0.64), rgba(15, 23, 42, 0.42));
}

.triangle-grid-canvas {
  display: block;
  width: 100%;
  height: 100%;
  touch-action: none;
}

.triangle-grid-hint {
  margin: 12px 2px 0;
  font-size: 13px;
  line-height: 1.55;
  color: var(--vp-c-text-2);
}

.triangle-grid-sidebar {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
}

.triangle-grid-card {
  padding: 14px 16px;
}

.triangle-grid-card--grow {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.triangle-grid-card-title {
  margin: 0 0 10px;
  font-size: 15px;
  line-height: 1.3;
  color: var(--vp-c-text-1);
}

.triangle-grid-list {
  margin: 0;
  padding-left: 18px;
  color: var(--vp-c-text-2);
  font-size: 13px;
  line-height: 1.65;
}

.triangle-grid-list li + li {
  margin-top: 6px;
}

.triangle-grid-legend {
  display: grid;
  gap: 8px;
}

.triangle-grid-legend-item {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  color: var(--vp-c-text-2);
}

.triangle-grid-legend-dot {
  width: 12px;
  height: 12px;
  border-radius: 999px;
  box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.72);
}

.dark .triangle-grid-legend-dot {
  box-shadow: 0 0 0 3px rgba(15, 23, 42, 0.72);
}

.triangle-grid-stats {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.triangle-grid-stat {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 12px;
  border-radius: 12px;
  background: var(--vp-c-default-soft);
}

.triangle-grid-stat-label {
  font-size: 12px;
  color: var(--vp-c-text-2);
}

.triangle-grid-stat strong {
  font-size: 16px;
  line-height: 1;
  color: var(--vp-c-text-1);
}

.triangle-grid-sample {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-bottom: 10px;
}

.triangle-grid-swatch {
  width: 42px;
  height: 42px;
  border-radius: 12px;
  flex: 0 0 auto;
}

.triangle-grid-sample-meta {
  font-size: 13px;
  line-height: 1.6;
  color: var(--vp-c-text-2);
}

.triangle-grid-weight-list {
  display: grid;
  gap: 8px;
}

.triangle-grid-weight-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 13px;
  color: var(--vp-c-text-2);
}

.triangle-grid-weight-row strong {
  color: var(--vp-c-text-1);
}

.triangle-grid-note {
  margin: 10px 0 0;
  font-size: 12px;
  line-height: 1.6;
  color: var(--vp-c-text-2);
}

@media (max-width: 960px) {
  .triangle-grid-board {
    grid-template-columns: 1fr;
  }

  .triangle-grid-canvas-wrapper {
    min-height: 380px;
  }

  .triangle-grid-sidebar {
    height: auto;
  }

  .triangle-grid-card--grow {
    flex: initial;
  }
}

@media (max-width: 640px) {
  .triangle-grid-stage,
  .triangle-grid-card {
    border-radius: 16px;
  }

  .triangle-grid-stage {
    padding: 12px;
  }

  .triangle-grid-canvas-wrapper {
    min-height: 320px;
  }

  .triangle-grid-stats {
    grid-template-columns: 1fr 1fr;
  }
}
</style>
