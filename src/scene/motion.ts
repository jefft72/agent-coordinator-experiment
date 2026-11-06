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
 * the pinned opening: the opening's own height. The sculpture folds away
 * between these two fractions of that distance, so it is clearly moving by
 * the time the chapter's surface reaches it and has left the reading plane
 * before the surface covers the last of the opening.
 */
export const FOLD_START = 0.18;
export const FOLD_END = 0.92;
