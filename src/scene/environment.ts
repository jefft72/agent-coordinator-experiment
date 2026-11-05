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
import { COOL_LIGHT, FILL_LIGHT, KEY_LIGHT } from './bladeField';

/**
 * Authored light-shape environment, prefiltered once with PMREM. No external HDR.
 *
 * The enclosure is a graded dome: dim grey overhead falling to black below the
 * horizon, so every satin face carries some tone and faces turned downward
 * read as the dark recess. Three light shapes sit on top of it:
 * - a broad white key behind and above the camera, which the plates sweep
 *   through as the twist turns their faces toward the viewer;
 * - a narrow cool strip far to the left and behind, which lands on the plate
 *   edges and the faces that twist away from the key;
 * - a faint warm fill on the right, so the faces turned right are not pure black.
 */
export interface SceneEnvironment {
  texture: Texture;
  dispose: () => void;
}

function emissive(hex: string, intensity: number): MeshBasicMaterial {
  return new MeshBasicMaterial({ color: new Color(hex).multiplyScalar(intensity) });
}

function gradedDome(radius: number): { geometry: SphereGeometry; material: MeshBasicMaterial } {
  const geometry = new SphereGeometry(radius, 32, 24);
  const positions = geometry.getAttribute('position');
  const colors = new Float32Array(positions.count * 3);
  const top = new Color('#5a5e66');
  const horizon = new Color('#24272c');
  const floor = new Color('#050506');
  const c = new Color();
  for (let i = 0; i < positions.count; i++) {
    const y = positions.getY(i) / radius;
    if (y >= 0) c.copy(horizon).lerp(top, Math.pow(y, 0.8));
    else c.copy(horizon).lerp(floor, Math.pow(-y, 0.6));
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
  const geometries: { dispose: () => void }[] = [];
  const materials: { dispose: () => void }[] = [];

  const dome = gradedDome(40);
  geometries.push(dome.geometry);
  materials.push(dome.material);
  scene.add(new Mesh(dome.geometry, dome.material));

  const addLight = (w: number, h: number, hex: string, intensity: number, position: [number, number, number]) => {
    const geometry = new PlaneGeometry(w, h);
    const material = emissive(hex, intensity);
    geometries.push(geometry);
    materials.push(material);
    const mesh = new Mesh(geometry, material);
    mesh.position.set(position[0], position[1], position[2]);
    mesh.lookAt(0, 0, 0);
    scene.add(mesh);
  };

  addLight(22, 12, '#ffffff', 3.2, KEY_LIGHT);
  addLight(0.7, 12, '#d6e4ff', 6, COOL_LIGHT);
  addLight(5, 5, '#e9e2d6', 0.6, FILL_LIGHT);

  const pmrem = new PMREMGenerator(renderer);
  const target = pmrem.fromScene(scene, 0.04, 0.1, 100);
  pmrem.dispose();
  for (const g of geometries) g.dispose();
  for (const m of materials) m.dispose();

  return {
    texture: target.texture,
    dispose: () => target.dispose(),
  };
}
