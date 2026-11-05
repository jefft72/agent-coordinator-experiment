import { useEffect, useRef } from 'react';
import type { LoadState } from '../loader/useLoadSequence';

const SETTLED: readonly LoadState[] = ['ready', 'bypassed', 'failed'];

function initialFragment(): string | null {
  try {
    return decodeURIComponent(window.location.hash.slice(1)) || null;
  } catch {
    // A malformed escape in the hash is not a reason to throw from an effect.
    return null;
  }
}

/**
 * The browser scrolls to a URL fragment while the document loads, but the
 * section ids only exist once React has rendered, so a cold load of /#about
 * stayed at the top. Once the page is readable and the fonts have settled the
 * layout, scroll the fragment's target into place the way native navigation
 * would, including its scroll-margin. Runs once per page load; later hash
 * changes are handled natively because the targets exist by then. A position
 * the browser already restored (reload, back/forward) is left alone. The work
 * is only marked done once it actually ran, so StrictMode's effect replay can
 * retry after its cleanup cancelled the first attempt.
 */
export function useInitialFragment(state: LoadState): void {
  const done = useRef(false);
  useEffect(() => {
    if (done.current || !SETTLED.includes(state)) return;
    const id = initialFragment();
    if (!id) {
      done.current = true;
      return;
    }
    let cancelled = false;
    const settle = () => {
      if (cancelled) return;
      done.current = true;
      if (window.scrollY > 0) return;
      document.getElementById(id)?.scrollIntoView({ block: 'start', behavior: 'instant' });
    };
    const fonts = 'fonts' in document ? document.fonts.ready : Promise.resolve();
    fonts.then(settle, settle);
    return () => {
      cancelled = true;
    };
  }, [state]);
}
