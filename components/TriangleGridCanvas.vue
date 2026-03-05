<template>
  <div ref="rootEl" class="triangle-grid-root">
    <canvas ref="canvasEl" class="triangle-grid-canvas" />
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';

type Vec2 = { x: number; y: number };

const rootEl = ref<HTMLDivElement | null>(null);
const canvasEl = ref<HTMLCanvasElement | null>(null);

const dpr = ref(1);
let ctx: CanvasRenderingContext2D | null = null;

const gridSize = 24;
const pointRadius = 5;
const pointHitPadding = 9;
const gridDotRadius = 1.6;

let rafId: number | null = null;
let ro: ResizeObserver | null = null;

const points = ref<Vec2[]>([
  { x: 0, y: 0 },
  { x: 0, y: 0 },
  { x: 0, y: 0 }
]);

let didInitTriangle = false;
let hoveringIndex: number | null = null;

let draggingIndex: number | null = null;
let pointerDown = false;

const clamp = (v: number, min: number, max: number) => {
  return Math.max(min, Math.min(max, v));
}

const sub = (a: Vec2, b: Vec2): Vec2 => {
  return { x: a.x - b.x, y: a.y - b.y };
}

const dot = (a: Vec2, b: Vec2) => {
  return a.x * b.x + a.y * b.y;
}

const dist2 = (a: Vec2, b: Vec2) => {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

const triangleContainsPoint = (p: Vec2, a: Vec2, b: Vec2, c: Vec2): boolean => {
  const v0 = sub(c, a);
  const v1 = sub(b, a);
  const v2 = sub(p, a);

  const dot00 = dot(v0, v0);
  const dot01 = dot(v0, v1);
  const dot02 = dot(v0, v2);
  const dot11 = dot(v1, v1);
  const dot12 = dot(v1, v2);

  const denom = dot00 * dot11 - dot01 * dot01;
  if (Math.abs(denom) < 1e-8) return false;

  const inv = 1 / denom;
  const u = (dot11 * dot02 - dot01 * dot12) * inv;
  const v = (dot00 * dot12 - dot01 * dot02) * inv;

  return u >= 0 && v >= 0 && u + v <= 1;
}

const getCanvasSizeCss = () => {
  const el = rootEl.value;
  if (!el) return { w: 0, h: 0 };
  const rect = el.getBoundingClientRect();
  const w = Math.max(1, Math.floor(rect.width));
  const h = Math.max(1, Math.floor(rect.height));
  return { w, h };
}

const resizeCanvas = () => {
  const canvas = canvasEl.value;
  if (!canvas) return;

  dpr.value = Math.max(1, Math.floor(window.devicePixelRatio || 1));
  const { w, h } = getCanvasSizeCss();

  if (!didInitTriangle && w > 0 && h > 0) {
    const cx = w / 2;
    const cy = h / 2;

    const margin = Math.max(pointRadius + 6, gridSize);
    const radius = Math.max(30, Math.min(w, h) * 0.28);
    const maxR = Math.max(30, Math.min(w, h) / 2 - margin);
    const r = Math.min(radius, maxR);

    const dy = r;
    const dx = r * Math.sqrt(3) / 2;

    points.value = [
      { x: cx, y: cy - dy },
      { x: cx - dx, y: cy + dy / 2 },
      { x: cx + dx, y: cy + dy / 2 }
    ];

    didInitTriangle = true;
  }

  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  canvas.width = Math.floor(w * dpr.value);
  canvas.height = Math.floor(h * dpr.value);

  if (ctx) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr.value, dpr.value);
  }

  for (const p of points.value) {
    p.x = clamp(p.x, pointRadius, w - pointRadius);
    p.y = clamp(p.y, pointRadius, h - pointRadius);
  }

  requestDraw();
}

const drawGrid = (w: number, h: number) => {
  if (!ctx) return;

  const a = points.value[0];
  const b = points.value[1];
  const c = points.value[2];

  ctx.clearRect(0, 0, w, h);

  ctx.lineWidth = 1;

  const baseStroke = 'rgba(80, 80, 80, 0.25)';
  const insideFill = 'rgba(59, 130, 246, 0.14)';
  const dotFill = 'rgba(30, 64, 175, 0.55)';

  const half = gridSize / 2;

  ctx.save();
  for (let x = 0; x < w; x += gridSize) {
    for (let y = 0; y < h; y += gridSize) {
      const cx = x + half;
      const cy = y + half;

      const inside = triangleContainsPoint({ x: cx, y: cy }, a, b, c);
      if (inside) {
        ctx.fillStyle = insideFill;
        ctx.fillRect(x, y, gridSize, gridSize);
      }

      ctx.beginPath();
      ctx.fillStyle = dotFill;
      ctx.arc(cx, cy, gridDotRadius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = baseStroke;

  ctx.beginPath();
  for (let x = 0; x <= w; x += gridSize) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
  }
  for (let y = 0; y <= h; y += gridSize) {
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
  }
  ctx.stroke();
  ctx.restore();
}

const drawTriangleAndPoints = () => {
  if (!ctx) return;
  const canvas = canvasEl.value;
  if (!canvas) return;

  const { w, h } = getCanvasSizeCss();

  const [a, b, c] = points.value;

  ctx.save();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(59, 130, 246, 0.9)';
  ctx.fillStyle = 'rgba(59, 130, 246, 0.10)';

  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.lineTo(c.x, c.y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  for (let i = 0; i < points.value.length; i++) {
    const p = points.value[i];
    ctx.beginPath();
    ctx.arc(p.x, p.y, pointRadius, 0, Math.PI * 2);
    ctx.fillStyle = i === draggingIndex ? 'rgba(37, 99, 235, 1)' : 'rgba(59, 130, 246, 1)';
    ctx.fill();

    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.stroke();
  }

  ctx.restore();

  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.font = '12px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto';
  ctx.fillText('拖动蓝色顶点', 12, Math.min(20, h - 8));
  ctx.restore();
}

const draw = () => {
  rafId = null;
  const { w, h } = getCanvasSizeCss();
  if (!ctx || w <= 0 || h <= 0) return;

  drawGrid(w, h);
  drawTriangleAndPoints();
}

const requestDraw = () => {
  if (rafId != null) return;
  rafId = window.requestAnimationFrame(draw);
}

const getPointerPos = (ev: PointerEvent): Vec2 => {
  const canvas = canvasEl.value;
  if (!canvas) return { x: 0, y: 0 };
  const rect = canvas.getBoundingClientRect();
  return {
    x: ev.clientX - rect.left,
    y: ev.clientY - rect.top
  };
}

const hitTestPoint = (pos: Vec2): number | null => {
  const r2 = (pointRadius + pointHitPadding) * (pointRadius + pointHitPadding);
  for (let i = 0; i < points.value.length; i++) {
    if (dist2(pos, points.value[i]) <= r2) return i;
  }
  return null;
}

const onPointerDown = (ev: PointerEvent) => {
  pointerDown = true;
  const canvas = canvasEl.value;
  if (!canvas) return;
  canvas.setPointerCapture(ev.pointerId);

  const pos = getPointerPos(ev);
  draggingIndex = hitTestPoint(pos);
  if (draggingIndex != null) {
    canvas.style.cursor = 'grabbing';
  }
  requestDraw();
}

const onPointerMove = (ev: PointerEvent) => {
  const canvas = canvasEl.value;
  if (!canvas) return;

  const pos = getPointerPos(ev);

  if (!pointerDown) {
    hoveringIndex = hitTestPoint(pos);
    canvas.style.cursor = hoveringIndex != null ? 'grab' : '';
    return;
  }

  if (draggingIndex == null) return;

  const { w, h } = getCanvasSizeCss();
  points.value[draggingIndex] = {
    x: clamp(pos.x, pointRadius, w - pointRadius),
    y: clamp(pos.y, pointRadius, h - pointRadius)
  };

  requestDraw();
}

const endDrag = (ev: PointerEvent) => {
  pointerDown = false;
  const canvas = canvasEl.value;
  if (!canvas) return;
  try {
    canvas.releasePointerCapture(ev.pointerId);
  } catch {
    // ignore
  }
  draggingIndex = null;
  canvas.style.cursor = hoveringIndex != null ? 'grab' : '';
  requestDraw();
}

onMounted(() => {
  const canvas = canvasEl.value;
  if (!canvas) return;

  ctx = canvas.getContext('2d');
  if (!ctx) return;

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('pointerleave', endDrag);

  canvas.style.cursor = '';

  ro = new ResizeObserver(() => resizeCanvas());
  if (rootEl.value) ro.observe(rootEl.value);

  resizeCanvas();
});

onBeforeUnmount(() => {
  const canvas = canvasEl.value;
  if (canvas) {
    canvas.removeEventListener('pointerdown', onPointerDown);
    canvas.removeEventListener('pointermove', onPointerMove);
    canvas.removeEventListener('pointerup', endDrag);
    canvas.removeEventListener('pointercancel', endDrag);
    canvas.removeEventListener('pointerleave', endDrag);
  }

  if (ro && rootEl.value) ro.unobserve(rootEl.value);
  ro = null;

  if (rafId != null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
});
</script>

<style scoped>
.triangle-grid-root {
  width: 100%;
  height: 420px;
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 10px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.9);
}

.triangle-grid-canvas {
  display: block;
  width: 100%;
  height: 100%;
  touch-action: none;
  cursor: default;
}

.triangle-grid-canvas:active {
  cursor: grabbing;
}
</style>
