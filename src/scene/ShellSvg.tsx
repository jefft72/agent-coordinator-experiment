import { useMemo } from 'react';
import {
  FORM,
  buildShell,
  layoutFor,
  partMatrix,
  project,
  transformPoint,
  vertexAt,
  type Mat4,
  type Part,
  type ShellGeometry,
  type Vec3,
  type Viewport,
} from './shell';
import './scene-fallback.css';

export interface ShellSvgProps {
  viewport: Viewport;
  compact: boolean;
  className: string;
  testId: string;
}

interface Ring {
  d: string;
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** Projects one ring of the shell grid into a closed SVG path in pixel space. */
function ring(geometry: ShellGeometry, j: number, matrix: Mat4, fov: number, viewport: Viewport): Ring {
  const aspect = viewport.width / viewport.height;
  const p: Vec3 = [0, 0, 0];
  const q: Vec3 = [0, 0, 0];
  const s = { x: 0, y: 0, depth: 0 };
  const parts: string[] = [];
  const out: Ring = { d: '', left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity };
  for (let i = 0; i < geometry.rays; i++) {
    vertexAt(geometry, i, j, p);
    transformPoint(matrix, p, q);
    project(q, fov, aspect, s);
    const x = s.x * viewport.width;
    const y = s.y * viewport.height;
    parts.push(`${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`);
    out.left = Math.min(out.left, x);
    out.right = Math.max(out.right, x);
    out.top = Math.min(out.top, y);
    out.bottom = Math.max(out.bottom, y);
  }
  out.d = `${parts.join(' ')} Z`;
  return out;
}

interface Picture {
  part: Part;
  back: Ring;
  wall: Ring;
  face: Ring;
}

function pictureFor(part: Part, compact: boolean, viewport: Viewport): Picture {
  const layout = layoutFor(compact);
  const geometry = buildShell(FORM, part, 'poster', layout.gap);
  const matrix = partMatrix(layout, FORM, viewport, part, { reveal: 1, fold: 0 });
  return {
    part,
    back: ring(geometry, geometry.edges.backWall, matrix, layout.fov, viewport),
    wall: ring(geometry, geometry.edges.frontWall, matrix, layout.fov, viewport),
    face: ring(geometry, geometry.edges.frontDome, matrix, layout.fov, viewport),
  };
}

/**
 * The static poster: the two shells at rest, projected through the same
 * camera as the WebGL scene at the real viewport size. Each shell is three
 * nested rings: the dark back edge, the steel wall and rounded rim, and the
 * silver front face with one broad light-to-dark reflection and a soft
 * highlight, so the picture keeps the value hierarchy of the rendered metal.
 */
export function ShellSvg({ viewport, compact, className, testId }: ShellSvgProps) {
  const pictures = useMemo(() => [pictureFor('upper', compact, viewport), pictureFor('lower', compact, viewport)], [compact, viewport]);
  return (
    <svg
      className={className}
      data-testid={testId}
      viewBox={`0 0 ${viewport.width} ${viewport.height}`}
      preserveAspectRatio="none"
      width="100%"
      height="100%"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        {pictures.map((picture) => {
          const { face } = picture;
          const id = `${testId}-${picture.part}`;
          return (
            <g key={id}>
              <linearGradient id={`${id}-face`} gradientUnits="userSpaceOnUse" x1={face.left} y1={face.bottom} x2={face.right} y2={face.top}>
                <stop offset="0" stopColor="#e4e6e9" />
                <stop offset="0.38" stopColor="#b9bdc3" />
                <stop offset="0.7" stopColor="#6d7279" />
                <stop offset="1" stopColor="#3a3e45" />
              </linearGradient>
              <linearGradient id={`${id}-wall`} gradientUnits="userSpaceOnUse" x1={face.left} y1={face.top} x2={face.right} y2={face.bottom}>
                <stop offset="0" stopColor="#9ea3aa" />
                <stop offset="0.5" stopColor="#4c5057" />
                <stop offset="1" stopColor="#24272c" />
              </linearGradient>
              <radialGradient
                id={`${id}-sheen`}
                gradientUnits="userSpaceOnUse"
                cx={face.left + (face.right - face.left) * 0.3}
                cy={face.top + (face.bottom - face.top) * 0.62}
                r={(face.right - face.left) * 0.55}
              >
                <stop offset="0" stopColor="#ffffff" stopOpacity="0.5" />
                <stop offset="0.5" stopColor="#ffffff" stopOpacity="0.08" />
                <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
              </radialGradient>
            </g>
          );
        })}
      </defs>
      {pictures.map((picture) => {
        const id = `${testId}-${picture.part}`;
        return (
          <g key={id} data-part={picture.part}>
            <path d={picture.back.d} fill="#101114" />
            <path d={picture.wall.d} fill={`url(#${id}-wall)`} />
            <path d={picture.face.d} fill={`url(#${id}-face)`} />
            <path d={picture.face.d} fill={`url(#${id}-sheen)`} />
          </g>
        );
      })}
    </svg>
  );
}
