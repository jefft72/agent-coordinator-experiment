import { Color, MeshStandardMaterial } from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { Field } from './bladeField';

/** One plate: a rounded box one unit tall, scaled per instance. */
export function createBladeGeometry(field: Field): RoundedBoxGeometry {
  return new RoundedBoxGeometry(field.blade.width, 1, field.blade.depth, 4, field.blade.radius);
}

/** Satin silver-graphite metal, lit entirely by the authored environment. */
export function createBladeMaterial(): MeshStandardMaterial {
  return new MeshStandardMaterial({
    color: new Color('#9a9ea4'),
    metalness: 1,
    roughness: 0.42,
    envMapIntensity: 1.0,
    flatShading: false,
  });
}
