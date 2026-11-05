import { useRef } from 'react';
import { Group } from 'three';
import { SCENE_COLORS, type ArtifactProps } from '../contract';
import { useDimMaterials } from '../dim';

const TRAY_W = 1.6;
const TRAY_H = 0.08;
const TRAY_D = 1.0;
const LIP_T = 0.05;
const LIP_H = 0.06;

const SLAB_W = 0.3;
const SLAB_H = 0.05;
const SLAB_D = 0.22;
const SLAB_GAP = 0.012;

const PITCH_X = 0.36;
const PITCH_Z = 0.29;

/** Capacity map: 0 = empty slot, 1 = one slab, 2 = stacked two high. Rows run back to front. */
const CAPACITY: number[][] = [
  [2, 1, 0, 1],
  [1, 2, 1, 0],
  [0, 1, 2, 1],
];

/** The oxidized-green slab: [row, col]. */
const GREEN_SLOT: [number, number] = [1, 2];

/** A shallow microVM placement tray: ink-black tray with a lip, thin pale-silver slabs at varied heights. */
export function Judi(props: ArtifactProps) {
  const root = useRef<Group>(null);
  useDimMaterials(root, props.dimmed, props.reducedMotion);

  const slabs: { key: string; position: [number, number, number]; color: string }[] = [];
  CAPACITY.forEach((row, r) => {
    row.forEach((count, c) => {
      const x = (c - 1.5) * PITCH_X;
      const z = (r - 1) * PITCH_Z;
      for (let level = 0; level < count; level += 1) {
        const y = TRAY_H + SLAB_H / 2 + level * (SLAB_H + SLAB_GAP);
        const isGreen = r === GREEN_SLOT[0] && c === GREEN_SLOT[1] && level === count - 1;
        slabs.push({
          key: `${r}-${c}-${level}`,
          position: [x, y, z],
          color: isGreen ? SCENE_COLORS.green : level === 0 ? SCENE_COLORS.silver : SCENE_COLORS.paper,
        });
      }
    });
  });

  const lipY = TRAY_H + LIP_H / 2;
  const lips: { key: string; position: [number, number, number]; size: [number, number, number] }[] = [
    { key: 'back', position: [0, lipY, -TRAY_D / 2 + LIP_T / 2], size: [TRAY_W, LIP_H, LIP_T] },
    { key: 'front', position: [0, lipY, TRAY_D / 2 - LIP_T / 2], size: [TRAY_W, LIP_H, LIP_T] },
    { key: 'left', position: [-TRAY_W / 2 + LIP_T / 2, lipY, 0], size: [LIP_T, LIP_H, TRAY_D] },
    { key: 'right', position: [TRAY_W / 2 - LIP_T / 2, lipY, 0], size: [LIP_T, LIP_H, TRAY_D] },
  ];

  return (
    <group ref={root}>
      <mesh position={[0, TRAY_H / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[TRAY_W, TRAY_H, TRAY_D]} />
        <meshStandardMaterial color={SCENE_COLORS.ink} roughness={0.55} metalness={0.15} />
      </mesh>
      {lips.map((lip) => (
        <mesh key={lip.key} position={lip.position} castShadow receiveShadow>
          <boxGeometry args={lip.size} />
          <meshStandardMaterial color={SCENE_COLORS.inkEdge} roughness={0.55} metalness={0.15} />
        </mesh>
      ))}
      {slabs.map((slab) => (
        <mesh key={slab.key} position={slab.position} castShadow receiveShadow>
          <boxGeometry args={[SLAB_W, SLAB_H, SLAB_D]} />
          <meshStandardMaterial color={slab.color} roughness={0.35} metalness={0.3} />
        </mesh>
      ))}
    </group>
  );
}
