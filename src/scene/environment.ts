import {
  BackSide,
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
 * Authored light-shape environment: a near-black enclosure, one broad warm
 * white rectangle, one narrow cool strip, and a faint fill. No external HDR.
 * The light placement is derived from where the blade faces reflect the
 * camera: the broad light sits up-right-front so the fanned faces around the
 * crest carry one soft highlight, and the cool strip sits far left-back so it
 * lands on the bevels and the leaning faces of the foreground.
 */
export interface SceneEnvironment {
  texture: Texture;
  dispose: () => void;
}

function emissive(hex: string, intensity: number): MeshBasicMaterial {
  return new MeshBasicMaterial({ color: new Color(hex).multiplyScalar(intensity) });
}

export function createEnvironment(renderer: WebGLRenderer): SceneEnvironment {
  const scene = new Scene();
  const geometries: { dispose: () => void }[] = [];
  const materials: { dispose: () => void }[] = [];

  const enclosureGeometry = new SphereGeometry(40, 24, 12);
  const enclosureMaterial = new MeshBasicMaterial({ color: new Color('#101216').multiplyScalar(0.55), side: BackSide });
  geometries.push(enclosureGeometry);
  materials.push(enclosureMaterial);
  scene.add(new Mesh(enclosureGeometry, enclosureMaterial));

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

  // Broad warm-white reflection: up, right of centre, in front.
  addLight(6, 2.4, '#fff8ee', 5, [5.5, 7.5, 9]);
  // Narrow cool strip: far left, slightly above, behind the form.
  addLight(0.5, 7, '#cfe0ff', 3, [-11, 3.5, -4]);
  // Faint fill from below-left-front so the undersides are not pure black.
  addLight(3, 3, '#dfe4ea', 0.35, [-5, -8, 7]);

  const pmrem = new PMREMGenerator(renderer);
  const target = pmrem.fromScene(scene, 0.02, 0.1, 100);
  pmrem.dispose();
  for (const g of geometries) g.dispose();
  for (const m of materials) m.dispose();

  return {
    texture: target.texture,
    dispose: () => target.dispose(),
  };
}
