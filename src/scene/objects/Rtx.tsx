import { useMemo, useRef } from 'react';
import { CatmullRomCurve3, Group, TubeGeometry, Vector3 } from 'three';
import { SCENE_COLORS, type ArtifactProps } from '../contract';
import { useDimMaterials } from '../dim';

const PLATE_W = 3.4;
const PLATE_H = 0.04;
const PLATE_D = 1.5;
const LINE_Y = PLATE_H + 0.03;
const LINE_R = 0.013;

/** Plan-view waypoints on the plate (x, z). The route weaves between the posts. */
const WAYPOINTS: [number, number][] = [
  [-1.45, 0.45],
  [-0.8, -0.35],
  [-0.15, 0.3],
  [0.5, -0.45],
  [1.05, 0.25],
  [1.45, -0.3],
];

/** Obstacle posts: x, z, radius, height. */
const POSTS: [number, number, number, number][] = [
  [-1.0, 0.35, 0.07, 0.3],
  [-0.35, -0.45, 0.09, 0.2],
  [0.55, 0.1, 0.05, 0.36],
  [1.35, 0.3, 0.065, 0.26],
];

/** A long route plate: a pale-silver plate with a raised ink route line weaving around dark posts. */
export function Rtx(props: ArtifactProps) {
  const root = useRef<Group>(null);
  useDimMaterials(root, props.dimmed, props.reducedMotion);

  const routeGeometry = useMemo(() => {
    const curve = new CatmullRomCurve3(
      WAYPOINTS.map(([x, z]) => new Vector3(x, LINE_Y, z)),
      false,
      'centripetal',
    );
    return new TubeGeometry(curve, 140, LINE_R, 8, false);
  }, []);

  return (
    <group ref={root}>
      <mesh position={[0, PLATE_H / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[PLATE_W, PLATE_H, PLATE_D]} />
        <meshStandardMaterial color={SCENE_COLORS.silver} roughness={0.5} metalness={0.2} />
      </mesh>
      <mesh geometry={routeGeometry} castShadow>
        <meshStandardMaterial color={SCENE_COLORS.ink} roughness={0.45} metalness={0.1} />
      </mesh>
      {WAYPOINTS.map(([x, z], i) => (
        <mesh key={`wp-${i}`} position={[x, PLATE_H + 0.007, z]} receiveShadow>
          <cylinderGeometry args={[0.065, 0.065, 0.014, 24]} />
          <meshStandardMaterial color={SCENE_COLORS.silverDeep} roughness={0.4} metalness={0.3} />
        </mesh>
      ))}
      {POSTS.map(([x, z, r, h], i) => (
        <mesh key={`post-${i}`} position={[x, PLATE_H + h / 2, z]} castShadow receiveShadow>
          <cylinderGeometry args={[r, r, h, 24]} />
          <meshStandardMaterial color={SCENE_COLORS.inkEdge} roughness={0.6} metalness={0.1} />
        </mesh>
      ))}
    </group>
  );
}
