import type { Face } from './faces';
import './scene-fallback.css';

export interface BladeSvgProps {
  faces: Face[];
  viewW: number;
  viewH: number;
  /** Thinner edge strokes for small pictures. */
  fine: boolean;
  className: string;
  testId: string;
}

/** Draws projected blade faces: graphite base, broad and cool reflections, bright edges. */
export function BladeSvg({ faces, viewW, viewH, fine, className, testId }: BladeSvgProps) {
  const gradientId = `${testId}-broad`;
  return (
    <svg
      className={className}
      data-testid={testId}
      viewBox={`0 0 ${viewW} ${viewH}`}
      preserveAspectRatio="xMidYMid slice"
      width="100%"
      height="100%"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={gradientId} x1="0.15" y1="0" x2="0.85" y2="1">
          <stop offset="0" stopColor="#dfe2e6" stopOpacity="0.9" />
          <stop offset="0.55" stopColor="#7d838b" stopOpacity="0.5" />
          <stop offset="1" stopColor="#30343a" stopOpacity="0.1" />
        </linearGradient>
      </defs>
      {faces.map((face, i) => {
        const broad = Math.pow(face.broad, 10);
        const cool = Math.pow(face.cool, 14);
        const edge = Math.min(1, 0.18 + broad * 0.9 + cool * 0.6);
        return (
          <g key={i}>
            <polygon points={face.points} fill="#24272c" />
            {broad > 0.01 && (
              <polygon points={face.points} fill={`url(#${gradientId})`} opacity={Math.min(1, broad * 1.1)} />
            )}
            {cool > 0.01 && <polygon points={face.points} fill="#cfe0ff" opacity={cool * 0.45} />}
            <polygon
              points={face.points}
              fill="none"
              stroke="#d9dde2"
              strokeWidth={fine ? 0.6 : 0.8}
              strokeOpacity={edge}
              strokeLinejoin="round"
            />
          </g>
        );
      })}
    </svg>
  );
}
