import { describe, expect, it } from 'vitest';
import { bladeCount, cameraFor, createField, projectToScreen, sampleBlade, type BladeSample } from './bladeField';

const DESKTOP_ASPECT = 1440 / 900;

function samples(compact: boolean, reveal: number, fold: number): BladeSample[] {
  const field = createField({ count: bladeCount(compact), compact });
  const out: BladeSample[] = [];
  for (let i = 0; i < field.count; i++) out.push(sampleBlade(field, i, { reveal, fold }));
  return out;
}

function spacingVariance(list: BladeSample[]): number {
  const gaps: number[] = [];
  for (let i = 1; i < list.length; i++) {
    const a = list[i - 1].position;
    const b = list[i].position;
    gaps.push(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]));
  }
  const mean = gaps.reduce((s, g) => s + g, 0) / gaps.length;
  return gaps.reduce((s, g) => s + (g - mean) * (g - mean), 0) / gaps.length;
}

describe('bladeField', () => {
  it('is deterministic', () => {
    const a = samples(false, 0.37, 0.21);
    const b = samples(false, 0.37, 0.21);
    expect(a).toEqual(b);
  });

  it('produces the requested counts', () => {
    expect(createField({ count: 140, compact: false }).count).toBe(140);
    expect(createField({ count: 96, compact: true }).count).toBe(96);
    expect(bladeCount(false)).toBe(140);
    expect(bladeCount(true)).toBe(96);
    expect(samples(true, 1, 0)).toHaveLength(96);
  });

  it('progresses from lower-left to upper-right along the sweep', () => {
    for (const compact of [false, true]) {
      const list = samples(compact, 1, 0);
      const first = list[0].position;
      const last = list[list.length - 1].position;
      expect(last[0]).toBeGreaterThan(first[0]);
      expect(last[1]).toBeGreaterThan(first[1]);
      expect(last[2]).toBeLessThan(first[2]);
      // u is monotone non-decreasing.
      for (let i = 1; i < list.length; i++) expect(list[i].u).toBeGreaterThanOrEqual(list[i - 1].u);
    }
  });

  it('keeps the upper-left pocket free of blade centres at rest on desktop', () => {
    const camera = cameraFor(false, { reveal: 1, fold: 0 });
    for (const blade of samples(false, 1, 0)) {
      const p = projectToScreen(blade.position, camera, DESKTOP_ASPECT);
      const inPocket = p.x < 0.4 && p.y < 0.5;
      expect(inPocket).toBe(false);
    }
  });

  it('keeps the crest in the upper right and the foreground in the lower left on desktop', () => {
    const camera = cameraFor(false, { reveal: 1, fold: 0 });
    const list = samples(false, 1, 0);
    const first = projectToScreen(list[0].position, camera, DESKTOP_ASPECT);
    expect(first.x).toBeLessThan(0.2);
    expect(first.y).toBeGreaterThan(0.75);
    const tallest = list.reduce((best, b) => (b.scale[1] > best.scale[1] ? b : best), list[0]);
    const crest = projectToScreen(tallest.position, camera, DESKTOP_ASPECT);
    expect(crest.x).toBeGreaterThan(0.5);
    expect(crest.y).toBeLessThan(0.45);
  });

  it('moves the mean x to the right when folded', () => {
    for (const compact of [false, true]) {
      const rest = samples(compact, 1, 0);
      const folded = samples(compact, 1, 1);
      const mean = (list: BladeSample[]) => list.reduce((s, b) => s + b.position[0], 0) / list.length;
      expect(mean(folded)).toBeGreaterThan(mean(rest) + 1);
    }
  });

  it('stays coherent at intermediate fold values', () => {
    const half = samples(false, 1, 0.5);
    for (let i = 1; i < half.length; i++) {
      const a = half[i - 1].position;
      const b = half[i].position;
      expect(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2])).toBeLessThan(0.6);
    }
  });

  it('has smaller spacing variance when collapsed than at rest', () => {
    expect(spacingVariance(samples(false, 0, 0))).toBeLessThan(spacingVariance(samples(false, 1, 0)));
    expect(spacingVariance(samples(false, 0, 0))).toBeLessThan(1e-6);
  });

  it('aligns the roll when collapsed', () => {
    const list = samples(false, 0, 0);
    for (const blade of list) {
      expect(Math.abs(blade.normal[0] - list[0].normal[0])).toBeLessThan(1e-6);
      expect(Math.abs(blade.normal[2] - list[0].normal[2])).toBeLessThan(1e-6);
    }
  });

  it('varies height and roll smoothly along the sweep', () => {
    const list = samples(false, 1, 0);
    const heights = list.map((b) => b.scale[1]);
    expect(Math.max(...heights)).toBeGreaterThan(2.4);
    expect(Math.min(...heights)).toBeLessThan(1.5);
    for (let i = 1; i < list.length; i++) {
      expect(Math.abs(heights[i] - heights[i - 1])).toBeLessThan(0.08);
    }
  });

  it('returns orthonormal axes', () => {
    for (const blade of samples(false, 1, 0.3)) {
      const { normal, up, side } = blade;
      expect(Math.hypot(...normal)).toBeCloseTo(1, 6);
      expect(Math.hypot(...up)).toBeCloseTo(1, 6);
      expect(Math.hypot(...side)).toBeCloseTo(1, 6);
      expect(normal[0] * up[0] + normal[1] * up[1] + normal[2] * up[2]).toBeCloseTo(0, 6);
      expect(side[0] * up[0] + side[1] * up[1] + side[2] * up[2]).toBeCloseTo(0, 6);
    }
  });

  it('writes into the provided sample without allocating', () => {
    const field = createField({ count: 10, compact: false });
    const out = sampleBlade(field, 3, { reveal: 1, fold: 0 });
    const again = sampleBlade(field, 4, { reveal: 1, fold: 0 }, out);
    expect(again).toBe(out);
  });

  it('projects the camera target to the screen centre', () => {
    for (const compact of [false, true]) {
      for (const params of [
        { reveal: 1, fold: 0 },
        { reveal: 0, fold: 0 },
        { reveal: 1, fold: 1 },
      ]) {
        const camera = cameraFor(compact, params);
        const p = projectToScreen(camera.target, camera, compact ? 390 / 844 : DESKTOP_ASPECT);
        expect(p.x).toBeCloseTo(0.5, 9);
        expect(p.y).toBeCloseTo(0.5, 9);
        expect(p.depth).toBeGreaterThan(0);
      }
    }
  });

  it('projects a point right of and above the target to the upper right', () => {
    const camera = cameraFor(false, { reveal: 1, fold: 0 });
    const [tx, ty, tz] = camera.target;
    const p = projectToScreen([tx + 1, ty + 1, tz], camera, DESKTOP_ASPECT);
    expect(p.x).toBeGreaterThan(0.5);
    expect(p.y).toBeLessThan(0.5);
  });
});
