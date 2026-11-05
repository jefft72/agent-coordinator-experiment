import type { ProjectId } from '../content/types';

/**
 * Per-project modulation of the blade field, as small offsets along the sweep
 * (u), a roll about each plate's height axis in radians, and a push along the
 * plate normal in world units. Shared by the WebGL sculpture and the inline
 * blade rule under each project row, so both respond in the same language:
 * AnimaLabs is one correlated wave, OpenCraft is four bands drifting into
 * phase, Diffex settles from irregular spacing into order, Judi redistributes
 * spacing while both ends stay fixed, RTX sweeps a single arc, UPlate rolls a
 * slow swell. Small and subordinate by design; nothing here is a diagram.
 */
export interface Modulation {
  u: number;
  roll: number;
  push: number;
}

export function modulate(focus: ProjectId, i: number, u: number, t: number, out: Modulation): void {
  out.u = 0;
  out.roll = 0;
  out.push = 0;
  switch (focus) {
    case 'animalabs': {
      const phase = u * 3 - t * 0.45;
      out.roll = 0.11 * Math.sin(phase * Math.PI * 2);
      out.push = 0.05 * Math.sin(phase * Math.PI * 2 + 0.6);
      return;
    }
    case 'opencraft': {
      const band = Math.floor(u * 4);
      const sync = 0.5 + 0.5 * Math.sin(t * 0.35);
      const offset = (band / 4) * Math.PI * 2 * (1 - sync);
      out.roll = 0.09 * Math.sin(u * Math.PI * 4 + offset + t * 0.6);
      return;
    }
    case 'diffex': {
      const settle = Math.min(1, t / 2.4);
      const hash = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
      const noise = hash - Math.floor(hash) - 0.5;
      out.u = 0.006 * noise * (1 - settle);
      out.roll = 0.05 * noise * (1 - settle) + 0.03 * settle;
      return;
    }
    case 'judi': {
      out.u = 0.012 * Math.sin(u * Math.PI) * Math.sin(t * 0.7 + u * 2);
      out.roll = 0.06 * Math.cos(u * Math.PI) * Math.sin(t * 0.7 + u * 2);
      return;
    }
    case 'rtx': {
      out.roll = 0.07 * Math.sin(u * Math.PI) * Math.sin(t * 0.8);
      return;
    }
    case 'uplate': {
      out.push = 0.035 * Math.sin(u * Math.PI * 2 - t * 0.5);
      out.roll = 0.05 * Math.sin(u * Math.PI * 2 - t * 0.5);
      return;
    }
  }
}
