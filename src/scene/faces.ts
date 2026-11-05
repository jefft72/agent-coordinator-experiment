import { COOL_LIGHT, KEY_LIGHT, projectToScreen, sampleBlade, type CameraPose, type Field, type SampleParams, type Vec3 } from './bladeField';

export interface Face {
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

const REST: SampleParams = { reveal: 1, fold: 0 };

/**
 * Projects every blade of `field` through `camera` into a `viewW` by `viewH`
 * picture, shading each front face by how squarely it reflects the two
 * authored lights. `paramsFor` supplies the pose of each blade; the rest pose
 * by default.
 */
export function buildFaces(
  field: Field,
  camera: CameraPose,
  viewW: number,
  viewH: number,
  paramsFor: (i: number) => SampleParams = () => REST,
): Face[] {
  const aspect = viewW / viewH;
  const faces: Face[] = [];
  const corner: Vec3 = [0, 0, 0];
  for (let i = 0; i < field.count; i++) {
    const s = sampleBlade(field, i, paramsFor(i));
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
