import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3 } from 'three';
import type { ProjectId } from '../content/work';
import { COMPACT_POSES, POSES, type Pose } from './contract';
import { EASE_MS, easeOutCubic } from './ease';

interface CameraRigProps {
  selected: ProjectId | null;
  compact: boolean;
  reducedMotion: boolean;
}

function poseFor(selected: ProjectId | null, compact: boolean): Pose {
  return (compact ? COMPACT_POSES : POSES)[selected ?? 'rest'];
}

/**
 * One deliberate ease (cubic ease-out, ~900ms) from the current camera pose to the
 * pose for the selection. No orbit, no idle motion. Snaps under reducedMotion.
 */
export function CameraRig({ selected, compact, reducedMotion }: CameraRigProps) {
  const camera = useThree((s) => s.camera);
  const invalidate = useThree((s) => s.invalidate);
  const anim = useRef({
    fromPos: new Vector3(),
    fromTarget: new Vector3(),
    toPos: new Vector3(),
    toTarget: new Vector3(),
    pos: new Vector3(...POSES.rest.camera),
    target: new Vector3(...POSES.rest.target),
    start: -1,
    initialised: false,
  });

  useEffect(() => {
    const state = anim.current;
    const pose = poseFor(selected, compact);
    state.toPos.set(...pose.camera);
    state.toTarget.set(...pose.target);
    if (reducedMotion || !state.initialised) {
      state.initialised = true;
      state.pos.copy(state.toPos);
      state.target.copy(state.toTarget);
      state.start = -1;
      camera.position.copy(state.pos);
      camera.lookAt(state.target);
    } else {
      state.fromPos.copy(state.pos);
      state.fromTarget.copy(state.target);
      state.start = performance.now();
    }
    invalidate();
  }, [selected, compact, reducedMotion, camera, invalidate]);

  useFrame(() => {
    const state = anim.current;
    if (state.start < 0) return;
    const e = easeOutCubic((performance.now() - state.start) / EASE_MS);
    state.pos.lerpVectors(state.fromPos, state.toPos, e);
    state.target.lerpVectors(state.fromTarget, state.toTarget, e);
    camera.position.copy(state.pos);
    camera.lookAt(state.target);
    if (e >= 1) state.start = -1;
    else invalidate();
  });

  return null;
}
