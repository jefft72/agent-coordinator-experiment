import { useMemo } from 'react';
import {
  EXTRUSION,
  OUTLINES,
  PARTS,
  contours,
  layoutFor,
  partMatrix,
  pixelsPerUnit,
  projectOutline,
  thickness,
  type Part,
  type Viewport,
} from './monogram';
import './scene-fallback.css';

export interface MonogramSvgProps {
  viewport: Viewport;
  compact: boolean;
  className: string;
  testId: string;
}

interface Picture {
  part: Part;
  /** The cap contours (outer boundary, then holes) at the back and front cap planes, in pixels. */
  back: string;
  front: string;
  /** Pixel bounds of the front cap, for the gradients. */
  left: number;
  top: number;
  right: number;
  bottom: number;
  /** The bevel radius in pixels: the silhouette is the cap grown by this. */
  bevel: number;
}

const REST = { reveal: 1, fold: 0 };

function pictureFor(part: Part, compact: boolean, viewport: Viewport): Picture {
  const layout = layoutFor(compact);
  const matrix = partMatrix(layout, viewport, part, REST);
  const aspect = viewport.width / viewport.height;
  const picture: Picture = { part, back: '', front: '', left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity, bevel: 0 };
  const draw = (z: number, track: boolean) =>
    contours(OUTLINES[part])
      .map((points) => {
        const parts: string[] = [];
        projectOutline(points, z, matrix, layout.fov, aspect).forEach((s, i) => {
          const x = s.x * viewport.width;
          const y = s.y * viewport.height;
          parts.push(`${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`);
          if (track) {
            picture.left = Math.min(picture.left, x);
            picture.right = Math.max(picture.right, x);
            picture.top = Math.min(picture.top, y);
            picture.bottom = Math.max(picture.bottom, y);
          }
        });
        return `${parts.join(' ')} Z`;
      })
      .join(' ');
  const half = thickness(part) / 2;
  picture.back = draw(-half, false);
  picture.front = draw(half, true);
  picture.bevel = EXTRUSION.bevel[part] * pixelsPerUnit(layout, viewport, REST);
  return picture;
}

/**
 * The static poster: the emblem at rest, drawn from the same cap outlines
 * and projected through the same camera as the WebGL scene at the real
 * viewport size. The silhouette of each part is its cap grown by its own
 * bevel, which a round-joined stroke of twice that bevel paints exactly, so
 * the rim's hole stays open and the letter tips stay sharp. Each part is its dark back silhouette, then its
 * front silhouette in the bevel's rolling gradient, then the flat cap in
 * silver on top, so the picture keeps the sharp caps and rounded edges of
 * the rendered metal.
 */
export function MonogramSvg({ viewport, compact, className, testId }: MonogramSvgProps) {
  const pictures = useMemo(() => PARTS.map((part) => pictureFor(part, compact, viewport)), [compact, viewport]);
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
          const id = `${testId}-${picture.part}`;
          return (
            <g key={id}>
              <linearGradient id={`${id}-cap`} gradientUnits="userSpaceOnUse" x1={picture.left} y1={picture.top} x2={picture.right} y2={picture.bottom}>
                <stop offset="0" stopColor="#d4d7dc" />
                <stop offset="0.55" stopColor="#aeb2b8" />
                <stop offset="1" stopColor="#7c8188" />
              </linearGradient>
              <linearGradient id={`${id}-bevel`} gradientUnits="userSpaceOnUse" x1={picture.left} y1={picture.top} x2={picture.right} y2={picture.bottom}>
                <stop offset="0" stopColor="#f4f5f7" />
                <stop offset="0.5" stopColor="#80858c" />
                <stop offset="1" stopColor="#1f2227" />
              </linearGradient>
            </g>
          );
        })}
      </defs>
      {pictures.map((picture) => {
        const id = `${testId}-${picture.part}`;
        const grown = picture.bevel * 2;
        return (
          <g key={id} data-part={picture.part}>
            <path d={picture.back} fill="#1f2227" fillRule="evenodd" stroke="#1f2227" strokeWidth={grown} strokeLinejoin="round" />
            <path d={picture.front} fill={`url(#${id}-bevel)`} fillRule="evenodd" stroke={`url(#${id}-bevel)`} strokeWidth={grown} strokeLinejoin="round" />
            <path d={picture.front} fill={`url(#${id}-cap)`} fillRule="evenodd" />
          </g>
        );
      })}
    </svg>
  );
}
