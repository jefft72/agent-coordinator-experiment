import type { ProjectId } from '../content/work';

/**
 * Shared contract between the opening layout, the WebGL contact sheet, and
 * the non-WebGL fallback. Positions are in world units. The camera sees roughly
 * 9 units across by 4 units tall on desktop at the rest pose.
 *
 * Axes: x right, y up, z toward the camera. The "floor" is y = -1.4.
 */

export interface SceneProps {
  /** null = rest pose: nothing chosen yet, the whole composition at full presence. */
  selected: ProjectId | null;
  /** prefers-reduced-motion: snap to the selected state, never animate. */
  reducedMotion: boolean;
  /** Viewport under 768px: use LAYOUT.compact and show fewer objects in depth. */
  compact: boolean;
  onReady: () => void;
  onFail: (reason: string) => void;
}

export interface ArtifactProps {
  selected: boolean;
  /** True for the non-selected objects while something else is selected. False at rest. */
  dimmed: boolean;
  reducedMotion: boolean;
}

export interface Placement {
  position: [number, number, number];
  /** Euler rotation in radians. */
  rotation: [number, number, number];
  scale: number;
}

export interface Pose {
  /** Camera position and look-at target for this selection. */
  camera: [number, number, number];
  target: [number, number, number];
}

export const FLOOR_Y = -1.4;

/**
 * Rest pose: the composition as a still image before anyone selects anything.
 * Diffex is cropped at the right edge on purpose. The upper-left quadrant stays
 * empty on purpose (the pocket of negative space).
 */
export const LAYOUT: Record<'desktop' | 'compact', Record<ProjectId, Placement>> = {
  desktop: {
    opencraft: { position: [-2.7, FLOOR_Y, 0.7], rotation: [0, 0.42, 0], scale: 1 },
    animalabs: { position: [1.1, FLOOR_Y, -0.5], rotation: [0, -0.28, 0], scale: 1 },
    diffex: { position: [4.1, -0.2, -1.3], rotation: [0.1, -0.35, 0.05], scale: 1 },
    judi: { position: [-4.3, FLOOR_Y, -2.4], rotation: [0, 0.55, 0], scale: 0.85 },
    rtx: { position: [0.0, FLOOR_Y, -2.9], rotation: [0, 0.12, 0], scale: 1 },
    uplate: { position: [3.1, FLOOR_Y, 1.3], rotation: [0, -0.5, 0], scale: 0.9 },
  },
  compact: {
    opencraft: { position: [-1.2, FLOOR_Y, 0.2], rotation: [0, 0.42, 0], scale: 0.7 },
    animalabs: { position: [0.9, FLOOR_Y, -0.6], rotation: [0, -0.28, 0], scale: 0.7 },
    diffex: { position: [2.2, 0.1, -1.6], rotation: [0.1, -0.35, 0.05], scale: 0.7 },
    judi: { position: [-2.4, FLOOR_Y, -2.2], rotation: [0, 0.55, 0], scale: 0.6 },
    rtx: { position: [0.2, FLOOR_Y, -2.8], rotation: [0, 0.12, 0], scale: 0.75 },
    uplate: { position: [2.0, FLOOR_Y, 0.6], rotation: [0, -0.5, 0], scale: 0.65 },
  },
};

/** Desktop camera at rest, then one deliberate move per selection. */
export const POSES: Record<'rest' | ProjectId, Pose> = {
  rest: { camera: [0.2, 1.7, 9.6], target: [0.2, -0.45, 0] },
  opencraft: { camera: [-1.6, 1.4, 7.4], target: [-2.3, -0.7, 0.4] },
  animalabs: { camera: [1.1, 1.5, 7.2], target: [1.2, -0.3, -0.5] },
  diffex: { camera: [2.6, 1.3, 7.0], target: [3.6, -0.1, -1.2] },
  judi: { camera: [-2.6, 1.6, 6.8], target: [-3.6, -0.6, -2.0] },
  rtx: { camera: [0.2, 2.6, 6.4], target: [0.2, -1.0, -2.6] },
  uplate: { camera: [2.3, 1.1, 7.6], target: [2.9, -0.4, 1.2] },
};

/** Compact camera: tighter and a little higher so the selected object fills the frame. */
export const COMPACT_POSES: Record<'rest' | ProjectId, Pose> = {
  rest: { camera: [0.3, 1.5, 7.6], target: [0.3, -0.5, -0.4] },
  opencraft: { camera: [-0.7, 1.2, 5.6], target: [-1.1, -0.7, 0.1] },
  animalabs: { camera: [0.8, 1.2, 5.4], target: [0.9, -0.4, -0.6] },
  diffex: { camera: [1.5, 1.2, 5.2], target: [2.0, 0.0, -1.5] },
  judi: { camera: [-1.6, 1.4, 5.0], target: [-2.2, -0.7, -2.0] },
  rtx: { camera: [0.3, 2.2, 4.8], target: [0.3, -1.1, -2.6] },
  uplate: { camera: [1.4, 1.0, 5.4], target: [1.9, -0.5, 0.5] },
};

/** How far the selected object lifts off the floor when chosen. */
export const SELECT_LIFT = 0.22;

/** Scene palette. Keep these exact so the WebGL sheet and the fallback agree. */
export const SCENE_COLORS = {
  ground: '#DCE4E8',
  ink: '#16131A',
  inkEdge: '#2A2530',
  paper: '#C7D3DA',
  paperEdge: '#EEF2F4',
  silver: '#EEF2F4',
  silverDeep: '#B9C6CE',
  green: '#5F7B66',
  greenDeep: '#4A6350',
  greenLight: '#7E9A82',
  soil: '#6B5A4E',
  oxblood: '#442631',
  shadow: '#8FA3AF',
} as const;
