/**
 * Pure geometry for the opening artwork: a custom JT monogram. Everything
 * here is deterministic plain math, so the WebGL scene, the SVG poster, and
 * the unit tests share one description.
 *
 * Each letter is one closed outline drawn from a handful of lines and cubic
 * curves in a local frame: x right, y up, the letter two units tall from
 * y = -1 to y = 1. The J is a long upright stem on its right that flows into
 * a broad bottom hook, curling left and rising to a short rounded terminal
 * so the upper left stays open. The T is a gently arched, slightly swept top
 * bar over a tapering central stem with a rounded foot. The outlines are the
 * silhouettes: the extrusion keeps them as the straight wall and rolls a
 * quarter-round bevel inward from them to a flat, narrower cap, so the
 * drawn curves are exactly what the viewer sees in outline.
 *
 * Poses are rigid: the letters never deform. The two sit side by side in one
 * group with a deliberate gap; the scroll handoff turns the group modestly
 * and carries it up and right while the first chapter covers it; the loader
 * starts closer and pitched; the pointer tilts the view by a few degrees.
 */

export type Vec2 = [number, number];
export type Vec3 = [number, number, number];
export type Letter = 'j' | 't';

export const LETTERS: readonly Letter[] = ['j', 't'];

const DEG = Math.PI / 180;

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

export function easeInOutCubic(t: number): number {
  const x = clamp01(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

// --- outlines -----------------------------------------------------------------

export interface LineSegment {
  kind: 'line';
  to: Vec2;
}

export interface CubicSegment {
  kind: 'cubic';
  c1: Vec2;
  c2: Vec2;
  to: Vec2;
}

export type Segment = LineSegment | CubicSegment;

/** A closed outline: the last segment ends exactly at `start`. */
export interface Outline {
  start: Vec2;
  segments: Segment[];
}

function unit(x: number, y: number): Vec2 {
  const len = Math.hypot(x, y) || 1;
  return [x / len, y / len];
}

const RIGHT: Vec2 = [1, 0];
const LEFT: Vec2 = [-1, 0];
const UP: Vec2 = [0, 1];
const DOWN: Vec2 = [0, -1];

/** Handle length that makes a cubic between two unit tangents approximate a circular arc. */
function arcHandle(chord: number, turn: number): number {
  if (turn < 1e-6) return chord / 3;
  return (chord * (4 / 3) * Math.tan(turn / 4)) / (2 * Math.sin(turn / 2));
}

/** Builds one closed outline from a pen that remembers its position and direction, so every join is tangent-continuous. */
class Pen {
  readonly segments: Segment[] = [];
  readonly start: Vec2;
  private at: Vec2;
  private dir: Vec2;

  constructor(start: Vec2, dir: Vec2) {
    this.start = start;
    this.at = start;
    this.dir = dir;
  }

  line(to: Vec2): this {
    this.dir = unit(to[0] - this.at[0], to[1] - this.at[1]);
    this.segments.push({ kind: 'line', to });
    this.at = to;
    return this;
  }

  /** A cubic that leaves along the current direction and arrives along `dir`, with explicit handle lengths. */
  curve(to: Vec2, dir: Vec2, leave: number, arrive: number): this {
    const c1: Vec2 = [this.at[0] + this.dir[0] * leave, this.at[1] + this.dir[1] * leave];
    const c2: Vec2 = [to[0] - dir[0] * arrive, to[1] - dir[1] * arrive];
    this.segments.push({ kind: 'cubic', c1, c2, to });
    this.at = to;
    this.dir = dir;
    return this;
  }

  /** A near-circular arc from the current direction to `dir`. */
  arc(to: Vec2, dir: Vec2): this {
    const chord = Math.hypot(to[0] - this.at[0], to[1] - this.at[1]);
    const cos = Math.max(-1, Math.min(1, this.dir[0] * dir[0] + this.dir[1] * dir[1]));
    const handle = arcHandle(chord, Math.acos(cos));
    return this.curve(to, dir, handle, handle);
  }

  close(): Outline {
    return { start: this.start, segments: this.segments };
  }
}

/**
 * The J. Stem width 0.42 with a flat top and rounded corners; the hook is
 * fullest through its bottom (0.44) and thins to a 0.36 terminal. The
 * outside of the hook bulges a little more than a circle and the inside is
 * drawn tauter, so the stroke reads as drawn rather than mechanically offset.
 * The stem's right edge is at x = 0 and the terminal reaches x = -1.18.
 */
function drawJ(): Outline {
  const stem = 0.42;
  const corner = 0.18;
  const pen = new Pen([-stem + corner, 1], RIGHT);
  pen
    .line([-corner, 1])
    .arc([0, 1 - corner], DOWN)
    .line([0, -0.2])
    // Outside of the hook: down and around to the terminal, fuller than a circle.
    .curve([-0.58, -1], LEFT, 0.8 * 0.6, 0.58 * 0.6)
    .curve([-1.18, -0.56], UP, 0.6 * 0.56, 0.44 * 0.56)
    .line([-1.18, -0.4])
    // Rounded terminal.
    .arc([-1, -0.22], RIGHT)
    .arc([-0.82, -0.4], DOWN)
    .line([-0.82, -0.44])
    // Inside of the hook: tight at the terminal, tall toward the stem.
    .curve([-0.66, -0.56], RIGHT, 0.12 * 0.55, 0.16 * 0.55)
    .curve([-stem, -0.08], UP, 0.24 * 0.55, 0.48 * 0.55)
    .line([-stem, 1 - corner])
    .arc([-stem + corner, 1], RIGHT);
  return pen.close();
}

/** Where the line through `p` along `d` meets the line through `q` along `e`. */
function intersect(p: Vec2, d: Vec2, q: Vec2, e: Vec2): Vec2 {
  const denom = d[0] * e[1] - d[1] * e[0];
  const s = ((q[0] - p[0]) * e[1] - (q[1] - p[1]) * e[0]) / denom;
  return [p[0] + d[0] * s, p[1] + d[1] * s];
}

/** Distance from a corner to the points where a circular fillet of radius `r` touches its two edges. */
function filletReach(a: Vec2, b: Vec2, r: number): number {
  const cos = Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1]));
  return r * Math.tan(Math.acos(cos) / 2);
}

/** Rounds the corner where the pen's current line (direction `a`) meets the next edge (direction `b`). */
function fillet(pen: Pen, corner: Vec2, a: Vec2, b: Vec2, r: number): Pen {
  const reach = filletReach(a, b, r);
  pen.line([corner[0] - a[0] * reach, corner[1] - a[1] * reach]);
  return pen.arc([corner[0] + b[0] * reach, corner[1] + b[1] * reach], b);
}

/**
 * The T. The bar is 1.24 wide and arches gently, peaking right of centre; it
 * is about 0.38 thick at its left end and 0.33 at its lifted right end, so
 * the sweep reads as a brush stroke while the stem stays plainly beneath it.
 * The stem sits just right of the bar's centre, tapers from 0.42 to 0.36,
 * and ends in a round foot; the bar joins it through concave fillets. Every
 * corner is a circular fillet between the bar's edge lines, so the bevel
 * meets the same radius all the way round. The bar's left end is at x = 0.
 */
function drawT(): Outline {
  const corner = 0.175;
  const joint = 0.13;
  const stemCentre = 0.64;
  const foot = 0.18;
  const topLeft = unit(1, 0.1);
  const topRight = unit(1, -0.08);
  const underRight = unit(-1, -0.125);
  const underLeft = unit(-1, -0.16);
  const stemRight = unit(-0.03, -1.315);
  const stemLeft = unit(-0.03, 1.315);
  // Virtual corners of the bar ends, and the stem's edge lines.
  const leftTop: Vec2 = [0, 0.93];
  const leftBottom: Vec2 = [0, 0.552];
  const rightTop: Vec2 = [1.24, 0.972];
  const rightBottom: Vec2 = [1.24, 0.645];
  const rightEdgeFoot: Vec2 = [stemCentre + foot, -0.82];
  const leftEdgeFoot: Vec2 = [stemCentre - foot, -0.82];
  const rightJoint = intersect(rightBottom, underRight, rightEdgeFoot, stemRight);
  const leftJoint = intersect(leftEdgeFoot, stemLeft, leftBottom, underLeft);

  const startReach = filletReach(UP, topLeft, corner);
  const start: Vec2 = [leftTop[0] + topLeft[0] * startReach, leftTop[1] + topLeft[1] * startReach];
  const topEndReach = filletReach(topRight, DOWN, corner);
  const pen = new Pen(start, topLeft);
  // The arched top edge, then down the right end.
  pen.curve([rightTop[0] - topRight[0] * topEndReach, rightTop[1] - topRight[1] * topEndReach], topRight, 0.46, 0.42);
  pen.arc([rightTop[0], rightTop[1] - topEndReach], DOWN);
  fillet(pen, rightBottom, DOWN, underRight, corner);
  // Under the bar into the stem, around the foot, and back up.
  fillet(pen, rightJoint, underRight, stemRight, joint);
  pen.line(rightEdgeFoot);
  pen.arc([stemCentre, -1], LEFT);
  pen.arc(leftEdgeFoot, stemLeft);
  fillet(pen, leftJoint, stemLeft, underLeft, joint);
  fillet(pen, leftBottom, underLeft, UP, corner);
  pen.line([leftTop[0], leftTop[1] - startReach]);
  pen.arc(start, topLeft);
  return pen.close();
}

export const OUTLINES: Readonly<Record<Letter, Outline>> = { j: drawJ(), t: drawT() };

/** Letter height in local units; the outlines span y = -1 to y = 1. */
export const LETTER_HEIGHT = 2;

/** Clear space between the nearest points of the two silhouettes: 7% of the letter height. */
export const GAP = 0.07 * LETTER_HEIGHT;

/**
 * Extrusion: the straight wall depth, the bevel radius (its size and
 * thickness are equal, so the profile is a quarter circle rolled inward from
 * the silhouette to the cap), and the tessellation of the bevel and of each
 * cubic. Total thickness is depth + 2 * bevel.
 */
export const EXTRUSION = {
  depth: 0.12,
  bevel: 0.145,
  bevelSegments: 10,
  curveSegments: 24,
} as const;

export const THICKNESS = EXTRUSION.depth + 2 * EXTRUSION.bevel;

// --- sampling and measurement -------------------------------------------------

function cubicPoint(p0: Vec2, c1: Vec2, c2: Vec2, p1: Vec2, t: number, out: Vec2): Vec2 {
  const u = 1 - t;
  const a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
  out[0] = a * p0[0] + b * c1[0] + c * c2[0] + d * p1[0];
  out[1] = a * p0[1] + b * c1[1] + c * c2[1] + d * p1[1];
  return out;
}

/**
 * The outline as a closed polyline: one point per line and `segments` points
 * per cubic, without repeating the start. This matches three's Shape
 * sampling at the same `curveSegments`, so the poster and the mesh agree.
 */
export function flatten(outline: Outline, segments = EXTRUSION.curveSegments): Vec2[] {
  const points: Vec2[] = [[outline.start[0], outline.start[1]]];
  let from = outline.start;
  for (const segment of outline.segments) {
    if (segment.kind === 'line') {
      points.push([segment.to[0], segment.to[1]]);
    } else {
      for (let i = 1; i <= segments; i++) {
        points.push(cubicPoint(from, segment.c1, segment.c2, segment.to, i / segments, [0, 0]));
      }
    }
    from = segment.to;
  }
  const last = points[points.length - 1];
  if (Math.abs(last[0] - points[0][0]) < 1e-9 && Math.abs(last[1] - points[0][1]) < 1e-9) points.pop();
  return points;
}

export interface Bounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** Axis-aligned bounds of 2D points; `top` is the largest y in local space and the smallest y on screen. */
export function bounds2(points: readonly Vec2[]): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of points) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY };
}

/** Signed area: positive for counterclockwise. */
export function polygonArea(points: readonly Vec2[]): number {
  let sum = 0;
  for (let i = 0, n = points.length; i < n; i++) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[(i + 1) % n];
    sum += x0 * y1 - x1 * y0;
  }
  return sum / 2;
}

function segmentsCross(a: Vec2, b: Vec2, c: Vec2, d: Vec2): boolean {
  const orient = (p: Vec2, q: Vec2, r: Vec2) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  const o1 = orient(a, b, c), o2 = orient(a, b, d), o3 = orient(c, d, a), o4 = orient(c, d, b);
  return o1 * o2 < 0 && o3 * o4 < 0;
}

/** True when no two non-adjacent edges of the closed polyline cross. */
export function isSimple(points: readonly Vec2[]): boolean {
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const a = points[i], b = points[(i + 1) % n];
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      if (segmentsCross(a, b, points[j], points[(j + 1) % n])) return false;
    }
  }
  return true;
}

/**
 * The smallest radius of curvature at a convex sample of the closed
 * polyline, from the circle through each point and its neighbours. The
 * bevel rolls inward from the silhouette, so every convex radius must exceed
 * the bevel radius or the cap would fold over itself.
 */
export function minConvexRadius(points: readonly Vec2[]): number {
  const n = points.length;
  const ccw = polygonArea(points) > 0;
  let min = Infinity;
  for (let i = 0; i < n; i++) {
    const p = points[(i + n - 1) % n], q = points[i], r = points[(i + 1) % n];
    const ax = q[0] - p[0], ay = q[1] - p[1], bx = r[0] - q[0], by = r[1] - q[1];
    const cross = ax * by - ay * bx;
    const convex = ccw ? cross > 0 : cross < 0;
    if (!convex || Math.abs(cross) < 1e-12) continue;
    const la = Math.hypot(ax, ay), lb = Math.hypot(bx, by), lc = Math.hypot(r[0] - p[0], r[1] - p[1]);
    const radius = (la * lb * lc) / (2 * Math.abs(cross));
    if (radius < min) min = radius;
  }
  return min;
}

/**
 * The narrowest stroke: for every sample, the distance along the inward
 * normal to the first edge the ray meets again. Two bevels must fit across
 * every stroke with a flat cap left between them.
 */
export function minStrokeWidth(points: readonly Vec2[]): number {
  const n = points.length;
  const ccw = polygonArea(points) > 0;
  let min = Infinity;
  for (let i = 0; i < n; i++) {
    const p = points[(i + n - 1) % n], q = points[i], r = points[(i + 1) % n];
    const t = unit(r[0] - p[0], r[1] - p[1]);
    // Inward normal: left of travel for a counterclockwise outline.
    const nx = ccw ? -t[1] : t[1];
    const ny = ccw ? t[0] : -t[0];
    for (let j = 0; j < n; j++) {
      if (j === i || (j + 1) % n === i || j === (i + 1) % n || (j + 1) % n === (i + 1) % n) continue;
      const a = points[j], b = points[(j + 1) % n];
      const ex = b[0] - a[0], ey = b[1] - a[1];
      const denom = nx * ey - ny * ex;
      if (Math.abs(denom) < 1e-12) continue;
      const dx = a[0] - q[0], dy = a[1] - q[1];
      const s = (dx * ey - dy * ex) / denom;
      const u = (dx * ny - dy * nx) / denom;
      if (s > 1e-6 && u >= 0 && u <= 1 && s < min) min = s;
    }
  }
  return min;
}

// --- placement ----------------------------------------------------------------

export interface Placement {
  /** Translation that moves the drawn outline into the pair's frame, centred on its own bounds. */
  offset: Vec2;
  /** Where the letter's centre sits in the pair's frame. */
  centre: Vec2;
  width: number;
  height: number;
}

function placeLetters(): Record<Letter, Placement> {
  const j = bounds2(flatten(OUTLINES.j));
  const t = bounds2(flatten(OUTLINES.t));
  // The J's nearest point to the T is its stem's right edge; the T's is its bar's left end.
  const jShift = -GAP / 2 - j.maxX;
  const tShift = GAP / 2 - t.minX;
  const left = j.minX + jShift;
  const right = t.maxX + tShift;
  const recentre = -(left + right) / 2;
  const place = (b: ReturnType<typeof bounds2>, shift: number): Placement => {
    const cx = (b.minX + b.maxX) / 2 + shift + recentre;
    const cy = (b.minY + b.maxY) / 2;
    return { offset: [-(b.minX + b.maxX) / 2, -cy], centre: [cx, cy], width: b.maxX - b.minX, height: b.maxY - b.minY };
  };
  return { j: place(j, jShift), t: place(t, tShift) };
}

export const PLACEMENT: Readonly<Record<Letter, Placement>> = placeLetters();

/** Bounds of the whole monogram in the pair's frame. */
export const MONOGRAM = (() => {
  const j = PLACEMENT.j, t = PLACEMENT.t;
  const left = j.centre[0] - j.width / 2;
  const right = t.centre[0] + t.width / 2;
  return { left, right, width: right - left, height: LETTER_HEIGHT };
})();

/** The letter's outline centred on its own bounds, as the mesh and poster use it. */
export function centredOutline(letter: Letter, segments = EXTRUSION.curveSegments): Vec2[] {
  const [dx, dy] = PLACEMENT[letter].offset;
  return flatten(OUTLINES[letter], segments).map(([x, y]) => [x + dx, y + dy] as Vec2);
}

// --- layout and poses ---------------------------------------------------------

export interface Pose {
  position: Vec3;
  /** Euler angles in radians, applied in three's default XYZ order. */
  rotation: Vec3;
  scale: number;
}

export interface Layout {
  /** Vertical field of view in degrees and the distance from the camera to the monogram. */
  fov: number;
  distance: number;
  /** Screen position of the monogram's centre, 0..1 from the left and from the top. */
  centre: Vec2;
  /** On viewports shorter than SHORT_VIEWPORT the centre moves down by this much per missing pixel. */
  shortShift: number;
  scale: number;
  /** Rest orientation in degrees: pitch, yaw, roll. */
  rest: Vec3;
  /** At fold 1: the extra pitch and yaw in degrees, and the travel up and right in world units. */
  foldPitch: number;
  foldYaw: number;
  foldTravel: Vec2;
  /** At fold 1: how many degrees the J turns beyond the group and the T short of it, so the pair keeps its depth. */
  letterTurn: number;
  /** At reveal 0: how much closer the monogram starts and the extra pitch in degrees. */
  revealApproach: number;
  revealPitch: number;
}

export const DESKTOP: Layout = {
  fov: 32,
  distance: 8,
  centre: [0.72, 0.515],
  shortShift: 0,
  scale: 1.2,
  rest: [4, 10, 0],
  foldPitch: -6,
  foldYaw: 24,
  foldTravel: [1.1, 1.3],
  letterTurn: 4,
  revealApproach: 1.5,
  revealPitch: 6,
};

export const COMPACT: Layout = {
  fov: 40,
  distance: 8,
  centre: [0.5, 0.675],
  shortShift: 0.0004,
  scale: 0.8,
  rest: [3, 14, 0],
  foldPitch: -5,
  foldYaw: 20,
  foldTravel: [0.9, 1.1],
  letterTurn: 3,
  revealApproach: 1.2,
  revealPitch: 5,
};

export interface Viewport {
  width: number;
  height: number;
}

/** Compact viewports shorter than this lower the artwork so it stays under the identity lines. */
export const SHORT_VIEWPORT = 760;

export function screenCentre(layout: Layout, viewport: Viewport, out: Vec2 = [0, 0]): Vec2 {
  const short = Math.max(0, SHORT_VIEWPORT - viewport.height);
  out[0] = layout.centre[0];
  out[1] = layout.centre[1] + short * layout.shortShift;
  return out;
}

export function layoutFor(compact: boolean): Layout {
  return compact ? COMPACT : DESKTOP;
}

export interface PoseParams {
  /** 0 = loader entrance, 1 = settled. */
  reveal: number;
  /** 0 = rest, 1 = turned and carried away as the first chapter covers the opening. */
  fold: number;
  /** Pointer in normalised device coordinates, or zero. */
  pointerX?: number;
  pointerY?: number;
}

function freshPose(): Pose {
  return { position: [0, 0, 0], rotation: [0, 0, 0], scale: 1 };
}

const scratchCentre: Vec2 = [0, 0];

/**
 * Pose of the whole monogram in camera space: the camera sits at the origin
 * looking down -z, so a point at depth `distance` projects to the layout's
 * screen centre.
 */
export function groupPose(layout: Layout, viewport: Viewport, params: PoseParams, out: Pose = freshPose()): Pose {
  const reveal = easeInOutCubic(params.reveal);
  const fold = easeInOutCubic(params.fold);
  const distance = layout.distance - (1 - reveal) * layout.revealApproach;
  const halfHeight = Math.tan((layout.fov * DEG) / 2) * distance;
  const aspect = viewport.width / Math.max(1, viewport.height);
  const centre = screenCentre(layout, viewport, scratchCentre);
  out.position[0] = (centre[0] - 0.5) * 2 * halfHeight * aspect + layout.foldTravel[0] * fold;
  out.position[1] = (0.5 - centre[1]) * 2 * halfHeight + layout.foldTravel[1] * fold;
  out.position[2] = -distance;
  const pointerX = params.pointerX ?? 0;
  const pointerY = params.pointerY ?? 0;
  out.rotation[0] = (layout.rest[0] + layout.revealPitch * (1 - reveal) + layout.foldPitch * fold - pointerY * 2.5) * DEG;
  out.rotation[1] = (layout.rest[1] + layout.foldYaw * fold + pointerX * 3.5) * DEG;
  out.rotation[2] = layout.rest[2] * DEG;
  out.scale = layout.scale;
  return out;
}

/**
 * Pose of one letter relative to the group: its place in the pair, plus a
 * few degrees of its own turn during the fold so the two solids keep a
 * visible depth relationship while they travel together.
 */
export function letterPose(layout: Layout, letter: Letter, params: PoseParams, out: Pose = freshPose()): Pose {
  const fold = easeInOutCubic(params.fold);
  const centre = PLACEMENT[letter].centre;
  out.position[0] = centre[0];
  out.position[1] = centre[1];
  out.position[2] = 0;
  out.rotation[0] = 0;
  out.rotation[1] = (letter === 'j' ? layout.letterTurn : -layout.letterTurn) * fold * DEG;
  out.rotation[2] = 0;
  out.scale = 1;
  return out;
}

// --- transforms and projection ------------------------------------------------

/** Column-major 4x4 matrix, as three.js stores it. */
export type Mat4 = Float64Array;

/** Matrix for a pose: translate, rotate X then Y then Z (three's XYZ Euler order), scale. */
export function poseMatrix(pose: Pose, out: Mat4 = new Float64Array(16)): Mat4 {
  const [a, b, c] = pose.rotation;
  const ca = Math.cos(a), sa = Math.sin(a);
  const cb = Math.cos(b), sb = Math.sin(b);
  const cc = Math.cos(c), sc = Math.sin(c);
  const s = pose.scale;
  const ae = ca * cc, af = ca * sc, be = sa * cc, bf = sa * sc;
  out[0] = cb * cc * s;
  out[4] = -cb * sc * s;
  out[8] = sb * s;
  out[1] = (af + be * sb) * s;
  out[5] = (ae - bf * sb) * s;
  out[9] = -sa * cb * s;
  out[2] = (bf - ae * sb) * s;
  out[6] = (be + af * sb) * s;
  out[10] = ca * cb * s;
  out[3] = 0;
  out[7] = 0;
  out[11] = 0;
  out[12] = pose.position[0];
  out[13] = pose.position[1];
  out[14] = pose.position[2];
  out[15] = 1;
  return out;
}

export function multiplyMatrices(a: Mat4, b: Mat4, out: Mat4 = new Float64Array(16)): Mat4 {
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      out[col * 4 + row] = a[row] * b[col * 4] + a[4 + row] * b[col * 4 + 1] + a[8 + row] * b[col * 4 + 2] + a[12 + row] * b[col * 4 + 3];
    }
  }
  return out;
}

export function transformPoint(m: Mat4, p: Vec3, out: Vec3 = [0, 0, 0]): Vec3 {
  const x = p[0], y = p[1], z = p[2];
  out[0] = m[0] * x + m[4] * y + m[8] * z + m[12];
  out[1] = m[1] * x + m[5] * y + m[9] * z + m[13];
  out[2] = m[2] * x + m[6] * y + m[10] * z + m[14];
  return out;
}

export interface ScreenPoint {
  /** 0..1 from the left and from the top. */
  x: number;
  y: number;
  /** Distance in front of the camera; larger is farther. */
  depth: number;
}

/** Projects a camera-space point through a pinhole at the origin looking down -z. */
export function project(point: Vec3, fov: number, aspect: number, out: ScreenPoint = { x: 0, y: 0, depth: 0 }): ScreenPoint {
  const depth = -point[2];
  const safe = Math.abs(depth) < 1e-6 ? 1e-6 : depth;
  const tanHalf = Math.tan((fov * DEG) / 2);
  out.x = 0.5 + (0.5 * point[0]) / safe / (tanHalf * aspect);
  out.y = 0.5 - (0.5 * point[1]) / safe / tanHalf;
  out.depth = depth;
  return out;
}

/** World matrix of a letter for the given layout, viewport, and parameters. */
export function letterMatrix(layout: Layout, viewport: Viewport, letter: Letter, params: PoseParams, out: Mat4 = new Float64Array(16)): Mat4 {
  const group = poseMatrix(groupPose(layout, viewport, params));
  const local = poseMatrix(letterPose(layout, letter, params));
  return multiplyMatrices(group, local, out);
}

/** The letter's centred outline at local depth `z`, projected to screen fractions. */
export function projectOutline(points: readonly Vec2[], z: number, matrix: Mat4, fov: number, aspect: number): ScreenPoint[] {
  const p: Vec3 = [0, 0, z];
  const q: Vec3 = [0, 0, 0];
  return points.map(([x, y]) => {
    p[0] = x;
    p[1] = y;
    transformPoint(matrix, p, q);
    return project(q, fov, aspect);
  });
}

/** Projected screen bounds (0..1) of a letter's full solid: both cap planes of its silhouette. */
export function projectedBounds(layout: Layout, viewport: Viewport, letter: Letter, params: PoseParams): Bounds {
  const matrix = letterMatrix(layout, viewport, letter, params);
  const aspect = viewport.width / viewport.height;
  const outline = centredOutline(letter);
  const bounds: Bounds = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity };
  for (const z of [THICKNESS / 2, -THICKNESS / 2]) {
    for (const s of projectOutline(outline, z, matrix, layout.fov, aspect)) {
      bounds.left = Math.min(bounds.left, s.x);
      bounds.right = Math.max(bounds.right, s.x);
      bounds.top = Math.min(bounds.top, s.y);
      bounds.bottom = Math.max(bounds.bottom, s.y);
    }
  }
  return bounds;
}

/** Pixels per local unit at the front of the monogram, for screen-space line widths in the poster. */
export function pixelsPerUnit(layout: Layout, viewport: Viewport, params: PoseParams): number {
  const pose = groupPose(layout, viewport, params);
  const depth = -pose.position[2] - THICKNESS / 2;
  return ((viewport.height / 2) * pose.scale) / (Math.tan((layout.fov * DEG) / 2) * depth);
}
