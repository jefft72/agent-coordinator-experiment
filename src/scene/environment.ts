import {
  BackSide,
  BufferAttribute,
  Color,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  PMREMGenerator,
  Scene,
  SphereGeometry,
  type Texture,
  type WebGLRenderer,
} from 'three';

/**
 * Authored environment, prefiltered once with PMREM. No external HDR.
 *
 * The enclosure is one smooth sky painted per vertex, so the convex faces
 * reflect broad light-to-dark gradients with no visible cards: a graded base
 * (dim grey overhead, dark horizon, black floor) with two soft lobes added,
 * a wide white key low on the camera's left and a cooler, dimmer fill high
 * on the right and behind. One narrow cool strip far to the left is the only
 * hard-edged source; it lands as a clean highlight on the polished wall of
 * the cut and the rounded rim.
 */
export interface SceneEnvironment {
  texture: Texture;
  dispose: () => void;
}

type Vec3 = [number, number, number];

/** Directions from the object; the camera looks down -z. */
export const KEY_DIRECTION: Vec3 = unit([-0.62, -0.1, 0.78]);
export const FILL_DIRECTION: Vec3 = unit([0.55, 0.7, -0.45]);
export const COOL_LIGHT: Vec3 = [-30, 8, -6];

function unit(v: Vec3): Vec3 {
  const len = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / len, v[1] / len, v[2] / len];
}

function lobe(x: number, y: number, z: number, direction: Vec3, power: number): number {
  const d = Math.max(0, x * direction[0] + y * direction[1] + z * direction[2]);
  return Math.pow(d, power);
}

function paintedSky(radius: number): { geometry: SphereGeometry; material: MeshBasicMaterial } {
  const geometry = new SphereGeometry(radius, 96, 64);
  const positions = geometry.getAttribute('position');
  const colors = new Float32Array(positions.count * 3);
  const top = new Color('#2c2f35');
  const horizon = new Color('#121417');
  const floor = new Color('#030304');
  const key = new Color('#ffffff');
  const fill = new Color('#c9d3e2');
  const c = new Color();
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i) / radius;
    const y = positions.getY(i) / radius;
    const z = positions.getZ(i) / radius;
    if (y >= 0) c.copy(horizon).lerp(top, Math.pow(y, 0.8));
    else c.copy(horizon).lerp(floor, Math.pow(-y, 0.6));
    const k = lobe(x, y, z, KEY_DIRECTION, 9) * 1.7;
    const f = lobe(x, y, z, FILL_DIRECTION, 3) * 0.22;
    c.r += key.r * k + fill.r * f;
    c.g += key.g * k + fill.g * f;
    c.b += key.b * k + fill.b * f;
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geometry.setAttribute('color', new BufferAttribute(colors, 3));
  const material = new MeshBasicMaterial({ vertexColors: true, side: BackSide });
  return { geometry, material };
}

export function createEnvironment(renderer: WebGLRenderer): SceneEnvironment {
  const scene = new Scene();
  const sky = paintedSky(40);
  const strip = new PlaneGeometry(1.4, 22);
  const stripMaterial = new MeshBasicMaterial({ color: new Color('#d6e4ff').multiplyScalar(4) });
  const stripMesh = new Mesh(strip, stripMaterial);
  stripMesh.position.set(COOL_LIGHT[0], COOL_LIGHT[1], COOL_LIGHT[2]);
  stripMesh.lookAt(0, 0, 0);
  scene.add(new Mesh(sky.geometry, sky.material));
  scene.add(stripMesh);

  const pmrem = new PMREMGenerator(renderer);
  const target = pmrem.fromScene(scene, 0.04, 0.1, 100);
  pmrem.dispose();
  sky.geometry.dispose();
  sky.material.dispose();
  strip.dispose();
  stripMaterial.dispose();

  return {
    texture: target.texture,
    dispose: () => target.dispose(),
  };
}
