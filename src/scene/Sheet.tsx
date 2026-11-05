import { Component, Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import type { ProjectId } from '../content/work';
import { POSES, type SceneProps } from './contract';
import { CameraRig } from './CameraRig';
import { Lighting } from './Lighting';
import { Placed } from './Placed';
import { AnimaLabs } from './objects/AnimaLabs';
import { Diffex } from './objects/Diffex';
import { Judi } from './objects/Judi';
import { OpenCraft } from './objects/OpenCraft';
import { Rtx } from './objects/Rtx';
import { UPlate } from './objects/UPlate';

const OBJECTS: Record<ProjectId, (props: { selected: boolean; dimmed: boolean; reducedMotion: boolean }) => ReactNode> = {
  opencraft: OpenCraft,
  animalabs: AnimaLabs,
  diffex: Diffex,
  judi: Judi,
  rtx: Rtx,
  uplate: UPlate,
};

const ORDER: ProjectId[] = ['opencraft', 'animalabs', 'diffex', 'judi', 'rtx', 'uplate'];

function probeWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    return context !== null;
  } catch {
    return false;
  }
}

interface BoundaryProps {
  onFail: (reason: string) => void;
  children: ReactNode;
}

class SceneErrorBoundary extends Component<BoundaryProps, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    this.props.onFail(`scene error: ${message}`);
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/** Fires onReady once after the first frame that includes the objects has been presented. */
function ReadyProbe({ onReady }: { onReady: () => void }) {
  const fired = useRef(false);
  useFrame(() => {
    if (fired.current) return;
    fired.current = true;
    requestAnimationFrame(() => onReady());
  });
  return null;
}

/** Under frameloop="demand" a prop change has to request a frame. */
function Invalidator({ selected, compact }: { selected: ProjectId | null; compact: boolean }) {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    invalidate();
  }, [selected, compact, invalidate]);
  return null;
}

export default function Sheet(props: SceneProps) {
  const { selected, compact, reducedMotion, onReady, onFail } = props;
  const [supported] = useState(probeWebGL);

  useEffect(() => {
    if (!supported) onFail('webgl unavailable');
  }, [supported, onFail]);

  if (!supported) return null;

  return (
    <SceneErrorBoundary onFail={onFail}>
      <Canvas
        gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
        dpr={[1, 2]}
        shadows
        frameloop={reducedMotion ? 'demand' : 'always'}
        camera={{ fov: 26, near: 0.1, far: 60, position: POSES.rest.camera }}
        style={{ width: '100%', height: '100%' }}
        onCreated={({ gl }) => {
          gl.setClearColor(0x000000, 0);
          gl.domElement.addEventListener('webglcontextlost', (event) => {
            event.preventDefault();
            onFail('webgl context lost');
          });
        }}
      >
        <Lighting reducedMotion={reducedMotion} />
        <CameraRig selected={selected} compact={compact} reducedMotion={reducedMotion} />
        <Invalidator selected={selected} compact={compact} />
        <Suspense fallback={null}>
          {ORDER.map((id) => {
            const Artifact = OBJECTS[id];
            return (
              <Placed key={id} id={id} compact={compact} selected={selected === id} reducedMotion={reducedMotion}>
                <Artifact
                  selected={selected === id}
                  dimmed={selected !== null && selected !== id}
                  reducedMotion={reducedMotion}
                />
              </Placed>
            );
          })}
          <ReadyProbe onReady={onReady} />
        </Suspense>
      </Canvas>
    </SceneErrorBoundary>
  );
}
