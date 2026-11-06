/**
 * Pure geometry for the opening artwork: a heavy italic JT emblem fused into
 * an elongated oval rim, one continuous piece of polished metal like a
 * streetwear belt buckle. Everything here is deterministic plain math, so
 * the WebGL scene, the SVG poster, and the unit tests share one description.
 *
 * The emblem lives in one local frame: x right, y up, the oval two units
 * tall from y = -1 to y = 1 and 1.55 times as wide. It is a single compound
 * outline: the outer oval, which carries two swept thorns, and one inner
 * negative-space contour that follows the rim's inner edge and detours
 * around the two letters where they grow out of it. The J leans forward
 * with a broad stem, a rounded return, and a rising left terminal; a spur
 * sweeps back from its upper shoulder and a thorn from the base of its stem;
 * its return flows into the rim near seven o'clock. The T has a heavy swept
 * crossbar drawn out to a point on the left, a centred slanted stem with a
 * clean foot and a thorn on its outer edge, and its crossbar's right end
 * flows into the rim near two o'clock. Each join is a tangent cove, every
 * thorn grows from a broad root to a small finite tip, and nothing else
 * touches the rim, so the dark space inside the oval stays one open region
 * and the J counter stays open.
 *
 * The drawn outline is the flat cap. The extrusion rolls a small
 * quarter-round bevel outward from it, so the silhouette is the cap grown
 * by the bevel radius, and a shallow dome is raised on the whole front cap
 * from one smooth field, so letters, joins, thorns, and rim share one
 * continuous surface. Concave corners need a radius larger than the bevel.
 *
 * Poses are rigid: the emblem moves as one. The scroll handoff turns it
 * modestly and carries it up and right while the first chapter covers it;
 * the loader starts closer and pitched; the pointer tilts the view by a few
 * degrees.
 */

export type Vec2 = [number, number];
export type Vec3 = [number, number, number];
export type Part = 'emblem';

export const PARTS: readonly Part[] = ['emblem'];

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

/** A closed outline: the last segment ends exactly at `start`. Holes are closed outlines wound the opposite way. */
export interface Outline {
  start: Vec2;
  segments: Segment[];
  holes?: Outline[];
}

function unit(x: number, y: number): Vec2 {
  const len = Math.hypot(x, y) || 1;
  return [x / len, y / len];
}

const RIGHT: Vec2 = [1, 0];
const LEFT: Vec2 = [-1, 0];
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

  /** A near-circular arc from the current direction to `dir`; turns beyond a right angle are split in two. */
  arc(to: Vec2, dir: Vec2): this {
    const cos = Math.max(-1, Math.min(1, this.dir[0] * dir[0] + this.dir[1] * dir[1]));
    const turn = Math.acos(cos);
    if (turn > Math.PI / 2 + 1e-6) {
      // Midpoint of the circular arc through both tangents: the chord's midpoint pushed out by the sagitta.
      const mx = (this.at[0] + to[0]) / 2, my = (this.at[1] + to[1]) / 2;
      const chord = Math.hypot(to[0] - this.at[0], to[1] - this.at[1]);
      const radius = chord / (2 * Math.sin(turn / 2));
      const sagitta = radius * (1 - Math.cos(turn / 2));
      const mid = unit(this.dir[0] + dir[0], this.dir[1] + dir[1]);
      // The arc bulges to the side the turn comes from: left of travel for a counterclockwise turn.
      const cross = this.dir[0] * dir[1] - this.dir[1] * dir[0];
      const side = cross > 0 ? -1 : 1;
      const apex: Vec2 = [mx - side * mid[1] * -sagitta * -1, my + side * mid[0] * -sagitta * -1];
      void apex;
      const n: Vec2 = cross > 0 ? [-mid[1], mid[0]] : [mid[1], -mid[0]];
      const peak: Vec2 = [mx - n[0] * sagitta, my - n[1] * sagitta];
      this.arc(peak, mid);
      return this.arc(to, dir);
    }
    const chord = Math.hypot(to[0] - this.at[0], to[1] - this.at[1]);
    const handle = arcHandle(chord, turn);
    return this.curve(to, dir, handle, handle);
  }

  /** Samples an ellipse arc as short lines, leaving the pen heading along the ellipse. */
  ellipse(a: number, b: number, from: number, to: number, step = 1.5): this {
    const count = Math.max(2, Math.ceil(Math.abs(to - from) / step));
    for (let i = 1; i <= count; i++) {
      const phi = (from + ((to - from) * i) / count) * DEG;
      this.line([a * Math.cos(phi), b * Math.sin(phi)]);
    }
    const t = ellipseTangent(a, b, to);
    this.dir = to >= from ? t : [-t[0], -t[1]];
    return this;
  }

  /** Rounds a thorn's tip as two arcs through its apex, so even a sharp turn stays circular. */
  point(t: Tip): this {
    this.arc(t.apex, t.tangent);
    return this.arc(t.exit, t.out);
  }

  private angle = 0;

  /** Remembers or reads the ellipse angle the pen is at, for contours that walk an ellipse in pieces. */
  heading(angle?: number): number {
    if (angle !== undefined) this.angle = angle;
    return this.angle;
  }

  close(): Outline {
    return { start: this.start, segments: this.segments };
  }
}

interface Tip {
  apex: Vec2;
  entry: Vec2;
  exit: Vec2;
  tangent: Vec2;
  in: Vec2;
  out: Vec2;
}

/**
 * A rounded tip of radius `r` whose visible apex is `apex`: the edge arrives
 * along `a` and leaves along `b`. The contour travels with the metal on its
 * right, so the apex tangent is the bisector turned a quarter clockwise.
 */
function tip(apex: Vec2, a: Vec2, b: Vec2, r: number): Tip {
  const cosA = Math.max(-1, Math.min(1, -(a[0] * b[0] + a[1] * b[1])));
  const alpha = Math.acos(cosA);
  const u = unit(-a[0] + b[0], -a[1] + b[1]);
  const d = r / Math.sin(alpha / 2);
  const corner: Vec2 = [apex[0] - u[0] * (d - r), apex[1] - u[1] * (d - r)];
  const reach = r * Math.tan((Math.PI - alpha) / 2);
  return {
    apex,
    entry: [corner[0] - a[0] * reach, corner[1] - a[1] * reach],
    exit: [corner[0] + b[0] * reach, corner[1] + b[1] * reach],
    tangent: [-u[1], u[0]],
    in: a,
    out: b,
  };
}

function rotate(v: Vec2, degrees: number): Vec2 {
  const c = Math.cos(degrees * DEG), s = Math.sin(degrees * DEG);
  return [v[0] * c - v[1] * s, v[0] * s + v[1] * c];
}

/**
 * A thorn tip from its apex and axis (root to apex): a symmetric wedge of
 * `width` degrees whose edges are oriented for a contour that keeps the
 * metal on its right, so the arriving edge turns right into the leaving one.
 */
function wedge(apex: Vec2, axis: Vec2, width: number, r: number): Tip {
  const d = unit(axis[0], axis[1]);
  return tip(apex, rotate(d, -width / 2), rotate([-d[0], -d[1]], width / 2), r);
}

function ellipsePoint(a: number, b: number, degrees: number): Vec2 {
  return [a * Math.cos(degrees * DEG), b * Math.sin(degrees * DEG)];
}

/** Counterclockwise unit tangent of the ellipse at the given angle. */
function ellipseTangent(a: number, b: number, degrees: number): Vec2 {
  return unit(-a * Math.sin(degrees * DEG), b * Math.cos(degrees * DEG));
}

/**
 * A thorn growing from a straight edge the pen is travelling along: a broad
 * fillet out onto the leading edge, the wedge and its tip, and a tighter
 * fillet back onto the same edge, which the pen then continues along.
 */
function thornOnEdge(pen: Pen, edgePoint: Vec2, edgeDir: Vec2, t: Tip, lead = 0.09, trail = 0.05): Pen {
  const leadCorner = intersect(edgePoint, edgeDir, t.entry, t.in);
  const trailCorner = intersect(t.exit, t.out, edgePoint, edgeDir);
  fillet(pen, leadCorner, edgeDir, t.in, lead);
  pen.line(t.entry);
  pen.point(t);
  fillet(pen, trailCorner, t.out, edgeDir, trail);
  return pen;
}

/** Rounds the corner where the pen's current line (direction `a`) meets the next edge (direction `b`). */
function fillet(pen: Pen, corner: Vec2, a: Vec2, b: Vec2, r: number): Pen {
  const cos = Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1]));
  const reach = r * Math.tan(Math.acos(cos) / 2);
  pen.line([corner[0] - a[0] * reach, corner[1] - a[1] * reach]);
  return pen.arc([corner[0] + b[0] * reach, corner[1] + b[1] * reach], b);
}

/** Bevel radius rolled outward from the drawn (cap) outline; the silhouette is the cap grown by it. */
export const BEVEL = 0.02;

/** Silhouette oval: 1.55:1, with a band of 0.16 (8% of the height); the cap sits one bevel inside the silhouette. */
export const RIM = { a: 1.55, b: 1.0, band: 0.16 };

/** The cap's outer oval and inner edge, each one bevel inside its silhouette. */
const OUTER = { a: RIM.a - BEVEL, b: RIM.b - BEVEL };
const INNER = { a: RIM.a - RIM.band + BEVEL, b: RIM.b - RIM.band + BEVEL };

/** Forward lean of the letters: x shifts by this much per unit of height. */
export const SLANT = 0.23;

/** Cap radius of every thorn tip; the silhouette tip is this plus the bevel. */
export const THORN_TIP = 0.018;

const sh = (x: number, y: number): Vec2 => [x + SLANT * y, y];
const shd = (x: number, y: number): Vec2 => unit(x + SLANT * y, y);
const SLANT_UP = shd(0, 1);
const SLANT_DOWN = shd(0, -1);

/** Where the line through `p` along `d` meets the line through `q` along `e`. */
function intersect(p: Vec2, d: Vec2, q: Vec2, e: Vec2): Vec2 {
  const denom = d[0] * e[1] - d[1] * e[0];
  const t = ((q[0] - p[0]) * e[1] - (q[1] - p[1]) * e[0]) / denom;
  return [p[0] + d[0] * t, p[1] + d[1] * t];
}

interface Flank {
  /** Angle on the inner edge where the cove meets the ellipse. */
  phi: number;
  /** Where the cove's arc touches the letter's edge. */
  edge: Vec2;
}

/**
 * A join flank: the circular cove of radius `r` tangent to the rim's inner
 * edge and to a straight letter edge. Solved for the ellipse angle at which
 * the cove meets the ellipse exactly, so the sampled ellipse and the arc
 * share that point and direction. `entering` is the flank where the contour
 * leaves the ellipse for the edge; otherwise it returns to the ellipse. `cw`
 * is for contours that travel the ellipse clockwise.
 */
function flank(a: number, b: number, edgePoint: Vec2, edgeDir: Vec2, r: number, lo: number, hi: number, entering: boolean, cw = false): Flank {
  const gap = (phi: number): { f: number; edge: Vec2 } => {
    const e = ellipsePoint(a, b, phi);
    const ccw = ellipseTangent(a, b, phi);
    const t: Vec2 = cw ? [-ccw[0], -ccw[1]] : ccw;
    const corner = intersect(e, t, edgePoint, edgeDir);
    const from = entering ? t : edgeDir;
    const to = entering ? edgeDir : t;
    const cos = Math.max(-1, Math.min(1, from[0] * to[0] + from[1] * to[1]));
    const reach = r * Math.tan(Math.acos(cos) / 2);
    const along = entering ? (corner[0] - e[0]) * t[0] + (corner[1] - e[1]) * t[1] : (e[0] - corner[0]) * t[0] + (e[1] - corner[1]) * t[1];
    const edge: Vec2 = entering
      ? [corner[0] + edgeDir[0] * reach, corner[1] + edgeDir[1] * reach]
      : [corner[0] - edgeDir[0] * reach, corner[1] - edgeDir[1] * reach];
    return { f: along - reach, edge };
  };
  let low = lo, high = hi;
  let fLow = gap(low).f;
  for (let i = 0; i < 60; i++) {
    const mid = (low + high) / 2;
    const fMid = gap(mid).f;
    if ((fMid < 0) === (fLow < 0)) {
      low = mid;
      fLow = fMid;
    } else {
      high = mid;
    }
  }
  const phi = (low + high) / 2;
  return { phi, edge: gap(phi).edge };
}

/**
 * The outer oval, clockwise from the right, carrying two thorns that sweep
 * the same way round: one on the lower right, one on the upper left. Each
 * is a straight-edged wedge with a small finite tip, leaving the oval
 * through a broad tangent cove on its leading edge and landing back through
 * a tighter cove on its trailing edge.
 */
function drawOuter(): Outline {
  const { a, b } = OUTER;
  const cw = (phi: number): Vec2 => {
    const t = ellipseTangent(a, b, phi);
    return [-t[0], -t[1]];
  };
  const pen = new Pen([a, 0], DOWN);
  const thorn = (t: Tip, lo: number, hi: number) => {
    const lead = flank(a, b, t.entry, t.in, 0.08, lo, hi, true, true);
    const trail = flank(a, b, t.exit, t.out, 0.05, lo, hi, false, true);
    pen.ellipse(a, b, pen.heading(), lead.phi);
    pen.arc(lead.edge, t.in);
    pen.line(t.entry);
    pen.point(t);
    pen.line(trail.edge);
    pen.arc(ellipsePoint(a, b, trail.phi), cw(trail.phi));
    pen.heading(trail.phi);
  };
  pen.heading(360);
  thorn(wedge([0.6, -1.17], [-0.42, -0.91], 24, THORN_TIP), 290, 350);
  thorn(wedge([-0.6, 1.17], [0.42, 0.91], 24, THORN_TIP), 110, 170);
  pen.ellipse(a, b, pen.heading(), 0);
  return pen.close();
}

/**
 * The negative space: one counterclockwise contour that runs along the rim's
 * inner edge and, at each join, leaves it through a cove to trace the letter
 * clockwise (thorns included) and returns through another cove. Starting on
 * the right side below the T.
 */
function drawNegative(): Outline {
  const { a, b } = INNER;
  const r = THORN_TIP;
  // T, upright before the slant: bar top and bottom, stem edges, foot, and the thorn on the stem's outer edge.
  const barTop = 0.69, barBottom = 0.42, stemL = 0.44, stemR = 0.71, foot = -0.62;
  const barTip = wedge(sh(-0.04, 0.68), shd(-1, 0.22), 22, r);
  const stemThorn = wedge(sh(1.02, -0.34), shd(0.75, -0.66), 24, r);
  // J: stem edges, top, terminal, and the two thorns: a spur swept back from the upper shoulder and one at the stem's base.
  const stemJL = -0.62, stemJR = -0.35, top = 0.66, termL = -1.06, termWidth = 0.24, termTop = 0.0;
  const spur = wedge(sh(-0.92, 0.66), shd(-0.8, 0.6), 24, r);
  const baseThorn = wedge(sh(-0.02, -0.34), shd(0.8, -0.6), 24, r);
  const jEnd: Vec2 = [-0.86, -0.56];
  const jEndDir = unit(-0.95, -0.3);
  const floor = -0.38;

  // The four coves where the letters grow out of the rim.
  const tLower = flank(a, b, sh(0.95, barBottom), LEFT, 0.12, 5, 50, true);
  const tUpper = flank(a, b, sh(0.5, barTop), RIGHT, 0.05, 40, 80, false);
  const jUpper = flank(a, b, sh(termL, -0.5), SLANT_UP, 0.05, 190, 235, true);
  const jLower = flank(a, b, jEnd, jEndDir, 0.05, 215, 262, false);

  const pen = new Pen(ellipsePoint(a, b, tLower.phi), ellipseTangent(a, b, tLower.phi));

  // T: cove into the bar's underside, down the stem with its thorn, around the foot, up, out to the bar's point, and back along the top.
  pen.arc(tLower.edge, LEFT);
  fillet(pen, sh(stemR, barBottom), LEFT, SLANT_DOWN, 0.08);
  thornOnEdge(pen, sh(stemR, 0), SLANT_DOWN, stemThorn);
  fillet(pen, sh(stemR, foot), SLANT_DOWN, LEFT, 0.06);
  fillet(pen, sh(stemL, foot), LEFT, SLANT_UP, 0.06);
  fillet(pen, sh(stemL, barBottom), SLANT_UP, LEFT, 0.08);
  pen.curve(barTip.entry, barTip.in, 0.3, 0.2);
  pen.point(barTip);
  pen.curve(sh(0.3, barTop), RIGHT, 0.24, 0.2);
  pen.line(tUpper.edge);
  pen.arc(ellipsePoint(a, b, tUpper.phi), ellipseTangent(a, b, tUpper.phi));

  // Over the top and down the left side to the J.
  pen.ellipse(a, b, tUpper.phi, jUpper.phi);

  // J: cove into the terminal, over its round, down into the counter, up the stem past the spur, over the top, down past the base thorn, and round into the rim.
  pen.arc(jUpper.edge, SLANT_UP);
  pen.line(sh(termL, termTop - termWidth / 2));
  pen.arc(sh(termL + termWidth / 2, termTop), RIGHT);
  pen.arc(sh(termL + termWidth, termTop - termWidth / 2), SLANT_DOWN);
  // The counter: down the terminal's inner edge, along the floor, and up the stem's left edge, with rounded inner corners.
  fillet(pen, sh(termL + termWidth, floor), SLANT_DOWN, RIGHT, 0.08);
  fillet(pen, sh(stemJL, floor), RIGHT, SLANT_UP, 0.08);
  thornOnEdge(pen, sh(stemJL, 0), SLANT_UP, spur);
  fillet(pen, sh(stemJL, top), SLANT_UP, RIGHT, 0.06);
  fillet(pen, sh(stemJR, top), RIGHT, SLANT_DOWN, 0.06);
  thornOnEdge(pen, sh(stemJR, 0), SLANT_DOWN, baseThorn);
  pen.line(sh(stemJR, -0.26));
  pen.curve(jEnd, jEndDir, 0.42, 0.28);
  pen.line(jLower.edge);
  pen.arc(ellipsePoint(a, b, jLower.phi), ellipseTangent(a, b, jLower.phi));

  // Along the bottom and up the right side back to the start.
  pen.ellipse(a, b, jLower.phi, tLower.phi + 360);
  return pen.close();
}

function drawEmblem(): Outline {
  return { ...drawOuter(), holes: [drawNegative()] };
}

export const OUTLINES: Readonly<Record<Part, Outline>> = { emblem: drawEmblem() };

/** Silhouette size of the emblem: the outer oval including its bevel, plus the rim thorns' reach. */
export const EMBLEM = { width: 2 * RIM.a, height: 2 * 1.15 + 2 * BEVEL };

/**
 * Extrusion: the bevel rolled outward from the cap, the straight wall depth,
 * and the shallow dome raised on the front cap from one smooth field, broad
 * over the letter bodies and modest over the band. Total thickness is depth
 * plus two bevels plus the dome.
 */
export const EXTRUSION = {
  bevel: { emblem: BEVEL } as Readonly<Record<Part, number>>,
  bevelSegments: 6,
  curveSegments: 24,
  depth: { emblem: 0.1 } as Readonly<Record<Part, number>>,
  lift: { emblem: 0 } as Readonly<Record<Part, number>>,
  dome: { emblem: 0.06 } as Readonly<Record<Part, number>>,
  /** Longest edge allowed in the domed cap's triangulation, and the spacing of the field's grid. */
  domeEdge: 0.034,
  domeGrid: 0.015,
} as const;

export function thickness(part: Part): number {
  return EXTRUSION.depth[part] + 2 * EXTRUSION.bevel[part];
}

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
 * The smallest radius of curvature at the convex (or, with `concave`, the
 * concave) samples of the closed polyline, from the circle through each
 * point and its neighbours. The bevel rolls outward from the cap, so every
 * concave radius must exceed the bevel radius or the bevel would fold.
 */
export function minRadius(points: readonly Vec2[], concave = false): number {
  const n = points.length;
  const ccw = polygonArea(points) > 0;
  let min = Infinity;
  for (let i = 0; i < n; i++) {
    const p = points[(i + n - 1) % n], q = points[i], r = points[(i + 1) % n];
    const ax = q[0] - p[0], ay = q[1] - p[1], bx = r[0] - q[0], by = r[1] - q[1];
    const cross = ax * by - ay * bx;
    const convex = ccw ? cross > 0 : cross < 0;
    if (convex === concave || Math.abs(cross) < 1e-12) continue;
    const la = Math.hypot(ax, ay), lb = Math.hypot(bx, by), lc = Math.hypot(r[0] - p[0], r[1] - p[1]);
    const radius = (la * lb * lc) / (2 * Math.abs(cross));
    if (radius < min) min = radius;
  }
  return min;
}

/**
 * The narrowest stroke of a cap outline: for every sample, the distance
 * along the inward normal to the first edge the ray meets again.
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

/** Nearest distance from any sample of `a` to the edges of the closed polyline `b`. */
export function clearance(a: readonly Vec2[], b: readonly Vec2[]): number {
  let min = Infinity;
  for (const [ax, ay] of a) {
    for (let i = 0; i < b.length; i++) {
      const [px, py] = b[i];
      const [qx, qy] = b[(i + 1) % b.length];
      const ex = qx - px, ey = qy - py;
      const t = Math.max(0, Math.min(1, ((ax - px) * ex + (ay - py) * ey) / (ex * ex + ey * ey || 1)));
      min = Math.min(min, Math.hypot(ax - (px + ex * t), ay - (py + ey * t)));
    }
  }
  return min;
}

/** Even-odd point-in-polygon. */
export function contains(points: readonly Vec2[], x: number, y: number): boolean {
  let hit = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i];
    const [xj, yj] = points[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

/** The outline's contours as closed polylines: the outer boundary first, then any holes. */
export function contours(outline: Outline, segments = EXTRUSION.curveSegments): Vec2[][] {
  return [flatten(outline, segments), ...(outline.holes ?? []).map((hole) => flatten(hole, segments))];
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
  /** At reveal 0: how much closer the monogram starts and the extra pitch in degrees. */
  revealApproach: number;
  revealPitch: number;
}

export const DESKTOP: Layout = {
  fov: 32,
  distance: 8,
  centre: [0.73, 0.515],
  shortShift: 0,
  scale: 1,
  rest: [3, 8, 0],
  foldPitch: -5,
  foldYaw: 22,
  foldTravel: [1.1, 1.3],
  revealApproach: 1.5,
  revealPitch: 6,
};

export const COMPACT: Layout = {
  fov: 40,
  distance: 8,
  centre: [0.5, 0.675],
  shortShift: 0.0004,
  scale: 0.72,
  rest: [2, 7, 0],
  foldPitch: -4,
  foldYaw: 18,
  foldTravel: [0.9, 1.1],
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
 * Pose of the whole emblem in camera space: the camera sits at the origin
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

/** Pose of one part relative to the emblem: rim and letters are rigid, the letters raised in depth. */
export function partPose(part: Part, out: Pose = freshPose()): Pose {
  out.position[0] = 0;
  out.position[1] = 0;
  out.position[2] = EXTRUSION.lift[part];
  out.rotation[0] = 0;
  out.rotation[1] = 0;
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

/** World matrix of a part for the given layout, viewport, and parameters. */
export function partMatrix(layout: Layout, viewport: Viewport, part: Part, params: PoseParams, out: Mat4 = new Float64Array(16)): Mat4 {
  const group = poseMatrix(groupPose(layout, viewport, params));
  const local = poseMatrix(partPose(part));
  return multiplyMatrices(group, local, out);
}

/** A contour at local depth `z`, projected to screen fractions. */
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

/** Pixels per local unit at the front of the emblem, for screen-space widths in the poster. */
export function pixelsPerUnit(layout: Layout, viewport: Viewport, params: PoseParams): number {
  const pose = groupPose(layout, viewport, params);
  const depth = -pose.position[2] - thickness('emblem') / 2 - EXTRUSION.lift.emblem;
  return ((viewport.height / 2) * pose.scale) / (Math.tan((layout.fov * DEG) / 2) * depth);
}

/**
 * Projected screen bounds (0..1) of a part's full solid: its cap outline at
 * both cap planes, grown by the bevel that the extrusion rolls outward.
 */
export function projectedBounds(layout: Layout, viewport: Viewport, part: Part, params: PoseParams): Bounds {
  const matrix = partMatrix(layout, viewport, part, params);
  const aspect = viewport.width / viewport.height;
  const outline = flatten(OUTLINES[part]);
  const bounds: Bounds = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity };
  const half = thickness(part) / 2;
  for (const z of [half, -half]) {
    for (const s of projectOutline(outline, z, matrix, layout.fov, aspect)) {
      bounds.left = Math.min(bounds.left, s.x);
      bounds.right = Math.max(bounds.right, s.x);
      bounds.top = Math.min(bounds.top, s.y);
      bounds.bottom = Math.max(bounds.bottom, s.y);
    }
  }
  const grow = EXTRUSION.bevel[part] * pixelsPerUnit(layout, viewport, params);
  bounds.left -= grow / viewport.width;
  bounds.right += grow / viewport.width;
  bounds.top -= grow / viewport.height;
  bounds.bottom += grow / viewport.height;
  return bounds;
}
