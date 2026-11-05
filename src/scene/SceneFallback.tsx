import { useMemo } from 'react';
import { COOL_LIGHT, KEY_LIGHT, bladeCount, cameraFor, createField, projectToScreen, sampleBlade, type Vec3 } from './bladeField';
import './scene-fallback.css';

interface Face {
  points: string;
  /** 0..1, how squarely the face reflects the broad light toward the camera. */
  broad: number;
  /** 0..1, how squarely the face reflects the cool strip. */
  cool: number;
  depth: number;
}

function unit(v: Vec3): Vec3 {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}

function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

/** Specular facing: how close the blade normal is to the half vector of view and light. */
function facing(normal: Vec3, toCamera: Vec3, light: Vec3, position: Vec3): number {
  const toLight = unit([light[0] - position[0], light[1] - position[1], light[2] - position[2]]);
  const half = unit([toLight[0] + toCamera[0], toLight[1] + toCamera[1], toLight[2] + toCamera[2]]);
  return Math.max(0, Math.abs(dot(normal, half)));
}

function buildFaces(compact: boolean, viewW: number, viewH: number): Face[] {
  const field = createField({ count: bladeCount(compact), compact });
  const camera = cameraFor(compact, { reveal: 1, fold: 0 });
  const aspect = viewW / viewH;
  const faces: Face[] = [];
  const corner: Vec3 = [0, 0, 0];
  for (let i = 0; i < field.count; i++) {
    const s = sampleBlade(field, i, { reveal: 1, fold: 0 });
    const toCamera = unit([
      camera.position[0] - s.position[0],
      camera.position[1] - s.position[1],
      camera.position[2] - s.position[2],
    ]);
    // Front face: the one turned toward the camera.
    const sign = dot(s.normal, toCamera) >= 0 ? 1 : -1;
    const n: Vec3 = [s.normal[0] * sign, s.normal[1] * sign, s.normal[2] * sign];
    const hw = s.scale[0] / 2;
    const hh = s.scale[1] / 2;
    const hd = s.scale[2] / 2;
    const pts: string[] = [];
    for (const [a, b] of [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ]) {
      corner[0] = s.position[0] + s.side[0] * hw * a + s.up[0] * hh * b + n[0] * hd;
      corner[1] = s.position[1] + s.side[1] * hw * a + s.up[1] * hh * b + n[1] * hd;
      corner[2] = s.position[2] + s.side[2] * hw * a + s.up[2] * hh * b + n[2] * hd;
      const p = projectToScreen(corner, camera, aspect);
      pts.push(`${(p.x * viewW).toFixed(1)},${(p.y * viewH).toFixed(1)}`);
    }
    const centre = projectToScreen(s.position, camera, aspect);
    faces.push({
      points: pts.join(' '),
      broad: facing(n, toCamera, KEY_LIGHT, s.position),
      cool: facing(n, toCamera, COOL_LIGHT, s.position),
      depth: centre.depth,
    });
  }
  faces.sort((a, b) => b.depth - a.depth);
  return faces;
}

/**
 * Static composition with the same silhouette and framing as the WebGL scene.
 * Used when WebGL is unavailable, fails, or while the scene is still loading.
 */
export function SceneFallback({ compact }: { compact: boolean }) {
  const viewW = compact ? 390 : 1440;
  const viewH = compact ? 844 : 900;
  const faces = useMemo(() => buildFaces(compact, viewW, viewH), [compact, viewW, viewH]);

  return (
    <svg
      className="scene-fallback"
      data-testid="scene-fallback"
      viewBox={`0 0 ${viewW} ${viewH}`}
      preserveAspectRatio="xMidYMid slice"
      width="100%"
      height="100%"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="scene-fallback-broad" x1="0.15" y1="0" x2="0.85" y2="1">
          <stop offset="0" stopColor="#dfe2e6" stopOpacity="0.9" />
          <stop offset="0.55" stopColor="#7d838b" stopOpacity="0.5" />
          <stop offset="1" stopColor="#30343a" stopOpacity="0.1" />
        </linearGradient>
      </defs>
      {faces.map((face, i) => {
        const broad = Math.pow(face.broad, 10);
        const cool = Math.pow(face.cool, 14);
        const edge = Math.min(1, 0.18 + broad * 0.9 + cool * 0.6);
        return (
          <g key={i}>
            <polygon points={face.points} fill="#24272c" />
            {broad > 0.01 && (
              <polygon points={face.points} fill="url(#scene-fallback-broad)" opacity={Math.min(1, broad * 1.1)} />
            )}
            {cool > 0.01 && <polygon points={face.points} fill="#cfe0ff" opacity={cool * 0.45} />}
            <polygon
              points={face.points}
              fill="none"
              stroke="#d9dde2"
              strokeWidth={compact ? 0.6 : 0.8}
              strokeOpacity={edge}
              strokeLinejoin="round"
            />
          </g>
        );
      })}
    </svg>
  );
}
