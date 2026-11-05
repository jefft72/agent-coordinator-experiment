/** One deliberate move: cubic ease-out over EASE_MS. Shared by the camera rig and the placed objects. */
export const EASE_MS = 900;

export function easeOutCubic(t: number): number {
  const clamped = t < 0 ? 0 : t > 1 ? 1 : t;
  const inv = 1 - clamped;
  return 1 - inv * inv * inv;
}
