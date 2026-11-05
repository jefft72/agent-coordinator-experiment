import { useMemo } from 'react';
import { BoxGeometry, DoubleSide, EdgesGeometry, LineBasicMaterial, MeshPhysicalMaterial } from 'three';
import { SCENE_COLORS, type ArtifactProps } from '../contract';
import { images } from '../../content/work';
import { ImageBoard } from './ImageBoard';
import { makeChartTexture, type ChartKind } from './textures';

const PAGE_W = 1.15;
const PAGE_H = 1.5;
const PAGE_T = 0.012;

/** Four chart kinds across five pages so no two neighbours repeat. */
const PAGES: Array<{ kind: ChartKind; seed: number }> = [
  { kind: 'line', seed: 3 },
  { kind: 'steps', seed: 11 },
  { kind: 'scatter', seed: 5 },
  { kind: 'bars', seed: 8 },
  { kind: 'line', seed: 21 },
];

/** Where the shared bottom-left hinge of the page fan sits in object space. */
const HINGE: [number, number, number] = [-0.75, 0, -0.1];

/**
 * AnimaLabs: a fan of translucent research pages standing on the floor, with
 * the demo frame on a leaning 16:9 plate in front. Local origin is on the floor.
 */
// Props are reserved for the placement agent (dimming and lift happen there).
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function AnimaLabs(_props: ArtifactProps) {
  const pageGeometry = useMemo(() => new BoxGeometry(PAGE_W, PAGE_H, PAGE_T), []);
  const edgeGeometry = useMemo(() => new EdgesGeometry(pageGeometry), [pageGeometry]);
  const edgeMaterial = useMemo(() => new LineBasicMaterial({ color: SCENE_COLORS.paperEdge }), []);
  const pageMaterials = useMemo(
    () =>
      PAGES.map(
        (page) =>
          new MeshPhysicalMaterial({
            color: SCENE_COLORS.paper,
            map: makeChartTexture(page.kind, page.seed),
            transparent: true,
            opacity: 0.78,
            roughness: 0.9,
            metalness: 0,
            side: DoubleSide,
          }),
      ),
    [],
  );

  return (
    <group>
      <group position={HINGE}>
        {PAGES.map((page, i) => (
          <group
            key={`${page.kind}-${page.seed}`}
            rotation={[-(0.04 + i * 0.02), (i - 2) * 0.11 + 0.05, i * 0.012]}
          >
            <mesh
              geometry={pageGeometry}
              material={pageMaterials[i]}
              position={[PAGE_W / 2, PAGE_H / 2, 0]}
              castShadow
              receiveShadow
            >
              <lineSegments geometry={edgeGeometry} material={edgeMaterial} />
            </mesh>
          </group>
        ))}
      </group>

      <group position={[0.35, 0, 0.85]} rotation={[-0.14, 0, 0]}>
        <group position={[0, 0.42, 0]}>
          <ImageBoard src={images.animalabs} width={1.5} height={0.84} depth={0.02} />
        </group>
      </group>
    </group>
  );
}
