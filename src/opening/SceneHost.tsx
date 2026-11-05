import { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import type { SceneStatus } from '../loader/useLoadSequence';
import { useMediaQuery } from '../lib/useMediaQuery';
import { SceneErrorBoundary } from '../scene/SceneErrorBoundary';
import { SceneFallback } from '../scene/SceneFallback';

const OpeningScene = lazy(() =>
  new URLSearchParams(window.location.search).get('scene') === 'chunk-fail'
    ? Promise.reject(new Error('forced by ?scene=chunk-fail'))
    : import('../scene/OpeningScene'),
);

export interface SceneHostProps {
  status: SceneStatus;
  onReady: () => void;
  onFallback: () => void;
  onFail: (reason: string) => void;
}

function sceneParam(name: 'webgl' | 'scene'): string | null {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get(name);
}

function hasWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

/**
 * Hosts the one canvas. The static SVG composition paints first and stays
 * until the WebGL scene reports its first frame, then crossfades out. If
 * WebGL is disabled, unavailable, or fails, the SVG simply remains.
 * `?scene=stall` swallows readiness to exercise the loader deadline;
 * `?scene=fail` forces the failure path; `?scene=chunk-fail` rejects the
 * lazy scene chunk, which the boundary turns into the same failure path.
 */
export function SceneHost({ status, onReady, onFallback, onFail }: SceneHostProps) {
  const compact = useMediaQuery('(max-width: 767px)');
  const [wantsWebGL, setWantsWebGL] = useState(false);
  const [active, setActive] = useState(true);

  useEffect(() => {
    if (sceneParam('scene') === 'fail') {
      onFail('forced by ?scene=fail');
      return;
    }
    if (sceneParam('webgl') === 'off' || !hasWebGL()) {
      onFallback();
      return;
    }
    const id = window.requestAnimationFrame(() => setWantsWebGL(true));
    return () => window.cancelAnimationFrame(id);
  }, [onFail, onFallback]);

  useEffect(() => {
    const onActive = (event: Event) => setActive((event as CustomEvent<boolean>).detail);
    window.addEventListener('jt:scene-active', onActive);
    return () => window.removeEventListener('jt:scene-active', onActive);
  }, []);

  const handleFirstFrame = useCallback(() => {
    if (sceneParam('scene') === 'stall') return;
    onReady();
  }, [onReady]);

  const handleFail = useCallback(
    (reason: string) => {
      console.warn('Opening scene unavailable, keeping the static composition.', reason);
      onFail(reason);
    },
    [onFail],
  );

  const renderState = status === 'ready' ? 'ready' : status === 'failed' ? 'failed' : 'fallback';
  const showCanvas = wantsWebGL && status !== 'failed';

  return (
    <div
      className="scene"
      data-testid="scene"
      data-render-state={renderState}
      data-active={active ? 'true' : 'false'}
      aria-hidden="true"
    >
      <div className="scene__fallback">
        <SceneFallback compact={compact} />
      </div>
      {showCanvas ? (
        <div className="scene__webgl" data-testid="scene-webgl">
          <SceneErrorBoundary onFail={handleFail}>
            <Suspense fallback={null}>
              <OpeningScene onFirstFrame={handleFirstFrame} onFail={handleFail} />
            </Suspense>
          </SceneErrorBoundary>
        </div>
      ) : null}
    </div>
  );
}
