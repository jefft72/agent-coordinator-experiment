import type { LoadSequence } from './useLoadSequence';
import './loader.css';

const PANELS = 8;

/**
 * The intro overlay: a near-black field, the name in its fixed position, a
 * visible Skip control, and one narrow pale opening across the centre that
 * resolves into aligned strips as fonts and the first scene frame arrive.
 * On reveal the panels between the strips separate along their diagonal
 * and the page underneath is exposed through the widening gaps.
 */
export function Loader({ sequence }: { sequence: LoadSequence }) {
  const { state, steps, skip } = sequence;
  if (state === 'ready' || state === 'bypassed' || state === 'failed') return null;
  const progress = (steps.fonts ? 1 : 0) + (steps.scene ? 1 : 0);

  return (
    <div
      className="intro"
      data-testid="intro"
      data-state={state}
      data-progress={progress}
      role="status"
      aria-live="polite"
      aria-label={state === 'reveal' ? 'Opening' : 'Loading'}
    >
      <div className="intro__panels" aria-hidden="true">
        {Array.from({ length: PANELS }, (_, i) => (
          <div key={i} className="intro__panel" style={{ '--i': i - (PANELS - 1) / 2, '--d': `${Math.abs(i - (PANELS - 1) / 2) * 28}ms` } as React.CSSProperties} />
        ))}
      </div>
      <span className="intro__name label">Jeffrey Tseng</span>
      <button type="button" className="intro__skip label" data-testid="skip-intro" onClick={skip}>
        Skip intro
      </button>
    </div>
  );
}
