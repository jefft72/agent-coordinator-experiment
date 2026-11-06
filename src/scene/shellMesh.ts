import { BufferAttribute, BufferGeometry, MeshStandardMaterial } from 'three';
import type { ShellGeometry } from './shell';

/** Wraps one built shell as an indexed geometry with positions, normals, and vertex colours. */
export function createShellGeometry(shell: ShellGeometry): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(shell.positions, 3));
  geometry.setAttribute('normal', new BufferAttribute(shell.normals, 3));
  geometry.setAttribute('color', new BufferAttribute(shell.colors, 3));
  geometry.setIndex(new BufferAttribute(shell.indices, 1));
  geometry.computeBoundingSphere();
  return geometry;
}

/**
 * Satin metal lit entirely by the authored environment. The vertex colours
 * carry the value hierarchy: silver fronts, steel at the cut, near-black backs.
 */
export function createShellMaterial(): MeshStandardMaterial {
  return new MeshStandardMaterial({
    vertexColors: true,
    metalness: 1,
    roughness: 0.3,
    envMapIntensity: 1,
    flatShading: false,
  });
}
