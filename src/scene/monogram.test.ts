import { describe, expect, it } from 'vitest';
import {
  COMPACT,
  DESKTOP,
  EXTRUSION,
  GAP,
  LETTERS,
  LETTER_HEIGHT,
  MONOGRAM,
  OUTLINES,
  PLACEMENT,
  THICKNESS,
  bounds2,
  centredOutline,
  flatten,
  groupPose,
  isSimple,
  letterPose,
  minConvexRadius,
  minStrokeWidth,
  polygonArea,
  projectedBounds,
  type Bounds,
  type Letter,
  type Vec2,
} from './monogram';
import { createLetterGeometry } from './monogramMesh';

const DESKTOP_VIEW = { width: 1440, height: 900 };
const PHONE_VIEW = { width: 390, height: 844 };
const NARROW_VIEW = { width: 320, height: 700 };
const REST = { reveal: 1, fold: 0 };

function union(a: Bounds, b: Bounds): Bounds {
  return { left: Math.min(a.left, b.left), top: Math.min(a.top, b.top), right: Math.max(a.right, b.right), bottom: Math.max(a.bottom, b.bottom) };
}

function monogramBounds(viewport: { width: number; height: number }, compact: boolean, params = REST): Bounds {
  const layout = compact ? COMPACT : DESKTOP;
  return union(projectedBounds(layout, viewport, 'j', params), projectedBounds(layout, viewport, 't', params));
}

/** Even-odd point-in-polygon. */
function inside(points: readonly Vec2[], x: number, y: number): boolean {
  let hit = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i];
    const [xj, yj] = points[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

function nearestDistance(a: readonly Vec2[], b: readonly Vec2[]): number {
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

describe('letter outlines', () => {
  it.each(LETTERS)('%s closes exactly, is simple, and is deterministic', (letter) => {
    const outline = OUTLINES[letter];
    const last = outline.segments[outline.segments.length - 1].to;
    expect(last).toEqual(outline.start);
    const points = flatten(outline);
    expect(points.length).toBeGreaterThan(100);
    expect(isSimple(points)).toBe(true);
    expect(flatten(outline)).toEqual(points);
    expect(Math.abs(polygonArea(points))).toBeGreaterThan(0.8);
  });

  it.each(LETTERS)('%s spans the full letter height with its top and bottom on the shared lines', (letter) => {
    const b = bounds2(flatten(OUTLINES[letter]));
    expect(b.maxY).toBeCloseTo(LETTER_HEIGHT / 2, 2);
    expect(b.minY).toBeCloseTo(-LETTER_HEIGHT / 2, 2);
  });

  it('leaves the upper left of the J open and keeps the hook terminal short', () => {
    const j = flatten(OUTLINES.j);
    const b = bounds2(j);
    // The stem is on the right; the space to its upper left is empty down to below the middle.
    expect(inside(j, b.minX + 0.3, 0.6)).toBe(false);
    expect(inside(j, b.minX + 0.3, 0)).toBe(false);
    expect(inside(j, b.maxX - 0.2, 0.6)).toBe(true);
    // The terminal rises into the lower half only, and the hook is wide.
    let terminalTop = -Infinity;
    for (const [x, y] of j) if (x < b.minX + 0.4) terminalTop = Math.max(terminalTop, y);
    expect(terminalTop).toBeGreaterThan(-0.5);
    expect(terminalTop).toBeLessThan(0);
    expect(b.maxX - b.minX).toBeGreaterThan(LETTER_HEIGHT * 0.5);
  });

  it('keeps the T stem directly beneath its bar with open space either side', () => {
    const t = flatten(OUTLINES.t);
    const b = bounds2(t);
    const centre = (b.minX + b.maxX) / 2;
    expect(inside(t, centre, 0.85)).toBe(true);
    expect(inside(t, centre, -0.2)).toBe(true);
    expect(inside(t, b.minX + 0.15, -0.2)).toBe(false);
    expect(inside(t, b.maxX - 0.15, -0.2)).toBe(false);
    expect(inside(t, b.minX + 0.05, 0.75)).toBe(true);
    expect(inside(t, b.maxX - 0.05, 0.8)).toBe(true);
  });

  it.each(LETTERS)('%s keeps every convex radius and stroke clear of the bevel', (letter) => {
    const points = flatten(OUTLINES[letter]);
    expect(minConvexRadius(points)).toBeGreaterThan(EXTRUSION.bevel * 1.15);
    expect(minStrokeWidth(points)).toBeGreaterThan(EXTRUSION.bevel * 2 + 0.06);
  });
});

describe('monogram placement', () => {
  it('sets the two letters apart by the gap, sharing top and bottom, at about 1.25:1', () => {
    const j = centredOutline('j').map(([x, y]) => [x + PLACEMENT.j.centre[0], y + PLACEMENT.j.centre[1]] as Vec2);
    const t = centredOutline('t').map(([x, y]) => [x + PLACEMENT.t.centre[0], y + PLACEMENT.t.centre[1]] as Vec2);
    expect(nearestDistance(j, t)).toBeCloseTo(GAP, 2);
    expect(bounds2(j).maxX).toBeLessThan(bounds2(t).minX);
    expect(MONOGRAM.width / MONOGRAM.height).toBeGreaterThan(1.15);
    expect(MONOGRAM.width / MONOGRAM.height).toBeLessThan(1.4);
    expect(MONOGRAM.left).toBeCloseTo(-MONOGRAM.right, 6);
  });
});

describe('framing', () => {
  it('fills the right of the desktop opening beside the name at about half the viewport height', () => {
    const b = monogramBounds(DESKTOP_VIEW, false);
    expect(b.left).toBeGreaterThan(0.5);
    expect(b.right).toBeLessThan(0.97);
    expect(b.top).toBeGreaterThan(0.15);
    expect(b.bottom).toBeLessThan(0.85);
    expect(b.bottom - b.top).toBeGreaterThan(0.45);
    expect(b.bottom - b.top).toBeLessThan(0.62);
  });

  it.each([
    ['phone', PHONE_VIEW],
    ['narrow', NARROW_VIEW],
  ])('shows the whole monogram under the identity lines on a %s viewport', (_name, viewport) => {
    const b = monogramBounds(viewport, true);
    expect(b.left).toBeGreaterThan(0.03);
    expect(b.right).toBeLessThan(0.97);
    expect(b.right - b.left).toBeGreaterThan(0.6);
    expect(b.right - b.left).toBeLessThan(0.92);
    expect(b.top).toBeGreaterThan(0.5);
    expect(b.bottom).toBeLessThan(0.93);
  });

  it('keeps the view near frontal at rest', () => {
    for (const layout of [DESKTOP, COMPACT]) {
      const pose = groupPose(layout, DESKTOP_VIEW, REST);
      expect(Math.abs(pose.rotation[1])).toBeLessThan((16 * Math.PI) / 180);
      expect(Math.abs(pose.rotation[1])).toBeGreaterThan((6 * Math.PI) / 180);
      expect(Math.abs(pose.rotation[0])).toBeLessThan((8 * Math.PI) / 180);
      for (const letter of LETTERS) expect(letterPose(layout, letter, REST).rotation.map(Math.abs)).toEqual([0, 0, 0]);
    }
  });
});

describe('motion', () => {
  it('turns the monogram modestly and carries it up and right at the end of the fold, still mostly facing the viewer', () => {
    const rest = groupPose(DESKTOP, DESKTOP_VIEW, REST);
    const folded = groupPose(DESKTOP, DESKTOP_VIEW, { reveal: 1, fold: 1 });
    expect(folded.position[0]).toBeGreaterThan(rest.position[0] + 0.5);
    expect(folded.position[1]).toBeGreaterThan(rest.position[1] + 0.5);
    expect(Math.abs(folded.rotation[1] - rest.rotation[1])).toBeLessThan((35 * Math.PI) / 180);
    const restWidth = monogramBounds(DESKTOP_VIEW, false).right - monogramBounds(DESKTOP_VIEW, false).left;
    const foldedBounds = monogramBounds(DESKTOP_VIEW, false, { reveal: 1, fold: 1 });
    expect(foldedBounds.right - foldedBounds.left).toBeGreaterThan(restWidth * 0.6);
  });

  it('keeps the letters together: their own turns stay within a few degrees and oppose each other', () => {
    const j = letterPose(DESKTOP, 'j', { reveal: 1, fold: 1 });
    const t = letterPose(DESKTOP, 't', { reveal: 1, fold: 1 });
    expect(Math.abs(j.rotation[1])).toBeLessThan((6 * Math.PI) / 180);
    expect(j.rotation[1]).toBeCloseTo(-t.rotation[1], 9);
    expect(j.position).toEqual([PLACEMENT.j.centre[0], PLACEMENT.j.centre[1], 0]);
  });

  it('is reversible and reads the rest pose again at fold 0, which is what reduced motion shows', () => {
    const rest = groupPose(DESKTOP, DESKTOP_VIEW, REST);
    groupPose(DESKTOP, DESKTOP_VIEW, { reveal: 1, fold: 1 });
    const back = groupPose(DESKTOP, DESKTOP_VIEW, { reveal: 1, fold: 0 });
    expect(back).toEqual(rest);
  });

  it('starts the reveal closer to the camera and pitched, then settles', () => {
    const entrance = groupPose(DESKTOP, DESKTOP_VIEW, { reveal: 0, fold: 0 });
    const settled = groupPose(DESKTOP, DESKTOP_VIEW, REST);
    expect(entrance.position[2]).toBeGreaterThan(settled.position[2]);
    expect(entrance.rotation[0]).toBeGreaterThan(settled.rotation[0]);
    expect(groupPose(DESKTOP, DESKTOP_VIEW, { reveal: 1, fold: 0, pointerX: 1, pointerY: 1 }).rotation[1]).not.toBe(settled.rotation[1]);
  });
});

describe('letter solids', () => {
  const geometries = Object.fromEntries(LETTERS.map((letter) => [letter, createLetterGeometry(letter)])) as Record<Letter, ReturnType<typeof createLetterGeometry>>;

  it.each(LETTERS)('%s is as thick as the extrusion and as wide as its outline', (letter) => {
    const position = geometries[letter].getAttribute('position');
    let minZ = Infinity, maxZ = -Infinity, minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (let i = 0; i < position.count; i++) {
      minZ = Math.min(minZ, position.getZ(i));
      maxZ = Math.max(maxZ, position.getZ(i));
      minX = Math.min(minX, position.getX(i));
      maxX = Math.max(maxX, position.getX(i));
      minY = Math.min(minY, position.getY(i));
      maxY = Math.max(maxY, position.getY(i));
    }
    expect(maxZ - minZ).toBeCloseTo(THICKNESS, 5);
    expect(maxZ).toBeCloseTo(-minZ, 5);
    const b = bounds2(centredOutline(letter));
    expect(minX).toBeCloseTo(b.minX, 3);
    expect(maxX).toBeCloseTo(b.maxX, 3);
    expect(minY).toBeCloseTo(b.minY, 3);
    expect(maxY).toBeCloseTo(b.maxY, 3);
  });

  it.each(LETTERS)('%s has unit normals that agree with every face, flat on the caps and level on the wall', (letter) => {
    const geometry = geometries[letter];
    const position = geometry.getAttribute('position');
    const normal = geometry.getAttribute('normal');
    expect(normal.count).toBe(position.count);
    expect(position.count % 3).toBe(0);
    const capZ = THICKNESS / 2;
    const wallZ = EXTRUSION.depth / 2;
    let degenerate = 0;
    for (let i = 0; i < position.count; i += 3) {
      const p = [0, 1, 2].map((k) => [position.getX(i + k), position.getY(i + k), position.getZ(i + k)]);
      const ax = p[1][0] - p[0][0], ay = p[1][1] - p[0][1], az = p[1][2] - p[0][2];
      const bx = p[2][0] - p[0][0], by = p[2][1] - p[0][1], bz = p[2][2] - p[0][2];
      const face = [ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx];
      const area = Math.hypot(face[0], face[1], face[2]);
      if (area < 1e-9) {
        degenerate++;
        continue;
      }
      for (let k = 0; k < 3; k++) {
        const n = [normal.getX(i + k), normal.getY(i + k), normal.getZ(i + k)];
        const len = Math.hypot(n[0], n[1], n[2]);
        expect(len).toBeCloseTo(1, 5);
        expect((face[0] * n[0] + face[1] * n[1] + face[2] * n[2]) / area).toBeGreaterThan(0);
        const z = p[k][2];
        if (Math.abs(Math.abs(z) - capZ) < 1e-6 && Math.abs(face[2]) / area > 0.999) {
          expect(Math.abs(n[0])).toBe(0);
          expect(Math.abs(n[1])).toBe(0);
          expect(n[2]).toBe(Math.sign(z));
        } else if (Math.abs(z) <= wallZ + 1e-6) {
          expect(Math.abs(n[2])).toBeLessThan(1e-6);
        }
      }
    }
    expect(degenerate).toBeLessThan(position.count / 3 / 200);
  });
});
