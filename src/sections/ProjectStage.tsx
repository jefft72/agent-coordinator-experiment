import { Suspense, lazy, useCallback, useEffect, useId, useRef, useState } from 'react';
import type { Project } from '../content/types';
import { useDocumentVisible } from '../lib/useDocumentVisible';
import { useReducedMotion } from '../lib/useReducedMotion';
import { webglAvailable } from '../lib/webgl';
import { SceneErrorBoundary } from '../scene/SceneErrorBoundary';
import { StageFallback } from '../scene/StageFallback';
import { PATTERNS } from '../scene/modulation';
import './sections.css';

const StageScene = lazy(() => import('../scene/StageScene'));

type Mode = 'rest' | 'playing' | 'paused';

export interface ProjectStageProps {
  project: Project;
  /** Compact layouts collapse the stage behind an explicit control. */
  compact: boolean;
}

/**
 * The project stage inside the details dialog: the opening's folded surface,
 * framed on its crest, performing this project's pattern. Replay runs the
 * pattern from its start, the phase slider holds any instant of it for
 * inspection, and Reset returns to the composed rest pose. Under reduced
 * motion, or without WebGL, every control applies its phase immediately
 * instead of animating, and Replay shows the pattern's end state. The
 * timeline only advances while the stage is expanded and the document is
 * visible: a collapsed phone stage begins when it is opened, and a run
 * interrupted by a hidden tab keeps its phase and resumes when shown.
 */
export function ProjectStage({ project, compact }: ProjectStageProps) {
  const reduced = useReducedMotion();
  const documentVisible = useDocumentVisible();
  const [webgl] = useState(() => webglAvailable());
  const [failed, setFailed] = useState(false);
  const immediate = reduced || !webgl || failed;
  const [open, setOpen] = useState(!compact);
  const visible = open && documentVisible;
  const [phase, setPhase] = useState(() => (immediate ? 1 : 0));
  const [mode, setMode] = useState<Mode>(() => (immediate ? 'paused' : 'playing'));
  const phaseRef = useRef(phase);
  const labelId = useId();
  const sliderId = useId();

  // Play: advance the phase at the pattern's own pace while the stage is
  // visible, then hold at the end. If motion must be immediate (or becomes so
  // mid-run), jump to the end state.
  useEffect(() => {
    if (mode !== 'playing' || !visible) return;
    const { duration } = PATTERNS[project.id];
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      phaseRef.current = immediate ? 1 : Math.min(1, phaseRef.current + dt / duration);
      setPhase(phaseRef.current);
      if (phaseRef.current >= 1) setMode('paused');
      else raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [mode, immediate, visible, project.id]);

  const replay = useCallback(() => {
    phaseRef.current = 0;
    setPhase(0);
    setMode('playing');
  }, []);
  const scrub = useCallback((value: number) => {
    phaseRef.current = value;
    setPhase(value);
    setMode('paused');
  }, []);
  const reset = useCallback(() => {
    phaseRef.current = 0;
    setPhase(0);
    setMode('rest');
  }, []);
  const fail = useCallback((reason: string) => {
    console.warn('Project stage unavailable, keeping the static study.', reason);
    setFailed(true);
  }, []);

  const engaged = mode !== 'rest';
  const percent = Math.round(phase * 100);

  return (
    <section
      className="stage"
      data-testid="project-stage"
      data-mode={mode}
      data-phase={phase.toFixed(2)}
      data-renderer={webgl && !failed ? 'webgl' : 'svg'}
      data-open={open ? 'true' : 'false'}
      aria-labelledby={labelId}
    >
      <p className="stage__label label" id={labelId}>
        Abstract study
      </p>
      <p className="stage__study">{project.study}</p>
      {open ? (
        <>
          <div className="stage__view" data-testid="stage-view">
            {webgl && !failed ? (
              <SceneErrorBoundary onFail={fail}>
                <Suspense fallback={<StageFallback project={project.id} phase={phase} engaged={engaged} compact={compact} />}>
                  <StageScene project={project.id} phase={phase} engaged={engaged} reduced={reduced || !documentVisible} onFail={fail} />
                </Suspense>
              </SceneErrorBoundary>
            ) : (
              <StageFallback project={project.id} phase={phase} engaged={engaged} compact={compact} />
            )}
          </div>
          <div className="stage__controls">
            <button type="button" className="details-button" data-testid="stage-replay" onClick={replay}>
              Replay
            </button>
            <label className="stage__phase" htmlFor={sliderId}>
              <span className="label">Phase</span>
              <input
                id={sliderId}
                type="range"
                min={0}
                max={100}
                step={1}
                value={percent}
                data-testid="stage-phase"
                aria-valuetext={`${percent} percent`}
                onChange={(event) => scrub(Number(event.currentTarget.value) / 100)}
              />
              <span className="stage__value" aria-hidden="true">
                {percent}%
              </span>
            </label>
            <button type="button" className="details-button" data-testid="stage-reset" onClick={reset}>
              Reset
            </button>
            {compact ? (
              <button type="button" className="details-button" data-testid="stage-close" onClick={() => setOpen(false)}>
                Hide
              </button>
            ) : null}
          </div>
        </>
      ) : (
        <button type="button" className="details-button stage__open" data-testid="stage-open" onClick={() => setOpen(true)}>
          Open the study
        </button>
      )}
    </section>
  );
}
