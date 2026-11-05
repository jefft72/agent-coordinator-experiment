import { CanvasTexture, SRGBColorSpace } from 'three';
import { SCENE_COLORS } from '../contract';

export type ChartKind = 'line' | 'steps' | 'scatter' | 'bars';

const WIDTH = 512;
const HEIGHT = 672;
const GRAY = '#8A9AA4';

const cache = new Map<string, CanvasTexture>();

/** Small deterministic PRNG (mulberry32) so a given seed always draws the same page. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Frame {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

function drawTextBars(ctx: CanvasRenderingContext2D, rand: () => number, y: number, rows: number) {
  ctx.fillStyle = GRAY;
  for (let row = 0; row < rows; row += 1) {
    const rowY = y + row * 22;
    let x = 56;
    const segments = 3 + Math.floor(rand() * 3);
    for (let i = 0; i < segments; i += 1) {
      const w = 28 + rand() * 70;
      if (x + w > WIDTH - 56) break;
      ctx.fillRect(x, rowY, w, 7);
      x += w + 12;
    }
  }
}

function drawAxes(ctx: CanvasRenderingContext2D, frame: Frame) {
  ctx.strokeStyle = SCENE_COLORS.ink;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(frame.left, frame.top);
  ctx.lineTo(frame.left, frame.bottom);
  ctx.lineTo(frame.right, frame.bottom);
  ctx.stroke();

  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let i = 0; i <= 6; i += 1) {
    const x = frame.left + ((frame.right - frame.left) * i) / 6;
    ctx.moveTo(x, frame.bottom);
    ctx.lineTo(x, frame.bottom + 8);
  }
  for (let i = 0; i <= 4; i += 1) {
    const y = frame.bottom - ((frame.bottom - frame.top) * i) / 4;
    ctx.moveTo(frame.left - 8, y);
    ctx.lineTo(frame.left, y);
  }
  ctx.stroke();

  ctx.strokeStyle = GRAY;
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 6]);
  ctx.beginPath();
  for (let i = 1; i <= 4; i += 1) {
    const y = frame.bottom - ((frame.bottom - frame.top) * i) / 4;
    ctx.moveTo(frame.left, y);
    ctx.lineTo(frame.right, y);
  }
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawLine(ctx: CanvasRenderingContext2D, frame: Frame, rand: () => number) {
  const span = frame.right - frame.left;
  const height = frame.bottom - frame.top;
  ctx.strokeStyle = SCENE_COLORS.ink;
  ctx.lineWidth = 3;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  const points = 24;
  let value = 0.25 + rand() * 0.2;
  for (let i = 0; i <= points; i += 1) {
    const t = i / points;
    value += (rand() - 0.42) * 0.09 + Math.sin(t * 5.5) * 0.02;
    value = Math.min(0.95, Math.max(0.08, value));
    const x = frame.left + span * t;
    const y = frame.bottom - height * value;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

function drawSteps(ctx: CanvasRenderingContext2D, frame: Frame, rand: () => number) {
  const span = frame.right - frame.left;
  const height = frame.bottom - frame.top;
  const series: Array<{ color: string; width: number; start: number }> = [
    { color: SCENE_COLORS.ink, width: 3, start: 0.2 },
    { color: GRAY, width: 2.5, start: 0.45 },
  ];
  for (const s of series) {
    ctx.strokeStyle = s.color;
    ctx.lineWidth = s.width;
    ctx.beginPath();
    const steps = 11;
    let value = s.start;
    let x = frame.left;
    let y = frame.bottom - height * value;
    ctx.moveTo(x, y);
    for (let i = 1; i <= steps; i += 1) {
      value += (rand() - 0.4) * 0.14;
      value = Math.min(0.92, Math.max(0.06, value));
      const nextX = frame.left + (span * i) / steps;
      const nextY = frame.bottom - height * value;
      ctx.lineTo(nextX, y);
      ctx.lineTo(nextX, nextY);
      x = nextX;
      y = nextY;
    }
    ctx.stroke();
  }
}

function drawScatter(ctx: CanvasRenderingContext2D, frame: Frame, rand: () => number) {
  const span = frame.right - frame.left;
  const height = frame.bottom - frame.top;
  for (let i = 0; i < 70; i += 1) {
    const t = rand();
    const spread = (rand() - 0.5) * 0.35;
    const value = Math.min(0.95, Math.max(0.05, 0.15 + t * 0.65 + spread));
    const x = frame.left + 10 + (span - 20) * t;
    const y = frame.bottom - height * value;
    ctx.fillStyle = rand() < 0.75 ? SCENE_COLORS.ink : GRAY;
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = SCENE_COLORS.ink;
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 6]);
  ctx.beginPath();
  ctx.moveTo(frame.left + 10, frame.bottom - height * 0.18);
  ctx.lineTo(frame.right - 10, frame.bottom - height * 0.78);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawBars(ctx: CanvasRenderingContext2D, frame: Frame, rand: () => number) {
  const span = frame.right - frame.left;
  const height = frame.bottom - frame.top;
  const groups = 5;
  const slot = span / groups;
  const barWidth = slot * 0.28;
  for (let g = 0; g < groups; g += 1) {
    const base = frame.left + slot * g + slot * 0.18;
    const a = 0.2 + rand() * 0.7;
    const b = Math.min(0.95, a * (0.5 + rand() * 0.7));
    ctx.fillStyle = SCENE_COLORS.ink;
    ctx.fillRect(base, frame.bottom - height * a, barWidth, height * a);
    ctx.fillStyle = GRAY;
    ctx.fillRect(base + barWidth + 6, frame.bottom - height * b, barWidth, height * b);
  }
}

/**
 * Procedural report-page face: axes, one ink curve, tick marks, and short gray
 * text-like bars. No real words; the pages are illustrative.
 */
export function makeChartTexture(kind: ChartKind, seed: number): CanvasTexture {
  const key = `${kind}:${seed}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas context unavailable');
  const rand = seededRandom(seed * 7919 + kind.length);

  ctx.fillStyle = SCENE_COLORS.paperEdge;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Title block: one dark bar and a couple of gray lines.
  ctx.fillStyle = SCENE_COLORS.ink;
  ctx.fillRect(56, 54, 150 + rand() * 90, 10);
  drawTextBars(ctx, rand, 84, 2);

  const frame: Frame = { left: 76, right: WIDTH - 52, top: 170, bottom: 440 };
  drawAxes(ctx, frame);
  switch (kind) {
    case 'line':
      drawLine(ctx, frame, rand);
      break;
    case 'steps':
      drawSteps(ctx, frame, rand);
      break;
    case 'scatter':
      drawScatter(ctx, frame, rand);
      break;
    case 'bars':
      drawBars(ctx, frame, rand);
      break;
  }

  // Caption and body paragraph.
  drawTextBars(ctx, rand, 486, 1);
  drawTextBars(ctx, rand, 530, 4);

  // Page number tick at the foot.
  ctx.fillStyle = GRAY;
  ctx.fillRect(WIDTH / 2 - 10, HEIGHT - 40, 20, 5);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  cache.set(key, texture);
  return texture;
}
