/**
 * Pure geometry for the opening artwork: one lens-shaped object cut into two
 * closed shells by a shallow S-shaped slit. Everything here is deterministic
 * plain math, so the WebGL scene, the SVG poster, and the unit tests share
 * one description.
 *
 * The object lives in its own local frame: x right, y up, z toward the
 * viewer. Its outline is a skewed egg leaning to the upper right; a curve
 * across the lower third divides it into an upper mass and a lower
 * counterform with a narrow gap between them. Each shell is one continuous
 * surface: a convex silver front and a flatter dark back are smooth height
 * fields over the shell's plan (a dome fitted to the shell's own area, plus
 * extra height carried along the cut and faded out toward the outer
 * perimeter), a rounded edge runs around the boundary as an offset band whose
 * profile starts tangent to the field it leaves, and a nearly vertical wall
 * joins the front edge to the back edge, tall along the cut and collapsing to
 * a thin rounded tip along the perimeter. The plan-view corners where the cut
 * meets the perimeter are rounded, so the band turns smoothly around them.
 * Vertex normals are the analytic normals of that description, never
 * differences of the grid, so the shading is continuous across the mesh.
 *
 * Poses are rigid: the shells never deform. The scroll handoff slides the
 * lower shell home against the upper one while the whole object turns toward
 * a thin profile and moves up and right; the loader starts closer and
 * closed; the pointer tilts the view by a few degrees.
 */

export type Vec3 = [number, number, number];
export type Vec2 = [number, number];
export type Part = 'upper' | 'lower';

const DEG = Math.PI / 180;

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function smoothstep(t: number): number {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
}

/** Quintic step with zero slope and zero curvature at both ends, so surfaces blended by it stay free of visible rings. */
function smootherstep(t: number): number {
  const x = clamp01(t);
  return x * x * x * (x * (x * 6 - 15) + 10);
}

function smootherstepDerivative(t: number): number {
  if (t <= 0 || t >= 1) return 0;
  return 30 * t * t * (t - 1) * (t - 1);
}

export function easeInOutCubic(t: number): number {
  const x = clamp01(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

// --- the form -----------------------------------------------------------------

/** Outline, cut, and thickness of the object, in local units (the width is about 2.5). */
export interface Form {
  /** Semi-axes of the base ellipse before the egg skew and the lean. */
  axes: Vec2;
  /** Egg skew: the outline bulges by this fraction toward `broadDeg`. */
  skew: number;
  broadDeg: number;
  /** Rotation of the outline about z in degrees; negative leans the top to the right. */
  leanDeg: number;
  cut: {
    /** Height of the cut at x = 0. */
    y0: number;
    /** Rise of the cut per unit x. */
    slope: number;
    /** Amplitude and frequency of the S wave. */
    wave: number;
    frequency: number;
    phase: number;
    /** Half width of the gap at rest, measured along the cut normal. */
    gap: number;
  };
  thickness: {
    /** Rise of each shell's front dome and back dome above the tip height, at the dome's apex. */
    front: number;
    back: number;
    /** Exponent of the dome profile (1 - q^2)^power over the fitted ellipse; 2 keeps the curvature bounded everywhere. */
    domePower: number;
    /** The dome ellipse is the fitted ellipse scaled by this; above 1 its edge lies outside the shell and never shows as a ring. */
    apexScale: number;
    /** Radius of the rounded tip along the outer perimeter, which is also the half thickness there. */
    tip: number;
    /** Extra front and back height carried along the cut, so the slit shows a wall. */
    wall: number;
    wallBack: number;
    /** Distance from the cut over which the wall height fades into the dome, as a fraction of the shell's reach. */
    shoulder: number;
    /** Distance inside the outer perimeter over which the dome and the wall height fade to the tip. */
    rim: number;
    /** Distance inside the slit edge over which the dome lands on the wall height, so the cut edge keeps one height. */
    landing: number;
    /** Radius of the rounded edge between the front and the wall along the cut. */
    fillet: number;
    /** Plan-view radius of the rounding where the cut meets the outer perimeter. */
    corner: number;
  };
}

export const FORM: Form = {
  axes: [1.16, 1.62],
  skew: 0.14,
  broadDeg: 78,
  leanDeg: -30,
  cut: { y0: -0.22, slope: 0.3, wave: 0.14, frequency: 2.3, phase: 0.4, gap: 0.05 },
  thickness: { front: 0.21, back: 0.1, domePower: 2, apexScale: 1.12, tip: 0.03, wall: 0.085, wallBack: 0.05, shoulder: 0.85, rim: 0.36, landing: 0.3, fillet: 0.018, corner: 0.06 },
};

/** Outline point for the polar parameter `theta`, in the leaned local frame. */
export function outlinePoint(form: Form, theta: number, out: Vec2 = [0, 0]): Vec2 {
  const r = 1 + form.skew * Math.cos(theta - form.broadDeg * DEG);
  const x = form.axes[0] * r * Math.cos(theta);
  const y = form.axes[1] * r * Math.sin(theta);
  const lean = form.leanDeg * DEG;
  const c = Math.cos(lean);
  const s = Math.sin(lean);
  out[0] = c * x - s * y;
  out[1] = s * x + c * y;
  return out;
}

/** Unit tangent of the outline at `theta`, in the direction of increasing `theta` (counterclockwise). */
export function outlineTangent(form: Form, theta: number, out: Vec2 = [0, 0]): Vec2 {
  const phase = theta - form.broadDeg * DEG;
  const r = 1 + form.skew * Math.cos(phase);
  const dr = -form.skew * Math.sin(phase);
  const dx = form.axes[0] * (dr * Math.cos(theta) - r * Math.sin(theta));
  const dy = form.axes[1] * (dr * Math.sin(theta) + r * Math.cos(theta));
  const lean = form.leanDeg * DEG;
  const c = Math.cos(lean);
  const s = Math.sin(lean);
  const x = c * dx - s * dy;
  const y = s * dx + c * dy;
  const len = Math.hypot(x, y) || 1;
  out[0] = x / len;
  out[1] = y / len;
  return out;
}

/** Height of the cut curve at `x`, in the leaned local frame. */
export function cutHeight(form: Form, x: number): number {
  const { y0, slope, wave, frequency, phase } = form.cut;
  return y0 + slope * x + wave * Math.sin(frequency * x + phase);
}

function cutSlope(form: Form, x: number): number {
  const { slope, wave, frequency, phase } = form.cut;
  return slope + wave * frequency * Math.cos(frequency * x + phase);
}

/** Signed distance-like value: positive above the cut curve. */
function cutSide(form: Form, x: number, y: number): number {
  return (y - cutHeight(form, x)) / Math.sqrt(1 + cutSlope(form, x) ** 2);
}

/** Height of the shell's edge of the slit at `x`: the cut curve offset by `gap` toward the shell's side. */
function slitHeight(form: Form, x: number, sign: number, gap: number): number {
  return cutHeight(form, x) + sign * gap * Math.sqrt(1 + cutSlope(form, x) ** 2);
}

// --- the boundary -------------------------------------------------------------

export interface BoundaryPoint {
  x: number;
  y: number;
  /** Unit tangent in the walking direction (counterclockwise around the shell). */
  tx: number;
  ty: number;
  /** True on the cut segment, false on the outer perimeter. */
  cut: boolean;
}

const OUTLINE_SAMPLES = 1440;
const CUT_SAMPLES = 480;
const CORNER_SAMPLES = 16;

function boundaryPoint(x: number, y: number, tx: number, ty: number, cut: boolean): BoundaryPoint {
  const len = Math.hypot(tx, ty) || 1;
  return { x, y, tx: tx / len, ty: ty / len, cut };
}

function arcLengths(points: readonly BoundaryPoint[]): Float64Array {
  const cumulative = new Float64Array(points.length);
  for (let i = 1; i < points.length; i++) {
    cumulative[i] = cumulative[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  return cumulative;
}

/** The point at arc position `target` along an open polyline, with its tangent interpolated. */
function pointAlong(points: readonly BoundaryPoint[], cumulative: Float64Array, target: number): BoundaryPoint {
  let seg = 0;
  while (seg < points.length - 2 && cumulative[seg + 1] < target) seg++;
  const a = points[seg];
  const b = points[seg + 1];
  const span = cumulative[seg + 1] - cumulative[seg] || 1;
  const t = clamp01((target - cumulative[seg]) / span);
  return boundaryPoint(lerp(a.x, b.x, t), lerp(a.y, b.y, t), lerp(a.tx, b.tx, t), lerp(a.ty, b.ty, t), a.cut);
}

/** The open polyline with `distance` of arc removed from its start and from its end; the new ends are interpolated. */
function trimmed(points: readonly BoundaryPoint[], distance: number): BoundaryPoint[] {
  const cumulative = arcLengths(points);
  const total = cumulative[points.length - 1];
  const start = pointAlong(points, cumulative, distance);
  const end = pointAlong(points, cumulative, total - distance);
  const kept = points.filter((_, i) => cumulative[i] > distance && cumulative[i] < total - distance);
  return [start, ...kept, end];
}

/**
 * Cubic Hermite arc from `a` to `b`, tangent to both, sampled without its
 * endpoints. The tangent magnitudes make it approximate the circle tangent to
 * both lines, which is what rounding a plan-view corner by `radius` leaves.
 */
function cornerArc(a: BoundaryPoint, b: BoundaryPoint, radius: number): BoundaryPoint[] {
  const turn = Math.acos(Math.max(-1, Math.min(1, a.tx * b.tx + a.ty * b.ty)));
  const magnitude = turn < 1e-3 ? 2 * radius : (4 * Math.tan(turn / 4) * radius) / Math.tan(turn / 2);
  const points: BoundaryPoint[] = [];
  for (let k = 1; k < CORNER_SAMPLES; k++) {
    const s = k / CORNER_SAMPLES;
    const s2 = s * s;
    const s3 = s2 * s;
    const h00 = 2 * s3 - 3 * s2 + 1;
    const h10 = s3 - 2 * s2 + s;
    const h01 = -2 * s3 + 3 * s2;
    const h11 = s3 - s2;
    const x = h00 * a.x + h10 * magnitude * a.tx + h01 * b.x + h11 * magnitude * b.tx;
    const y = h00 * a.y + h10 * magnitude * a.ty + h01 * b.y + h11 * magnitude * b.ty;
    const d00 = 6 * s2 - 6 * s;
    const d10 = 3 * s2 - 4 * s + 1;
    const d01 = -6 * s2 + 6 * s;
    const d11 = 3 * s2 - 2 * s;
    const tx = d00 * a.x + d10 * magnitude * a.tx + d01 * b.x + d11 * magnitude * b.tx;
    const ty = d00 * a.y + d10 * magnitude * a.ty + d01 * b.y + d11 * magnitude * b.ty;
    points.push(boundaryPoint(x, y, tx, ty, s < 0.5 ? a.cut : b.cut));
  }
  return points;
}

/**
 * Closed boundary of one shell, counterclockwise: the outer perimeter from
 * one end of the cut to the other, then the slit edge back, with the two
 * corners rounded in plan. Every point carries its unit tangent, so the
 * rounded edge built on the boundary has a continuous outward normal.
 * The upper shell takes the part of the outline above the cut; the lower
 * shell the part below.
 */
export function shellBoundary(form: Form, part: Part, gap = form.cut.gap): BoundaryPoint[] {
  const sign = part === 'upper' ? 1 : -1;
  const side = (x: number, y: number) => sign * cutSide(form, x, y) - gap;
  const points: Vec2[] = [];
  for (let i = 0; i < OUTLINE_SAMPLES; i++) points.push(outlinePoint(form, (i / OUTLINE_SAMPLES) * Math.PI * 2));

  // Find the two crossings of the slit edge with the outline.
  const crossings: { index: number; theta: number }[] = [];
  for (let i = 0; i < OUTLINE_SAMPLES; i++) {
    const a = points[i];
    const b = points[(i + 1) % OUTLINE_SAMPLES];
    const fa = side(a[0], a[1]);
    const fb = side(b[0], b[1]);
    if ((fa > 0 && fb <= 0) || (fa <= 0 && fb > 0)) {
      const t = fa / (fa - fb);
      crossings.push({ index: i, theta: ((i + t) / OUTLINE_SAMPLES) * Math.PI * 2 });
    }
  }
  if (crossings.length !== 2) throw new Error(`the cut crosses the outline ${crossings.length} times`);

  // Walk the outline through the inside part, counterclockwise.
  const [first, second] = crossings;
  const inside = (i: number) => side(points[i][0], points[i][1]) > 0;
  const startAtFirst = inside((first.index + 1) % OUTLINE_SAMPLES);
  const from = startAtFirst ? first : second;
  const to = startAtFirst ? second : first;
  const outlineAt = (theta: number): BoundaryPoint => {
    const p = outlinePoint(form, theta);
    const t = outlineTangent(form, theta);
    return boundaryPoint(p[0], p[1], t[0], t[1], false);
  };
  const outline: BoundaryPoint[] = [outlineAt(from.theta)];
  for (let i = (from.index + 1) % OUTLINE_SAMPLES; i !== (to.index + 1) % OUTLINE_SAMPLES; i = (i + 1) % OUTLINE_SAMPLES) {
    outline.push(outlineAt((i / OUTLINE_SAMPLES) * Math.PI * 2));
  }
  outline.push(outlineAt(to.theta));

  // Then the slit edge from `to` back to `from`, so the loop stays counterclockwise.
  const x0 = outline[outline.length - 1].x;
  const x1 = outline[0].x;
  const direction = Math.sign(x1 - x0) || 1;
  const h = 1e-5;
  const slit: BoundaryPoint[] = [];
  for (let k = 0; k <= CUT_SAMPLES; k++) {
    const x = lerp(x0, x1, k / CUT_SAMPLES);
    const dy = (slitHeight(form, x + h, sign, gap) - slitHeight(form, x - h, sign, gap)) / (2 * h);
    slit.push(boundaryPoint(x, slitHeight(form, x, sign, gap), direction, direction * dy, true));
  }

  // Round both corners: trim each curve by the corner radius and bridge the ends with tangent arcs.
  const radius = form.thickness.corner;
  const outer = trimmed(outline, radius);
  const inner = trimmed(slit, radius);
  return [...outer, ...cornerArc(outer[outer.length - 1], inner[0], radius), ...inner, ...cornerArc(inner[inner.length - 1], outer[0], radius)];
}

/** Signed area of a closed polygon; positive when counterclockwise. */
export function polygonArea(points: readonly { x: number; y: number }[]): number {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return sum / 2;
}

export function polygonCentroid(points: readonly { x: number; y: number }[]): Vec2 {
  let cx = 0;
  let cy = 0;
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const w = a.x * b.y - b.x * a.y;
    cx += (a.x + b.x) * w;
    cy += (a.y + b.y) * w;
    area += w;
  }
  const k = 1 / (3 * area);
  return [cx * k, cy * k];
}

// --- the surface fields -------------------------------------------------------

/**
 * The smooth height fields of one shell. The dome is an ellipse fitted to the
 * shell's own area (same centroid and second moments) and enlarged so its
 * edge lies outside the shell, so each shell has its own apex and a convex
 * shoulder that rolls down toward the slit and the rim without ever showing
 * the ellipse's edge; a wall term carries extra height along the cut; both
 * fade to the tip height at the outer perimeter. Everything is a smooth
 * function of position with a closed-form gradient, so the surface normal is
 * known exactly at every point rather than estimated from the mesh.
 */
export interface ShellField {
  part: Part;
  centre: Vec2;
  /** Semi-axes and angle of the fitted ellipse. */
  axes: Vec2;
  angle: number;
  /** Typical reach of the shell from the cut, which scales the shoulder. */
  reach: number;
  /** Offset of the slit edge from the cut curve. */
  gap: number;
}

function fitEllipse(boundary: readonly { x: number; y: number }[], centre: Vec2): { axes: Vec2; angle: number } {
  // Second central moments of the polygon's area.
  let a2 = 0;
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (let i = 0; i < boundary.length; i++) {
    const p = boundary[i];
    const q = boundary[(i + 1) % boundary.length];
    const x0 = p.x - centre[0], y0 = p.y - centre[1];
    const x1 = q.x - centre[0], y1 = q.y - centre[1];
    const w = x0 * y1 - x1 * y0;
    a2 += w;
    sxx += (x0 * x0 + x0 * x1 + x1 * x1) * w;
    syy += (y0 * y0 + y0 * y1 + y1 * y1) * w;
    sxy += (x0 * y1 + 2 * x0 * y0 + 2 * x1 * y1 + x1 * y0) * w;
  }
  const area = a2 / 2;
  const vxx = sxx / 12 / area;
  const vyy = syy / 12 / area;
  const vxy = sxy / 24 / area;
  const mean = (vxx + vyy) / 2;
  const diff = (vxx - vyy) / 2;
  const root = Math.hypot(diff, vxy);
  const l1 = mean + root;
  const l2 = Math.max(1e-9, mean - root);
  const angle = 0.5 * Math.atan2(2 * vxy, vxx - vyy);
  // A uniform ellipse with semi-axes a, b has variances a^2/4 and b^2/4 along its axes.
  return { axes: [2 * Math.sqrt(l1), 2 * Math.sqrt(l2)], angle };
}

export function shellField(form: Form, part: Part, boundary: BoundaryPoint[], gap = form.cut.gap): ShellField {
  const centre = polygonCentroid(boundary);
  const { axes, angle } = fitEllipse(boundary, centre);
  let reach = 0;
  for (const p of boundary) if (!p.cut) reach = Math.max(reach, Math.abs(cutSide(form, p.x, p.y)));
  return { part, centre, axes, angle, reach, gap };
}

/**
 * Implicit function of the outline: 0 on the egg, positive inside, growing
 * toward its centre. In the unleaned ellipse frame the egg is r(theta) in
 * polar form, so the parameter is exactly the polar angle there.
 */
function outlineDepth(form: Form, x: number, y: number): number {
  const lean = form.leanDeg * DEG;
  const c = Math.cos(lean);
  const s = Math.sin(lean);
  const u = (c * x + s * y) / form.axes[0];
  const v = (-s * x + c * y) / form.axes[1];
  const r = 1 + form.skew * Math.cos(Math.atan2(v, u) - form.broadDeg * DEG);
  return 1 - Math.hypot(u, v) / r;
}

interface Distance {
  d: number;
  /** Gradient of the distance, pointing inward. */
  gx: number;
  gy: number;
}

/**
 * Distance inside the outer perimeter: the implicit function over its
 * gradient, which is exact on the outline, first-order accurate inside, and
 * smooth everywhere, so the fades built on it have no creases.
 */
function outlineDistance(form: Form, x: number, y: number): number {
  const h = 1e-5;
  const f = outlineDepth(form, x, y);
  const fx = (outlineDepth(form, x + h, y) - outlineDepth(form, x - h, y)) / (2 * h);
  const fy = (outlineDepth(form, x, y + h) - outlineDepth(form, x, y - h)) / (2 * h);
  return Math.max(0, f / (Math.hypot(fx, fy) || 1e-9));
}

function perimeterDistance(form: Form, x: number, y: number, out: Distance): Distance {
  const h = 1e-4;
  out.d = outlineDistance(form, x, y);
  out.gx = (outlineDistance(form, x + h, y) - outlineDistance(form, x - h, y)) / (2 * h);
  out.gy = (outlineDistance(form, x, y + h) - outlineDistance(form, x, y - h)) / (2 * h);
  return out;
}

export type Side = 'front' | 'back';

export interface FieldSample {
  /** Height above the mid plane (the back field is a positive depth). */
  z: number;
  /** Gradient of the height. */
  gx: number;
  gy: number;
  /** Share of the wall height carried here: 1 on the cut, fading over the shoulder, and 0 at the perimeter. */
  share: number;
}

const scratchDistance: Distance = { d: 0, gx: 0, gy: 0 };

/** The front or back height field of a shell at a point, with its gradient. */
export function sampleField(form: Form, field: ShellField, x: number, y: number, side: Side, out: FieldSample = { z: 0, gx: 0, gy: 0, share: 0 }): FieldSample {
  const t = form.thickness;
  const perimeter = perimeterDistance(form, x, y, scratchDistance);

  // Fade to the tip at the outer perimeter.
  const rimT = perimeter.d / t.rim;
  const rim = smootherstep(rimT);
  const rimSlope = smootherstepDerivative(rimT) / t.rim;
  const rimGx = rimSlope * perimeter.gx;
  const rimGy = rimSlope * perimeter.gy;

  // The wall height along the cut, fading over the shoulder.
  const h = 1e-5;
  const cs = cutSide(form, x, y);
  const csx = (cutSide(form, x + h, y) - cutSide(form, x - h, y)) / (2 * h);
  const csy = (cutSide(form, x, y + h) - cutSide(form, x, y - h)) / (2 * h);
  const span = Math.max(1e-6, field.reach * t.shoulder);
  const fromCut = Math.abs(cs) / span;
  const along = 1 - smootherstep(fromCut);
  const alongSlope = (-smootherstepDerivative(fromCut) / span) * Math.sign(cs);
  const share = along * rim;
  const shareGx = alongSlope * csx * rim + along * rimGx;
  const shareGy = alongSlope * csy * rim + along * rimGy;

  // The dome over the enlarged fitted ellipse.
  const c = Math.cos(-field.angle);
  const s = Math.sin(-field.angle);
  const dx = x - field.centre[0];
  const dy = y - field.centre[1];
  const au = field.axes[0] * t.apexScale;
  const av = field.axes[1] * t.apexScale;
  const u = (c * dx - s * dy) / au;
  const v = (s * dx + c * dy) / av;
  const base = Math.max(0, 1 - (u * u + v * v));
  const profile = Math.pow(base, t.domePower);
  const profileSlope = base > 0 ? -t.domePower * Math.pow(base, t.domePower - 1) : 0;
  const q2x = (2 * u * c) / au + (2 * v * s) / av;
  const q2y = (-2 * u * s) / au + (2 * v * c) / av;
  // The dome lands on the wall height at the slit the way it lands on the tip at the rim.
  const landT = (Math.abs(cs) - field.gap) / t.landing;
  const land = smootherstep(landT);
  const landSlope = (smootherstepDerivative(landT) / t.landing) * Math.sign(cs);
  const fade = rim * land;
  const fadeGx = rimGx * land + rim * landSlope * csx;
  const fadeGy = rimGy * land + rim * landSlope * csy;
  const dome = profile * fade;
  const domeGx = profileSlope * q2x * fade + profile * fadeGx;
  const domeGy = profileSlope * q2y * fade + profile * fadeGy;

  const wall = side === 'front' ? t.wall : t.wallBack;
  const rise = side === 'front' ? t.front : t.back;
  out.z = t.tip + wall * share + rise * dome;
  out.gx = wall * shareGx + rise * domeGx;
  out.gy = wall * shareGy + rise * domeGy;
  out.share = share;
  return out;
}

/** Height of the shell's front surface above the mid plane. */
export function frontHeight(form: Form, field: ShellField, x: number, y: number): number {
  return sampleField(form, field, x, y, 'front').z;
}

/** Depth of the shell's back surface below the mid plane, as a positive number. */
export function backHeight(form: Form, field: ShellField, x: number, y: number): number {
  return sampleField(form, field, x, y, 'back').z;
}

// --- the loft -----------------------------------------------------------------

interface Ray {
  /** Boundary point and the unit outward normal of the boundary there. */
  bx: number;
  by: number;
  mx: number;
  my: number;
}

/** Extra ray measure per radian of boundary turn, so the rounded corners get rays in proportion to how far the edge turns. */
const TURN_MEASURE = 0.1;

/**
 * Resamples the boundary into `count` points with their outward normals,
 * spaced by arc length plus a share for the turning of the tangent, so the
 * rounded corners are covered as densely as the straighter runs.
 */
function boundaryRays(boundary: BoundaryPoint[], count: number): Ray[] {
  const n = boundary.length;
  const cumulative = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) {
    const a = boundary[i];
    const b = boundary[(i + 1) % n];
    const turn = Math.acos(Math.max(-1, Math.min(1, a.tx * b.tx + a.ty * b.ty)));
    cumulative[i + 1] = cumulative[i] + Math.hypot(b.x - a.x, b.y - a.y) + TURN_MEASURE * turn;
  }
  const total = cumulative[n];
  const rays: Ray[] = [];
  let seg = 0;
  for (let k = 0; k < count; k++) {
    const target = (k / count) * total;
    while (seg < n - 1 && cumulative[seg + 1] < target) seg++;
    const a = boundary[seg];
    const b = boundary[(seg + 1) % n];
    const span = cumulative[seg + 1] - cumulative[seg] || 1;
    const t = clamp01((target - cumulative[seg]) / span);
    const tx = lerp(a.tx, b.tx, t);
    const ty = lerp(a.ty, b.ty, t);
    const len = Math.hypot(tx, ty) || 1;
    // Counterclockwise walk: the outward normal is the tangent turned clockwise.
    rays.push({ bx: lerp(a.x, b.x, t), by: lerp(a.y, b.y, t), mx: ty / len, my: -tx / len });
  }
  return rays;
}

export interface ShellGeometry {
  part: Part;
  positions: Float32Array;
  normals: Float32Array;
  colors: Float32Array;
  indices: Uint32Array;
  /** Rays around the shell and samples along each cross-section. */
  rays: number;
  samples: number;
  /** Sample indices of the front dome edge, the front wall edge, the back wall edge, and the back dome edge. */
  edges: { frontDome: number; frontWall: number; backWall: number; backDome: number };
  /** Local centre of the shell's boundary polygon. */
  centre: Vec2;
}

export type Detail = 'full' | 'poster';

const SILVER: Vec3 = [0.8, 0.81, 0.83];
const STEEL: Vec3 = [0.5, 0.52, 0.55];
const DARK: Vec3 = [0.085, 0.088, 0.095];

/** The wall bows outward by this fraction of its height at mid height, so the slit shows a polished convex face. */
const WALL_BULGE = 0.06;

function mixColor(a: Vec3, b: Vec3, t: number, out: Vec3): Vec3 {
  out[0] = lerp(a[0], b[0], t);
  out[1] = lerp(a[1], b[1], t);
  out[2] = lerp(a[2], b[2], t);
  return out;
}

interface Section {
  x: number[];
  y: number[];
  z: number[];
  nx: number[];
  ny: number[];
  nz: number[];
  /** 0 on the front dome, 1 on the wall, 2 on the back dome, blended through the rounded edges. */
  zone: number[];
}

function makeSection(samples: number): Section {
  const array = () => new Array<number>(samples).fill(0);
  return { x: array(), y: array(), z: array(), nx: array(), ny: array(), nz: array(), zone: array() };
}

const scratchFront: FieldSample = { z: 0, gx: 0, gy: 0, share: 0 };
const scratchBack: FieldSample = { z: 0, gx: 0, gy: 0, share: 0 };

/**
 * Cross-section of one ray, with exact normals: the front dome from the
 * centre to the edge of the rounded band, the front rounding, the wall, the
 * back rounding, and the back dome. The rounding is the field minus a
 * circular drop in the distance from the boundary, so it leaves the dome
 * tangentially, turns through a quarter circle of radius `r` measured along
 * the boundary normal, and meets the wall vertically; its radius is the tip
 * radius on the perimeter and the fillet radius along the cut. The sample
 * counts are the same for every ray so the rays can be stitched into one grid.
 */
function sectionFor(form: Form, field: ShellField, ray: Ray, dome: number, fillets: number, walls: number, out: Section): void {
  const t = form.thickness;
  const [cx, cy] = field.centre;
  const { bx, by, mx, my } = ray;
  const atFront = sampleField(form, field, bx, by, 'front', scratchFront);
  const atBack = sampleField(form, field, bx, by, 'back', scratchBack);
  const r = lerp(t.tip, t.fillet, atFront.share);
  // The dome runs from the centre to the inner edge of the rounded band.
  const ex = bx - r * mx - cx;
  const ey = by - r * my - cy;
  let k = 0;
  const push = (x: number, y: number, z: number, nx: number, ny: number, nz: number, zone: number) => {
    const len = Math.hypot(nx, ny, nz) || 1;
    out.x[k] = x;
    out.y[k] = y;
    out.z[k] = z;
    out.nx[k] = nx / len;
    out.ny[k] = ny / len;
    out.nz[k] = nz / len;
    out.zone[k] = zone;
    k++;
  };
  const domeFraction = (i: number) => 1 - Math.pow(1 - i / (dome - 1), 1.7);

  // Front dome: denser toward the edge, where the shoulder bends.
  for (let i = 0; i < dome; i++) {
    const l = domeFraction(i);
    const x = cx + ex * l;
    const y = cy + ey * l;
    const f = sampleField(form, field, x, y, 'front', scratchFront);
    push(x, y, f.z, -f.gx, -f.gy, 1, 0);
  }
  // Front rounding, from just past the dome edge down to the top of the wall.
  for (let i = 1; i <= fillets; i++) {
    const psi = (Math.PI / 2) * (1 - i / fillets);
    const sin = Math.sin(psi);
    const cos = Math.cos(psi);
    const d = r * (1 - cos);
    const x = bx - d * mx;
    const y = by - d * my;
    const f = sampleField(form, field, x, y, 'front', scratchFront);
    push(x, y, f.z - r * (1 - sin), -sin * f.gx + cos * mx, -sin * f.gy + cos * my, sin, i / fillets);
  }
  // Wall: nearly vertical, bowing outward in proportion to its height.
  const top = atFront.z - r;
  const foot = -(atBack.z - r);
  const height = top - foot;
  const bulge = WALL_BULGE * height;
  for (let i = 1; i <= walls; i++) {
    const s = i / (walls + 1);
    const sin = Math.sin(Math.PI * s);
    const bow = bulge * sin * sin;
    const tilt = bulge * Math.PI * Math.sin(2 * Math.PI * s);
    if (height > 1e-9) push(bx + bow * mx, by + bow * my, lerp(top, foot, s), height * mx, height * my, tilt, 1);
    else push(bx, by, top, mx, my, 0, 1);
  }
  // Back rounding, from the foot of the wall out to the back dome edge.
  for (let i = 0; i <= fillets; i++) {
    const psi = (Math.PI / 2) * (i / fillets);
    const sin = Math.sin(psi);
    const cos = Math.cos(psi);
    const d = r * (1 - cos);
    const x = bx - d * mx;
    const y = by - d * my;
    const g = sampleField(form, field, x, y, 'back', scratchBack);
    push(x, y, -(g.z - r * (1 - sin)), -sin * g.gx + cos * mx, -sin * g.gy + cos * my, -sin, 1 + i / fillets);
  }
  // Back dome, from just inside the edge to the centre.
  for (let i = dome - 2; i >= 0; i--) {
    const l = domeFraction(i);
    const x = cx + ex * l;
    const y = cy + ey * l;
    const g = sampleField(form, field, x, y, 'back', scratchBack);
    push(x, y, -g.z, -g.gx, -g.gy, -1, 2);
  }
}

/**
 * Builds one closed shell. `full` is the WebGL mesh; `poster` is a coarser
 * grid for the static picture and the tests.
 */
export function buildShell(form: Form, part: Part, detail: Detail = 'full', gap = form.cut.gap): ShellGeometry {
  const rayCount = detail === 'full' ? 320 : 96;
  const dome = detail === 'full' ? 28 : 8;
  const fillets = detail === 'full' ? 6 : 3;
  const walls = detail === 'full' ? 4 : 2;
  // Front dome, front rounding, wall, back rounding (with the wall foot), back dome without its duplicated edge.
  const samples = 2 * dome + 2 * fillets + walls;

  const boundary = shellBoundary(form, part, gap);
  const field = shellField(form, part, boundary, gap);
  const centre = field.centre;
  const rays = boundaryRays(boundary, rayCount);

  // The two poles are single shared vertices; every other grid point is its own vertex.
  const vertexCount = 2 + rayCount * (samples - 2);
  const positions = new Float32Array(vertexCount * 3);
  const normals = new Float32Array(vertexCount * 3);
  const colors = new Float32Array(vertexCount * 3);
  const index = (i: number, j: number) => vertexIndexFor(samples, i, j);
  const section = makeSection(samples);
  const color: Vec3 = [0, 0, 0];
  for (let i = 0; i < rayCount; i++) {
    sectionFor(form, field, rays[i], dome, fillets, walls, section);
    for (let j = 0; j < samples; j++) {
      const v = index(i, j) * 3;
      positions[v] = section.x[j];
      positions[v + 1] = section.y[j];
      positions[v + 2] = section.z[j];
      normals[v] = section.nx[j];
      normals[v + 1] = section.ny[j];
      normals[v + 2] = section.nz[j];
      const zone = section.zone[j];
      if (zone <= 1) mixColor(SILVER, STEEL, smoothstep(zone), color);
      else mixColor(STEEL, DARK, smoothstep(zone - 1), color);
      colors[v] = color[0];
      colors[v + 1] = color[1];
      colors[v + 2] = color[2];
    }
  }

  // Triangles: quads between neighbouring rays and samples; the pole rows are fans.
  const tris: number[] = [];
  for (let i = 0; i < rayCount; i++) {
    const i1 = (i + 1) % rayCount;
    for (let j = 0; j < samples - 1; j++) {
      const a = index(i, j);
      const b = index(i1, j);
      const c = index(i1, j + 1);
      const d = index(i, j + 1);
      // Counterclockwise seen from outside: outward first, then around.
      if (j === 0) {
        tris.push(a, d, c);
      } else if (j === samples - 2) {
        tris.push(a, c, b);
      } else {
        tris.push(a, d, c, a, c, b);
      }
    }
  }

  return {
    part,
    positions,
    normals,
    colors,
    indices: new Uint32Array(tris),
    rays: rayCount,
    samples,
    edges: { frontDome: dome - 1, frontWall: dome + fillets - 1, backWall: dome + fillets + walls, backDome: dome + fillets + walls + fillets },
    centre,
  };
}

// --- poses --------------------------------------------------------------------

export interface Pose {
  position: Vec3;
  /** Euler angles in radians, applied in three's default XYZ order. */
  rotation: Vec3;
  scale: number;
}

export interface Layout {
  /** Vertical field of view in degrees and the distance from the camera to the object. */
  fov: number;
  distance: number;
  /** Screen position of the object's centre, 0..1 from the left and from the top. */
  centre: Vec2;
  /** On viewports shorter than SHORT_VIEWPORT the centre moves down by this much per missing pixel. */
  shortShift: number;
  scale: number;
  /** Rest orientation in degrees: pitch (top away when positive), yaw (right side away when negative), roll. */
  rest: Vec3;
  /** Half gap of the slit at rest. */
  gap: number;
  /** Lower shell offsets at rest: slid along the cut (negative is left and down), toward the viewer, and tilted in degrees. */
  lowerSlide: number;
  lowerLift: number;
  lowerPitch: number;
  lowerYaw: number;
  lowerRoll: number;
  /** At fold 1: extra yaw in degrees and the travel up and right in world units. */
  foldYaw: number;
  foldTravel: Vec2;
  /** At reveal 0: how much closer the object starts and the extra pitch in degrees. */
  revealApproach: number;
  revealPitch: number;
}

export const DESKTOP: Layout = {
  fov: 32,
  distance: 8,
  centre: [0.72, 0.515],
  shortShift: 0,
  scale: 1.1,
  rest: [11, -20, 0],
  gap: 0.05,
  lowerSlide: -0.3,
  lowerLift: 0.13,
  lowerPitch: -9,
  lowerYaw: 4,
  lowerRoll: -1.5,
  foldYaw: -50,
  foldTravel: [1.1, 1.3],
  revealApproach: 1.7,
  revealPitch: 6,
};

export const COMPACT: Layout = {
  fov: 40,
  distance: 8,
  centre: [0.5, 0.675],
  shortShift: 0.0004,
  scale: 0.8,
  rest: [9, -14, 0],
  gap: 0.07,
  lowerSlide: -0.22,
  lowerLift: 0.1,
  lowerPitch: -7,
  lowerYaw: 3,
  lowerRoll: -1,
  foldYaw: -46,
  foldTravel: [0.9, 1.1],
  revealApproach: 1.3,
  revealPitch: 5,
};

export interface Viewport {
  width: number;
  height: number;
}

/** Compact viewports shorter than this lower the artwork so it stays under the identity lines. */
export const SHORT_VIEWPORT = 760;

/** Screen centre of the object for a viewport, 0..1 from the left and from the top. */
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
  /** 0 = rest, 1 = closed, turned, and moved away as the first chapter covers the opening. */
  fold: number;
  /** Pointer in normalised device coordinates, or zero. */
  pointerX?: number;
  pointerY?: number;
}

/** How closed the slit is: fully closed before the reveal and again at the end of the fold. */
export function closure(params: PoseParams): number {
  return Math.max(1 - easeInOutCubic(params.reveal), easeInOutCubic(params.fold));
}

const scratchCentre: Vec2 = [0, 0];

/**
 * Pose of the whole object in camera space: the camera sits at the origin
 * looking down -z, so a point at depth `distance` projects to the layout's
 * screen centre.
 */
export function groupPose(layout: Layout, viewport: Viewport, params: PoseParams, out: Pose = { position: [0, 0, 0], rotation: [0, 0, 0], scale: 1 }): Pose {
  const reveal = easeInOutCubic(params.reveal);
  const fold = easeInOutCubic(params.fold);
  const approach = (1 - reveal) * layout.revealApproach;
  const distance = layout.distance - approach;
  const halfHeight = Math.tan((layout.fov * DEG) / 2) * distance;
  const aspect = viewport.width / Math.max(1, viewport.height);
  const centre = screenCentre(layout, viewport, scratchCentre);
  out.position[0] = (centre[0] - 0.5) * 2 * halfHeight * aspect + layout.foldTravel[0] * fold;
  out.position[1] = (0.5 - centre[1]) * 2 * halfHeight + layout.foldTravel[1] * fold;
  out.position[2] = -distance;
  const pointerX = params.pointerX ?? 0;
  const pointerY = params.pointerY ?? 0;
  out.rotation[0] = (layout.rest[0] + layout.revealPitch * (1 - reveal) - pointerY * 2.5) * DEG;
  out.rotation[1] = (layout.rest[1] + layout.foldYaw * fold + pointerX * 3.5) * DEG;
  out.rotation[2] = layout.rest[2] * DEG;
  out.scale = layout.scale;
  return out;
}

/**
 * Pose of the lower shell relative to the group. At rest it is slid down the
 * cut toward the lower left, lifted toward the viewer, and tilted so its cut
 * wall faces the camera; as the slit closes it returns along the cut and then
 * slides home along the cut normal until only a hairline remains.
 */
export function lowerPose(layout: Layout, form: Form, params: PoseParams, out: Pose = { position: [0, 0, 0], rotation: [0, 0, 0], scale: 1 }): Pose {
  const closed = closure(params);
  const open = 1 - closed;
  // The cut tangent and normal at the centre of the slit; the normal points up into the upper shell.
  const slope = cutSlope(form, 0);
  const n = 1 / Math.sqrt(1 + slope * slope);
  const tx = n, ty = slope * n;
  const nx = -slope * n, ny = n;
  const home = (2 * layout.gap - 0.012) * closed;
  const slide = layout.lowerSlide * open;
  out.position[0] = tx * slide + nx * home;
  out.position[1] = ty * slide + ny * home;
  out.position[2] = layout.lowerLift * open;
  out.rotation[0] = layout.lowerPitch * open * DEG;
  out.rotation[1] = layout.lowerYaw * open * DEG;
  out.rotation[2] = layout.lowerRoll * open * DEG;
  out.scale = 1;
  return out;
}

export function upperPose(out: Pose = { position: [0, 0, 0], rotation: [0, 0, 0], scale: 1 }): Pose {
  out.position[0] = 0;
  out.position[1] = 0;
  out.position[2] = 0;
  out.rotation[0] = 0;
  out.rotation[1] = 0;
  out.rotation[2] = 0;
  out.scale = 1;
  return out;
}

// --- transforms and projection -----------------------------------------------

/** Column-major 4x4 matrix, as three.js stores it. */
export type Mat4 = Float64Array;

/** Matrix for a pose: translate, rotate X then Y then Z (three's XYZ Euler order), scale. */
export function poseMatrix(pose: Pose, out: Mat4 = new Float64Array(16)): Mat4 {
  const [a, b, c] = pose.rotation;
  const ca = Math.cos(a), sa = Math.sin(a);
  const cb = Math.cos(b), sb = Math.sin(b);
  const cc = Math.cos(c), sc = Math.sin(c);
  const s = pose.scale;
  // R = Rx * Ry * Rz, matching three's Matrix4.makeRotationFromEuler for order XYZ.
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

export function transformNormal(m: Mat4, n: Vec3, out: Vec3 = [0, 0, 0]): Vec3 {
  // Rigid plus uniform scale: the rotation part is enough.
  const x = n[0], y = n[1], z = n[2];
  out[0] = m[0] * x + m[4] * y + m[8] * z;
  out[1] = m[1] * x + m[5] * y + m[9] * z;
  out[2] = m[2] * x + m[6] * y + m[10] * z;
  const len = Math.hypot(out[0], out[1], out[2]) || 1;
  out[0] /= len;
  out[1] /= len;
  out[2] /= len;
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
export function partMatrix(layout: Layout, form: Form, viewport: Viewport, part: Part, params: PoseParams, out: Mat4 = new Float64Array(16)): Mat4 {
  const group = poseMatrix(groupPose(layout, viewport, params));
  const local = poseMatrix(part === 'lower' ? lowerPose(layout, form, params) : upperPose());
  return multiplyMatrices(group, local, out);
}

export interface Bounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** Projected screen bounds (0..1) of a part's vertices. */
export function projectedBounds(geometry: ShellGeometry, matrix: Mat4, fov: number, aspect: number): Bounds {
  const bounds: Bounds = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity };
  const p: Vec3 = [0, 0, 0];
  const q: Vec3 = [0, 0, 0];
  const s: ScreenPoint = { x: 0, y: 0, depth: 0 };
  for (let v = 0; v < geometry.positions.length; v += 3) {
    p[0] = geometry.positions[v];
    p[1] = geometry.positions[v + 1];
    p[2] = geometry.positions[v + 2];
    transformPoint(matrix, p, q);
    project(q, fov, aspect, s);
    bounds.left = Math.min(bounds.left, s.x);
    bounds.right = Math.max(bounds.right, s.x);
    bounds.top = Math.min(bounds.top, s.y);
    bounds.bottom = Math.max(bounds.bottom, s.y);
  }
  return bounds;
}

/** Index of the vertex at sample `j` on ray `i`: the poles are the first two vertices. */
export function vertexIndexFor(samples: number, i: number, j: number): number {
  if (j === 0) return 0;
  if (j === samples - 1) return 1;
  return 2 + i * (samples - 2) + (j - 1);
}

/** Vertex position of sample `j` on ray `i`. */
export function vertexAt(geometry: ShellGeometry, i: number, j: number, out: Vec3 = [0, 0, 0]): Vec3 {
  const v = vertexIndexFor(geometry.samples, i, j) * 3;
  out[0] = geometry.positions[v];
  out[1] = geometry.positions[v + 1];
  out[2] = geometry.positions[v + 2];
  return out;
}

export function normalAt(geometry: ShellGeometry, i: number, j: number, out: Vec3 = [0, 0, 0]): Vec3 {
  const v = vertexIndexFor(geometry.samples, i, j) * 3;
  out[0] = geometry.normals[v];
  out[1] = geometry.normals[v + 1];
  out[2] = geometry.normals[v + 2];
  return out;
}
