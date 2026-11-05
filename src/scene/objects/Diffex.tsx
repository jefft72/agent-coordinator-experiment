import { useMemo } from 'react';
import { BoxGeometry, MeshStandardMaterial } from 'three';
import { SCENE_COLORS, type ArtifactProps } from '../contract';
import { seededRandom } from './textures';

const PANELS = 7;
const PANEL_L = 1.0;
const WIDTH = 0.46;
const THICK = 0.012;
/** Each panel swings this far from the direction of travel, alternating sign. */
const FOLD = 1.2;
/** The whole accordion tilts up toward the right so it climbs as it travels. */
const LEAN = 0.25;
const EDGE = 0.01;

interface Tick {
  x: number;
  y: number;
  large: boolean;
}

interface Panel {
  position: [number, number, number];
  rotationY: number;
  ticks: Tick[];
}

function buildPanels(): Panel[] {
  const rand = seededRandom(917);
  const panels: Panel[] = [];
  let x = 0;
  let z = 0;
  const largeOn = new Set([1, 3, 5]);
  for (let i = 0; i < PANELS; i += 1) {
    const sign = i % 2 === 0 ? 1 : -1;
    const ticks: Tick[] = [];
    const rows = [0.11, 0.23, 0.35];
    for (const row of rows) {
      let cursor = 0.06 + rand() * 0.1;
      while (cursor + 0.12 < PANEL_L - 0.05) {
        if (rand() > 0.3) ticks.push({ x: cursor + 0.06, y: row, large: false });
        cursor += 0.12 + 0.03 + rand() * 0.14;
      }
    }
    if (largeOn.has(i)) {
      ticks.push({ x: 0.25 + rand() * 0.5, y: 0.17 + rand() * 0.12, large: true });
    }
    panels.push({ position: [x, 0, z], rotationY: -sign * FOLD, ticks });
    x += Math.cos(FOLD) * PANEL_L;
    z += sign * Math.sin(FOLD) * PANEL_L;
  }
  return panels;
}

/**
 * Diffex: a fan-folded execution trace. Seven satin-black panels hinged on
 * vertical folds, climbing to the right, with silver edges and tick marks laid
 * along the faces like a typed trace. Local origin is the left-bottom end.
 */
// Props are reserved for the placement agent (dimming and lift happen there).
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function Diffex(_props: ArtifactProps) {
  const panels = useMemo(() => buildPanels(), []);
  const panelGeometry = useMemo(() => new BoxGeometry(PANEL_L, WIDTH, THICK), []);
  const edgeGeometry = useMemo(() => new BoxGeometry(PANEL_L, EDGE, THICK + 0.006), []);
  const tickGeometry = useMemo(() => new BoxGeometry(0.12, 0.03, 0.004), []);
  const largeTickGeometry = useMemo(() => new BoxGeometry(0.2, 0.05, 0.004), []);
  const inkMaterial = useMemo(
    () => new MeshStandardMaterial({ color: SCENE_COLORS.ink, roughness: 0.4, metalness: 0.25 }),
    [],
  );
  const silverMaterial = useMemo(
    () => new MeshStandardMaterial({ color: SCENE_COLORS.silver, roughness: 0.5, metalness: 0.1 }),
    [],
  );
  const silverDeepMaterial = useMemo(
    () => new MeshStandardMaterial({ color: SCENE_COLORS.silverDeep, roughness: 0.5, metalness: 0.1 }),
    [],
  );
  const faceZ = THICK / 2 + 0.002;

  return (
    <group rotation={[0, 0, LEAN]} position={[0, 0, (-Math.sin(FOLD) * PANEL_L) / 2]}>
      {panels.map((panel, i) => (
        <group key={i} position={panel.position} rotation={[0, panel.rotationY, 0]}>
          <mesh
            geometry={panelGeometry}
            material={inkMaterial}
            position={[PANEL_L / 2, WIDTH / 2, 0]}
            castShadow
            receiveShadow
          />
          <mesh
            geometry={edgeGeometry}
            material={silverMaterial}
            position={[PANEL_L / 2, EDGE / 2, 0]}
            castShadow
            receiveShadow
          />
          <mesh
            geometry={edgeGeometry}
            material={silverMaterial}
            position={[PANEL_L / 2, WIDTH - EDGE / 2, 0]}
            castShadow
            receiveShadow
          />
          {panel.ticks.map((tick, j) => (
            <mesh
              key={j}
              geometry={tick.large ? largeTickGeometry : tickGeometry}
              material={tick.large ? silverDeepMaterial : silverMaterial}
              position={[tick.x, tick.y, faceZ]}
              castShadow
              receiveShadow
            />
          ))}
        </group>
      ))}
    </group>
  );
}
