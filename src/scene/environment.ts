import {
  BackSide,
  Color,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  PMREMGenerator,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
  type Texture,
  type WebGLRenderer,
} from 'three';

/**
 * Authored environment, prefiltered once with PMREM. No external HDR.
 *
 * The enclosure is one smooth sky shaded per fragment, so the convex faces
 * reflect broad light-to-dark gradients with no visible cards or facets: a graded base
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


const SKY_VERTEX = /* glsl */ `
  varying vec3 vDirection;
  void main() {
    vDirection = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SKY_FRAGMENT = /* glsl */ `
  uniform vec3 top;
  uniform vec3 horizon;
  uniform vec3 floorColor;
  uniform vec3 key;
  uniform vec3 fill;
  uniform vec3 keyDirection;
  uniform vec3 fillDirection;
  varying vec3 vDirection;
  void main() {
    vec3 d = normalize(vDirection);
    vec3 c = d.y >= 0.0 ? mix(horizon, top, pow(d.y, 0.8)) : mix(horizon, floorColor, pow(-d.y, 0.6));
    float k = pow(max(0.0, dot(d, keyDirection)), 9.0) * 1.7;
    float f = pow(max(0.0, dot(d, fillDirection)), 3.0) * 0.22;
    gl_FragColor = vec4(c + key * k + fill * f, 1.0);
  }
`;

/** The sky is shaded per fragment, so its gradients have no facets for a polished surface to reveal. */
function paintedSky(radius: number): { geometry: SphereGeometry; material: ShaderMaterial } {
  const geometry = new SphereGeometry(radius, 32, 16);
  const material = new ShaderMaterial({
    side: BackSide,
    depthWrite: false,
    uniforms: {
      top: { value: new Color('#2c2f35') },
      horizon: { value: new Color('#121417') },
      floorColor: { value: new Color('#030304') },
      key: { value: new Color('#ffffff') },
      fill: { value: new Color('#c9d3e2') },
      keyDirection: { value: new Vector3(...KEY_DIRECTION) },
      fillDirection: { value: new Vector3(...FILL_DIRECTION) },
    },
    vertexShader: SKY_VERTEX,
    fragmentShader: SKY_FRAGMENT,
  });
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
