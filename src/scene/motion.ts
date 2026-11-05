import type { ProjectId } from '../content/types';

/**
 * One shared motion state for the whole page.
 * The loader, the scroll controller, and the pointer listener write to it;
 * the WebGL scene reads it every frame. Nothing here triggers a React render.
 */
export interface MotionState {
  /** 0 = loader intro framing, 1 = settled opening framing. Driven by the loader. */
  reveal: number;
  /** 0 = opening at rest, 1 = folded toward the right edge with Work in place. Driven by scroll. */
  fold: number;
  /** Pointer in normalized device coordinates, -1..1, active only while over the viewport. */
  pointer: { x: number; y: number; active: boolean };
  /** Project the artwork is currently responding to, or null at rest. */
  focus: ProjectId | null;
  /** Mirrors prefers-reduced-motion. The scene must not animate when true. */
  reducedMotion: boolean;
  /** False once the opening has scrolled out of view; the scene stops rendering. */
  active: boolean;
  /** True while the project stage owns the only live renderer; the opening scene holds its frame. */
  suspended: boolean;
}

export const motion: MotionState = {
  reveal: 0,
  fold: 0,
  pointer: { x: 0, y: 0, active: false },
  focus: null,
  reducedMotion: false,
  active: true,
  suspended: false,
};

/** Scroll distance, as a fraction of the viewport height, over which the fold completes. */
export const FOLD_SCROLL_VH = 0.85;
