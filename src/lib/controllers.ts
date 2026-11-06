import { FOLD_END, FOLD_START, motion } from '../scene/motion';

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

export type HandoffState = 'rest' | 'moving' | 'done';

/**
 * Native scroll drives the opening handoff; pointer position drives the local
 * response. Both write to the motion store and never cause React renders.
 *
 * The handoff is measured against the opening's height: the first chapter
 * rises over the pinned opening at scroll speed, so the opening is covered
 * exactly when the page has scrolled its height. Over that distance the
 * name and identity recede (CSS, from --handoff and --handoff-px) ahead of
 * the rising surface, and the sculpture folds out of the reading plane
 * between FOLD_START and FOLD_END. Once covered, the scene stops rendering
 * and the opening is hidden until the reader scrolls back.
 */
export function installMotionControllers(): () => void {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = window.matchMedia('(pointer: fine)');
  const root = document.documentElement;
  motion.reducedMotion = reduced.matches;

  let lastActive = motion.active;
  const publishActive = () => {
    if (motion.active === lastActive) return;
    lastActive = motion.active;
    window.dispatchEvent(new CustomEvent('jt:scene-active', { detail: motion.active }));
  };

  let lastState: HandoffState | null = null;
  const onScroll = () => {
    const vh = window.innerHeight || 1;
    const y = window.scrollY || 0;
    const opening = document.getElementById('opening');
    const end = Math.max(1, opening?.offsetHeight ?? vh);
    const progress = clamp01(y / end);
    const fold = motion.reducedMotion ? 0 : easeInOut(clamp01((progress - FOLD_START) / (FOLD_END - FOLD_START)));
    motion.fold = fold;
    motion.active = progress < 1;
    root.style.setProperty('--handoff', progress.toFixed(4));
    root.style.setProperty('--handoff-px', `${Math.round(Math.min(y, end))}px`);
    root.style.setProperty('--fold', fold.toFixed(4));
    const state: HandoffState = progress <= 0 ? 'rest' : progress < 1 ? 'moving' : 'done';
    if (state !== lastState) {
      lastState = state;
      root.dataset.handoff = state;
    }
    publishActive();
  };

  const onPointerMove = (event: PointerEvent) => {
    if (!finePointer.matches || motion.reducedMotion) return;
    motion.pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    motion.pointer.y = -((event.clientY / window.innerHeight) * 2 - 1);
    motion.pointer.active = true;
  };
  const onPointerLeave = () => {
    motion.pointer.active = false;
  };
  const onReduced = (event: MediaQueryListEvent) => {
    motion.reducedMotion = event.matches;
    if (event.matches) motion.pointer.active = false;
    onScroll();
  };
  const onVisibility = () => {
    if (document.hidden) {
      motion.active = false;
      publishActive();
    } else {
      onScroll();
    }
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  window.addEventListener('pointermove', onPointerMove, { passive: true });
  document.documentElement.addEventListener('pointerleave', onPointerLeave);
  window.addEventListener('blur', onPointerLeave);
  document.addEventListener('visibilitychange', onVisibility);
  reduced.addEventListener('change', onReduced);
  onScroll();

  return () => {
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', onScroll);
    window.removeEventListener('pointermove', onPointerMove);
    document.documentElement.removeEventListener('pointerleave', onPointerLeave);
    window.removeEventListener('blur', onPointerLeave);
    document.removeEventListener('visibilitychange', onVisibility);
    reduced.removeEventListener('change', onReduced);
    delete root.dataset.handoff;
    root.style.removeProperty('--handoff');
    root.style.removeProperty('--handoff-px');
    root.style.removeProperty('--fold');
  };
}
