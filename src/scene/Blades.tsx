import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Color, InstancedMesh, MeshStandardMaterial, Object3D, Vector3 } from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { ProjectId } from '../content/types';
import { bladeCount, createField, createSample, sampleBlade, type Field } from './bladeField';
import { motion } from './motion';

/** Pointer response: damped spring per blade coupled to its neighbours. */
const SPRING = 70;
const DIFFUSION = 55;
const DAMPING = 9;
const POINTER_SIGMA = 0.17;
const MAX_ROLL = 0.3;
const MAX_PUSH = 0.12;
const SUBSTEPS = 2;

interface Modulation {
  u: number;
  roll: number;
  push: number;
}

/** Per-project modulation along the sweep. Small and subordinate by design. */
function modulate(focus: ProjectId, i: number, u: number, t: number, out: Modulation): void {
  out.u = 0;
  out.roll = 0;
  out.push = 0;
  switch (focus) {
    case 'animalabs': {
      // One correlated wave travelling along the sweep.
      const phase = u * 3 - t * 0.45;
      out.roll = 0.11 * Math.sin(phase * Math.PI * 2);
      out.push = 0.05 * Math.sin(phase * Math.PI * 2 + 0.6);
      return;
    }
    case 'opencraft': {
      // Four offset bands that drift into phase and out again.
      const band = Math.floor(u * 4);
      const sync = 0.5 + 0.5 * Math.sin(t * 0.35);
      const offset = (band / 4) * Math.PI * 2 * (1 - sync);
      out.roll = 0.09 * Math.sin(u * Math.PI * 4 + offset + t * 0.6);
      return;
    }
    case 'diffex': {
      // Irregular spacing settling into order over the first seconds of focus.
      const settle = Math.min(1, t / 2.4);
      const hash = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
      const noise = hash - Math.floor(hash) - 0.5;
      out.u = 0.006 * noise * (1 - settle);
      out.roll = 0.05 * noise * (1 - settle);
      return;
    }
    case 'judi': {
      // Spacing redistributes while both ends stay fixed.
      out.u = 0.012 * Math.sin(u * Math.PI) * Math.sin(t * 0.7 + u * 2);
      return;
    }
    case 'rtx': {
      out.roll = 0.05 * Math.sin(u * Math.PI) * Math.sin(t * 0.8);
      return;
    }
    case 'uplate': {
      out.push = 0.035 * Math.sin(u * Math.PI * 2 - t * 0.5);
      return;
    }
  }
}

interface FrameState {
  dummy: Object3D;
  projected: Vector3;
  sample: ReturnType<typeof createSample>;
  mod: Modulation;
  excite: Float32Array;
  velocity: Float32Array;
  target: Float32Array;
  reveal: number;
  fold: number;
  focusAmount: number;
  focusTime: number;
  focusMode: ProjectId | null;
  appliedFold: number;
  appliedStatic: boolean;
}

function createFrameState(count: number): FrameState {
  return {
    dummy: new Object3D(),
    projected: new Vector3(),
    sample: createSample(),
    mod: { u: 0, roll: 0, push: 0 },
    excite: new Float32Array(count),
    velocity: new Float32Array(count),
    target: new Float32Array(count),
    reveal: motion.reveal,
    fold: motion.fold,
    focusAmount: 0,
    focusTime: 0,
    focusMode: null,
    appliedFold: -1,
    appliedStatic: false,
  };
}

function ease(current: number, target: number, rate: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-rate * dt));
}

export function Blades() {
  const size = useThree((s) => s.size);
  const camera = useThree((s) => s.camera);
  const compact = size.width < 768;
  const count = bladeCount(compact);
  const field: Field = useMemo(() => createField({ count, compact }), [count, compact]);

  const geometry = useMemo(
    () => new RoundedBoxGeometry(field.blade.width, 1, field.blade.depth, 4, field.blade.radius),
    [field],
  );
  const material = useMemo(
    () =>
      new MeshStandardMaterial({
        color: new Color('#2a2d33'),
        metalness: 1,
        roughness: 0.3,
        envMapIntensity: 1.3,
        flatShading: false,
      }),
    [],
  );
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);

  const meshRef = useRef<InstancedMesh>(null);
  // Mutable per-frame state lives in a ref (created in an effect) so nothing
  // React hands out is ever mutated.
  const stateRef = useRef<FrameState | null>(null);
  useEffect(() => {
    stateRef.current = createFrameState(count);
    return () => {
      stateRef.current = null;
    };
  }, [count]);

  const write = (state: FrameState, reveal: number, fold: number, pointer: boolean, aspect: number) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const { dummy, sample, mod, excite } = state;
    for (let i = 0; i < count; i++) {
      let uOffset = 0;
      let rollOffset = 0;
      let normalOffset = 0;
      if (pointer) {
        rollOffset = excite[i] * MAX_ROLL;
        normalOffset = excite[i] * MAX_PUSH;
      }
      if (state.focusAmount > 0.001 && state.focusMode) {
        modulate(state.focusMode, i, field.u[i], state.focusTime, mod);
        uOffset += mod.u * state.focusAmount;
        rollOffset += mod.roll * state.focusAmount;
        normalOffset += mod.push * state.focusAmount;
      }
      sampleBlade(field, i, { reveal, fold, uOffset, rollOffset, normalOffset }, sample);
      dummy.position.set(sample.position[0], sample.position[1], sample.position[2]);
      dummy.quaternion.set(sample.quaternion[0], sample.quaternion[1], sample.quaternion[2], sample.quaternion[3]);
      dummy.scale.set(sample.scale[0] / field.blade.width, sample.scale[1], sample.scale[2] / field.blade.depth);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      if (pointer && motion.pointer.active) {
        // Screen distance between the blade centre and the pointer, isotropic in pixels.
        state.projected.copy(dummy.position).project(camera);
        const dx = (state.projected.x - motion.pointer.x) * aspect;
        const dy = state.projected.y - motion.pointer.y;
        const d2 = dx * dx + dy * dy;
        state.target[i] = Math.exp(-d2 / (2 * POINTER_SIGMA * POINTER_SIGMA));
      } else {
        state.target[i] = 0;
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
  };

  const step = (state: FrameState, dt: number) => {
    const { excite, velocity, target } = state;
    const h = dt / SUBSTEPS;
    for (let s = 0; s < SUBSTEPS; s++) {
      for (let i = 0; i < count; i++) {
        const left = i > 0 ? excite[i - 1] : excite[i];
        const right = i < count - 1 ? excite[i + 1] : excite[i];
        const force = SPRING * (target[i] - excite[i]) + DIFFUSION * (left + right - 2 * excite[i]) - DAMPING * velocity[i];
        velocity[i] += force * h;
      }
      for (let i = 0; i < count; i++) excite[i] += velocity[i] * h;
    }
  };

  useFrame((_, delta) => {
    const state = stateRef.current;
    if (!motion.active || !state) return;
    const aspect = size.width / size.height;
    if (motion.reducedMotion) {
      // Static pose: reveal 1, fold straight from the store, no easing, no pointer.
      if (state.appliedStatic && state.appliedFold === motion.fold) return;
      state.appliedStatic = true;
      state.appliedFold = motion.fold;
      state.focusAmount = 0;
      write(state, 1, motion.fold, false, aspect);
      return;
    }
    const dt = Math.min(delta, 1 / 30);
    state.reveal = ease(state.reveal, motion.reveal, 16, dt);
    state.fold = ease(state.fold, motion.fold, 12, dt);
    const focused = motion.focus !== null;
    if (focused && motion.focus !== state.focusMode) {
      state.focusMode = motion.focus;
      state.focusTime = 0;
    }
    state.focusAmount = ease(state.focusAmount, focused ? 1 : 0, 3, dt);
    if (state.focusAmount > 0.001) state.focusTime += dt;
    step(state, dt);
    write(state, state.reveal, state.fold, true, aspect);
  });

  return (
    <instancedMesh ref={meshRef} args={[geometry, material, count]} frustumCulled={false} />
  );
}
