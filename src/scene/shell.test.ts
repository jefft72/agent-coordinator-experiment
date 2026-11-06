import { describe, expect, it } from 'vitest';
import {
  COMPACT,
  DESKTOP,
  FORM,
  buildShell,
  closure,
  groupPose,
  lowerPose,
  normalAt,
  partMatrix,
  polygonArea,
  polygonCentroid,
  project,
  projectedBounds,
  shellBoundary,
  transformNormal,
  transformPoint,
  vertexAt,
  type Bounds,
  type Part,
  type Vec3,
} from './shell';

const DESKTOP_VIEW = { width: 1440, height: 900 };
const PHONE_VIEW = { width: 390, height: 844 };
const NARROW_VIEW = { width: 320, height: 700 };

function boundsFor(part: Part, viewport: { width: number; height: number }, compact: boolean, params = { reveal: 1, fold: 0 }): Bounds {
  const layout = compact ? COMPACT : DESKTOP;
  const geometry = buildShell(FORM, part, 'poster', layout.gap);
  const matrix = partMatrix(layout, FORM, viewport, part, params);
  return projectedBounds(geometry, matrix, layout.fov, viewport.width / viewport.height);
}

function union(a: Bounds, b: Bounds): Bounds {
  return { left: Math.min(a.left, b.left), top: Math.min(a.top, b.top), right: Math.max(a.right, b.right), bottom: Math.max(a.bottom, b.bottom) };
}

describe('shell form', () => {
  it('is deterministic', () => {
    const a = buildShell(FORM, 'upper', 'poster');
    const b = buildShell(FORM, 'upper', 'poster');
    expect(a.positions).toEqual(b.positions);
    expect(a.indices).toEqual(b.indices);
  });

  it('cuts the outline into a counterclockwise upper mass of about 65% and a lower counterform of about 35%', () => {
    const upper = shellBoundary(FORM, 'upper');
    const lower = shellBoundary(FORM, 'lower');
    const upperArea = polygonArea(upper);
    const lowerArea = polygonArea(lower);
    expect(upperArea).toBeGreaterThan(0);
    expect(lowerArea).toBeGreaterThan(0);
    const share = lowerArea / (upperArea + lowerArea);
    expect(share).toBeGreaterThan(0.3);
    expect(share).toBeLessThan(0.4);
  });

  it('keeps both boundaries star-shaped about their centroids, so every ray reaches the boundary once', () => {
    for (const part of ['upper', 'lower'] as const) {
      const boundary = shellBoundary(FORM, part);
      const centre = polygonCentroid(boundary);
      let previous = Math.atan2(boundary[0].y - centre[1], boundary[0].x - centre[0]);
      let turned = 0;
      for (let i = 1; i <= boundary.length; i++) {
        const p = boundary[i % boundary.length];
        const angle = Math.atan2(p.y - centre[1], p.x - centre[0]);
        let delta = angle - previous;
        if (delta > Math.PI) delta -= 2 * Math.PI;
        if (delta < -Math.PI) delta += 2 * Math.PI;
        expect(delta, `${part} boundary turns back on itself at point ${i}`).toBeGreaterThanOrEqual(-1e-9);
        turned += delta;
        previous = angle;
      }
      expect(turned).toBeCloseTo(2 * Math.PI, 6);
    }
  });

  it('builds closed two-manifold shells with outward normals', () => {
    for (const part of ['upper', 'lower'] as const) {
      const geometry = buildShell(FORM, part, 'poster');
      const edges = new Map<string, number>();
      const directed = new Set<string>();
      let sameDirection = 0;
      const { indices } = geometry;
      for (let t = 0; t < indices.length; t += 3) {
        for (let k = 0; k < 3; k++) {
          const a = indices[t + k];
          const b = indices[t + ((k + 1) % 3)];
          const key = a < b ? `${a}-${b}` : `${b}-${a}`;
          edges.set(key, (edges.get(key) ?? 0) + 1);
          // A consistently wound closed surface traverses every shared edge once in each direction.
          if (directed.has(`${a}>${b}`)) sameDirection++;
          directed.add(`${a}>${b}`);
        }
      }
      const counts = Array.from(edges.values());
      expect(counts.filter((count) => count !== 2), `${part}: open or non-manifold edges`).toEqual([]);
      expect(sameDirection, `${part}: edges traversed twice in the same direction (inconsistent winding)`).toBe(0);
      // Triangles seen from outside the front are counterclockwise: the front pole fan and the first quad ring agree.
      const area = (t: number) => {
        const [a, b, c] = [indices[t], indices[t + 1], indices[t + 2]].map((v) => [geometry.positions[v * 3], geometry.positions[v * 3 + 1]]);
        return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
      };
      expect(area(0), `${part}: front pole fan winding`).toBeGreaterThan(0);
      expect(area(3), `${part}: first front quad winding`).toBeGreaterThan(0);
      // Every non-degenerate triangle's geometric normal agrees with its vertex normals.
      const disagreeing: number[] = [];
      for (let t = 0; t < indices.length; t += 3) {
        const [a, b, c] = [indices[t], indices[t + 1], indices[t + 2]];
        const p = (v: number): Vec3 => [geometry.positions[v * 3], geometry.positions[v * 3 + 1], geometry.positions[v * 3 + 2]];
        const n = (v: number): Vec3 => [geometry.normals[v * 3], geometry.normals[v * 3 + 1], geometry.normals[v * 3 + 2]];
        const [pa, pb, pc] = [p(a), p(b), p(c)];
        const e1 = [pb[0] - pa[0], pb[1] - pa[1], pb[2] - pa[2]];
        const e2 = [pc[0] - pa[0], pc[1] - pa[1], pc[2] - pa[2]];
        const g = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
        if (Math.hypot(g[0], g[1], g[2]) < 1e-10) continue;
        const [na, nb, nc] = [n(a), n(b), n(c)];
        const sum = [na[0] + nb[0] + nc[0], na[1] + nb[1] + nc[1], na[2] + nb[2] + nc[2]];
        if (g[0] * sum[0] + g[1] * sum[1] + g[2] * sum[2] <= 0) disagreeing.push(t / 3);
      }
      expect(disagreeing, `${part}: triangles whose geometric normal opposes their vertex normals`).toEqual([]);

      const centre: Vec3 = [geometry.centre[0], geometry.centre[1], 0];
      const p: Vec3 = [0, 0, 0];
      const n: Vec3 = [0, 0, 0];
      let inward = 0;
      let total = 0;
      for (let i = 0; i < geometry.rays; i += 3) {
        for (let j = 1; j < geometry.samples - 1; j++) {
          vertexAt(geometry, i, j, p);
          normalAt(geometry, i, j, n);
          const dot = (p[0] - centre[0]) * n[0] + (p[1] - centre[1]) * n[1] + (p[2] - centre[2]) * n[2];
          total++;
          if (dot < 0) inward++;
        }
      }
      expect(inward / total, `${part}: normals pointing inward`).toBeLessThan(0.01);
    }
  });

  it('has a thick wall along the cut and a tapered tip along the perimeter', () => {
    const geometry = buildShell(FORM, 'upper', 'poster');
    const top: Vec3 = [0, 0, 0];
    const foot: Vec3 = [0, 0, 0];
    const boundary = shellBoundary(FORM, 'upper');
    let thickest = 0;
    let thinnest = Infinity;
    for (let i = 0; i < geometry.rays; i++) {
      vertexAt(geometry, i, geometry.edges.frontWall, top);
      vertexAt(geometry, i, geometry.edges.backWall, foot);
      const wall = top[2] - foot[2];
      thickest = Math.max(thickest, wall);
      thinnest = Math.min(thinnest, wall);
    }
    expect(thickest).toBeGreaterThan(0.14);
    expect(thinnest).toBeLessThan(0.03);
    // The apex is 8-16% of the width deep, and the front rolls down substantially from the apex to the cut edge.
    const width = Math.max(...boundary.map((b) => b.x)) - Math.min(...boundary.map((b) => b.x));
    const centreFront = vertexAt(geometry, 0, 0);
    const centreBack = vertexAt(geometry, 0, geometry.samples - 1);
    const depth = centreFront[2] - centreBack[2];
    expect(depth / width).toBeGreaterThan(0.08);
    expect(depth / width).toBeLessThan(0.18);
    let cutEdgeMax = 0;
    for (let i = 0; i < geometry.rays; i++) {
      vertexAt(geometry, i, geometry.edges.frontWall, top);
      vertexAt(geometry, i, geometry.edges.backWall, foot);
      if (top[2] - foot[2] > 0.1) cutEdgeMax = Math.max(cutEdgeMax, top[2]);
    }
    expect(centreFront[2] - cutEdgeMax, 'the shoulder rolls down toward the slit').toBeGreaterThan(0.1);
  });
});

describe('shell composition', () => {
  it('fills the upper right of the desktop opening and stays clear of the name and the header', () => {
    const upper = boundsFor('upper', DESKTOP_VIEW, false);
    const lower = boundsFor('lower', DESKTOP_VIEW, false);
    const all = union(upper, lower);
    const width = all.right - all.left;
    const height = all.bottom - all.top;
    expect(width).toBeGreaterThan(0.38);
    expect(width).toBeLessThan(0.52);
    expect(height).toBeGreaterThan(0.62);
    expect(height).toBeLessThan(0.78);
    expect(all.top, 'clear of the header').toBeGreaterThan(84 / 900);
    expect(all.bottom, 'above the name baseline region on the left').toBeLessThan(0.9);
    expect(all.left, 'the name owns the lower left').toBeGreaterThan(0.44);
    expect(all.right).toBeLessThanOrEqual(1.0);
    // The lower counterform sits below the upper mass, toward the lower left.
    expect(lower.bottom).toBeGreaterThan(upper.bottom - 0.05);
    expect(lower.left).toBeLessThan(upper.left + 0.1);
  });

  it('frames a smaller, more frontal object under the identity lines on phones', () => {
    for (const [viewport, nameBottom] of [
      [PHONE_VIEW, 350 / 844],
      [NARROW_VIEW, 310 / 700],
    ] as const) {
      const all = union(boundsFor('upper', viewport, true), boundsFor('lower', viewport, true));
      const width = all.right - all.left;
      expect(width, `${viewport.width}px width share`).toBeGreaterThan(0.7);
      expect(width).toBeLessThan(0.92);
      expect(all.top, `${viewport.width}px: below the identity lines`).toBeGreaterThan(nameBottom);
      expect(all.bottom, `${viewport.width}px: a quiet lower margin`).toBeLessThan(0.95);
      expect(all.left).toBeGreaterThan(0.02);
      expect(all.right).toBeLessThan(0.98);
    }
  });

  it('closes the slit as the fold ends and turns the object toward a thin profile', () => {
    expect(closure({ reveal: 1, fold: 0 })).toBe(0);
    expect(closure({ reveal: 1, fold: 1 })).toBe(1);
    expect(closure({ reveal: 0, fold: 0 })).toBe(1);
    const open = lowerPose(DESKTOP, FORM, { reveal: 1, fold: 0 });
    const closed = lowerPose(DESKTOP, FORM, { reveal: 1, fold: 1 });
    expect(open.position[2]).toBeGreaterThan(0.05);
    expect(open.position[0], 'the lower counterform rests toward the left').toBeLessThan(-0.2);
    expect(open.rotation[0], 'the lower counterform tilts toward the viewer at rest').toBeLessThan(0);
    expect(closed.position[2]).toBe(0);
    expect(closed.rotation[0]).toBeCloseTo(0, 9);
    expect(Math.hypot(closed.position[0], closed.position[1])).toBeCloseTo(2 * DESKTOP.gap - 0.012, 6);
    const rest = groupPose(DESKTOP, DESKTOP_VIEW, { reveal: 1, fold: 0 });
    const folded = groupPose(DESKTOP, DESKTOP_VIEW, { reveal: 1, fold: 1 });
    const turn = Math.abs(folded.rotation[1] - rest.rotation[1]) / (Math.PI / 180);
    expect(turn).toBeGreaterThanOrEqual(35);
    expect(turn).toBeLessThanOrEqual(50);
    expect(folded.position[0]).toBeGreaterThan(rest.position[0]);
    expect(folded.position[1]).toBeGreaterThan(rest.position[1]);
    const restWidth = (() => {
      const a = union(boundsFor('upper', DESKTOP_VIEW, false), boundsFor('lower', DESKTOP_VIEW, false));
      return a.right - a.left;
    })();
    const foldedWidth = (() => {
      const params = { reveal: 1, fold: 1 };
      const a = union(boundsFor('upper', DESKTOP_VIEW, false, params), boundsFor('lower', DESKTOP_VIEW, false, params));
      return a.right - a.left;
    })();
    expect(foldedWidth).toBeLessThan(restWidth * 0.8);
  });

  it('starts the loader closer and closed, and lands on the rest pose', () => {
    const entrance = groupPose(DESKTOP, DESKTOP_VIEW, { reveal: 0, fold: 0 });
    const rest = groupPose(DESKTOP, DESKTOP_VIEW, { reveal: 1, fold: 0 });
    expect(entrance.position[2]).toBeGreaterThan(rest.position[2]);
    expect(lowerPose(DESKTOP, FORM, { reveal: 0, fold: 0 }).position[2]).toBe(0);
    const centre = project([rest.position[0], rest.position[1], rest.position[2]], DESKTOP.fov, 1440 / 900);
    expect(centre.x).toBeCloseTo(DESKTOP.centre[0], 6);
    expect(centre.y).toBeCloseTo(DESKTOP.centre[1], 6);
  });

  it('reverses: the same scroll position gives the same pose on the way back', () => {
    const down = groupPose(DESKTOP, DESKTOP_VIEW, { reveal: 1, fold: 0.37 });
    const up = groupPose(DESKTOP, DESKTOP_VIEW, { reveal: 1, fold: 0.37 });
    expect(down).toEqual(up);
  });

  it('transforms normals with the rotation only', () => {
    const matrix = partMatrix(DESKTOP, FORM, DESKTOP_VIEW, 'lower', { reveal: 1, fold: 0 });
    const n = transformNormal(matrix, [0, 0, 1]);
    expect(Math.hypot(n[0], n[1], n[2])).toBeCloseTo(1, 9);
    const origin = transformPoint(matrix, [0, 0, 0]);
    expect(origin[2]).toBeLessThan(0);
  });
});
