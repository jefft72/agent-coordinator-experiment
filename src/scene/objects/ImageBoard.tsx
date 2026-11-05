import { Suspense, useMemo } from 'react';
import { MeshStandardMaterial, SRGBColorSpace, type Texture } from 'three';
import { useTexture } from '@react-three/drei';
import { SCENE_COLORS } from '../contract';

interface ImageBoardProps {
  src: string;
  width: number;
  height: number;
  depth: number;
}

const toSRGB = (texture: Texture) => {
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
};

/** The inset photo plane; mounted inside Suspense so the ink backing shows while loading. */
function ImageFace({ src, width, height, depth }: ImageBoardProps) {
  const texture = useTexture(src, toSRGB);
  const material = useMemo(
    () => new MeshStandardMaterial({ map: texture, roughness: 0.6, metalness: 0 }),
    [texture],
  );
  return (
    <mesh position={[0, 0, depth / 2 + 0.002]} material={material} castShadow receiveShadow>
      <planeGeometry args={[width, height]} />
    </mesh>
  );
}

/**
 * A 16:9 photo plate: ink-black backing with the untinted image inset on its
 * front face. Centered on its own origin; callers lift it by height / 2.
 */
export function ImageBoard({ src, width, height, depth }: ImageBoardProps) {
  const backing = useMemo(
    () => new MeshStandardMaterial({ color: SCENE_COLORS.ink, roughness: 0.45, metalness: 0.1 }),
    [],
  );
  const inset = 0.03;
  return (
    <group>
      <mesh material={backing} castShadow receiveShadow>
        <boxGeometry args={[width, height, depth]} />
      </mesh>
      <Suspense fallback={null}>
        <ImageFace src={src} width={width - inset * 2} height={height - inset * 2} depth={depth} />
      </Suspense>
    </group>
  );
}
