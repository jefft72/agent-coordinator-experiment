import { ContactShadows } from '@react-three/drei';
import { FLOOR_Y, SCENE_COLORS } from './contract';

interface LightingProps {
  reducedMotion: boolean;
}

/**
 * Studio lighting on a cool pale ground. There is no floor plane: the page
 * background is the ground, and ContactShadows provides the grounding.
 */
export function Lighting({ reducedMotion }: LightingProps) {
  return (
    <>
      <hemisphereLight color="#EEF2F4" groundColor="#8FA3AF" intensity={0.55} />
      <directionalLight
        position={[-4.5, 7, 6]}
        color="#FFF6EA"
        intensity={2.2}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
        shadow-radius={4}
        shadow-camera-near={1}
        shadow-camera-far={30}
        shadow-camera-left={-8}
        shadow-camera-right={8}
        shadow-camera-top={6}
        shadow-camera-bottom={-6}
      />
      <directionalLight position={[6, 3, 2]} color="#DCE8F0" intensity={0.5} />
      <ContactShadows
        position={[0, FLOOR_Y + 0.001, -0.6]}
        width={16}
        height={10}
        color={SCENE_COLORS.shadow}
        opacity={0.45}
        blur={2.4}
        far={3}
        resolution={512}
        frames={reducedMotion ? 1 : 60}
      />
    </>
  );
}
