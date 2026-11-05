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
    expect(createField({ count: 112, compact: false }).count).toBe(112);
    expect(createField({ count: 84, compact: true }).count).toBe(84);
    expect(bladeCount(false)).toBe(112);
    expect(bladeCount(true)).toBe(84);
    expect(samples(true, 1, 0)).toHaveLength(84);
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

  it('starts beside the name, crests in the upper right, and clears the Work heading on desktop', () => {
    const camera = cameraFor(false, { reveal: 1, fold: 0 });
    const list = samples(false, 1, 0);
    const first = projectToScreen(list[0].position, camera, DESKTOP_ASPECT);
    // The thin tail tapers out right of the name, above the Work heading (y >= 0.8).
    expect(first.x).toBeGreaterThan(0.42);
    expect(first.x).toBeLessThan(0.58);
    expect(first.y).toBeGreaterThan(0.55);
    expect(first.y).toBeLessThan(0.78);
    const tallest = list.reduce((best, b) => (b.scale[1] > best.scale[1] ? b : best), list[0]);
    const crest = projectToScreen(tallest.position, camera, DESKTOP_ASPECT);
    expect(crest.x).toBeGreaterThan(0.6);
    expect(crest.y).toBeLessThan(0.4);
    // The return limb comes back left of the crest, behind it, so the fold turns in depth.
    const last = projectToScreen(list[list.length - 1].position, camera, DESKTOP_ASPECT);
    expect(last.x).toBeLessThan(crest.x - 0.1);
    expect(last.depth).toBeGreaterThan(crest.depth + 2);
    // Nothing reaches the navigation strip or the Work heading region.
    for (const blade of list) {
      const p = projectToScreen(blade.position, camera, DESKTOP_ASPECT);
      expect(p.y).toBeGreaterThan(0.1);
      expect(p.y).toBeLessThan(0.8);
    }
  });

  it('turns the crest plates to face the camera and the ends edge-on', () => {
    for (const compact of [false, true]) {
      const camera = cameraFor(compact, { reveal: 1, fold: 0 });
      const list = samples(compact, 1, 0);
      const facing = (b: BladeSample) => {
        const v = [
          camera.position[0] - b.position[0],
          camera.position[1] - b.position[1],
          camera.position[2] - b.position[2],
        ];
        const l = Math.hypot(v[0], v[1], v[2]);
        return Math.abs((b.normal[0] * v[0] + b.normal[1] * v[1] + b.normal[2] * v[2]) / l);
      };
      const tallest = list.reduce((best, b) => (b.scale[1] > best.scale[1] ? b : best), list[0]);
      expect(facing(tallest)).toBeGreaterThan(0.95);
      // The tail is edge-on; the return limb shows a dimmer, partly turned face.
      expect(facing(list[0])).toBeLessThan(0.25);
      expect(facing(list[list.length - 1])).toBeGreaterThan(0.3);
      expect(facing(list[list.length - 1])).toBeLessThan(0.9);
    }
  });

  it('turns every plate toward edge-on when folded', () => {
    const camera = cameraFor(false, { reveal: 1, fold: 0 });
    const rest = samples(false, 1, 0);
    const folded = samples(false, 1, 1);
    const facing = (b: BladeSample) => {
      const v = [
        camera.position[0] - b.position[0],
        camera.position[1] - b.position[1],
        camera.position[2] - b.position[2],
      ];
      const l = Math.hypot(v[0], v[1], v[2]);
      return Math.abs((b.normal[0] * v[0] + b.normal[1] * v[1] + b.normal[2] * v[2]) / l);
    };
    const mean = (list: BladeSample[]) => list.reduce((s, b) => s + facing(b), 0) / list.length;
    expect(mean(folded)).toBeLessThan(mean(rest) * 0.5);
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
    expect(Math.max(...heights)).toBeGreaterThan(1.8);
    expect(Math.min(...heights)).toBeLessThan(1.0);
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

describe('compact camera framing', () => {
  it('is unchanged at the reference phone size and lowers the artwork on shorter viewports', () => {
    const reference = cameraFor(true, { reveal: 1, fold: 0 }, undefined, { width: 390, height: 844 });
    const plain = cameraFor(true, { reveal: 1, fold: 0 });
    expect(reference.position).toEqual(plain.position);
    expect(reference.target).toEqual(plain.target);

    const short = cameraFor(true, { reveal: 1, fold: 0 }, undefined, { width: 320, height: 700 });
    expect(short.target[1]).toBeGreaterThan(plain.target[1]);
    const dist = (pose: typeof plain) =>
      Math.hypot(pose.target[0] - pose.position[0], pose.target[1] - pose.position[1], pose.target[2] - pose.position[2]);
    // 0.35 pixels per pixel of missing height: 21 CSS pixels at 700, in world units at the target distance.
    const unitsPerPx = (2 * dist(plain) * Math.tan((plain.fov * Math.PI) / 360)) / 700;
    expect(short.target[1] - plain.target[1]).toBeCloseTo(21 * unitsPerPx, 6);
    // And the camera dollies back 0.6 units.
    expect(dist(short) - dist(plain)).toBeCloseTo(0.6, 6);
  });

  it('projects the crest lower on a 320 by 700 screen than the plain pose would', () => {
    const field = createField({ count: bladeCount(true), compact: true });
    const crest = sampleBlade(field, Math.floor(field.count / 2), { reveal: 1, fold: 0 });
    const plain = projectToScreen(crest.position, cameraFor(true, { reveal: 1, fold: 0 }), 320 / 700);
    const nudged = projectToScreen(
      crest.position,
      cameraFor(true, { reveal: 1, fold: 0 }, undefined, { width: 320, height: 700 }),
      320 / 700,
    );
    const shift = nudged.y * 700 - plain.y * 700;
    expect(shift).toBeGreaterThan(12);
    expect(shift).toBeLessThan(40);
  });

  it('does not touch the desktop camera', () => {
    const plain = cameraFor(false, { reveal: 1, fold: 0 });
    const sized = cameraFor(false, { reveal: 1, fold: 0 }, undefined, { width: 1280, height: 600 });
    expect(sized.position).toEqual(plain.position);
    expect(sized.target).toEqual(plain.target);
  });
});
