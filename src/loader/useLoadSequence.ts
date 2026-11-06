import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from '../scene/motion';

export type LoadState = 'loading' | 'reveal' | 'ready' | 'bypassed' | 'failed';

export type SceneStatus = 'pending' | 'ready' | 'fallback' | 'failed';

/** Critical readiness must arrive within this window or the page is revealed anyway. */
export const LOAD_DEADLINE_MS = 2500;
/** Duration of the strip separation and camera arrival. */
export const REVEAL_MS = 800;

export const INTRO_STORAGE_KEY = 'jt:intro';

/** User Timing measure from the moment the deadline starts counting to finish; the browser tests read it. */
export const INTRO_MEASURE = 'jt:intro';
const INTRO_MARK_START = 'jt:intro:start';
const INTRO_MARK_END = 'jt:intro:end';

const CRITICAL_FONTS = ['900 1em "Archivo ExtraCondensed"', '400 1em "Archivo"'];

function readIntroPreference(): 'play' | 'skip' {
  if (typeof window === 'undefined') return 'skip';
  const params = new URLSearchParams(window.location.search);
  if (params.get('intro') === 'skip') return 'skip';
  if (params.get('intro') === 'play') return 'play';
  if (window.location.hash && window.location.hash !== '#top') return 'skip';
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return 'skip';
  try {
    if (window.sessionStorage.getItem(INTRO_STORAGE_KEY) === 'seen') return 'skip';
  } catch {
    /* storage can be unavailable; play the intro */
  }
  return 'play';
}

function markIntroSeen() {
  try {
    window.sessionStorage.setItem(INTRO_STORAGE_KEY, 'seen');
  } catch {
    /* ignore */
  }
}

/** Marks the start of the loader's own interval. No-op where User Timing is unavailable. */
function markIntroStart() {
  if (typeof performance.mark === 'function') performance.mark(INTRO_MARK_START);
}

/** Closes the loader's interval as the `jt:intro` measure. No-op where User Timing is unavailable. */
function markIntroEnd() {
  if (typeof performance.mark !== 'function' || typeof performance.measure !== 'function') return;
  performance.mark(INTRO_MARK_END);
  try {
    performance.measure(INTRO_MEASURE, INTRO_MARK_START, INTRO_MARK_END);
  } catch {
    /* finished before the deadline started counting: nothing to measure */
  }
}

function easeInOut(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export interface LoadSequence {
  state: LoadState;
  fontsReady: boolean;
  /** Measured readiness as whole steps: fonts, scene. Never a fabricated percentage. */
  steps: { fonts: boolean; scene: boolean };
  skip: () => void;
}

/**
 * Explicit intro state machine.
 * loading -> reveal -> ready on real readiness or at the bounded deadline;
 * loading | reveal -> bypassed on Skip, returning visit, hash link, or reduced motion;
 * loading -> failed when the scene fails before the reveal has started.
 * motion.reveal is driven here so the WebGL camera arrives with the strips.
 */
export function useLoadSequence(scene: SceneStatus): LoadSequence {
  const [state, setLoadState] = useState<LoadState>(() => (readIntroPreference() === 'skip' ? 'bypassed' : 'loading'));
  const [fontsReady, setFontsReady] = useState(false);
  const stateRef = useRef<LoadState>(state);
  const startedAt = useRef<number | null>(null);
  const revealFrame = useRef<number | null>(null);
  const setState = useCallback((next: LoadState) => {
    stateRef.current = next;
    setLoadState(next);
  }, []);

  const finish = useCallback(
    (next: 'bypassed' | 'failed' | 'ready') => {
      if (revealFrame.current !== null) {
        cancelAnimationFrame(revealFrame.current);
        revealFrame.current = null;
      }
      motion.reveal = 1;
      markIntroEnd();
      markIntroSeen();
      setState(next);
    },
    [setState],
  );

  const skip = useCallback(() => {
    if (stateRef.current === 'loading' || stateRef.current === 'reveal') finish('bypassed');
  }, [finish]);

  const startReveal = useCallback(() => {
    if (stateRef.current !== 'loading') return;
    setState('reveal');
    const t0 = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / REVEAL_MS);
      motion.reveal = easeInOut(t);
      if (t < 1) {
        revealFrame.current = requestAnimationFrame(tick);
      } else {
        revealFrame.current = null;
        finish('ready');
      }
    };
    revealFrame.current = requestAnimationFrame(tick);
  }, [finish, setState]);

  // Bypassed on first render: the page is already at its final framing.
  useEffect(() => {
    if (stateRef.current === 'bypassed') {
      motion.reveal = 1;
      markIntroSeen();
    }
  }, []);

  // Critical fonts.
  useEffect(() => {
    let cancelled = false;
    const fonts = 'fonts' in document ? document.fonts : null;
    Promise.all(fonts ? CRITICAL_FONTS.map((f) => fonts.load(f)) : [])
      .catch(() => undefined)
      .then(() => {
        if (!cancelled) setFontsReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Readiness and the bounded deadline. The deadline counts from first render,
  // so a late font never extends it; readiness or failure fires on the next tick.
  useEffect(() => {
    if (state !== 'loading') return;
    const settled = scene === 'failed' || (fontsReady && scene !== 'pending');
    if (startedAt.current === null) {
      startedAt.current = performance.now();
      markIntroStart();
    }
    const remaining = Math.max(0, startedAt.current + LOAD_DEADLINE_MS - performance.now());
    const timer = window.setTimeout(() => (scene === 'failed' ? finish('failed') : startReveal()), settled ? 0 : remaining);
    return () => window.clearTimeout(timer);
  }, [state, scene, fontsReady, startReveal, finish]);

  // Reflect the state for CSS and tests.
  useEffect(() => {
    document.documentElement.dataset.loadState = state;
  }, [state]);

  useEffect(
    () => () => {
      if (revealFrame.current !== null) cancelAnimationFrame(revealFrame.current);
    },
    [],
  );

  return { state, fontsReady, steps: { fonts: fontsReady, scene: scene !== 'pending' }, skip };
}
