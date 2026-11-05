import { Component, Suspense, useRef, type ReactNode } from 'react';
import { useTexture } from '@react-three/drei';
import { Group, SRGBColorSpace, type Texture } from 'three';
import { images } from '../../content/work';
import { SCENE_COLORS, type ArtifactProps } from '../contract';
import { useDimMaterials } from '../dim';

const HEIGHT = 1.9;
const WIDTH = (HEIGHT * 1206) / 2622;
const BACKING = 0.03;
const LEAN = 0.18;
const FACE_Z = BACKING / 2 + 0.001;

/** Runs in drei's layout effect before the texture is uploaded, so the first upload is already sRGB. */
function prepareTexture(texture: Texture) {
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
}

function Screenshot() {
  const texture = useTexture(images.uplateOnboarding, prepareTexture);
  return (
    <mesh position={[0, HEIGHT / 2, FACE_Z]}>
      <planeGeometry args={[WIDTH, HEIGHT]} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  );
}

/** If the screenshot cannot load, keep the slab's silhouette with a paper face rather than failing the sheet. */
class ScreenshotBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <mesh position={[0, HEIGHT / 2, FACE_Z]}>
        <planeGeometry args={[WIDTH, HEIGHT]} />
        <meshStandardMaterial color={SCENE_COLORS.paper} roughness={0.7} metalness={0} />
      </mesh>
    );
  }
}

/** The shipped onboarding screenshot standing on the floor on a thin ink backing slab, leaning back. */
export function UPlate(props: ArtifactProps) {
  const root = useRef<Group>(null);
  useDimMaterials(root, props.dimmed, props.reducedMotion);

  return (
    <group ref={root} rotation={[-LEAN, 0, 0]}>
      <mesh position={[0, HEIGHT / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[WIDTH, HEIGHT, BACKING]} />
        <meshStandardMaterial color={SCENE_COLORS.ink} roughness={0.55} metalness={0.15} />
      </mesh>
      <ScreenshotBoundary>
        <Suspense fallback={null}>
          <Screenshot />
        </Suspense>
      </ScreenshotBoundary>
    </group>
  );
}
