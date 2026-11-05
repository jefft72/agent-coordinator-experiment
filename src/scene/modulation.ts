import type { ProjectId } from '../content/types';

/**
 * Per-project deformation of the blade field, as a shift along the sweep (u,
 * a fraction of its arc length), a roll about each plate's height axis in
 * radians, and a push along the plate normal in world units. One set of
 * functions drives the project stage in the details dialog at full strength,
 * the opening sculpture while a row is focused, and the inline rule under
 * each row, so every response speaks the same language:
 * AnimaLabs resolves scattered independent bends into one correlated wave,
 * OpenCraft brings four offset bands into alignment, Diffex settles irregular
 * spacing into an ordered run, Judi redistributes spacing while both ends stay
 * fixed, RTX sweeps a single arc along the surface, UPlate rolls a slow swell.
 * These are abstract interpretations, never diagrams of the products.
 */
export interface Modulation {
  u: number;
  roll: number;
  push: number;
}

/** A pattern either resolves from a disturbed start to a settled end, or cycles. */
export interface Pattern {
  kind: 'resolve' | 'cycle';
  /** Seconds for one run from phase 0 to phase 1. */
  duration: number;
}

export const PATTERNS: Record<ProjectId, Pattern> = {
  animalabs: { kind: 'resolve', duration: 6 },
  opencraft: { kind: 'resolve', duration: 6 },
  diffex: { kind: 'resolve', duration: 5 },
  judi: { kind: 'resolve', duration: 5 },
  rtx: { kind: 'cycle', duration: 5 },
  uplate: { kind: 'cycle', duration: 6 },
};

/** Strength of the subordinate responses (opening sculpture, row rules) relative to the stage. */
export const SUBTLE = 0.2;

const TAU = Math.PI * 2;

/** Deterministic per-blade noise in -0.5..0.5. */
function noise(i: number): number {
  const hash = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
  return hash - Math.floor(hash) - 0.5;
}

function smooth(t: number): number {
  const x = t < 0 ? 0 : t > 1 ? 1 : t;
  return x * x * (3 - 2 * x);
}

/** Phase 0..1 of a pattern at time t: resolving patterns stop at 1, cycling ones wrap. */
export function phaseAt(id: ProjectId, t: number): number {
  const { kind, duration } = PATTERNS[id];
  const raw = t / duration;
  return kind === 'resolve' ? Math.min(1, raw) : raw - Math.floor(raw);
}

/**
 * The full-strength deformation of blade `i` at `u` along the sweep for the
 * given phase. Amplitudes are sized for the stage, where a plate of roughly two
 * world units turns through half a radian and moves a third of a unit.
 */
export function pattern(id: ProjectId, i: number, u: number, phase: number, out: Modulation): void {
  const p = phase < 0 ? 0 : phase > 1 ? 1 : phase;
  out.u = 0;
  out.roll = 0;
  out.push = 0;
  switch (id) {
    case 'animalabs': {
      // Scattered independent bends give way to one correlated wave travelling along the sweep.
      const scatter = 1 - smooth(p * 1.4);
      const wave = Math.sin(TAU * (2.5 * u - 1.5 * p));
      out.roll = 0.6 * noise(i) * scatter + 0.5 * wave * smooth(p * 1.6);
      out.push = 0.28 * Math.sin(TAU * (2.5 * u - 1.5 * p) + 0.6) * smooth(p * 1.6);
      return;
    }
    case 'opencraft': {
      // Four bands start a quarter turn apart and reach alignment.
      const band = Math.min(3, Math.floor(u * 4));
      const offset = (band / 4) * TAU * (1 - smooth(p));
      const s = Math.sin(TAU * 3 * u + offset);
      out.roll = 0.55 * s;
      out.push = 0.22 * s;
      return;
    }
    case 'diffex': {
      // Irregular spacing and tilt resolve into an even, ordered run.
      const disorder = 1 - smooth(p);
      out.u = 0.035 * noise(i) * disorder;
      out.roll = 0.7 * noise(i) * disorder + 0.16 * smooth(p);
      return;
    }
    case 'judi': {
      // Spacing redistributes toward the middle while both ends stay fixed:
      // every term vanishes at u = 0 and u = 1.
      const s = Math.sin(TAU * u);
      const centre = Math.sin(Math.PI * u);
      out.u = 0.09 * s * smooth(p);
      out.roll = 0.55 * s * smooth(p);
      out.push = -0.16 * centre * centre * smooth(p);
      return;
    }
    case 'rtx': {
      // One arc sweeps along the whole surface.
      const centre = p * 1.3 - 0.15;
      const d = (u - centre) / 0.09;
      const bump = Math.exp(-d * d);
      out.roll = 0.75 * bump;
      out.push = 0.36 * bump;
      return;
    }
    case 'uplate': {
      // A slow swell rolls across.
      const s = Math.sin(TAU * (1.5 * u - p));
      out.roll = 0.6 * s;
      out.push = 0.45 * s;
      return;
    }
  }
}

/** The subordinate, time-driven response used by the opening sculpture and the row rules. */
export function modulate(id: ProjectId, i: number, u: number, t: number, out: Modulation): void {
  pattern(id, i, u, phaseAt(id, t), out);
  out.u *= SUBTLE;
  out.roll *= SUBTLE;
  out.push *= SUBTLE;
}
