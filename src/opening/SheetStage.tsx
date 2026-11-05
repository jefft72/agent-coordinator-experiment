import { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import type { ProjectId } from '../content/work';
import { useMediaQuery } from '../lib/useMediaQuery';
import { useReducedMotion } from '../lib/useReducedMotion';
import { SheetFallback } from './SheetFallback';

const Sheet = lazy(() => import('../scene/Sheet'));

type RenderState = 'fallback' | 'ready' | 'failed';

interface SheetStageProps {
  selected: ProjectId | null;
}

function webglDisabledByQuery(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('webgl') === 'off';
}

/**
 * Hosts the composition. The HTML fallback is painted first and stays until the
 * WebGL sheet reports its first frame; if WebGL is unavailable or fails the
 * fallback simply remains. Content never depends on the canvas.
 */
export function SheetStage({ selected }: SheetStageProps) {
  const reducedMotion = useReducedMotion();
  const compact = useMediaQuery('(max-width: 767px)');
  const [renderState, setRenderState] = useState<RenderState>('fallback');
  const [wantsWebGL, setWantsWebGL] = useState(false);

  useEffect(() => {
    if (webglDisabledByQuery()) return;
    const id = window.requestAnimationFrame(() => setWantsWebGL(true));
    return () => window.cancelAnimationFrame(id);
  }, []);

  const onReady = useCallback(() => setRenderState('ready'), []);
  const onFail = useCallback((reason: string) => {
    console.warn('Contact sheet: WebGL unavailable, keeping the HTML composition.', reason);
    setRenderState('failed');
  }, []);

  const showCanvas = wantsWebGL && renderState !== 'failed';

  return (
    <div
      className="sheet"
      data-testid="sheet"
      data-render-state={renderState}
      data-selected={selected ?? 'none'}
      aria-hidden="true"
    >
      {renderState !== 'ready' ? <SheetFallback selected={selected} compact={compact} /> : null}
      {showCanvas ? (
        <div className={`sheet__webgl${renderState === 'ready' ? ' is-visible' : ''}`} data-testid="sheet-webgl">
          <Suspense fallback={null}>
            <Sheet
              selected={selected}
              reducedMotion={reducedMotion}
              compact={compact}
              onReady={onReady}
              onFail={onFail}
            />
          </Suspense>
        </div>
      ) : null}
    </div>
  );
}
