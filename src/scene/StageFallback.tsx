import { useMemo } from 'react';
import type { ProjectId } from '../content/types';
import { BladeSvg } from './BladeSvg';
import { STAGE_CAMERA, bladeCount, createField } from './bladeField';
import { buildFaces } from './faces';
import { pattern, type Modulation } from './modulation';

export interface StageFallbackProps {
  project: ProjectId;
  phase: number;
  engaged: boolean;
  compact: boolean;
}

/**
 * The stage without WebGL: the same field, camera, and pattern projected to
 * SVG. Every change of phase is immediate, which is also the reduced-motion
 * contract, so the controls work identically here.
 */
export function StageFallback({ project, phase, engaged, compact }: StageFallbackProps) {
  const viewW = compact ? 350 : 664;
  const viewH = compact ? 240 : 400;
  const faces = useMemo(() => {
    const field = createField({ count: bladeCount(false), compact: false });
    const mod: Modulation = { u: 0, roll: 0, push: 0 };
    const amount = engaged ? 1 : 0;
    return buildFaces(field, STAGE_CAMERA, viewW, viewH, (i) => {
      pattern(project, i, field.u[i], phase, mod);
      return { reveal: 1, fold: 0, uOffset: mod.u * amount, rollOffset: mod.roll * amount, normalOffset: mod.push * amount };
    });
  }, [project, phase, engaged, viewW, viewH]);
  return <BladeSvg faces={faces} viewW={viewW} viewH={viewH} fine={compact} className="stage__svg" testId="stage-fallback" />;
}
