import { BufferAttribute, BufferGeometry, Color, ExtrudeGeometry, MeshStandardMaterial, Shape } from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { EXTRUSION, OUTLINES, PLACEMENT, type Letter } from './monogram';

/** The letter's outline as a three Shape, centred on its own bounds, from the same lines and cubics the poster draws. */
export function letterShape(letter: Letter): Shape {
  const outline = OUTLINES[letter];
  const [dx, dy] = PLACEMENT[letter].offset;
  const shape = new Shape();
  shape.moveTo(outline.start[0] + dx, outline.start[1] + dy);
  for (const segment of outline.segments) {
    if (segment.kind === 'line') {
      shape.lineTo(segment.to[0] + dx, segment.to[1] + dy);
    } else {
      shape.bezierCurveTo(segment.c1[0] + dx, segment.c1[1] + dy, segment.c2[0] + dx, segment.c2[1] + dy, segment.to[0] + dx, segment.to[1] + dy);
    }
  }
  return shape;
}

function slice(geometry: BufferGeometry, start: number, count: number): BufferGeometry {
  const position = geometry.getAttribute('position') as BufferAttribute;
  const out = new BufferGeometry();
  out.setAttribute('position', new BufferAttribute((position.array as Float32Array).slice(start * 3, (start + count) * 3), 3));
  return out;
}

/**
 * Normals for the walls and bevels from the extrusion profile itself. The
 * bevel is a quarter circle that leaves the cap tangentially and arrives at
 * the straight wall tangentially, so at each vertex the normal is the
 * outline's outward direction tilted toward the cap by the profile angle
 * read from the vertex's depth. The outline direction is the average of the
 * adjacent wall facets, which the merged vertices already carry.
 */
function profileNormals(sides: BufferGeometry): void {
  const position = sides.getAttribute('position');
  const normal = sides.getAttribute('normal');
  const halfDepth = EXTRUSION.depth / 2;
  const bevel = EXTRUSION.bevel;
  for (let i = 0; i < position.count; i++) {
    const z = position.getZ(i);
    const beyond = Math.min(bevel, Math.max(0, Math.abs(z) - halfDepth));
    const theta = Math.acos(beyond / bevel);
    const radial = Math.sin(theta);
    const axial = Math.cos(theta) * Math.sign(z);
    const nx = normal.getX(i), ny = normal.getY(i);
    const len = Math.hypot(nx, ny) || 1;
    const x = (nx / len) * radial, y = (ny / len) * radial;
    const total = Math.hypot(x, y, axial) || 1;
    normal.setXYZ(i, x / total, y / total, axial / total);
  }
  normal.needsUpdate = true;
}

/**
 * One letter as a solid: three's standard beveled extrusion of the outline,
 * with the bevel rolled inward from the drawn silhouette (the straight wall
 * is the outline; the flat cap is inset by one bevel radius), then centred
 * on z. The caps keep exact flat normals and the sides get the profile's
 * analytic normals, so nothing is smoothed across the cap edge.
 */
export function createLetterGeometry(letter: Letter): BufferGeometry {
  const extruded = new ExtrudeGeometry(letterShape(letter), {
    depth: EXTRUSION.depth,
    steps: 1,
    bevelEnabled: true,
    bevelThickness: EXTRUSION.bevel,
    bevelSize: EXTRUSION.bevel,
    bevelOffset: -EXTRUSION.bevel,
    bevelSegments: EXTRUSION.bevelSegments,
    curveSegments: EXTRUSION.curveSegments,
  });
  extruded.translate(0, 0, -EXTRUSION.depth / 2);
  const capGroup = extruded.groups.find((g) => g.materialIndex === 0);
  const sideGroup = extruded.groups.find((g) => g.materialIndex === 1);
  if (!capGroup || !sideGroup) throw new Error('extrusion without cap and side groups');

  const caps = slice(extruded, capGroup.start, capGroup.count);
  caps.computeVertexNormals();
  const merged = mergeVertices(slice(extruded, sideGroup.start, sideGroup.count), 1e-5);
  merged.computeVertexNormals();
  profileNormals(merged);
  const sides = merged.toNonIndexed();
  extruded.dispose();
  merged.dispose();

  const capPosition = caps.getAttribute('position').array as Float32Array;
  const capNormal = caps.getAttribute('normal').array as Float32Array;
  const sidePosition = sides.getAttribute('position').array as Float32Array;
  const sideNormal = sides.getAttribute('normal').array as Float32Array;
  const positions = new Float32Array(capPosition.length + sidePosition.length);
  const normals = new Float32Array(capNormal.length + sideNormal.length);
  positions.set(capPosition);
  positions.set(sidePosition, capPosition.length);
  normals.set(capNormal);
  normals.set(sideNormal, capNormal.length);
  caps.dispose();
  sides.dispose();

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new BufferAttribute(normals, 3));
  geometry.computeBoundingSphere();
  return geometry;
}

/** Polished silver lit entirely by the authored environment. */
export function createLetterMaterial(): MeshStandardMaterial {
  return new MeshStandardMaterial({
    color: new Color('#e3e5e9'),
    metalness: 1,
    roughness: 0.16,
    envMapIntensity: 1,
  });
}
