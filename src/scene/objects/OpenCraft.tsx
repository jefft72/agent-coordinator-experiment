import { useLayoutEffect, useMemo, useRef } from 'react';
import { BoxGeometry, Color, DoubleSide, InstancedMesh, Matrix4, MeshStandardMaterial } from 'three';
import { SCENE_COLORS, type ArtifactProps } from '../contract';
import { images } from '../../content/work';
import { ImageBoard } from './ImageBoard';
import { seededRandom } from './textures';

const S = 0.28;
const COLS = 7; // along x
const ROWS = 5; // along z, index 0 is the back row (toward the board)
const SLAB_LAYERS = 2;
/** Inclusive voxel index range of the 3 x 2 excavation. */
const POCKET = { x0: 3, x1: 5, z0: 1, z1: 2 };

/** Extra voxels on the slab at two corners: [x, z, layer]. Layers 2..4 sit above the slab. */
const STACKS: Array<[number, number, number]> = [
  [0, 4, 2],
  [0, 4, 3],
  [0, 4, 4],
  [1, 4, 2],
  [0, 3, 2],
  [6, 3, 2],
  [6, 3, 3],
  [6, 4, 2],
];

interface Voxel {
  x: number;
  y: number;
  z: number;
  color: Color;
}

const inPocket = (x: number, z: number) =>
  x >= POCKET.x0 && x <= POCKET.x1 && z >= POCKET.z0 && z <= POCKET.z1;
const ringsPocket = (x: number, z: number) =>
  !inPocket(x, z) && x >= POCKET.x0 - 1 && x <= POCKET.x1 + 1 && z >= POCKET.z0 - 1 && z <= POCKET.z1 + 1;

function buildVoxels(): Voxel[] {
  const rand = seededRandom(1402);
  const green = new Color(SCENE_COLORS.green);
  const greenDeep = new Color(SCENE_COLORS.greenDeep);
  const greenLight = new Color(SCENE_COLORS.greenLight);
  const soil = new Color(SCENE_COLORS.soil);

  const greenAt = () => {
    const t = rand();
    const target = t < 0.5 ? greenDeep : greenLight;
    return green.clone().lerp(target, Math.abs(t - 0.5) * 1.3);
  };
  const soilAt = () => soil.clone().lerp(new Color(SCENE_COLORS.ink), rand() * 0.18);

  const voxels: Voxel[] = [];
  for (let y = 0; y < SLAB_LAYERS; y += 1) {
    for (let x = 0; x < COLS; x += 1) {
      for (let z = 0; z < ROWS; z += 1) {
        if (inPocket(x, z)) continue;
        voxels.push({ x, y, z, color: ringsPocket(x, z) ? soilAt() : greenAt() });
      }
    }
  }
  for (const [x, z, y] of STACKS) voxels.push({ x, y, z, color: greenAt() });
  return voxels;
}

const cx = (x: number) => (x - (COLS - 1) / 2) * S;
const cz = (z: number) => (z - (ROWS - 1) / 2) * S;
const cy = (y: number) => (y + 0.5) * S;

/**
 * OpenCraft: a miniature voxel dig site. Oxidized-green slab with a soil-walled
 * excavation, irregular stacks at two corners, a work marker, and the demo frame
 * on a board standing at the back. Local origin is on the floor.
 */
// Props are reserved for the placement agent (dimming and lift happen there).
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function OpenCraft(_props: ArtifactProps) {
  const voxels = useMemo(() => buildVoxels(), []);
  const geometry = useMemo(() => new BoxGeometry(S, S, S), []);
  const voxelMaterial = useMemo(() => new MeshStandardMaterial({ color: '#ffffff', roughness: 0.85, metalness: 0 }), []);
  const soilMaterial = useMemo(() => new MeshStandardMaterial({ color: SCENE_COLORS.soil, roughness: 0.95 }), []);
  const inkMaterial = useMemo(() => new MeshStandardMaterial({ color: SCENE_COLORS.ink, roughness: 0.45, metalness: 0.2 }), []);
  const flagMaterial = useMemo(
    () => new MeshStandardMaterial({ color: SCENE_COLORS.silver, roughness: 0.6, side: DoubleSide }),
    [],
  );
  const instanced = useRef<InstancedMesh>(null);

  useLayoutEffect(() => {
    const mesh = instanced.current;
    if (!mesh) return;
    const matrix = new Matrix4();
    voxels.forEach((v, i) => {
      matrix.makeTranslation(cx(v.x), cy(v.y), cz(v.z));
      mesh.setMatrixAt(i, matrix);
      mesh.setColorAt(i, v.color);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [voxels]);

  const slabTop = SLAB_LAYERS * S;
  const pocketCenterX = cx((POCKET.x0 + POCKET.x1) / 2);
  const pocketCenterZ = cz((POCKET.z0 + POCKET.z1) / 2);
  const postX = cx(POCKET.x0 - 1);
  const postZ = cz(POCKET.z1) + 0.09;

  return (
    <group>
      <instancedMesh
        ref={instanced}
        args={[geometry, voxelMaterial, voxels.length]}
        castShadow
        receiveShadow
      />

      {/* Dirt floor of the excavation. */}
      <mesh
        material={soilMaterial}
        position={[pocketCenterX, 0.01, pocketCenterZ]}
        receiveShadow
        castShadow
      >
        <boxGeometry args={[(POCKET.x1 - POCKET.x0 + 1) * S, 0.02, (POCKET.z1 - POCKET.z0 + 1) * S]} />
      </mesh>

      {/* Work marker post with a small flag at the pocket edge. */}
      <mesh material={inkMaterial} position={[postX, slabTop + 0.3, postZ]} castShadow receiveShadow>
        <cylinderGeometry args={[0.015, 0.015, 0.6, 10]} />
      </mesh>
      <mesh
        material={flagMaterial}
        position={[postX + 0.095, slabTop + 0.53, postZ]}
        rotation={[0, 0.25, 0]}
        castShadow
        receiveShadow
      >
        <planeGeometry args={[0.17, 0.1]} />
      </mesh>

      {/* Photo board standing at the back of the site. */}
      <group position={[0, 0, cz(0) - S / 2 - 0.06]} rotation={[-0.05, 0, 0]}>
        <group position={[0, 0.535, 0]}>
          <ImageBoard src={images.opencraft} width={1.9} height={1.07} depth={0.03} />
        </group>
      </group>
    </group>
  );
}
