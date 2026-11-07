import { describe, expect, it } from 'vitest';
import {
  BEVEL,
  COMPACT,
  THORN_TIP,
  DESKTOP,
  EXTRUSION,
  OUTLINES,
  PARTS,
  RIM,
  SLANT,
  bounds2,
  contains,
  contours,
  flatten,
  groupPose,
  isSimple,
  minRadius,
  partPose,
  polygonArea,
  projectedBounds,
  thickness,
  type Vec2,
} from './monogram';
import { contourDistance, createPartGeometry, indexShape, insideIndexed, insideShape, lastBuild, nearContour, triangulateCap, type CapMesh } from './monogramMesh';

const DESKTOP_VIEW = { width: 1440, height: 900 };
const PHONE_VIEW = { width: 390, height: 844 };
const NARROW_VIEW = { width: 320, height: 700 };
const REST = { reveal: 1, fold: 0 };

const [outer, negative] = contours(OUTLINES.emblem);

/** True where the cap has metal: inside the oval and outside the negative space. */
function metal(x: number, y: number): boolean {
  return contains(outer, x, y) && !contains(negative, x, y);
}

/** Fraction of metal along a horizontal line between two x values. */
function metalAlong(y: number, x0: number, x1: number, samples = 200): number {
  let hits = 0;
  for (let i = 0; i <= samples; i++) if (metal(x0 + ((x1 - x0) * i) / samples, y)) hits++;
  return hits / (samples + 1);
}

/** The runs of metal along a horizontal line, as [start, end] pairs. */
function runs(y: number, x0: number, x1: number, samples = 600): Vec2[] {
  const result: Vec2[] = [];
  let open: number | null = null;
  for (let i = 0; i <= samples; i++) {
    const x = x0 + ((x1 - x0) * i) / samples;
    const hit = metal(x, y);
    if (hit && open === null) open = x;
    if (!hit && open !== null) {
      result.push([open, x]);
      open = null;
    }
  }
  if (open !== null) result.push([open, x1]);
  return result;
}

describe('the united outline', () => {
  it('is one outer oval with one simple negative-space contour wound the other way', () => {
    expect(PARTS).toEqual(['emblem']);
    expect(OUTLINES.emblem.holes).toHaveLength(1);
    expect(isSimple(outer)).toBe(true);
    expect(isSimple(negative)).toBe(true);
    expect(polygonArea(outer) * polygonArea(negative)).toBeLessThan(0);
    for (const [x, y] of negative) expect(contains(outer, x, y)).toBe(true);
    expect(flatten(OUTLINES.emblem)).toEqual(flatten(OUTLINES.emblem));
  });

  it('is an elongated oval band about 8% of its height thick with a real open centre, plus two rim thorns', () => {
    const o = bounds2(outer);
    const width = o.maxX - o.minX + 2 * BEVEL;
    const height = o.maxY - o.minY + 2 * BEVEL;
    expect(RIM.a / RIM.b).toBeGreaterThan(1.45);
    expect(RIM.a / RIM.b).toBeLessThan(1.6);
    expect(width).toBeCloseTo(2 * RIM.a, 2);
    // The thorns reach beyond the oval's top and bottom by a bounded amount.
    expect(height).toBeGreaterThan(2 * RIM.b + 0.2);
    expect(height).toBeLessThan(2 * RIM.b + 0.45);
    // Across the middle, the band is metal and the centre is open except for the letters.
    expect(metal(RIM.a - BEVEL - RIM.band / 2, 0)).toBe(true);
    expect(metal(-(RIM.a - BEVEL - RIM.band / 2), 0)).toBe(true);
    expect(metal(0, 0)).toBe(false);
    expect(metal(0, RIM.b - BEVEL - RIM.band / 2)).toBe(true);
    expect(metalAlong(0, -1.2, 1.2)).toBeLessThan(0.35);
  });

  it('keeps every concave corner of the metal rounder than the bevel it rolls outward', () => {
    // The negative contour's convex corners are the metal's concave corners.
    expect(minRadius(negative)).toBeGreaterThan(BEVEL * 1.5);
    // The rim thorns: finite convex tips, and coves at their roots rounder than the bevel.
    expect(minRadius(outer)).toBeGreaterThan(THORN_TIP * 0.8);
    expect(minRadius(outer, true)).toBeGreaterThan(BEVEL * 1.5);
  });

  it('joins the letters to the rim at the lower left and the upper right only', () => {
    // Just inside the band, metal continues into the letters only in those two zones.
    const inner = { a: RIM.a - RIM.band + BEVEL, b: RIM.b - RIM.band + BEVEL };
    const attached: number[] = [];
    for (let phi = 0; phi < 360; phi += 2) {
      const r = phi * (Math.PI / 180);
      if (metal(inner.a * Math.cos(r) * 0.96, inner.b * Math.sin(r) * 0.96)) attached.push(phi);
    }
    expect(attached.length).toBeGreaterThan(8);
    const lowerLeft = attached.filter((phi) => phi > 180 && phi < 270);
    const upperRight = attached.filter((phi) => phi > 0 && phi < 90);
    expect(lowerLeft.length + upperRight.length).toBe(attached.length);
    expect(lowerLeft.length).toBeGreaterThan(3);
    expect(upperRight.length).toBeGreaterThan(3);
  });

  it('draws a legible forward-leaning J on the left: a stem, a rounded return, and a short rising terminal', () => {
    // The stem leans: its centre moves right by the slant as y rises.
    // Between the counter's floor and the terminal's top, the line crosses the terminal and the stem (with its base thorn);
    // higher, only the stem. The stem's left edge leans forward by the slant.
    const lower = runs(-0.2, -1.2, 0.0);
    const upper = runs(0.62, -0.95, 0.0);
    expect(lower).toHaveLength(2);
    expect(upper).toHaveLength(2);
    const stemUpper = upper[upper.length - 1];
    expect(stemUpper[0] - lower[1][0]).toBeCloseTo(SLANT * 0.82, 1);
    // Below the terminal's top the counter sits between terminal and stem, open above the terminal.
    expect(lower[0][1] - lower[0][0]).toBeLessThan(0.35);
    expect(lower[1][0] - lower[0][1], 'the J counter is open').toBeGreaterThan(0.12);
    expect(metalAlong(-0.5, -0.85, -0.5), 'the return closes the bottom of the J').toBeGreaterThan(0.6);
    expect(metal(-0.2, 0.8)).toBe(false);
    // The spur on the upper shoulder and the thorn at the base of the stem are present.
    expect(metal(-0.74, 0.62)).toBe(true);
    expect(metal(-0.14, -0.33)).toBe(true);
  });

  it('draws a legible T on the right: a crossbar over a centred slanted stem with open space either side', () => {
    // The bar runs from its free point into the rim; the stem, probed below its thorn, is centred under the bar's free part.
    const bar = runs(0.6, 0.0, 1.2);
    expect(bar).toHaveLength(1);
    expect(bar[0][1] - bar[0][0]).toBeGreaterThan(0.6);
    const stem = runs(-0.48, 0.0, 1.0);
    expect(stem).toHaveLength(1);
    expect(stem[0][1] - stem[0][0]).toBeLessThan(0.36);
    const stemCentre = (stem[0][0] + stem[0][1]) / 2;
    expect(stemCentre).toBeGreaterThan(bar[0][0] + 0.15);
    expect(stemCentre).toBeLessThan(1.0 - 0.25);
    // The stem's thorn is present on its outer edge, and the space beside the stem stays open.
    expect(metal(0.87, -0.27)).toBe(true);
    expect(metal(0.3, -0.3)).toBe(false);
    expect(metal(1.05, -0.55)).toBe(false);
    // The foot ends clear of the rim, and the J and T never touch.
    expect(metalAlong(-0.75, 0.3, 0.6)).toBe(0);
    expect(runs(0.3, -1.2, 1.2).length).toBeGreaterThanOrEqual(2);
  });
});

describe('framing', () => {
  it('fits the whole emblem in the right of the desktop opening beside the name', () => {
    const b = projectedBounds(DESKTOP, DESKTOP_VIEW, 'emblem', REST);
    expect(b.left).toBeGreaterThan(0.5);
    expect(b.right).toBeLessThan(0.97);
    expect(b.top).toBeGreaterThan(0.12);
    expect(b.bottom).toBeLessThan(0.85);
    expect(b.right - b.left).toBeGreaterThan(0.38);
    expect(b.right - b.left).toBeLessThan(0.5);
  });

  it.each([
    ['phone', PHONE_VIEW],
    ['narrow', NARROW_VIEW],
  ])('shows the whole emblem under the identity lines on a %s viewport', (_name, viewport) => {
    const b = projectedBounds(COMPACT, viewport, 'emblem', REST);
    expect(b.left).toBeGreaterThan(0.03);
    expect(b.right).toBeLessThan(0.97);
    expect(b.right - b.left).toBeGreaterThan(0.6);
    expect(b.right - b.left).toBeLessThan(0.92);
    expect(b.top).toBeGreaterThan(0.5);
    expect(b.bottom).toBeLessThan(0.93);
  });

  it('keeps the view near frontal at rest so the oval stays an oval', () => {
    for (const layout of [DESKTOP, COMPACT]) {
      const pose = groupPose(layout, DESKTOP_VIEW, REST);
      expect(Math.abs(pose.rotation[1])).toBeLessThan((12 * Math.PI) / 180);
      expect(Math.abs(pose.rotation[0])).toBeLessThan((6 * Math.PI) / 180);
    }
  });
});

describe('motion', () => {
  it('moves as one rigid piece', () => {
    const pose = partPose('emblem');
    expect(pose.rotation).toEqual([0, 0, 0]);
    expect(pose.position).toEqual([0, 0, 0]);
  });

  it('turns the emblem modestly and carries it up and right at the end of the fold, still facing the viewer', () => {
    const rest = groupPose(DESKTOP, DESKTOP_VIEW, REST);
    const folded = groupPose(DESKTOP, DESKTOP_VIEW, { reveal: 1, fold: 1 });
    expect(folded.position[0]).toBeGreaterThan(rest.position[0] + 0.5);
    expect(folded.position[1]).toBeGreaterThan(rest.position[1] + 0.5);
    expect(Math.abs(folded.rotation[1] - rest.rotation[1])).toBeLessThan((30 * Math.PI) / 180);
    const restBounds = projectedBounds(DESKTOP, DESKTOP_VIEW, 'emblem', REST);
    const foldedBounds = projectedBounds(DESKTOP, DESKTOP_VIEW, 'emblem', { reveal: 1, fold: 1 });
    expect(foldedBounds.right - foldedBounds.left).toBeGreaterThan((restBounds.right - restBounds.left) * 0.6);
  });

  it('is reversible and reads the rest pose again at fold 0, which is what reduced motion shows', () => {
    const rest = groupPose(DESKTOP, DESKTOP_VIEW, REST);
    groupPose(DESKTOP, DESKTOP_VIEW, { reveal: 1, fold: 1 });
    expect(groupPose(DESKTOP, DESKTOP_VIEW, { reveal: 1, fold: 0 })).toEqual(rest);
  });

  it('starts the reveal closer to the camera and pitched, then settles', () => {
    const entrance = groupPose(DESKTOP, DESKTOP_VIEW, { reveal: 0, fold: 0 });
    const settled = groupPose(DESKTOP, DESKTOP_VIEW, REST);
    expect(entrance.position[2]).toBeGreaterThan(settled.position[2]);
    expect(entrance.rotation[0]).toBeGreaterThan(settled.rotation[0]);
    expect(groupPose(DESKTOP, DESKTOP_VIEW, { reveal: 1, fold: 0, pointerX: 1, pointerY: 1 }).rotation[1]).not.toBe(settled.rotation[1]);
  });
});

describe('the solid', () => {
  const started = performance.now();
  const geometry = createPartGeometry('emblem');
  const totalMs = performance.now() - started;
  const position = geometry.getAttribute('position');
  const normal = geometry.getAttribute('normal');

  it('builds once within bounded sizes, with the field converged and the dome built in well under a second', () => {
    expect(lastBuild.capTriangles).toBeGreaterThan(2000);
    expect(lastBuild.capTriangles).toBeLessThan(30000);
    expect(lastBuild.capVertices).toBeLessThan(16000);
    expect(lastBuild.sweeps).toBeLessThan(4000);
    expect(lastBuild.lastUpdate).toBeLessThan(2e-6);
    expect(lastBuild.buildMs).toBeLessThan(400);
    expect(totalMs).toBeLessThan(900);
    expect(position.count).toBeLessThan(400000);
  });

  it('keeps every front cap triangle counterclockwise, inside the cap, and not inverted by the dome', () => {
    const capZ = thickness('emblem') / 2;
    let checked = 0;
    for (let i = 0; i < position.count; i += 3) {
      const z = [position.getZ(i), position.getZ(i + 1), position.getZ(i + 2)];
      if (z.some((v) => v < capZ - 1e-6)) continue;
      const x = [position.getX(i), position.getX(i + 1), position.getX(i + 2)];
      const y = [position.getY(i), position.getY(i + 1), position.getY(i + 2)];
      const area = (x[1] - x[0]) * (y[2] - y[0]) - (y[1] - y[0]) * (x[2] - x[0]);
      expect(area).toBeGreaterThan(1e-9);
      const cx = (x[0] + x[1] + x[2]) / 3, cy = (y[0] + y[1] + y[2]) / 3;
      expect(contains(outer, cx, cy) && !contains(negative, cx, cy)).toBe(true);
      checked++;
    }
    expect(checked).toBe(lastBuild.capTriangles);
  });

  it('is one bevel wider than its cap all round, flat on the back, and domed on the front', () => {
    let minZ = Infinity, maxZ = -Infinity, minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (let i = 0; i < position.count; i++) {
      minZ = Math.min(minZ, position.getZ(i));
      maxZ = Math.max(maxZ, position.getZ(i));
      minX = Math.min(minX, position.getX(i));
      maxX = Math.max(maxX, position.getX(i));
      minY = Math.min(minY, position.getY(i));
      maxY = Math.max(maxY, position.getY(i));
    }
    const half = thickness('emblem') / 2;
    expect(minZ).toBeCloseTo(-half, 5);
    expect(maxZ).toBeGreaterThan(half + EXTRUSION.dome.emblem * 0.6);
    expect(maxZ).toBeLessThanOrEqual(half + EXTRUSION.dome.emblem + 1e-6);
    const b = bounds2(outer);
    expect(minX).toBeCloseTo(b.minX - BEVEL, 2);
    expect(maxX).toBeCloseTo(b.maxX + BEVEL, 2);
    expect(minY).toBeCloseTo(b.minY - BEVEL, 2);
    expect(maxY).toBeCloseTo(b.maxY + BEVEL, 2);
  });

  it('has unit normals that agree with every face, exact on the back cap, level on the wall, and continuous at the front edge', () => {
    expect(normal.count).toBe(position.count);
    expect(position.count % 3).toBe(0);
    const capZ = thickness('emblem') / 2;
    const wallZ = EXTRUSION.depth.emblem / 2;
    let degenerate = 0;
    const inverted: string[] = [];
    for (let i = 0; i < position.count; i += 3) {
      const p = [0, 1, 2].map((k) => [position.getX(i + k), position.getY(i + k), position.getZ(i + k)]);
      const ax = p[1][0] - p[0][0], ay = p[1][1] - p[0][1], az = p[1][2] - p[0][2];
      const bx = p[2][0] - p[0][0], by = p[2][1] - p[0][1], bz = p[2][2] - p[0][2];
      const face = [ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx];
      const area = Math.hypot(face[0], face[1], face[2]);
      if (area < 1e-10) {
        degenerate++;
        continue;
      }
      for (let k = 0; k < 3; k++) {
        const n = [normal.getX(i + k), normal.getY(i + k), normal.getZ(i + k)];
        expect(Math.hypot(n[0], n[1], n[2])).toBeCloseTo(1, 4);
        const agreement = (face[0] * n[0] + face[1] * n[1] + face[2] * n[2]) / area;
        if (agreement <= 0 && inverted.length < 5) inverted.push(`tri ${i / 3} v${k} at (${p[k].map((c) => c.toFixed(3)).join(',')}) area ${area.toExponential(2)} face z ${(face[2] / area).toFixed(3)} dot ${agreement.toFixed(3)}`);
        const z = p[k][2];
        if (Math.abs(z + capZ) < 1e-6 && Math.abs(face[2]) / area > 0.999) {
          expect(Math.abs(n[0])).toBe(0);
          expect(Math.abs(n[1])).toBe(0);
          expect(n[2]).toBe(-1);
        } else if (Math.abs(z - capZ) < 1e-6) {
          // Front cap boundary vertices stay on the flat plane with the cap normal, so the bevel meets them without a crack.
          expect(n[2]).toBeGreaterThan(0.999);
        } else if (Math.abs(z) <= wallZ + 1e-6) {
          expect(Math.abs(n[2])).toBeLessThan(1e-6);
        }
      }
    }
    expect(inverted, inverted.join('\n')).toEqual([]);
    expect(degenerate).toBeLessThan(position.count / 3 / 100);
  });

  it('has an inner wall facing the open centre', () => {
    let inward = 0;
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i), y = position.getY(i);
      const nx = normal.getX(i), ny = normal.getY(i);
      if (Math.abs(position.getZ(i)) <= EXTRUSION.depth.emblem / 2 + 1e-6 && x * nx + y * ny < -0.5 * Math.hypot(x, y) * Math.hypot(nx, ny)) inward++;
    }
    expect(inward).toBeGreaterThan(100);
  });
});

describe('the cap triangulation', () => {
  const shape = contours(OUTLINES.emblem);
  const mesh: CapMesh = triangulateCap(shape, EXTRUSION.domeEdge, EXTRUSION.domeEdge * 1.2);
  const at = (v: number): Vec2 => [mesh.xy[v * 2], mesh.xy[v * 2 + 1]];
  const key = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);

  // Directed incidences per undirected edge.
  const incidences = new Map<string, number[][]>();
  for (let t = 0; t < mesh.triangles.length; t += 3) {
    for (let k = 0; k < 3; k++) {
      const a = mesh.triangles[t + k], b = mesh.triangles[t + ((k + 1) % 3)];
      const list = incidences.get(key(a, b)) ?? [];
      list.push([a, b]);
      incidences.set(key(a, b), list);
    }
  }
  const boundarySegments: [number, number][] = [];
  for (const contour of mesh.contours) {
    for (let i = 0; i < contour.length; i++) boundarySegments.push([contour[i], contour[(i + 1) % contour.length]]);
  }

  /** Whether `w` lies on the straight segment from `u` to `v`, strictly between them. */
  const between = (u: number, v: number, w: number): boolean => {
    const [ux, uy] = at(u), [vx, vy] = at(v), [wx, wy] = at(w);
    const ex = vx - ux, ey = vy - uy;
    const cross = ex * (wy - uy) - ey * (wx - ux);
    const t = ((wx - ux) * ex + (wy - uy) * ey) / (ex * ex + ey * ey);
    return Math.abs(cross) < 1e-9 && t > 1e-9 && t < 1 - 1e-9;
  };

  it('keeps every resampled boundary segment as a single-incidence cap edge or a collinear chain of them', () => {
    const neighbours = new Map<number, number[]>();
    for (const list of incidences.values()) {
      if (list.length !== 1) continue;
      const [a, b] = list[0];
      neighbours.set(a, [...(neighbours.get(a) ?? []), b]);
      neighbours.set(b, [...(neighbours.get(b) ?? []), a]);
    }
    const covered = new Set<string>();
    const missing: string[] = [];
    let chains = 0;
    for (const [u, v] of boundarySegments) {
      if (incidences.get(key(u, v))?.length === 1) {
        covered.add(key(u, v));
        continue;
      }
      // A chain of single-incidence edges from u to v through points on the segment.
      let here = u;
      let ok = true;
      const steps: number[] = [];
      while (here !== v) {
        const next = (neighbours.get(here) ?? []).find((n) => n === v || (between(u, v, n) && !steps.includes(n)));
        if (next === undefined) {
          ok = false;
          break;
        }
        steps.push(next);
        covered.add(key(here, next));
        here = next;
      }
      if (ok) chains++;
      else missing.push(`${u}-${v} at (${at(u).map((c) => c.toFixed(3))}) to (${at(v).map((c) => c.toFixed(3))})`);
    }
    expect(missing, `boundary segments absent from the cap: ${missing.join('; ')}`).toEqual([]);
    expect(chains).toBeLessThan(boundarySegments.length * 0.02);
    // No single-incidence edge exists beyond the boundary: nothing is open inside the cap.
    const open: string[] = [];
    for (const [k, list] of incidences) if (list.length === 1 && !covered.has(k)) open.push(k);
    expect(open, `unexpected open edges: ${open.slice(0, 10).join(' ')}`).toEqual([]);
    expect(boundarySegments.length).toBeGreaterThan(1000);
  });

  it('gives every interior edge exactly two oppositely directed incidences', () => {
    let interior = 0;
    for (const list of incidences.values()) {
      if (list.length === 1) continue;
      expect(list).toHaveLength(2);
      expect(list[0][0]).toBe(list[1][1]);
      expect(list[0][1]).toBe(list[1][0]);
      interior++;
    }
    expect(interior).toBeGreaterThan(3000);
  });

  it('covers exactly the sampled polygon area with positive triangles', () => {
    let sum = 0;
    for (let t = 0; t < mesh.triangles.length; t += 3) {
      const [ax, ay] = at(mesh.triangles[t]), [bx, by] = at(mesh.triangles[t + 1]), [cx, cy] = at(mesh.triangles[t + 2]);
      const area = ((bx - ax) * (cy - ay) - (by - ay) * (cx - ax)) / 2;
      expect(area).toBeGreaterThan(0);
      sum += area;
    }
    const polygon = mesh.contours.map((contour) => Math.abs(polygonArea(contour.map(at))));
    const expected = polygon[0] - polygon.slice(1).reduce((a, b) => a + b, 0);
    expect(Math.abs(sum - expected)).toBeLessThan(expected * 1e-9);
  });

  it('has no cap edge properly crossing a boundary segment, and is one connected piece', () => {
    const cross = (p: Vec2, q: Vec2, r: Vec2, s: Vec2): boolean => {
      const o = (a: Vec2, b: Vec2, c: Vec2) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
      return o(p, q, r) * o(p, q, s) < -1e-18 && o(r, s, p) * o(r, s, q) < -1e-18;
    };
    const segments = boundarySegments.map(([u, v]) => [at(u), at(v)] as [Vec2, Vec2]);
    let crossings = 0;
    for (const list of incidences.values()) {
      const [a, b] = list[0];
      const p = at(a), q = at(b);
      for (const [r, s] of segments) if (cross(p, q, r, s)) crossings++;
    }
    expect(crossings).toBe(0);
    // Union-find over triangles sharing an edge.
    const parent = Array.from({ length: mesh.triangles.length / 3 }, (_, i) => i);
    const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
    const owner = new Map<string, number>();
    for (let t = 0; t < mesh.triangles.length; t += 3) {
      for (let k = 0; k < 3; k++) {
        const e = key(mesh.triangles[t + k], mesh.triangles[t + ((k + 1) % 3)]);
        const other = owner.get(e);
        if (other === undefined) owner.set(e, t / 3);
        else parent[find(other)] = find(t / 3);
      }
    }
    const roots = new Set<number>();
    for (let i = 0; i < parent.length; i++) roots.add(find(i));
    expect(roots.size).toBe(1);
  });
});

describe('the shape index', () => {
  const shape = contours(OUTLINES.emblem);

  it('answers inside and distance queries exactly as scanning every edge does, on the whole field grid, interior grid, and cap', () => {
    const mesh: CapMesh = triangulateCap(shape, EXTRUSION.domeEdge, EXTRUSION.domeEdge * 1.2);
    const gridIndex = indexShape(shape, EXTRUSION.domeGrid * 2);
    const capIndex = indexShape(shape, EXTRUSION.domeEdge);
    let checked = 0;
    // The field grid, laid out exactly as the solver lays it out: every node, byte for byte, including nodes
    // outside the oval and inside the hole.
    const outerBounds = bounds2(shape[0]);
    const g = EXTRUSION.domeGrid;
    const minX = outerBounds.minX - 2 * g, minY = outerBounds.minY - 2 * g;
    const nx = Math.ceil((outerBounds.maxX - minX) / g) + 3, ny = Math.ceil((outerBounds.maxY - minY) / g) + 3;
    let mismatches = 0;
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        if (insideIndexed(gridIndex, minX + i * g, minY + j * g) !== insideShape(shape, minX + i * g, minY + j * g)) mismatches++;
        checked++;
      }
    }
    expect(mismatches).toBe(0);
    expect(checked).toBeGreaterThan(50000);
    // The interior grid's candidates, laid out exactly as the triangulation lays them out: membership and the
    // clearance decision for every one, so the admitted points and their order are unchanged.
    const sampledBounds = bounds2(mesh.contours.flatMap((c) => c.map((v) => [mesh.xy[v * 2], mesh.xy[v * 2 + 1]] as Vec2)));
    const spacing = EXTRUSION.domeEdge * 1.2;
    const clearance = EXTRUSION.domeEdge * 0.9;
    let candidates = 0;
    for (let y = sampledBounds.minY + spacing * 0.37; y < sampledBounds.maxY; y += spacing) {
      for (let x = sampledBounds.minX + spacing * 0.41; x < sampledBounds.maxX; x += spacing) {
        if (insideIndexed(capIndex, x, y) !== insideShape(shape, x, y)) mismatches++;
        if (nearContour(capIndex, x, y, clearance) !== contourDistance(shape, x, y) <= clearance) mismatches++;
        candidates++;
      }
    }
    expect(mismatches).toBe(0);
    expect(candidates).toBeGreaterThan(5000);
    // Exact contour vertices, and queries level with a vertex (a horizontal crossing through it) or directly
    // above and below it (a vertical one), which exercise the half-open crossing convention.
    let probes = 0;
    for (const points of shape) {
      for (let i = 0; i < points.length; i += 5) {
        const [vx, vy] = points[i];
        for (const [x, y] of [
          [vx, vy],
          [vx - g, vy],
          [vx + g, vy],
          [vx, vy - g],
          [vx, vy + g],
          [vx - 0.5 * g, vy],
          [vx + 0.5 * g, vy],
        ] as Vec2[]) {
          if (insideIndexed(gridIndex, x, y) !== insideShape(shape, x, y)) mismatches++;
          if (insideIndexed(capIndex, x, y) !== insideShape(shape, x, y)) mismatches++;
          if (nearContour(capIndex, x, y, clearance) !== contourDistance(shape, x, y) <= clearance) mismatches++;
          probes++;
        }
      }
    }
    expect(mismatches).toBe(0);
    expect(probes).toBeGreaterThan(2000);
    // Every cap triangle's centroid, which is what decides which triangles are kept.
    for (let t = 0; t < mesh.triangles.length; t += 3) {
      let cx = 0, cy = 0;
      for (let k = 0; k < 3; k++) {
        cx += mesh.xy[mesh.triangles[t + k] * 2] / 3;
        cy += mesh.xy[mesh.triangles[t + k] * 2 + 1] / 3;
      }
      expect(insideIndexed(capIndex, cx, cy)).toBe(true);
      expect(insideShape(shape, cx, cy)).toBe(true);
      checked++;
    }
    expect(checked).toBeGreaterThan(56000);
  });
});
