/**
 * One shared motion state for the whole page.
 * The loader, the scroll controller, and the pointer listener write to it;
 * the WebGL scene reads it every frame. Nothing here triggers a React render.
 */
export interface MotionState {
  /** 0 = loader intro framing, 1 = settled opening framing. Driven by the loader. */
  reveal: number;
  /** 0 = opening at rest, 1 = closed and turned away as the first chapter covers it. Driven by scroll. */
  fold: number;
  /** Pointer in normalized device coordinates, -1..1, active only while over the viewport. */
  pointer: { x: number; y: number; active: boolean };
  /** Mirrors prefers-reduced-motion. The scene must not animate when true. */
  reducedMotion: boolean;
  /** False once the opening has been covered; the scene stops rendering until the reader returns. */
  active: boolean;
  /** Bumped by every scroll, pointer, or preference write so the demand renderer knows a frame is owed. */
  version: number;
}

export const motion: MotionState = {
  reveal: 0,
  fold: 0,
  pointer: { x: 0, y: 0, active: false },
  reducedMotion: false,
  active: true,
  version: 0,
};

/** Marks the motion state changed; the scene renders one frame per change and then settles. */
export function touchMotion(): void {
  motion.version = (motion.version + 1) % 1_000_000;
}

/**
 * The handoff is the scroll distance over which the first chapter rises over
 * the pinned opening: the opening's own height, one full viewport. The
 * shells close and turn away between these two fractions of that distance,
 * so they are clearly moving by the time the chapter's surface reaches them
 * and have turned to a thin profile before the surface covers the last of
 * the opening.
 */
export const FOLD_START = 0.12;
export const FOLD_END = 0.88;
