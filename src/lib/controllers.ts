import { FOLD_SCROLL_VH, motion } from '../scene/motion';

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

/**
 * Native scroll drives the fold; pointer position drives the local response.
 * Both write to the motion store and never cause React renders. The scene is
 * switched off once the opening has fully scrolled away.
 */
export function installMotionControllers(): () => void {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = window.matchMedia('(pointer: fine)');
  motion.reducedMotion = reduced.matches;

  let lastActive = motion.active;
  const publishActive = () => {
    if (motion.active === lastActive) return;
    lastActive = motion.active;
    window.dispatchEvent(new CustomEvent('jt:scene-active', { detail: motion.active }));
  };

  const onScroll = () => {
    const vh = window.innerHeight || 1;
    const y = window.scrollY || 0;
    motion.fold = easeInOut(clamp01(y / (vh * FOLD_SCROLL_VH)));
    motion.active = y < vh * 1.15;
    document.documentElement.style.setProperty('--fold', motion.fold.toFixed(4));
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
  };
}
