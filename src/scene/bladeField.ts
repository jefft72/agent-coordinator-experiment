/**
 * Pure geometry for the opening artwork: one folded sweep of closely spaced
 * metallic blades. Everything here is deterministic plain math so the WebGL
 * scene, the SVG fallback, and the unit tests share one description.
 *
 * Axes: x right, y up, z toward the camera. Units are world units; the desktop
 * camera sees roughly 11 units across at the depth of the crest.
 *
 * Each blade is a thin slab sliced across a ribbon that follows a Catmull-Rom
 * sweep from the lower-left foreground to the upper-right background. The
 * slab's thin axis (its face normal) starts along the sweep tangent and is
 * rolled about the blade's height axis by a continuously varying angle, so the
 * faces fan through the light as the eye travels along the form.
 */

export type Vec3 = [number, number, number];
export type Quat = [number, number, number, number];

export interface FieldOptions {
  count: number;
  compact: boolean;
}

export interface CameraPose {
  position: Vec3;
  target: Vec3;
  /** Vertical field of view in degrees. */
  fov: number;
}

export interface SampleParams {
  /** 0 = collapsed loader strips, 1 = rest pose. */
  reveal: number;
  /** 0 = rest pose, 1 = folded toward the right edge. */
  fold: number;
  /** Small shift along the sweep as a fraction of its arc length (focus modulations). */
  uOffset?: number;
  /** Extra roll about the blade's height axis in radians (pointer and focus). */
  rollOffset?: number;
  /** Extra displacement along the blade's face normal in world units. */
  normalOffset?: number;
}

export interface BladeSample {
  position: Vec3;
  quaternion: Quat;
  /** [width, height, depth] in world units. */
  scale: Vec3;
  /** Unit face normal (thin axis) in world space. */
  normal: Vec3;
  /** Unit height axis in world space. */
  up: Vec3;
  /** Unit width axis in world space. */
  side: Vec3;
  /** Arc-length fraction along the sweep at rest, 0..1. */
  u: number;
}

interface Layout {
  /** Five authored points, lower-left foreground to upper-right background. */
  points: Vec3[];
  /** Arc-length fraction of the crest; spacing is densest here. */
  crest: number;
  /** Extra blade density at the crest relative to the ends. */
  density: number;
  densityWidth: number;
  /** Blade height at the start, the crest, and the end. */
  heights: [number, number, number];
  heightWidth: number;
  /** Width at the start and at the end. */
  widths: [number, number];
  /** Roll about the height axis at the start and the end, degrees. */
  rollDeg: [number, number];
  /** Lean of the height axis about the tangent at the start, crest, end, degrees. */
  leanDeg: [number, number, number];
  depth: number;
  radius: number;
  collapsed: {
    center: Vec3;
    dir: Vec3;
    pitch: number;
    rollDeg: number;
    height: number;
  };
  camera: {
    rest: CameraPose;
    collapsed: { position: Vec3; target: Vec3 };
    foldDrift: Vec3;
  };
  fold: {
    /** Translation to the right at fold = 1, world units (about 35% of the view width). */
    shift: number;
    /** Fraction of compression toward the right end at fold = 1. */
    compress: number;
    /** Lift of the left end at fold = 1, world units. */
    lift: number;
    /** How far toward edge-on the blades rotate at fold = 1 (1 = fully edge-on). */
    edgeOn: number;
  };
}

export interface Field {
  count: number;
  compact: boolean;
  blade: { width: number; depth: number; radius: number };
  /** Rest arc-length fraction of each blade. */
  u: Float64Array;
  /** Curve parameter for 257 uniformly spaced arc-length fractions. */
  arcToT: Float64Array;
  /** Total arc length of the sweep. */
  length: number;
  layout: Layout;
}

const DEG = Math.PI / 180;
const ARC_SAMPLES = 256;

const DESKTOP: Layout = {
  points: [
    [-7.4, -4.9, 5.2],
    [-3.3, -3.9, 2.8],
    [0.9, -0.9, 0.0],
    [4.4, 2.0, -2.6],
    [8.6, 3.5, -5.6],
  ],
  crest: 0.6,
  density: 0.9,
  densityWidth: 0.22,
  heights: [1.4, 2.6, 1.2],
  heightWidth: 0.26,
  widths: [0.22, 0.16],
  rollDeg: [-35, 25],
  leanDeg: [-14, 2, 16],
  depth: 0.035,
  radius: 0.012,
  collapsed: {
    center: [0.6, -0.6, 0.0],
    dir: [0.78, 0.33, -0.53],
    pitch: 0.06,
    rollDeg: -4,
    height: 1.9,
  },
  camera: {
    rest: { position: [0.2, 0.9, 12.4], target: [1.0, -0.35, 0.0], fov: 32 },
    collapsed: { position: [-4.2, -1.6, 7.6], target: [1.2, -0.3, -0.6] },
    foldDrift: [0.9, 0.1, 0.0],
  },
  fold: { shift: 3.6, compress: 0.32, lift: 1.6, edgeOn: 0.85 },
};

const COMPACT: Layout = {
  points: [
    [-4.2, -6.4, 4.4],
    [-2.0, -4.6, 2.4],
    [0.3, -2.4, 0.4],
    [2.2, -0.4, -1.6],
    [4.6, 0.9, -4.2],
  ],
  crest: 0.62,
  density: 0.9,
  densityWidth: 0.22,
  heights: [1.3, 2.4, 1.1],
  heightWidth: 0.26,
  widths: [0.22, 0.16],
  rollDeg: [-35, 25],
  leanDeg: [-12, 2, 14],
  depth: 0.035,
  radius: 0.012,
  collapsed: {
    center: [0.1, -2.4, 0.0],
    dir: [0.62, 0.45, -0.64],
    pitch: 0.06,
    rollDeg: -4,
    height: 1.8,
  },
  camera: {
    rest: { position: [0.0, 0.2, 11.2], target: [0.4, -1.9, 0.0], fov: 40 },
    collapsed: { position: [-3.2, -3.6, 6.4], target: [0.6, -1.9, -0.6] },
    foldDrift: [0.5, 0.1, 0.0],
  },
  fold: { shift: 2.0, compress: 0.32, lift: 1.4, edgeOn: 0.85 },
};

// --- small vector helpers (allocation free where it matters) -------------------

function set(out: Vec3, x: number, y: number, z: number): Vec3 {
  out[0] = x;
  out[1] = y;
  out[2] = z;
  return out;
}

function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross(out: Vec3, a: Vec3, b: Vec3): Vec3 {
  const x = a[1] * b[2] - a[2] * b[1];
  const y = a[2] * b[0] - a[0] * b[2];
  const z = a[0] * b[1] - a[1] * b[0];
  return set(out, x, y, z);
}

function normalize(out: Vec3): Vec3 {
  const len = Math.hypot(out[0], out[1], out[2]) || 1;
  return set(out, out[0] / len, out[1] / len, out[2] / len);
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function smootherstep(t: number): number {
  const x = clamp01(t);
  return x * x * x * (x * (x * 6 - 15) + 10);
}

export function easeInOutCubic(t: number): number {
  const x = clamp01(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

/** Rotates `v` about the unit axis `axis` by `angle` radians (Rodrigues), in place. */
function rotateAbout(v: Vec3, axis: Vec3, angle: number): Vec3 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const d = dot(axis, v) * (1 - c);
  const x = v[0] * c + (axis[1] * v[2] - axis[2] * v[1]) * s + axis[0] * d;
  const y = v[1] * c + (axis[2] * v[0] - axis[0] * v[2]) * s + axis[1] * d;
  const z = v[2] * c + (axis[0] * v[1] - axis[1] * v[0]) * s + axis[2] * d;
  return set(v, x, y, z);
}

/** Quaternion from an orthonormal right-handed basis (columns x, y, z). */
function quatFromBasis(out: Quat, x: Vec3, y: Vec3, z: Vec3): Quat {
  const m00 = x[0], m01 = y[0], m02 = z[0];
  const m10 = x[1], m11 = y[1], m12 = z[1];
  const m20 = x[2], m21 = y[2], m22 = z[2];
  const trace = m00 + m11 + m22;
  if (trace > 0) {
    const s = 0.5 / Math.sqrt(trace + 1);
    out[3] = 0.25 / s;
    out[0] = (m21 - m12) * s;
    out[1] = (m02 - m20) * s;
    out[2] = (m10 - m01) * s;
  } else if (m00 > m11 && m00 > m22) {
    const s = 2 * Math.sqrt(1 + m00 - m11 - m22);
    out[3] = (m21 - m12) / s;
    out[0] = 0.25 * s;
    out[1] = (m01 + m10) / s;
    out[2] = (m02 + m20) / s;
  } else if (m11 > m22) {
    const s = 2 * Math.sqrt(1 + m11 - m00 - m22);
    out[3] = (m02 - m20) / s;
    out[0] = (m01 + m10) / s;
    out[1] = 0.25 * s;
    out[2] = (m12 + m21) / s;
  } else {
    const s = 2 * Math.sqrt(1 + m22 - m00 - m11);
    out[3] = (m10 - m01) / s;
    out[0] = (m02 + m20) / s;
    out[1] = (m12 + m21) / s;
    out[2] = 0.25 * s;
  }
  return out;
}

function slerp(out: Quat, a: Quat, b: Quat, t: number): Quat {
  let cosHalf = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
  let bx = b[0], by = b[1], bz = b[2], bw = b[3];
  if (cosHalf < 0) {
    cosHalf = -cosHalf;
    bx = -bx;
    by = -by;
    bz = -bz;
    bw = -bw;
  }
  let wa: number;
  let wb: number;
  if (cosHalf > 0.9995) {
    wa = 1 - t;
    wb = t;
  } else {
    const half = Math.acos(cosHalf);
    const sinHalf = Math.sin(half);
    wa = Math.sin((1 - t) * half) / sinHalf;
    wb = Math.sin(t * half) / sinHalf;
  }
  out[0] = a[0] * wa + bx * wb;
  out[1] = a[1] * wa + by * wb;
  out[2] = a[2] * wa + bz * wb;
  out[3] = a[3] * wa + bw * wb;
  const len = Math.hypot(out[0], out[1], out[2], out[3]) || 1;
  out[0] /= len;
  out[1] /= len;
  out[2] /= len;
  out[3] /= len;
  return out;
}

// --- the sweep curve ----------------------------------------------------------

/** Uniform Catmull-Rom through the five layout points, with reflected phantom ends. */
function evalCurve(points: Vec3[], t: number, pos: Vec3, tangent: Vec3): void {
  const segments = points.length - 1;
  const clamped = clamp01(t);
  const k = Math.min(segments - 1, Math.floor(clamped * segments));
  const s = clamped * segments - k;
  const p1 = points[k];
  const p2 = points[k + 1];
  for (let axis = 0; axis < 3; axis++) {
    const a1 = p1[axis];
    const a2 = p2[axis];
    const a0 = k > 0 ? points[k - 1][axis] : 2 * a1 - a2;
    const a3 = k + 2 < points.length ? points[k + 2][axis] : 2 * a2 - a1;
    const c1 = 0.5 * (-a0 + a2);
    const c2 = 0.5 * (2 * a0 - 5 * a1 + 4 * a2 - a3);
    const c3 = 0.5 * (-a0 + 3 * a1 - 3 * a2 + a3);
    pos[axis] = a1 + s * (c1 + s * (c2 + s * c3));
    tangent[axis] = (c1 + s * (2 * c2 + 3 * s * c3)) * segments;
  }
}

function lookupT(field: Field, u: number): number {
  const f = clamp01(u) * ARC_SAMPLES;
  const i = Math.min(ARC_SAMPLES - 1, Math.floor(f));
  const frac = f - i;
  return field.arcToT[i] + (field.arcToT[i + 1] - field.arcToT[i]) * frac;
}

function bump(u: number, center: number, width: number): number {
  const d = (u - center) / width;
  return Math.exp(-d * d);
}

function heightAt(layout: Layout, u: number): number {
  const base = lerp(layout.heights[0], layout.heights[2], u);
  const peak = layout.heights[1] - lerp(layout.heights[0], layout.heights[2], layout.crest);
  return base + peak * bump(u, layout.crest, layout.heightWidth);
}

function rollAt(layout: Layout, u: number): number {
  return lerp(layout.rollDeg[0], layout.rollDeg[1], smootherstep(u)) * DEG;
}

function leanAt(layout: Layout, u: number): number {
  const [a, b, c] = layout.leanDeg;
  const deg =
    u < layout.crest
      ? lerp(a, b, smootherstep(u / layout.crest))
      : lerp(b, c, smootherstep((u - layout.crest) / (1 - layout.crest)));
  return deg * DEG;
}

// --- public API ---------------------------------------------------------------

export function createField(opts: FieldOptions): Field {
  const layout = opts.compact ? COMPACT : DESKTOP;
  const count = Math.max(2, Math.floor(opts.count));

  // Arc-length table: parameter t for uniformly spaced arc fractions.
  const pos: Vec3 = [0, 0, 0];
  const tan: Vec3 = [0, 0, 0];
  const prev: Vec3 = [0, 0, 0];
  const steps = 1024;
  const cumulative = new Float64Array(steps + 1);
  evalCurve(layout.points, 0, prev, tan);
  for (let i = 1; i <= steps; i++) {
    evalCurve(layout.points, i / steps, pos, tan);
    cumulative[i] = cumulative[i - 1] + Math.hypot(pos[0] - prev[0], pos[1] - prev[1], pos[2] - prev[2]);
    set(prev, pos[0], pos[1], pos[2]);
  }
  const length = cumulative[steps];
  const arcToT = new Float64Array(ARC_SAMPLES + 1);
  let cursor = 0;
  for (let i = 0; i <= ARC_SAMPLES; i++) {
    const target = (i / ARC_SAMPLES) * length;
    while (cursor < steps - 1 && cumulative[cursor + 1] < target) cursor++;
    const span = cumulative[cursor + 1] - cumulative[cursor] || 1;
    const frac = clamp01((target - cumulative[cursor]) / span);
    arcToT[i] = (cursor + frac) / steps;
  }

  // Density warp: blades sit at the inverse CDF of a crest-weighted density.
  const bins = 512;
  const cdf = new Float64Array(bins + 1);
  for (let i = 0; i < bins; i++) {
    const u = (i + 0.5) / bins;
    cdf[i + 1] = cdf[i] + 1 + layout.density * bump(u, layout.crest, layout.densityWidth);
  }
  const total = cdf[bins];
  const u = new Float64Array(count);
  let bin = 0;
  for (let i = 0; i < count; i++) {
    const target = (i / (count - 1)) * total;
    while (bin < bins - 1 && cdf[bin + 1] < target) bin++;
    const span = cdf[bin + 1] - cdf[bin] || 1;
    u[i] = clamp01((bin + clamp01((target - cdf[bin]) / span)) / bins);
  }

  return {
    count,
    compact: opts.compact,
    blade: { width: layout.widths[0], depth: layout.depth, radius: layout.radius },
    u,
    arcToT,
    length,
    layout,
  };
}

export function createSample(): BladeSample {
  return {
    position: [0, 0, 0],
    quaternion: [0, 0, 0, 1],
    scale: [1, 1, 1],
    normal: [0, 0, 1],
    up: [0, 1, 0],
    side: [1, 0, 0],
    u: 0,
  };
}

// Scratch space shared by sampleBlade; the function is synchronous so this is safe.
const WORLD_UP: Vec3 = [0, 1, 0];
const sPos: Vec3 = [0, 0, 0];
const sTan: Vec3 = [0, 0, 0];
const sUp: Vec3 = [0, 0, 0];
const sBi: Vec3 = [0, 0, 0];
const sView: Vec3 = [0, 0, 0];
const sQuatA: Quat = [0, 0, 0, 1];
const sQuatB: Quat = [0, 0, 0, 1];
const sSide: Vec3 = [0, 0, 0];
const sNormal: Vec3 = [0, 0, 0];
const cPos: Vec3 = [0, 0, 0];
const cUp: Vec3 = [0, 0, 0];
const cBi: Vec3 = [0, 0, 0];
const cSide: Vec3 = [0, 0, 0];
const cNormal: Vec3 = [0, 0, 0];
const cDir: Vec3 = [0, 0, 0];

/** Builds the (side, up, normal) basis for a tangent, lean, and roll. */
function frameFor(
  tangent: Vec3,
  lean: number,
  roll: number,
  up: Vec3,
  bi: Vec3,
  side: Vec3,
  normal: Vec3,
): void {
  normalize(tangent);
  const d = dot(WORLD_UP, tangent);
  set(up, WORLD_UP[0] - tangent[0] * d, WORLD_UP[1] - tangent[1] * d, WORLD_UP[2] - tangent[2] * d);
  normalize(up);
  rotateAbout(up, tangent, lean);
  cross(bi, up, tangent);
  normalize(bi);
  const c = Math.cos(roll);
  const s = Math.sin(roll);
  set(side, c * bi[0] + s * tangent[0], c * bi[1] + s * tangent[1], c * bi[2] + s * tangent[2]);
  set(normal, -s * bi[0] + c * tangent[0], -s * bi[1] + c * tangent[1], -s * bi[2] + c * tangent[2]);
}

/**
 * Pose of blade `i` for the given reveal and fold, written into `out`
 * (allocated when omitted). Deterministic and allocation free with `out`.
 */
export function sampleBlade(field: Field, i: number, params: SampleParams, out: BladeSample = createSample()): BladeSample {
  const { layout } = field;
  const reveal = easeInOutCubic(params.reveal);
  const fold = smootherstep(params.fold);
  const uRest = field.u[Math.max(0, Math.min(field.count - 1, i))];
  const u = clamp01(uRest + (params.uOffset ?? 0));
  const extraRoll = params.rollOffset ?? 0;

  // Rest pose on the sweep.
  evalCurve(layout.points, lookupT(field, u), sPos, sTan);
  let roll = rollAt(layout, u) + extraRoll;
  const lean = leanAt(layout, u);
  let height = heightAt(layout, u);
  const width = lerp(layout.widths[0], layout.widths[1], u);

  if (fold > 0) {
    // Rotate toward edge-on for the rest camera, whichever direction is nearer.
    const cam = layout.camera.rest.position;
    set(sView, sPos[0] - cam[0], sPos[1] - cam[1], sPos[2] - cam[2]);
    normalize(sView);
    frameFor(sTan, lean, 0, sUp, sBi, sSide, sNormal);
    const edge = Math.atan2(dot(sTan, sView), dot(sBi, sView));
    let delta = edge - roll;
    delta = delta - Math.PI * Math.round(delta / Math.PI);
    roll += delta * fold * layout.fold.edgeOn;
    // Compress toward the right end, slide right, lift the left end.
    const end = layout.points[layout.points.length - 1];
    const squeeze = 1 - layout.fold.compress * fold;
    const liftWeight = (1 - u) * (1 - u);
    set(
      sPos,
      end[0] + (sPos[0] - end[0]) * squeeze + layout.fold.shift * fold,
      end[1] + (sPos[1] - end[1]) * squeeze + layout.fold.lift * fold * liftWeight,
      end[2] + (sPos[2] - end[2]) * squeeze,
    );
    height *= 1 - 0.12 * fold;
  }

  frameFor(sTan, lean, roll, sUp, sBi, sSide, sNormal);
  quatFromBasis(sQuatA, sSide, sUp, sNormal);

  if (reveal < 1) {
    // Collapsed loader pose: aligned strips on one straight line.
    const c = layout.collapsed;
    const offset = (i - (field.count - 1) / 2) * c.pitch;
    set(cDir, c.dir[0], c.dir[1], c.dir[2]);
    normalize(cDir);
    set(cPos, c.center[0] + cDir[0] * offset, c.center[1] + cDir[1] * offset, c.center[2] + cDir[2] * offset);
    frameFor(cDir, 0, c.rollDeg * DEG + extraRoll, cUp, cBi, cSide, cNormal);
    quatFromBasis(sQuatB, cSide, cUp, cNormal);
    slerp(out.quaternion, sQuatB, sQuatA, reveal);
    set(out.position, lerp(cPos[0], sPos[0], reveal), lerp(cPos[1], sPos[1], reveal), lerp(cPos[2], sPos[2], reveal));
    height = lerp(c.height, height, reveal);
    // Axes follow the blend approximately; exact axes matter only at rest.
    set(out.normal, lerp(cNormal[0], sNormal[0], reveal), lerp(cNormal[1], sNormal[1], reveal), lerp(cNormal[2], sNormal[2], reveal));
    set(out.up, lerp(cUp[0], sUp[0], reveal), lerp(cUp[1], sUp[1], reveal), lerp(cUp[2], sUp[2], reveal));
    set(out.side, lerp(cSide[0], sSide[0], reveal), lerp(cSide[1], sSide[1], reveal), lerp(cSide[2], sSide[2], reveal));
    normalize(out.normal);
    normalize(out.up);
    normalize(out.side);
  } else {
    out.quaternion[0] = sQuatA[0];
    out.quaternion[1] = sQuatA[1];
    out.quaternion[2] = sQuatA[2];
    out.quaternion[3] = sQuatA[3];
    set(out.position, sPos[0], sPos[1], sPos[2]);
    set(out.normal, sNormal[0], sNormal[1], sNormal[2]);
    set(out.up, sUp[0], sUp[1], sUp[2]);
    set(out.side, sSide[0], sSide[1], sSide[2]);
  }

  const push = params.normalOffset ?? 0;
  if (push !== 0) {
    out.position[0] += out.normal[0] * push;
    out.position[1] += out.normal[1] * push;
    out.position[2] += out.normal[2] * push;
  }
  set(out.scale, width, height, layout.depth);
  out.u = u;
  return out;
}

/** Camera pose for the given reveal and fold; `out` avoids allocation. */
export function cameraFor(
  compact: boolean,
  params: { reveal: number; fold: number },
  out: CameraPose = { position: [0, 0, 0], target: [0, 0, 0], fov: 32 },
): CameraPose {
  const layout = compact ? COMPACT : DESKTOP;
  const reveal = easeInOutCubic(params.reveal);
  const fold = smootherstep(params.fold);
  const { rest, collapsed, foldDrift } = layout.camera;
  for (let a = 0; a < 3; a++) {
    out.position[a] = lerp(collapsed.position[a], rest.position[a], reveal) + foldDrift[a] * fold;
    out.target[a] = lerp(collapsed.target[a], rest.target[a], reveal) + foldDrift[a] * fold * 0.6;
  }
  out.fov = rest.fov;
  return out;
}

export interface ScreenPoint {
  /** 0..1 from the left edge. */
  x: number;
  /** 0..1 from the top edge. */
  y: number;
  /** Distance along the view axis; larger is farther. Negative means behind the camera. */
  depth: number;
}

const pFwd: Vec3 = [0, 0, 0];
const pRight: Vec3 = [0, 0, 0];
const pUp: Vec3 = [0, 0, 0];
const pRel: Vec3 = [0, 0, 0];

/**
 * Projects a world point through a pinhole camera matching three's
 * PerspectiveCamera (vertical fov, up = +y). Returns normalised screen space.
 */
export function projectToScreen(
  point: Vec3,
  camera: CameraPose,
  aspect: number,
  out: ScreenPoint = { x: 0, y: 0, depth: 0 },
): ScreenPoint {
  set(pFwd, camera.target[0] - camera.position[0], camera.target[1] - camera.position[1], camera.target[2] - camera.position[2]);
  normalize(pFwd);
  cross(pRight, pFwd, WORLD_UP);
  normalize(pRight);
  cross(pUp, pRight, pFwd);
  set(pRel, point[0] - camera.position[0], point[1] - camera.position[1], point[2] - camera.position[2]);
  const depth = dot(pRel, pFwd);
  const tanHalf = Math.tan((camera.fov * DEG) / 2);
  const safeDepth = Math.abs(depth) < 1e-6 ? 1e-6 : depth;
  const ndcX = dot(pRel, pRight) / safeDepth / (tanHalf * aspect);
  const ndcY = dot(pRel, pUp) / safeDepth / tanHalf;
  out.x = 0.5 + 0.5 * ndcX;
  out.y = 0.5 - 0.5 * ndcY;
  out.depth = depth;
  return out;
}

/** Blade count the scene uses for each layout. */
export function bladeCount(compact: boolean): number {
  return compact ? 96 : 140;
}
