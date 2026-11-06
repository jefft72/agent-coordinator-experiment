import { useMemo } from 'react';
import {
  EXTRUSION,
  LETTERS,
  THICKNESS,
  centredOutline,
  layoutFor,
  letterMatrix,
  pixelsPerUnit,
  projectOutline,
  type Letter,
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
  letter: Letter;
  /** The silhouette at the back wall and at the front wall, in pixels. */
  back: string;
  front: string;
  /** Pixel bounds of the front silhouette, for the gradients. */
  left: number;
  top: number;
  right: number;
  bottom: number;
  /** Width of the bevel band in pixels. */
  bevel: number;
}

const REST = { reveal: 1, fold: 0 };

function pictureFor(letter: Letter, compact: boolean, viewport: Viewport): Picture {
  const layout = layoutFor(compact);
  const matrix = letterMatrix(layout, viewport, letter, REST);
  const aspect = viewport.width / viewport.height;
  const outline = centredOutline(letter);
  const toPath = (z: number, track: boolean, out: Picture) => {
    const parts: string[] = [];
    projectOutline(outline, z, matrix, layout.fov, aspect).forEach((s, i) => {
      const x = s.x * viewport.width;
      const y = s.y * viewport.height;
      parts.push(`${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`);
      if (track) {
        out.left = Math.min(out.left, x);
        out.right = Math.max(out.right, x);
        out.top = Math.min(out.top, y);
        out.bottom = Math.max(out.bottom, y);
      }
    });
    return `${parts.join(' ')} Z`;
  };
  const picture: Picture = { letter, back: '', front: '', left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity, bevel: 0 };
  picture.back = toPath(-THICKNESS / 2, false, picture);
  picture.front = toPath(THICKNESS / 2, true, picture);
  picture.bevel = EXTRUSION.bevel * pixelsPerUnit(layout, viewport, REST);
  return picture;
}

/**
 * The static poster: the monogram at rest, drawn from the same outlines and
 * projected through the same camera as the WebGL scene at the real viewport
 * size. Each letter is its dark back silhouette, then its front silhouette
 * filled with one broad silver gradient, with the bevel band painted as a
 * stroke clipped to the silhouette, so the picture keeps the rounded-edge
 * value hierarchy of the rendered metal.
 */
export function MonogramSvg({ viewport, compact, className, testId }: MonogramSvgProps) {
  const pictures = useMemo(() => LETTERS.map((letter) => pictureFor(letter, compact, viewport)), [compact, viewport]);
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
          const id = `${testId}-${picture.letter}`;
          return (
            <g key={id}>
              <clipPath id={`${id}-clip`}>
                <path d={picture.front} />
              </clipPath>
              <linearGradient id={`${id}-face`} gradientUnits="userSpaceOnUse" x1={picture.left} y1={picture.top} x2={picture.right} y2={picture.bottom}>
                <stop offset="0" stopColor="#dfe2e6" />
                <stop offset="0.5" stopColor="#b4b8be" />
                <stop offset="1" stopColor="#7a7f87" />
              </linearGradient>
              <linearGradient id={`${id}-bevel`} gradientUnits="userSpaceOnUse" x1={picture.left} y1={picture.top} x2={picture.right} y2={picture.bottom}>
                <stop offset="0" stopColor="#f6f7f8" />
                <stop offset="0.45" stopColor="#8d9299" />
                <stop offset="1" stopColor="#23262b" />
              </linearGradient>
            </g>
          );
        })}
      </defs>
      {pictures.map((picture) => {
        const id = `${testId}-${picture.letter}`;
        return (
          <g key={id} data-part={picture.letter}>
            <path d={picture.back} fill="#1f2227" />
            <path d={picture.front} fill={`url(#${id}-face)`} />
            <path d={picture.front} fill="none" stroke={`url(#${id}-bevel)`} strokeWidth={picture.bevel * 2} strokeLinejoin="round" clipPath={`url(#${id}-clip)`} />
          </g>
        );
      })}
    </svg>
  );
}
