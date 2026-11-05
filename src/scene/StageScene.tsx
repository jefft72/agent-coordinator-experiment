import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ACESFilmicToneMapping, InstancedMesh, Object3D, PerspectiveCamera, SRGBColorSpace } from 'three';
import type { ProjectId } from '../content/types';
import { STAGE_CAMERA, bladeCount, createField, createSample, sampleBlade } from './bladeField';
import { createBladeGeometry, createBladeMaterial } from './bladeMesh';
import { createEnvironment } from './environment';
import { pattern, type Modulation } from './modulation';

export interface StageSceneProps {
  project: ProjectId;
  /** 0..1 through the project's pattern. */
  phase: number;
  /** False shows the composed rest pose; true applies the pattern at `phase`. */
  engaged: boolean;
  /** Apply changes immediately instead of easing the pattern in and out. */
  reduced: boolean;
  onFail: (reason: string) => void;
}

interface Live {
  project: ProjectId;
  phase: number;
  engaged: boolean;
  reduced: boolean;
  amount: number;
  written: string;
}

/** Rate at which the pattern eases in and out, per second. */
const EASE = 5;

function StageContent({ project, phase, engaged, reduced, onFail }: StageSceneProps) {
  const get = useThree((s) => s.get);
  const invalidate = useThree((s) => s.invalidate);
  // The stage always shows the desktop field: one object, framed close on its crest.
  const field = useMemo(() => createField({ count: bladeCount(false), compact: false }), []);
  const geometry = useMemo(() => createBladeGeometry(field), [field]);
  const material = useMemo(() => createBladeMaterial(), []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);

  const meshRef = useRef<InstancedMesh>(null);
  const live = useRef<Live>({ project, phase, engaged, reduced, amount: engaged && reduced ? 1 : 0, written: '' });
  const scratch = useRef({ dummy: new Object3D(), sample: createSample(), mod: { u: 0, roll: 0, push: 0 } as Modulation });

  useEffect(() => {
    const l = live.current;
    l.project = project;
    l.phase = phase;
    l.engaged = engaged;
    l.reduced = reduced;
    invalidate();
  }, [project, phase, engaged, reduced, invalidate]);

  useEffect(() => {
    const { gl, scene, camera } = get();
    const env = createEnvironment(gl);
    scene.environment = env.texture;
    if (camera instanceof PerspectiveCamera) {
      camera.fov = STAGE_CAMERA.fov;
      camera.near = 0.5;
      camera.far = 80;
      camera.position.set(STAGE_CAMERA.position[0], STAGE_CAMERA.position[1], STAGE_CAMERA.position[2]);
      camera.lookAt(STAGE_CAMERA.target[0], STAGE_CAMERA.target[1], STAGE_CAMERA.target[2]);
      camera.updateProjectionMatrix();
    }
    invalidate();
    return () => {
      if (scene.environment === env.texture) scene.environment = null;
      env.dispose();
    };
  }, [get, invalidate]);

  useEffect(() => {
    const canvas = get().gl.domElement;
    const lost = () => onFail('webgl context lost');
    canvas.addEventListener('webglcontextlost', lost);
    return () => canvas.removeEventListener('webglcontextlost', lost);
  }, [get, onFail]);

  useFrame((_, delta) => {
    const mesh = meshRef.current;
    const l = live.current;
    if (!mesh) return;
    const target = l.engaged ? 1 : 0;
    if (l.reduced) {
      l.amount = target;
    } else {
      l.amount += (target - l.amount) * (1 - Math.exp(-EASE * Math.min(delta, 1 / 30)));
      if (Math.abs(l.amount - target) < 0.002) l.amount = target;
      else invalidate();
    }
    const key = `${l.project}:${l.phase.toFixed(4)}:${l.amount.toFixed(4)}`;
    if (key === l.written) return;
    l.written = key;
    const { dummy, sample, mod } = scratch.current;
    for (let i = 0; i < field.count; i++) {
      pattern(l.project, i, field.u[i], l.phase, mod);
      sampleBlade(
        field,
        i,
        { reveal: 1, fold: 0, uOffset: mod.u * l.amount, rollOffset: mod.roll * l.amount, normalOffset: mod.push * l.amount },
        sample,
      );
      dummy.position.set(sample.position[0], sample.position[1], sample.position[2]);
      dummy.quaternion.set(sample.quaternion[0], sample.quaternion[1], sample.quaternion[2], sample.quaternion[3]);
      dummy.scale.set(sample.scale[0] / field.blade.width, sample.scale[1], sample.scale[2] / field.blade.depth);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  return <instancedMesh ref={meshRef} args={[geometry, material, field.count]} frustumCulled={false} />;
}

/**
 * The project stage: the opening's blade field, material, and environment,
 * framed close on the crest, deformed by the project's pattern at the phase
 * the controls choose. Renders on demand only; the drawing buffer is kept so
 * the picture can be read back.
 */
export default function StageScene(props: StageSceneProps) {
  return (
    <Canvas
      dpr={[1, 1.75]}
      frameloop="demand"
      shadows={false}
      gl={{
        antialias: true,
        alpha: true,
        preserveDrawingBuffer: true,
        powerPreference: 'high-performance',
        toneMapping: ACESFilmicToneMapping,
        toneMappingExposure: 1.0,
        outputColorSpace: SRGBColorSpace,
      }}
      camera={{ fov: STAGE_CAMERA.fov, near: 0.5, far: 80, position: STAGE_CAMERA.position }}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }}
    >
      <StageContent {...props} />
    </Canvas>
  );
}
