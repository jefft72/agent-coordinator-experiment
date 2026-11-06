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
 * The enclosure is one smooth sky shaded per fragment, so the flat caps and
 * rounded bevels of the letters reflect broad light-to-dark gradients with
 * no visible cards or facets. A graded base (grey overhead, dark horizon,
 * black floor) gives the bevels their sweep from a pale top edge through a
 * graphite band to a dark underside. The near-frontal caps mirror the
 * region behind and to the right of the camera, where a broad dim glow
 * holds them at a satin mid silver. The studio light is one soft disc just
 * right of the camera axis at the caps' height: the caps sit outside its
 * softened edge, and the bevel parts that turn toward the left roll into
 * it a few degrees in from the cap, so each stroke carries one broad
 * white-to-graphite transition rather than a flat plaque with a rim. A cooler fill high on the right and behind
 * lifts the bevels that turn away. One narrow cool strip far to the left is
 * the only hard-edged source; it lands as a crisp line on the bevels that
 * face left.
 */
export interface SceneEnvironment {
  texture: Texture;
  dispose: () => void;
}

type Vec3 = [number, number, number];

/** Directions from the object; the camera looks down -z, so +z is behind it. */
export const WALL_DIRECTION: Vec3 = direction(30, -6);
export const KEY_DIRECTION: Vec3 = direction(8, 0);
export const FILL_DIRECTION: Vec3 = unit([0.55, 0.7, -0.45]);
export const COOL_LIGHT: Vec3 = [-30, 8, -6];

function unit(v: Vec3): Vec3 {
  const len = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / len, v[1] / len, v[2] / len];
}

/** A unit direction from azimuth (degrees right of the camera axis, behind the camera at 0) and elevation. */
function direction(azimuth: number, elevation: number): Vec3 {
  const az = (azimuth * Math.PI) / 180;
  const el = (elevation * Math.PI) / 180;
  return [Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)];
}

/** The soft disc: fully lit inside KEY_INNER degrees, fading out by KEY_OUTER. */
export const KEY_INNER = 8;
export const KEY_OUTER = 24;


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
  uniform vec3 wall;
  uniform vec3 key;
  uniform vec3 fill;
  uniform vec3 wallDirection;
  uniform vec3 keyDirection;
  uniform vec3 fillDirection;
  uniform float keyInner;
  uniform float keyOuter;
  varying vec3 vDirection;
  void main() {
    vec3 d = normalize(vDirection);
    vec3 c = d.y >= 0.0 ? mix(horizon, top, pow(d.y, 0.8)) : mix(horizon, floorColor, pow(-d.y, 0.6));
    float w = pow(max(0.0, dot(d, wallDirection)), 2.5) * 0.36;
    float k = smoothstep(keyOuter, keyInner, dot(d, keyDirection)) * 1.5;
    float f = pow(max(0.0, dot(d, fillDirection)), 3.0) * 0.22;
    gl_FragColor = vec4(c + wall * w + key * k + fill * f, 1.0);
  }
`;

/** The sky is shaded per fragment, so its gradients have no facets for a polished surface to reveal. */
function paintedSky(radius: number): { geometry: SphereGeometry; material: ShaderMaterial } {
  const geometry = new SphereGeometry(radius, 32, 16);
  const material = new ShaderMaterial({
    side: BackSide,
    depthWrite: false,
    uniforms: {
      top: { value: new Color('#666a72') },
      horizon: { value: new Color('#15171a') },
      floorColor: { value: new Color('#040405') },
      wall: { value: new Color('#ffffff') },
      key: { value: new Color('#ffffff') },
      fill: { value: new Color('#c9d3e2') },
      wallDirection: { value: new Vector3(...WALL_DIRECTION) },
      keyDirection: { value: new Vector3(...KEY_DIRECTION) },
      keyInner: { value: Math.cos((KEY_INNER * Math.PI) / 180) },
      keyOuter: { value: Math.cos((KEY_OUTER * Math.PI) / 180) },
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
