/**
 * Scroll-linked arrival progress for the chapters.
 *
 * Every element with data-reveal gets a --reveal custom property from 0 to 1
 * as its top edge travels from the bottom of the viewport into the reading
 * zone; every chapter with data-takeover gets --takeover on itself and writes
 * --covered on the element it rises over. The values are pure functions of
 * the scroll position, so the motion plays forward on the way down and in
 * reverse on the way back up, and nothing is ever left hidden. The CSS reads
 * the variables with the settled value as fallback, so an element shows in
 * place until the tracker has run. Under reduced motion the tracker is
 * disabled and every inline value is removed, and it follows the preference
 * live in both directions without a reload.
 */

/** How far into the viewport the top edge travels before an element is settled, as a fraction of the viewport height. */
export const REVEAL_SPAN = 0.42;
/** The takeover runs while the chapter's top edge travels this fraction of the viewport. */
export const TAKEOVER_SPAN = 0.7;

const REDUCED = '(prefers-reduced-motion: reduce)';

export function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

/** Decelerating curve that settles rather than stopping, gentle enough that the travel stays visible. */
export function easeOut(t: number): number {
  const u = 1 - clamp01(t);
  return 1 - u * u;
}

/**
 * Linear progress of an element whose top edge is `top` pixels from the top
 * of a `viewport`-tall window: 0 while the edge is at or below the bottom of
 * the window, 1 once it has risen `span` of the window height.
 */
export function progressFor(top: number, viewport: number, span: number): number {
  const distance = Math.max(1, viewport * span);
  return clamp01((viewport - top) / distance);
}

export type RevealState = 'pending' | 'arriving' | 'settled';

export function revealState(progress: number): RevealState {
  return progress <= 0 ? 'pending' : progress >= 1 ? 'settled' : 'arriving';
}

function readSpan(element: HTMLElement, fallback: number): number {
  const parsed = Number.parseFloat(element.dataset.revealSpan ?? '');
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function installRevealTracker(): () => void {
  const reveals = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'));
  const takeovers = Array.from(document.querySelectorAll<HTMLElement>('[data-takeover]'));
  if (reveals.length === 0 && takeovers.length === 0) return () => undefined;

  const reduced = window.matchMedia(REDUCED);
  const written = new Map<HTMLElement, number>();
  let enabled = false;
  let disposed = false;
  let frame = 0;

  const update = () => {
    frame = 0;
    if (!enabled) return;
    const vh = window.innerHeight || 1;
    for (const element of reveals) {
      const linear = progressFor(element.getBoundingClientRect().top, vh, readSpan(element, REVEAL_SPAN));
      const state = revealState(linear);
      if (element.dataset.revealState !== state) element.dataset.revealState = state;
      const eased = easeOut(linear);
      const last = written.get(element);
      if (last !== undefined && Math.abs(last - eased) < 0.0015) continue;
      written.set(element, eased);
      element.style.setProperty('--reveal', eased.toFixed(3));
    }
    for (const chapter of takeovers) {
      const eased = easeOut(progressFor(chapter.getBoundingClientRect().top, vh, readSpan(chapter, TAKEOVER_SPAN)));
      chapter.style.setProperty('--takeover', eased.toFixed(3));
      const previous = chapter.previousElementSibling;
      if (previous instanceof HTMLElement) previous.style.setProperty('--covered', eased.toFixed(3));
    }
  };
  const schedule = () => {
    if (enabled && frame === 0) frame = window.requestAnimationFrame(update);
  };
  const onVisibility = () => {
    if (!document.hidden) schedule();
  };

  const clear = () => {
    for (const element of reveals) {
      element.style.removeProperty('--reveal');
      delete element.dataset.revealState;
    }
    for (const chapter of takeovers) {
      chapter.style.removeProperty('--takeover');
      const previous = chapter.previousElementSibling;
      if (previous instanceof HTMLElement) previous.style.removeProperty('--covered');
    }
    written.clear();
  };

  const enable = () => {
    if (enabled || disposed) return;
    enabled = true;
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    document.addEventListener('visibilitychange', onVisibility);
    update();
  };
  const disable = () => {
    if (!enabled) return;
    enabled = false;
    window.cancelAnimationFrame(frame);
    frame = 0;
    window.removeEventListener('scroll', schedule);
    window.removeEventListener('resize', schedule);
    document.removeEventListener('visibilitychange', onVisibility);
    clear();
  };
  const onPreference = (event: MediaQueryListEvent) => {
    if (event.matches) disable();
    else enable();
  };

  if (!reduced.matches) enable();
  reduced.addEventListener('change', onPreference);
  // Fonts and lazy media change the layout after mount; re-measure once they
  // settle, unless the tracker has been disposed in the meantime.
  const fonts = 'fonts' in document ? document.fonts.ready : Promise.resolve();
  const remeasure = () => {
    if (!disposed) schedule();
  };
  fonts.then(remeasure, remeasure);

  return () => {
    disposed = true;
    reduced.removeEventListener('change', onPreference);
    disable();
  };
}
