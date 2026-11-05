import { useEffect, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ACESFilmicToneMapping, PerspectiveCamera, SRGBColorSpace, Vector3 } from 'three';
import { Blades } from './Blades';
import { cameraFor, type CameraPose } from './bladeField';
import { createEnvironment } from './environment';
import { motion } from './motion';

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

  const refs = useRef({
    envFrame: -1,
    firstFrameSent: false,
    pose: { position: [0, 0, 0], target: [0, 0, 0], fov: 32 } as CameraPose,
    position: new Vector3(),
    target: new Vector3(),
    primed: false,
    onFirstFrame,
  });
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

  // Field of view per layout; aspect is kept current by R3F on resize.
  useEffect(() => {
    const { camera } = get();
    if (camera instanceof PerspectiveCamera) {
      camera.fov = compact ? 40 : 32;
      camera.near = 0.5;
      camera.far = 80;
      camera.updateProjectionMatrix();
    }
    refs.current.primed = false;
    invalidate();
  }, [get, compact, invalidate]);

  // Demand loop: invalidate every animation frame while the opening is live;
  // under reduced motion, only when the scroll-driven fold changes.
  useEffect(() => {
    let raf = 0;
    let lastFold = NaN;
    let lastReveal = NaN;
    const tick = () => {
      if (motion.active && !motion.suspended) {
        if (!motion.reducedMotion) invalidate();
        else if (motion.fold !== lastFold || motion.reveal !== lastReveal) invalidate();
        lastFold = motion.fold;
        lastReveal = motion.reveal;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [invalidate]);

  useFrame((state, delta) => {
    const r = refs.current;
    const reveal = motion.reducedMotion ? 1 : motion.reveal;
    cameraFor(compact, { reveal, fold: motion.fold }, r.pose, size);
    const [px, py, pz] = r.pose.position;
    const [tx, ty, tz] = r.pose.target;
    if (!r.primed || motion.reducedMotion) {
      r.position.set(px, py, pz);
      r.target.set(tx, ty, tz);
      r.primed = true;
    } else {
      const k = 1 - Math.exp(-Math.min(delta, 1 / 30) * 14);
      r.position.x += (px - r.position.x) * k;
      r.position.y += (py - r.position.y) * k;
      r.position.z += (pz - r.position.z) * k;
      r.target.x += (tx - r.target.x) * k;
      r.target.y += (ty - r.target.y) * k;
      r.target.z += (tz - r.target.z) * k;
    }
    state.camera.position.copy(r.position);
    state.camera.lookAt(r.target);

    if (!r.firstFrameSent && r.envFrame >= 0 && state.gl.info.render.frame > r.envFrame) {
      r.firstFrameSent = true;
      r.onFirstFrame();
    }
  });

  return <Blades />;
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
        camera={{ fov: 32, near: 0.5, far: 80, position: [0, 0, 12] }}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }}
      >
        <SceneContent onFirstFrame={onFirstFrame} onFail={onFail} />
      </Canvas>
  );
}
