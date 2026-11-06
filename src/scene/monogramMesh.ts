import { BufferAttribute, BufferGeometry, Color, ExtrudeGeometry, MeshStandardMaterial, Path, Shape } from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { EXTRUSION, OUTLINES, contains, contours, type Outline, type Part, type Vec2 } from './monogram';

function trace(path: Path, outline: Outline): void {
  path.moveTo(outline.start[0], outline.start[1]);
  for (const segment of outline.segments) {
    if (segment.kind === 'line') path.lineTo(segment.to[0], segment.to[1]);
    else path.bezierCurveTo(segment.c1[0], segment.c1[1], segment.c2[0], segment.c2[1], segment.to[0], segment.to[1]);
  }
}

/** The part's cap outline as a three Shape, with its holes, from the same lines and cubics the poster draws. */
export function partShape(part: Part): Shape {
  const outline = OUTLINES[part];
  const shape = new Shape();
  trace(shape, outline);
  for (const hole of outline.holes ?? []) {
    const path = new Path();
    trace(path, hole);
    shape.holes.push(path);
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
function profileNormals(sides: BufferGeometry, depth: number, bevel: number): void {
  const position = sides.getAttribute('position');
  const normal = sides.getAttribute('normal');
  const halfDepth = depth / 2;
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


// --- domed front caps ---------------------------------------------------------

/** Bounded diagnostics of the last dome build: sizes, solver convergence, and construction time. */
export interface BuildStats {
  capVertices: number;
  capTriangles: number;
  gridNodes: number;
  sweeps: number;
  /** Largest change of any node in the final sweep, relative to the field's peak. */
  lastUpdate: number;
  buildMs: number;
}

export const lastBuild: BuildStats = { capVertices: 0, capTriangles: 0, gridNodes: 0, sweeps: 0, lastUpdate: 0, buildMs: 0 };

/** Successive over-relaxation stops once no node moves more than this fraction of the current peak, or at this many sweeps. */
const SOR_TOLERANCE = 1e-6;
const SOR_MAX_SWEEPS = 4000;

interface CapMesh {
  /** x, y per vertex; z is the flat cap plane until the dome is applied. */
  xy: number[];
  /** 1 for vertices on the cap's outline, which stay fixed. */
  boundary: number[];
  /** Triangle vertex indices, counterclockwise. */
  triangles: number[];
}

/** The contours with extra points inserted so no segment is longer than `maxEdge`; every point lies on the outline. */
function resample(shape: Vec2[][], maxEdge: number): Vec2[] {
  const out: Vec2[] = [];
  for (const points of shape) {
    for (let i = 0; i < points.length; i++) {
      const [px, py] = points[i];
      const [qx, qy] = points[(i + 1) % points.length];
      const pieces = Math.max(1, Math.ceil(Math.hypot(qx - px, qy - py) / maxEdge));
      for (let k = 0; k < pieces; k++) out.push([px + ((qx - px) * k) / pieces, py + ((qy - py) * k) / pieces]);
    }
  }
  return out;
}

/** Distance from a point to the nearest contour. */
function contourDistance(shape: Vec2[][], x: number, y: number): number {
  let best = Infinity;
  for (const points of shape) {
    for (let i = 0; i < points.length; i++) {
      const [px, py] = points[i];
      const [qx, qy] = points[(i + 1) % points.length];
      const ex = qx - px, ey = qy - py;
      const t = Math.max(0, Math.min(1, ((x - px) * ex + (y - py) * ey) / (ex * ex + ey * ey || 1)));
      const d = Math.hypot(x - (px + ex * t), y - (py + ey * t));
      if (d < best) best = d;
    }
  }
  return best;
}

function insideShape(shape: Vec2[][], x: number, y: number): boolean {
  const [outer, ...holes] = shape;
  return contains(outer, x, y) && !holes.some((hole) => contains(hole, x, y));
}

/**
 * The cap triangulated for curvature: a Delaunay triangulation (Bowyer and
 * Watson) of the outline resampled to short segments plus a regular grid of
 * interior points kept clear of the outline, with the triangles outside the
 * cap removed. Short outline segments are all Delaunay edges, so the mesh
 * boundary is exactly the outline and meets the bevel without cracks.
 */
function triangulateCap(shape: Vec2[][], maxEdge: number, spacing: number): CapMesh {
  const boundaryPoints = resample(shape, maxEdge);
  const points: Vec2[] = boundaryPoints.slice();
  const boundary: number[] = boundaryPoints.map(() => 1);
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of points) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  for (let y = minY + spacing * 0.37; y < maxY; y += spacing) {
    for (let x = minX + spacing * 0.41; x < maxX; x += spacing) {
      if (insideShape(shape, x, y) && contourDistance(shape, x, y) > maxEdge * 0.9) {
        points.push([x, y]);
        boundary.push(0);
      }
    }
  }

  // Bowyer and Watson with a super triangle; triangles are kept counterclockwise.
  const span = Math.max(maxX - minX, maxY - minY) * 20;
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  const n = points.length;
  const all: Vec2[] = points.concat([[cx - span, cy - span], [cx + span, cy - span], [cx, cy + span]]);
  interface Tri { a: number; b: number; c: number; x: number; y: number; r2: number }
  const make = (a: number, b: number, c: number): Tri => {
    const [ax, ay] = all[a], [bx, by] = all[b], [cxx, cyy] = all[c];
    const d = 2 * (ax * (by - cyy) + bx * (cyy - ay) + cxx * (ay - by));
    const ux = ((ax * ax + ay * ay) * (by - cyy) + (bx * bx + by * by) * (cyy - ay) + (cxx * cxx + cyy * cyy) * (ay - by)) / d;
    const uy = ((ax * ax + ay * ay) * (cxx - bx) + (bx * bx + by * by) * (ax - cxx) + (cxx * cxx + cyy * cyy) * (bx - ax)) / d;
    return { a, b, c, x: ux, y: uy, r2: (ax - ux) * (ax - ux) + (ay - uy) * (ay - uy) };
  };
  let tris: Tri[] = [make(n, n + 1, n + 2)];
  for (let p = 0; p < n; p++) {
    const [px, py] = all[p];
    const bad: Tri[] = [];
    const keep: Tri[] = [];
    for (const t of tris) ((px - t.x) * (px - t.x) + (py - t.y) * (py - t.y) < t.r2 ? bad : keep).push(t);
    // The boundary of the cavity: edges of bad triangles not shared by two bad triangles.
    const edges = new Map<string, [number, number]>();
    for (const t of bad) {
      for (const [u, v] of [[t.a, t.b], [t.b, t.c], [t.c, t.a]] as [number, number][]) {
        const key = u < v ? `${u}-${v}` : `${v}-${u}`;
        if (edges.has(key)) edges.delete(key);
        else edges.set(key, [u, v]);
      }
    }
    for (const [u, v] of edges.values()) keep.push(make(u, v, p));
    tris = keep;
  }
  const triangles: number[] = [];
  for (const t of tris) {
    if (t.a >= n || t.b >= n || t.c >= n) continue;
    const [ax, ay] = all[t.a], [bx, by] = all[t.b], [cxx, cyy] = all[t.c];
    if (!insideShape(shape, (ax + bx + cxx) / 3, (ay + by + cyy) / 3)) continue;
    const area = (bx - ax) * (cyy - ay) - (by - ay) * (cxx - ax);
    if (Math.abs(area) < 1e-12) continue;
    if (area > 0) triangles.push(t.a, t.b, t.c);
    else triangles.push(t.a, t.c, t.b);
  }
  const xy: number[] = [];
  for (const [x, y] of points) xy.push(x, y);
  return { xy, boundary, triangles };
}

interface Field {
  minX: number;
  minY: number;
  nx: number;
  ny: number;
  spacing: number;
  /** Dome height at each grid node, zero outside the outline. */
  height: Float32Array;
}

/**
 * A smooth, boundary-fixed field over the cap: the solution of a Poisson
 * problem (unit load, zero on and outside the outline and inside its holes)
 * on a regular grid, which is broad over wide bodies and modest over the
 * narrow band without the ridges of a distance field. Its normalised value
 * is shaped by a smoothstep so the dome leaves every edge with zero slope,
 * keeping the cap-to-bevel join tangent, then scaled to the dome height.
 */
function solveField(shape: Vec2[][], spacing: number, amplitude: number): Field {
  const [contour, ...holes] = shape;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of contour) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  minX -= 2 * spacing;
  minY -= 2 * spacing;
  const nx = Math.ceil((maxX - minX) / spacing) + 3;
  const ny = Math.ceil((maxY - minY) / spacing) + 3;
  const inside = new Uint8Array(nx * ny);
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const x = minX + i * spacing, y = minY + j * spacing;
      if (contains(contour, x, y) && !holes.some((hole) => contains(hole, x, y))) inside[j * nx + i] = 1;
    }
  }
  const u = new Float64Array(nx * ny);
  const load = spacing * spacing;
  const omega = 1.85;
  let peak = 0;
  let sweeps = 0;
  let largest = Infinity;
  while (sweeps < SOR_MAX_SWEEPS && largest > SOR_TOLERANCE * Math.max(peak, 1e-12)) {
    largest = 0;
    peak = 0;
    for (let j = 1; j < ny - 1; j++) {
      for (let i = 1; i < nx - 1; i++) {
        const n = j * nx + i;
        if (!inside[n]) continue;
        const target = (u[n - 1] + u[n + 1] + u[n - nx] + u[n + nx] + load) / 4;
        const delta = omega * (target - u[n]);
        u[n] += delta;
        if (Math.abs(delta) > largest) largest = Math.abs(delta);
        if (u[n] > peak) peak = u[n];
      }
    }
    sweeps++;
  }
  lastBuild.gridNodes = nx * ny;
  lastBuild.sweeps = sweeps;
  lastBuild.lastUpdate = peak > 0 ? largest / peak : 0;
  const height = new Float32Array(nx * ny);
  for (let n = 0; n < u.length; n++) {
    const t = peak > 0 ? u[n] / peak : 0;
    height[n] = amplitude * t * t * (3 - 2 * t);
  }
  return { minX, minY, nx, ny, spacing, height };
}

function sampleField(field: Field, x: number, y: number, out: { h: number; gx: number; gy: number }): void {
  const { minX, minY, nx, ny, spacing, height } = field;
  const fx = (x - minX) / spacing, fy = (y - minY) / spacing;
  const i = Math.max(1, Math.min(nx - 3, Math.floor(fx)));
  const j = Math.max(1, Math.min(ny - 3, Math.floor(fy)));
  const tx = Math.max(0, Math.min(1, fx - i)), ty = Math.max(0, Math.min(1, fy - j));
  const at = (ii: number, jj: number) => height[jj * nx + ii];
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  out.h = lerp(lerp(at(i, j), at(i + 1, j), tx), lerp(at(i, j + 1), at(i + 1, j + 1), tx), ty);
  // Gradient from central differences at the four corners, interpolated the same way.
  const gxAt = (ii: number, jj: number) => (at(ii + 1, jj) - at(ii - 1, jj)) / (2 * spacing);
  const gyAt = (ii: number, jj: number) => (at(ii, jj + 1) - at(ii, jj - 1)) / (2 * spacing);
  out.gx = lerp(lerp(gxAt(i, j), gxAt(i + 1, j), tx), lerp(gxAt(i, j + 1), gxAt(i + 1, j + 1), tx), ty);
  out.gy = lerp(lerp(gyAt(i, j), gyAt(i + 1, j), tx), lerp(gyAt(i, j + 1), gyAt(i + 1, j + 1), tx), ty);
}

/**
 * The front cap raised into a shallow dome: the cap retriangulated for
 * curvature, every vertex lifted by the field and given the field's own
 * normal, outline vertices fixed exactly on the flat cap plane with the cap
 * normal so the bevel meets them without a crack. Returns non-indexed
 * positions and normals.
 */
function domedCap(capZ: number, part: Part): { positions: Float32Array; normals: Float32Array } {
  const started = performance.now();
  const shape = contours(OUTLINES[part]);
  const mesh = triangulateCap(shape, EXTRUSION.domeEdge, EXTRUSION.domeEdge * 1.2);
  const field = solveField(shape, EXTRUSION.domeGrid, EXTRUSION.dome[part]);
  lastBuild.capVertices = mesh.xy.length / 2;
  lastBuild.capTriangles = mesh.triangles.length / 3;
  const vertexCount = mesh.xy.length / 2;
  const lifted = new Float32Array(vertexCount * 3);
  const normal = new Float32Array(vertexCount * 3);
  const sample = { h: 0, gx: 0, gy: 0 };
  for (let v = 0; v < vertexCount; v++) {
    const x = mesh.xy[v * 2], y = mesh.xy[v * 2 + 1];
    lifted[v * 3] = x;
    lifted[v * 3 + 1] = y;
    if (mesh.boundary[v]) {
      lifted[v * 3 + 2] = capZ;
      normal[v * 3 + 2] = 1;
      continue;
    }
    sampleField(field, x, y, sample);
    lifted[v * 3 + 2] = capZ + sample.h;
    const len = Math.hypot(sample.gx, sample.gy, 1);
    normal[v * 3] = -sample.gx / len;
    normal[v * 3 + 1] = -sample.gy / len;
    normal[v * 3 + 2] = 1 / len;
  }
  const out = { positions: new Float32Array(mesh.triangles.length * 3), normals: new Float32Array(mesh.triangles.length * 3) };
  mesh.triangles.forEach((v, k) => {
    out.positions.set(lifted.subarray(v * 3, v * 3 + 3), k * 3);
    out.normals.set(normal.subarray(v * 3, v * 3 + 3), k * 3);
  });
  lastBuild.buildMs = performance.now() - started;
  return out;
}

/**
 * One part as a solid: three's standard beveled extrusion of the cap
 * outline, with the part's bevel rolled outward from the drawn cap (the
 * silhouette is the cap grown by that radius), centred on z. The caps keep exact
 * flat normals and the sides get the profile's analytic normals, so nothing
 * is smoothed across the cap edge.
 */
export function createPartGeometry(part: Part): BufferGeometry {
  const depth = EXTRUSION.depth[part];
  const bevel = EXTRUSION.bevel[part];
  const extruded = new ExtrudeGeometry(partShape(part), {
    depth,
    steps: 1,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelOffset: 0,
    bevelSegments: EXTRUSION.bevelSegments,
    curveSegments: EXTRUSION.curveSegments,
  });
  extruded.translate(0, 0, -depth / 2);
  const capGroup = extruded.groups.find((g) => g.materialIndex === 0);
  const sideGroup = extruded.groups.find((g) => g.materialIndex === 1);
  if (!capGroup || !sideGroup) throw new Error('extrusion without cap and side groups');

  const caps = slice(extruded, capGroup.start, capGroup.count);
  caps.computeVertexNormals();
  const merged = mergeVertices(slice(extruded, sideGroup.start, sideGroup.count), 1e-5);
  merged.computeVertexNormals();
  profileNormals(merged, depth, bevel);
  const sides = merged.toNonIndexed();
  extruded.dispose();
  merged.dispose();

  let capPosition = caps.getAttribute('position').array as Float32Array;
  let capNormal = caps.getAttribute('normal').array as Float32Array;
  if (EXTRUSION.dome[part] > 0) {
    // The extrusion lists one cap's triangles then the other's; keep the back half flat and rebuild the front as a dome.
    const half = capPosition.length / 2;
    const backStart = capPosition[2] > 0 ? half / 3 : 0;
    const domed = domedCap(depth / 2 + bevel, part);
    const flatPosition = capPosition.slice(backStart * 3, backStart * 3 + half);
    const flatNormal = capNormal.slice(backStart * 3, backStart * 3 + half);
    capPosition = new Float32Array(flatPosition.length + domed.positions.length);
    capNormal = new Float32Array(flatNormal.length + domed.normals.length);
    capPosition.set(flatPosition);
    capPosition.set(domed.positions, flatPosition.length);
    capNormal.set(flatNormal);
    capNormal.set(domed.normals, flatNormal.length);
  }
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

/** Polished silver lit entirely by the authored environment; rim and letters share it. */
export function createEmblemMaterial(): MeshStandardMaterial {
  return new MeshStandardMaterial({
    color: new Color('#e3e5e9'),
    metalness: 1,
    roughness: 0.16,
    envMapIntensity: 1,
  });
}
