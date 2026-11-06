import { describe, expect, it } from 'vitest';
import {
  BEVEL,
  COMPACT,
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
import { createPartGeometry, lastBuild } from './monogramMesh';

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

  it('is an elongated oval band about 5% of its height thick with a real open centre', () => {
    const o = bounds2(outer);
    const width = o.maxX - o.minX + 2 * BEVEL;
    const height = o.maxY - o.minY + 2 * BEVEL;
    expect(width / height).toBeGreaterThan(1.45);
    expect(width / height).toBeLessThan(1.6);
    expect(height).toBeCloseTo(2 * RIM.b, 5);
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
    expect(minRadius(outer)).toBeGreaterThan(0.5);
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
    const lower = runs(-0.4, -1.2, 0.2);
    const upper = runs(0.5, -1.2, 0.2);
    expect(lower).toHaveLength(2);
    expect(upper).toHaveLength(1);
    const stemLow = (lower[1][0] + lower[1][1]) / 2;
    const stemHigh = (upper[0][0] + upper[0][1]) / 2;
    expect(stemHigh - stemLow).toBeCloseTo(SLANT * 0.9, 1);
    // Below the terminal's top the counter sits between terminal and stem, open above the terminal.
    expect(lower[0][1] - lower[0][0]).toBeLessThan(0.3);
    expect(lower[1][0] - lower[0][1], 'the J counter is open').toBeGreaterThan(0.15);
    expect(metalAlong(-0.55, -0.9, -0.5), 'the return closes the bottom of the J').toBeGreaterThan(0.6);
    expect(metal(-0.2, 0.9)).toBe(false);
  });

  it('draws a legible T on the right: a crossbar over a centred slanted stem with open space either side', () => {
    const bar = runs(0.6, 0.0, 1.2);
    expect(bar).toHaveLength(1);
    expect(bar[0][1] - bar[0][0]).toBeGreaterThan(0.6);
    const stem = runs(-0.2, 0.0, 1.2);
    expect(stem).toHaveLength(1);
    expect(stem[0][1] - stem[0][0]).toBeLessThan(0.3);
    const stemCentre = (stem[0][0] + stem[0][1]) / 2;
    expect(stemCentre).toBeGreaterThan(bar[0][0] + 0.2);
    expect(stemCentre).toBeLessThan(bar[0][1] - 0.2);
    expect(metal(0.3, -0.3)).toBe(false);
    expect(metal(0.95, -0.3)).toBe(false);
    // The foot ends clear of the rim, and the J and T never touch.
    expect(metalAlong(-0.75, 0.3, 0.75)).toBe(0);
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
    expect(lastBuild.buildMs).toBeLessThan(800);
    expect(totalMs).toBeLessThan(1500);
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
