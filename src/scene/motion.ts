/**
 * One shared motion state for the whole page.
 * The loader, the scroll controller, and the pointer listener write to it;
 * the WebGL scene reads it every frame. Nothing here triggers a React render.
 */
export interface MotionState {
  /** 0 = loader intro framing, 1 = settled opening framing. Driven by the loader. */
  reveal: number;
  /** 0 = opening at rest, 1 = folded toward the right edge as the first chapter covers it. Driven by scroll. */
  fold: number;
  /** Pointer in normalized device coordinates, -1..1, active only while over the viewport. */
  pointer: { x: number; y: number; active: boolean };
  /** Mirrors prefers-reduced-motion. The scene must not animate when true. */
  reducedMotion: boolean;
  /** False once the opening has been covered; the scene stops rendering until the reader returns. */
  active: boolean;
}

export const motion: MotionState = {
  reveal: 0,
  fold: 0,
  pointer: { x: 0, y: 0, active: false },
  reducedMotion: false,
  active: true,
};

/**
 * The handoff is the scroll distance over which the first chapter rises over
 * the pinned opening: the opening's own height. The sculpture folds away over
 * the last part of it, as a fraction of that distance.
 */
export const FOLD_START = 0.45;
