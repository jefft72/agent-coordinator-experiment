/**
 * Pure geometry for the opening artwork: one lens-shaped object cut into two
 * closed shells by a shallow S-shaped slit. Everything here is deterministic
 * plain math, so the WebGL scene, the SVG poster, and the unit tests share
 * one description.
 *
 * The object lives in its own local frame: x right, y up, z toward the
 * viewer. Its outline is a skewed egg leaning to the upper right; a curve
 * across the lower third divides it into an upper mass and a lower
 * counterform with a narrow gap between them. Each shell is lofted from its
 * centre out to its boundary: a convex silver front dome, a flatter dark
 * back, a rounded tip along the outer perimeter and a thick, nearly vertical
 * polished wall along the cut, so the slit reads as a deliberate interval
 * with visible depth.
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
    /** Rise of each shell's front dome and back dome above the tip height, at the shell's own apex. */
    front: number;
    back: number;
    /** Exponent of the dome profile: 1 is parabolic, higher lands flat before the rim. */
    domePower: number;
    /** The dome spans this fraction of the fitted ellipse, so it lands inside the cut and the rim. */
    apexScale: number;
    /** Radius of the rounded tip along the outer perimeter, which is also the half thickness there. */
    tip: number;
    /** Extra front and back height carried along the cut, so the slit shows a wall. */
    wall: number;
    wallBack: number;
    /** Distance from the cut over which the wall height fades into the dome, as a fraction of the shell's reach. */
    shoulder: number;
    /** Distance inside the perimeter over which the wall height fades to the tip. */
    rim: number;
    /** Radius of the corner fillets along the cut wall. */
    fillet: number;
    /** Arc length over which the tip blends into the wall fillet at each end of the cut. */
    blend: number;
  };
}

export const FORM: Form = {
  axes: [1.16, 1.62],
  skew: 0.14,
  broadDeg: 78,
  leanDeg: -30,
  cut: { y0: -0.22, slope: 0.3, wave: 0.14, frequency: 2.3, phase: 0.4, gap: 0.05 },
  thickness: { front: 0.21, back: 0.1, domePower: 1.3, apexScale: 0.8, tip: 0.03, wall: 0.085, wallBack: 0.05, shoulder: 0.85, rim: 0.3, fillet: 0.018, blend: 0.16 },
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

/**
 * The smooth height field of one shell. The dome is an ellipse fitted to the
 * shell's own area (same centroid and second moments), so each shell has its
 * own apex and a convex shoulder that rolls down toward the slit and the rim;
 * the wall term carries extra height along the cut and fades to the tip at
 * the perimeter. Everything is a smooth function of position, so there are no
 * creases between rays.
 */
export interface ShellField {
  part: Part;
  centre: Vec2;
  /** Semi-axes and angle of the fitted ellipse. */
  axes: Vec2;
  angle: number;
  /** Subsampled outer perimeter, for the distance that fades the wall to the tip. */
  perimeter: Vec2[];
  /** Typical reach of the shell from the cut, which scales the shoulder. */
  reach: number;
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

export function shellField(form: Form, part: Part, boundary: BoundaryPoint[]): ShellField {
  const centre = polygonCentroid(boundary);
  const { axes, angle } = fitEllipse(boundary, centre);
  const outer = boundary.filter((p) => !p.cut);
  const step = Math.max(1, Math.floor(outer.length / 140));
  const perimeter: Vec2[] = [];
  for (let i = 0; i < outer.length; i += step) perimeter.push([outer[i].x, outer[i].y]);
  perimeter.push([outer[outer.length - 1].x, outer[outer.length - 1].y]);
  let reach = 0;
  for (const p of outer) reach = Math.max(reach, Math.abs(cutSide(form, p.x, p.y)));
  return { part, centre, axes, angle, perimeter, reach };
}

function perimeterDistance(field: ShellField, x: number, y: number): number {
  let best = Infinity;
  const pts = field.perimeter;
  for (let i = 0; i + 1 < pts.length; i++) {
    const ax = pts[i][0], ay = pts[i][1];
    const bx = pts[i + 1][0], by = pts[i + 1][1];
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy || 1e-12;
    const t = clamp01(((x - ax) * dx + (y - ay) * dy) / len2);
    const px = ax + dx * t - x;
    const py = ay + dy * t - y;
    const d = px * px + py * py;
    if (d < best) best = d;
  }
  return Math.sqrt(best);
}

/** Elliptical dome of the shell: 1 at its apex, 0 on and beyond the fitted ellipse. */
function shellDome(form: Form, field: ShellField, x: number, y: number): number {
  const c = Math.cos(-field.angle);
  const s = Math.sin(-field.angle);
  const dx = x - field.centre[0];
  const dy = y - field.centre[1];
  const u = (c * dx - s * dy) / (field.axes[0] * form.thickness.apexScale);
  const v = (s * dx + c * dy) / (field.axes[1] * form.thickness.apexScale);
  const q2 = u * u + v * v;
  return Math.pow(Math.max(0, 1 - q2), form.thickness.domePower);
}

/** Share of the wall height carried at a point: 1 on the cut, fading over the shoulder, and 0 at the perimeter. */
function wallShare(form: Form, field: ShellField, x: number, y: number): number {
  const fromCut = Math.abs(cutSide(form, x, y)) / Math.max(1e-6, field.reach * form.thickness.shoulder);
  const alongShoulder = 1 - smoothstep(fromCut);
  const insideRim = smoothstep(perimeterDistance(field, x, y) / form.thickness.rim);
  return alongShoulder * insideRim;
}

/** Height of the shell's front surface above the mid plane. */
export function frontHeight(form: Form, field: ShellField, x: number, y: number): number {
  const t = form.thickness;
  return t.tip + t.wall * wallShare(form, field, x, y) + t.front * shellDome(form, field, x, y);
}

/** Depth of the shell's back surface below the mid plane, as a positive number. */
export function backHeight(form: Form, field: ShellField, x: number, y: number): number {
  const t = form.thickness;
  return t.tip + t.wallBack * wallShare(form, field, x, y) + t.back * shellDome(form, field, x, y);
}

export interface BoundaryPoint {
  x: number;
  y: number;
  /** True on the cut segment, false on the outer perimeter. */
  cut: boolean;
}

const OUTLINE_SAMPLES = 1440;

/**
 * Closed boundary of one shell, counterclockwise: the outer perimeter from
 * one end of the cut to the other, then the cut curve back, offset by the
 * gap along the cut normal. The upper shell takes the part of the outline
 * above the cut; the lower shell the part below.
 */
export function shellBoundary(form: Form, part: Part, gap = form.cut.gap): BoundaryPoint[] {
  const sign = part === 'upper' ? 1 : -1;
  const side = (x: number, y: number) => sign * cutSide(form, x, y) - gap;
  const points: Vec2[] = [];
  for (let i = 0; i < OUTLINE_SAMPLES; i++) points.push(outlinePoint(form, (i / OUTLINE_SAMPLES) * Math.PI * 2));

  // Find the two crossings of the offset cut with the outline.
  const crossings: { index: number; point: Vec2 }[] = [];
  for (let i = 0; i < OUTLINE_SAMPLES; i++) {
    const a = points[i];
    const b = points[(i + 1) % OUTLINE_SAMPLES];
    const fa = side(a[0], a[1]);
    const fb = side(b[0], b[1]);
    if ((fa > 0 && fb <= 0) || (fa <= 0 && fb > 0)) {
      const t = fa / (fa - fb);
      crossings.push({ index: i, point: [lerp(a[0], b[0], t), lerp(a[1], b[1], t)] });
    }
  }
  if (crossings.length !== 2) throw new Error(`the cut crosses the outline ${crossings.length} times`);

  // Walk the outline through the inside part, counterclockwise.
  const [first, second] = crossings;
  const inside = (i: number) => side(points[i][0], points[i][1]) > 0;
  const startAtFirst = inside((first.index + 1) % OUTLINE_SAMPLES);
  const from = startAtFirst ? first : second;
  const to = startAtFirst ? second : first;
  const boundary: BoundaryPoint[] = [{ x: from.point[0], y: from.point[1], cut: false }];
  for (let i = (from.index + 1) % OUTLINE_SAMPLES; i !== (to.index + 1) % OUTLINE_SAMPLES; i = (i + 1) % OUTLINE_SAMPLES) {
    boundary.push({ x: points[i][0], y: points[i][1], cut: false });
  }
  boundary.push({ x: to.point[0], y: to.point[1], cut: false });

  // Then the offset cut from `to` back to `from`, so the loop stays counterclockwise.
  const steps = 160;
  for (let k = 1; k < steps; k++) {
    const x = lerp(to.point[0], from.point[0], k / steps);
    const slope = cutSlope(form, x);
    const n = 1 / Math.sqrt(1 + slope * slope);
    const nx = -slope * n * sign * gap;
    const ny = n * sign * gap;
    boundary.push({ x: x + nx, y: cutHeight(form, x) + ny, cut: true });
  }
  return boundary;
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

interface Ray {
  /** Unit direction from the centre and the distance to the boundary. */
  dx: number;
  dy: number;
  length: number;
  /** 0 on the outer perimeter, 1 on the cut, blended at the junctions. */
  wall: number;
}

/** Resamples the boundary by arc length into `count` rays from the centroid, with the wall weight. */
function boundaryRays(boundary: BoundaryPoint[], centre: Vec2, count: number, blend: number): Ray[] {
  const n = boundary.length;
  const cumulative = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) {
    const a = boundary[i];
    const b = boundary[(i + 1) % n];
    cumulative[i + 1] = cumulative[i] + Math.hypot(b.x - a.x, b.y - a.y);
  }
  const total = cumulative[n];
  // Arc positions of the two junctions between perimeter and cut.
  const junctions: number[] = [];
  for (let i = 0; i < n; i++) if (boundary[i].cut !== boundary[(i + 1) % n].cut) junctions.push(cumulative[i + 1]);

  const rays: Ray[] = [];
  let seg = 0;
  for (let k = 0; k < count; k++) {
    const target = (k / count) * total;
    while (seg < n - 1 && cumulative[seg + 1] < target) seg++;
    const a = boundary[seg];
    const b = boundary[(seg + 1) % n];
    const span = cumulative[seg + 1] - cumulative[seg] || 1;
    const t = clamp01((target - cumulative[seg]) / span);
    const x = lerp(a.x, b.x, t);
    const y = lerp(a.y, b.y, t);
    let nearest = Infinity;
    for (const j of junctions) {
      const d = Math.abs(target - j);
      nearest = Math.min(nearest, d, total - d);
    }
    const onCut = a.cut && b.cut;
    const toward = smoothstep(0.5 + (0.5 * nearest) / blend);
    const wall = onCut ? toward : 1 - toward;
    const dx = x - centre[0];
    const dy = y - centre[1];
    const length = Math.hypot(dx, dy) || 1e-6;
    rays.push({ dx: dx / length, dy: dy / length, length, wall });
  }
  return rays;
}

// --- the loft -----------------------------------------------------------------

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

function mixColor(a: Vec3, b: Vec3, t: number, out: Vec3): Vec3 {
  out[0] = lerp(a[0], b[0], t);
  out[1] = lerp(a[1], b[1], t);
  out[2] = lerp(a[2], b[2], t);
  return out;
}

interface Section {
  /** Distance along the ray and height above the mid plane. */
  l: number[];
  z: number[];
  /** 0 on the front dome, 1 on the wall, 2 on the back dome, blended through the fillets. */
  zone: number[];
}

/**
 * Cross-section profile of one ray: the shell's front dome, a fillet, the
 * wall left by the cut, the back fillet, and the back dome. Both domes are
 * smooth fields over the shell, so the wall is as tall as the field is where
 * the cut passes and the surface is continuous across rays. The sample counts are the same for every ray so the rays can
 * be stitched into one grid.
 */
function sectionFor(form: Form, field: ShellField, ray: Ray, dome: number, fillets: number, walls: number, out: Section): void {
  const t = form.thickness;
  const centre = field.centre;
  const L = ray.length;
  const fillet = lerp(t.tip, t.fillet, ray.wall);
  const flat = Math.max(0.02, L - fillet);
  const front = (l: number) => frontHeight(form, field, centre[0] + ray.dx * l, centre[1] + ray.dy * l);
  const back = (l: number) => backHeight(form, field, centre[0] + ray.dx * l, centre[1] + ray.dy * l);
  const frontEdge = front(flat);
  const backEdge = back(flat);
  let k = 0;
  const push = (l: number, z: number, zone: number) => {
    out.l[k] = l;
    out.z[k] = z;
    out.zone[k] = zone;
    k++;
  };
  // Front dome: denser toward the edge, where the profile turns.
  for (let i = 0; i < dome; i++) {
    const s = i / (dome - 1);
    const l = (1 - Math.pow(1 - s, 1.7)) * flat;
    push(l, front(l), 0);
  }
  // Front fillet: quarter arc from the dome edge to the top of the wall.
  for (let i = 1; i <= fillets; i++) {
    const a = (i / fillets) * (Math.PI / 2);
    push(flat + Math.sin(a) * fillet, frontEdge - fillet + Math.cos(a) * fillet, i / fillets);
  }
  // Wall: nearly vertical, with a slight polished bulge.
  const top = frontEdge - fillet;
  const foot = -(backEdge - fillet);
  for (let i = 1; i <= walls; i++) {
    const s = i / (walls + 1);
    push(L + Math.sin(s * Math.PI) * fillet * 0.35, lerp(top, foot, s), 1);
  }
  // Back fillet, from the foot of the wall to the back dome edge.
  for (let i = 0; i <= fillets; i++) {
    const a = (i / fillets) * (Math.PI / 2);
    push(flat + Math.cos(a) * fillet, foot - Math.sin(a) * fillet, 1 + i / fillets);
  }
  // Back dome, from just inside the edge to the centre.
  for (let i = dome - 2; i >= 0; i--) {
    const s = i / (dome - 1);
    const l = (1 - Math.pow(1 - s, 1.7)) * flat;
    push(l, -back(l), 2);
  }
}

/**
 * Builds one closed shell. `full` is the WebGL mesh; `poster` is a coarser
 * grid for the static picture and the tests.
 */
export function buildShell(form: Form, part: Part, detail: Detail = 'full', gap = form.cut.gap): ShellGeometry {
  const rayCount = detail === 'full' ? 288 : 96;
  const dome = detail === 'full' ? 18 : 8;
  const fillets = detail === 'full' ? 5 : 3;
  const walls = detail === 'full' ? 4 : 2;
  // Front dome, front fillet, wall, back fillet (with the wall foot), back dome without its duplicated edge.
  const samples = 2 * dome + 2 * fillets + walls;

  const boundary = shellBoundary(form, part, gap);
  const field = shellField(form, part, boundary);
  const centre = field.centre;
  const rays = boundaryRays(boundary, centre, rayCount, form.thickness.blend);

  // The two poles are single shared vertices; every other grid point is its own vertex.
  const vertexCount = 2 + rayCount * (samples - 2);
  const positions = new Float32Array(vertexCount * 3);
  const colors = new Float32Array(vertexCount * 3);
  const index = (i: number, j: number) => vertexIndexFor(samples, i, j);
  const section: Section = { l: new Array(samples).fill(0), z: new Array(samples).fill(0), zone: new Array(samples).fill(0) };
  const color: Vec3 = [0, 0, 0];
  for (let i = 0; i < rayCount; i++) {
    const ray = rays[i];
    sectionFor(form, field, ray, dome, fillets, walls, section);
    for (let j = 0; j < samples; j++) {
      const v = index(i, j) * 3;
      const l = section.l[j];
      positions[v] = centre[0] + ray.dx * l;
      positions[v + 1] = centre[1] + ray.dy * l;
      positions[v + 2] = section.z[j];
      const zone = section.zone[j];
      if (zone <= 1) mixColor(SILVER, STEEL, smoothstep(zone), color);
      else mixColor(STEEL, DARK, smoothstep(zone - 1), color);
      colors[v] = color[0];
      colors[v + 1] = color[1];
      colors[v + 2] = color[2];
    }
  }

  // Normals from the parametric grid: around (wrapping) and along the section.
  const normals = new Float32Array(positions.length);
  const at = (i: number, j: number, c: number) => positions[index((i + rayCount) % rayCount, j) * 3 + c];
  // The poles sit on the global domes, which slope there because the shell's centre is not the lens centre.
  const h = 1e-3;
  const frontX = (frontHeight(form, field, centre[0] + h, centre[1]) - frontHeight(form, field, centre[0] - h, centre[1])) / (2 * h);
  const frontY = (frontHeight(form, field, centre[0], centre[1] + h) - frontHeight(form, field, centre[0], centre[1] - h)) / (2 * h);
  const backX = (backHeight(form, field, centre[0] + h, centre[1]) - backHeight(form, field, centre[0] - h, centre[1])) / (2 * h);
  const backY = (backHeight(form, field, centre[0], centre[1] + h) - backHeight(form, field, centre[0], centre[1] - h)) / (2 * h);
  const frontLen = Math.hypot(frontX, frontY, 1);
  const backLen = Math.hypot(backX, backY, 1);
  normals[0] = -frontX / frontLen;
  normals[1] = -frontY / frontLen;
  normals[2] = 1 / frontLen;
  normals[3] = -backX / backLen;
  normals[4] = -backY / backLen;
  normals[5] = -1 / backLen;
  for (let i = 0; i < rayCount; i++) {
    for (let j = 1; j < samples - 1; j++) {
      const v = index(i, j) * 3;
      const ax = at(i + 1, j, 0) - at(i - 1, j, 0);
      const ay = at(i + 1, j, 1) - at(i - 1, j, 1);
      const az = at(i + 1, j, 2) - at(i - 1, j, 2);
      // Along the section; widen the stencil where the wall has collapsed to a point.
      let lo = j - 1;
      let hi = j + 1;
      let bx = at(i, hi, 0) - at(i, lo, 0);
      let by = at(i, hi, 1) - at(i, lo, 1);
      let bz = at(i, hi, 2) - at(i, lo, 2);
      while (Math.hypot(bx, by, bz) < 1e-6 && (lo > 0 || hi < samples - 1)) {
        lo = Math.max(0, lo - 1);
        hi = Math.min(samples - 1, hi + 1);
        bx = at(i, hi, 0) - at(i, lo, 0);
        by = at(i, hi, 1) - at(i, lo, 1);
        bz = at(i, hi, 2) - at(i, lo, 2);
      }
      // Around x along gives the outward normal: on the front dome, along points outward and
      // around points counterclockwise, so along x around points toward +z.
      let nx = by * az - bz * ay;
      let ny = bz * ax - bx * az;
      let nz = bx * ay - by * ax;
      const len = Math.hypot(nx, ny, nz) || 1;
      nx /= len;
      ny /= len;
      nz /= len;
      normals[v] = nx;
      normals[v + 1] = ny;
      normals[v + 2] = nz;
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
