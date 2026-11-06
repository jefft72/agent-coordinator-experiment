import { useEffect, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ACESFilmicToneMapping, PerspectiveCamera, SRGBColorSpace } from 'three';
import { Shells } from './Shells';
import { layoutFor } from './shell';
import { createEnvironment } from './environment';

export interface OpeningSceneProps {
  /** Called exactly once after the first frame rendered with the environment in place. */
  onFirstFrame: () => void;
  /** Called when the WebGL context cannot be created, throws, or is lost. */
  onFail: (reason: string) => void;
}

function SceneContent({ onFirstFrame, onFail }: OpeningSceneProps) {
  const get = useThree((s) => s.get);
  const size = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);
  const compact = size.width < 768;

  const refs = useRef({ envFrame: -1, firstFrameSent: false, onFirstFrame });
  useEffect(() => {
    refs.current.onFirstFrame = onFirstFrame;
  }, [onFirstFrame]);

  // Environment: authored light shapes, applied to the scene (never the background).
  useEffect(() => {
    const { gl, scene } = get();
    const env = createEnvironment(gl);
    scene.environment = env.texture;
    refs.current.envFrame = gl.info.render.frame;
    invalidate();
    return () => {
      if (scene.environment === env.texture) scene.environment = null;
      env.dispose();
    };
  }, [get, invalidate]);

  // Context loss is a failure for the page: the lead swaps in the fallback.
  useEffect(() => {
    const canvas = get().gl.domElement;
    const lost = () => onFail('webgl context lost');
    canvas.addEventListener('webglcontextlost', lost);
    return () => canvas.removeEventListener('webglcontextlost', lost);
  }, [get, onFail]);

  // The camera sits at the origin looking down -z; the shells are posed in
  // front of it, so only the field of view changes per layout.
  useEffect(() => {
    const { camera } = get();
    if (camera instanceof PerspectiveCamera) {
      camera.position.set(0, 0, 0);
      camera.rotation.set(0, 0, 0);
      camera.fov = layoutFor(compact).fov;
      camera.near = 0.5;
      camera.far = 60;
      camera.updateProjectionMatrix();
    }
    invalidate();
  }, [get, compact, invalidate]);

  useFrame((state) => {
    const r = refs.current;
    if (!r.firstFrameSent && r.envFrame >= 0 && state.gl.info.render.frame > r.envFrame) {
      r.firstFrameSent = true;
      r.onFirstFrame();
    }
  });

  return <Shells />;
}

/** The error boundary sits above the lazy import in SceneHost, so a failed chunk or render is caught there. */
export default function OpeningScene({ onFirstFrame, onFail }: OpeningSceneProps) {
  return (
    <Canvas
      dpr={[1, 1.75]}
      frameloop="demand"
      shadows={false}
      flat={false}
      gl={{
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
        toneMapping: ACESFilmicToneMapping,
        toneMappingExposure: 1.0,
        outputColorSpace: SRGBColorSpace,
      }}
      camera={{ fov: 32, near: 0.5, far: 60, position: [0, 0, 0] }}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }}
    >
      <SceneContent onFirstFrame={onFirstFrame} onFail={onFail} />
    </Canvas>
  );
}
