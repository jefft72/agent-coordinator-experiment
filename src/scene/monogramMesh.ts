import { BufferAttribute, BufferGeometry, Color, ExtrudeGeometry, MeshStandardMaterial, Path, Shape } from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import Delaunator from 'delaunator';
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

export interface CapMesh {
  /** x, y per vertex; z is the flat cap plane until the dome is applied. */
  xy: number[];
  /** 1 for vertices on the cap's outline, which stay fixed. */
  boundary: number[];
  /** Triangle vertex indices, counterclockwise. */
  triangles: number[];
  /** The resampled contours as ordered vertex indices, outer first then holes; consecutive pairs (closing round) are the boundary segments. */
  contours: number[][];
}

/** The contours with extra points inserted so no segment is longer than `maxEdge`; every point lies on the outline. */
function resample(shape: Vec2[][], maxEdge: number): { points: Vec2[]; contours: number[][] } {
  const points: Vec2[] = [];
  const contours: number[][] = [];
  for (const contour of shape) {
    const indices: number[] = [];
    for (let i = 0; i < contour.length; i++) {
      const [px, py] = contour[i];
      const [qx, qy] = contour[(i + 1) % contour.length];
      const pieces = Math.max(1, Math.ceil(Math.hypot(qx - px, qy - py) / maxEdge));
      for (let k = 0; k < pieces; k++) {
        indices.push(points.length);
        points.push([px + ((qx - px) * k) / pieces, py + ((qy - py) * k) / pieces]);
      }
    }
    contours.push(indices);
  }
  return { points, contours };
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
 * The cap triangulated for curvature: a Delaunay triangulation (Delaunator,
 * with robust orientation predicates) of the outline resampled to short
 * segments plus a regular grid of interior points kept clear of the
 * outline, with the triangles outside the cap removed. A Delaunay triangulation is not guaranteed to contain every
 * outline segment, so the result is not assumed correct: the unit tests
 * verify on the actual contour that every resampled boundary segment is a
 * single-incidence cap edge (or a collinear chain of them), that every other
 * edge has two opposite incidences, that no cap edge crosses the outline,
 * that the covered area equals the sampled polygon's, and that the cap is
 * one connected piece. Exported for those checks; it is pure and runs once
 * per build.
 */
export function triangulateCap(shape: Vec2[][], maxEdge: number, spacing: number): CapMesh {
  const sampled = resample(shape, maxEdge);
  const points: Vec2[] = sampled.points.slice();
  const boundary: number[] = sampled.points.map(() => 1);
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of points) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  // A regular grid: its cocircular squares are resolved consistently by the robust triangulator, and the
  // regular triangles sample the smooth field evenly.
  for (let y = minY + spacing * 0.37; y < maxY; y += spacing) {
    for (let x = minX + spacing * 0.41; x < maxX; x += spacing) {
      if (insideShape(shape, x, y) && contourDistance(shape, x, y) > maxEdge * 0.9) {
        points.push([x, y]);
        boundary.push(0);
      }
    }
  }

  // Delaunay triangulation with robust orientation predicates, then only the triangles inside the cap, counterclockwise.
  const flat = new Float64Array(points.length * 2);
  points.forEach(([x, y], i) => {
    flat[i * 2] = x;
    flat[i * 2 + 1] = y;
  });
  const delaunay = new Delaunator(flat);
  const triangles: number[] = [];
  for (let t = 0; t < delaunay.triangles.length; t += 3) {
    const a = delaunay.triangles[t], b = delaunay.triangles[t + 1], c = delaunay.triangles[t + 2];
    const [ax, ay] = points[a], [bx, by] = points[b], [cx, cy] = points[c];
    if (!insideShape(shape, (ax + bx + cx) / 3, (ay + by + cy) / 3)) continue;
    const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    if (Math.abs(area) < 1e-14) continue;
    if (area > 0) triangles.push(a, b, c);
    else triangles.push(a, c, b);
  }
  const xy: number[] = [];
  for (const [x, y] of points) xy.push(x, y);
  return { xy, boundary, triangles, contours: sampled.contours };
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

/**
 * Height and gradient at a point from the grid with bicubic (Catmull-Rom)
 * interpolation, so the sampled surface and its normal are smooth across
 * grid cells; bilinear sampling would leave the cells' creases visible as
 * steps in long highlights. The height is never below the cap plane.
 */
function sampleField(field: Field, x: number, y: number, out: { h: number; gx: number; gy: number }): void {
  const { minX, minY, nx, ny, spacing, height } = field;
  const fx = (x - minX) / spacing, fy = (y - minY) / spacing;
  const i = Math.max(1, Math.min(nx - 3, Math.floor(fx)));
  const j = Math.max(1, Math.min(ny - 3, Math.floor(fy)));
  const tx = Math.max(0, Math.min(1, fx - i)), ty = Math.max(0, Math.min(1, fy - j));
  const cubic = (p0: number, p1: number, p2: number, p3: number, t: number) =>
    0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);
  const slope = (p0: number, p1: number, p2: number, p3: number, t: number) =>
    0.5 * (-p0 + p2 + 2 * (2 * p0 - 5 * p1 + 4 * p2 - p3) * t + 3 * (-p0 + 3 * p1 - 3 * p2 + p3) * t * t);
  const rows: number[] = [];
  const rowSlopes: number[] = [];
  for (let dj = -1; dj <= 2; dj++) {
    const row = (j + dj) * nx;
    const p = [height[row + i - 1], height[row + i], height[row + i + 1], height[row + i + 2]];
    rows.push(cubic(p[0], p[1], p[2], p[3], tx));
    rowSlopes.push(slope(p[0], p[1], p[2], p[3], tx));
  }
  const h = cubic(rows[0], rows[1], rows[2], rows[3], ty);
  out.h = Math.max(0, h);
  out.gx = h > 0 ? cubic(rowSlopes[0], rowSlopes[1], rowSlopes[2], rowSlopes[3], ty) / spacing : 0;
  out.gy = h > 0 ? slope(rows[0], rows[1], rows[2], rows[3], ty) / spacing : 0;
}

/**
 * The front cap raised into a shallow dome: the cap retriangulated for
 * curvature, every vertex lifted by the field and given the field's own
 * smooth normal, and outline vertices fixed exactly on the flat cap plane
 * with the cap normal so the bevel meets them without a crack. Returns
 * non-indexed positions and normals.
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
  // Heights and normals both come from the smooth field, so the normals are independent of the triangles'
  // shapes; on polished metal, normals taken from an irregular triangle fan show as waviness. Outline vertices
  // keep the flat cap plane and normal so the bevel meets them without a seam.
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
