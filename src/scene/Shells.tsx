import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import type { Group, Mesh } from 'three';
import { FORM, buildShell, groupPose, layoutFor, lowerPose, type Pose, type PoseParams } from './shell';
import { createShellGeometry, createShellMaterial } from './shellMesh';
import { motion } from './motion';

interface FrameState {
  group: Pose;
  lower: Pose;
  params: PoseParams;
  pointer: { x: number; y: number };
  fold: number;
  reveal: number;
  seenVersion: number;
  seenReveal: number;
  /** True when every eased value has reached its target, so no frame is owed. */
  settled: boolean;
  primed: boolean;
}

function freshPose(): Pose {
  return { position: [0, 0, 0], rotation: [0, 0, 0], scale: 1 };
}

function ease(current: number, target: number, rate: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-rate * dt));
}

function close(a: number, b: number, epsilon: number): boolean {
  return Math.abs(a - b) < epsilon;
}

/**
 * The two shells. Every frame reads the motion store, eases the scroll fold,
 * the loader reveal, and the pointer toward their targets, and writes rigid
 * poses to the group and the lower shell. Rendering is on demand: a frame is
 * requested whenever the store changes or an eased value is still moving,
 * and nothing is requested once everything has settled, the opening is
 * covered, or the document is hidden. Under reduced motion the poses are
 * written straight from the store with no easing and no pointer.
 */
export function Shells() {
  const size = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);
  const compact = size.width < 768;
  const layout = useMemo(() => layoutFor(compact), [compact]);

  const upper = useMemo(() => createShellGeometry(buildShell(FORM, 'upper', 'full', layout.gap)), [layout]);
  const lower = useMemo(() => createShellGeometry(buildShell(FORM, 'lower', 'full', layout.gap)), [layout]);
  const material = useMemo(() => createShellMaterial(), []);
  useEffect(() => () => upper.dispose(), [upper]);
  useEffect(() => () => lower.dispose(), [lower]);
  useEffect(() => () => material.dispose(), [material]);

  const groupRef = useRef<Group>(null);
  const lowerRef = useRef<Mesh>(null);
  const stateRef = useRef<FrameState | null>(null);
  useEffect(() => {
    stateRef.current = {
      group: freshPose(),
      lower: freshPose(),
      params: { reveal: 1, fold: 0, pointerX: 0, pointerY: 0 },
      pointer: { x: 0, y: 0 },
      fold: motion.fold,
      reveal: motion.reveal,
      seenVersion: -1,
      seenReveal: NaN,
      settled: false,
      primed: false,
    };
    return () => {
      stateRef.current = null;
    };
  }, [layout]);

  // Wake the demand renderer when the store changes or a value is still easing.
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const state = stateRef.current;
      if (state && motion.active) {
        if (motion.version !== state.seenVersion || motion.reveal !== state.seenReveal || !state.settled) {
          state.seenVersion = motion.version;
          state.seenReveal = motion.reveal;
          invalidate();
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [invalidate]);

  useFrame((_, delta) => {
    const state = stateRef.current;
    const group = groupRef.current;
    const lowerMesh = lowerRef.current;
    if (!state || !group || !lowerMesh || !motion.active) return;
    const dt = Math.min(delta, 1 / 30);
    const reduced = motion.reducedMotion;
    const pointerX = !reduced && motion.pointer.active ? motion.pointer.x : 0;
    const pointerY = !reduced && motion.pointer.active ? motion.pointer.y : 0;
    const targetReveal = reduced ? 1 : motion.reveal;
    if (reduced || !state.primed) {
      state.pointer.x = pointerX;
      state.pointer.y = pointerY;
      state.fold = motion.fold;
      state.reveal = targetReveal;
      state.primed = true;
    } else {
      state.pointer.x = ease(state.pointer.x, pointerX, 5, dt);
      state.pointer.y = ease(state.pointer.y, pointerY, 5, dt);
      state.fold = ease(state.fold, motion.fold, 22, dt);
      state.reveal = targetReveal;
    }
    state.settled =
      close(state.pointer.x, pointerX, 0.002) && close(state.pointer.y, pointerY, 0.002) && close(state.fold, motion.fold, 0.001);
    if (state.settled) {
      state.pointer.x = pointerX;
      state.pointer.y = pointerY;
      state.fold = motion.fold;
    }

    const params = state.params;
    params.reveal = state.reveal;
    params.fold = state.fold;
    params.pointerX = state.pointer.x;
    params.pointerY = state.pointer.y;
    groupPose(layout, size, params, state.group);
    lowerPose(layout, FORM, params, state.lower);
    group.position.set(state.group.position[0], state.group.position[1], state.group.position[2]);
    group.rotation.set(state.group.rotation[0], state.group.rotation[1], state.group.rotation[2]);
    group.scale.setScalar(state.group.scale);
    lowerMesh.position.set(state.lower.position[0], state.lower.position[1], state.lower.position[2]);
    lowerMesh.rotation.set(state.lower.rotation[0], state.lower.rotation[1], state.lower.rotation[2]);
  });

  return (
    <group ref={groupRef}>
      <mesh geometry={upper} material={material} frustumCulled={false} />
      <mesh ref={lowerRef} geometry={lower} material={material} frustumCulled={false} />
    </group>
  );
}
