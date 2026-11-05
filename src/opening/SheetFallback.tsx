import type { ReactNode } from 'react';
import type { ProjectId } from '../content/work';
import { images } from '../content/work';
import { useMediaQuery } from '../lib/useMediaQuery';
import './sheet-fallback.css';

/**
 * Non-WebGL contact sheet. The same six artifacts the WebGL scene stages,
 * composed in 2D/CSS-3D on the pale blue page ground. Placement echoes
 * LAYOUT in src/scene/contract.ts: OpenCraft front left, AnimaLabs centre
 * right, Diffex cropped at the right edge, Judi and RTX in the back, UPlate
 * front right, and the upper-left quadrant left empty on purpose.
 *
 * The HTML index and caption carry all the words, so the whole sheet is
 * aria-hidden; the images still carry alt text for anyone reading the DOM.
 */

const INK = '#16131A';
const INK_EDGE = '#221D28';
const SILVER = '#EEF2F4';
const SILVER_DEEP = '#B9C6CE';
const SILVER_MID = '#D6DFE4';
const GREEN = '#5F7B66';
const GREEN_DEEP = '#4A6350';
const GREEN_LIGHT = '#7E9A82';
const SOIL = '#6B5A4E';
const SOIL_DEEP = '#574840';

interface SheetFallbackProps {
  selected: ProjectId | null;
  compact: boolean;
}

type ArtifactState = 'rest' | 'selected' | 'dimmed';

export function SheetFallback({ selected, compact }: SheetFallbackProps) {
  const narrow = useMediaQuery('(max-width: 767px)');
  const isCompact = compact || narrow;
  const stateOf = (id: ProjectId): ArtifactState =>
    selected === null ? 'rest' : selected === id ? 'selected' : 'dimmed';

  return (
    <div
      data-testid="sheet-fallback"
      className={isCompact ? 'sheet-fallback is-compact' : 'sheet-fallback'}
      data-selected={selected ?? 'none'}
      data-compact={isCompact ? 'true' : 'false'}
      aria-hidden="true"
    >
      <Artifact id="judi" state={stateOf('judi')}>
        <JudiTray />
      </Artifact>

      <Artifact id="rtx" state={stateOf('rtx')}>
        <RoutePlate />
      </Artifact>

      <Artifact id="diffex" state={stateOf('diffex')}>
        <AccordionRibbon />
      </Artifact>

      <Artifact id="animalabs" state={stateOf('animalabs')}>
        <PageFan />
        <div className="sf-plate sf-plate--animalabs">
          <img
            src={images.animalabs}
            alt="Title frame of the AnimaLabs demo video"
            width={1280}
            height={720}
            loading="eager"
            decoding="async"
            draggable={false}
          />
        </div>
      </Artifact>

      <Artifact id="opencraft" state={stateOf('opencraft')}>
        <div className="sf-board sf-board--opencraft">
          <img
            src={images.opencraft}
            alt="Frame from the OpenCraft demo video"
            width={1280}
            height={720}
            loading="eager"
            decoding="async"
            draggable={false}
          />
        </div>
        <VoxelSite />
      </Artifact>

      <Artifact id="uplate" state={stateOf('uplate')}>
        <div className="sf-phone sf-phone--uplate">
          <img
            src={images.uplateOnboarding}
            alt="UPlate onboarding screen"
            width={1206}
            height={2622}
            loading="eager"
            decoding="async"
            draggable={false}
          />
        </div>
      </Artifact>
    </div>
  );
}

function Artifact({ id, state, children }: { id: ProjectId; state: ArtifactState; children: ReactNode }) {
  return (
    <div className={`sf-artifact sf-artifact--${id}`} data-artifact={id} data-state={state}>
      <div className="sf-artifact__shadow" />
      <div className="sf-artifact__body">{children}</div>
    </div>
  );
}

/* ---------- isometric helpers ---------- */

const ISO_W = 0.866;
const ISO_H = 0.5;

interface IsoFrame {
  s: number;
  ox: number;
  oy: number;
}

function iso(i: number, j: number, k: number, f: IsoFrame): string {
  const x = f.ox + (i - j) * f.s * ISO_W;
  const y = f.oy + (i + j) * f.s * ISO_H - k * f.s;
  return `${x.toFixed(2)},${y.toFixed(2)}`;
}

interface BoxProps {
  i: number;
  j: number;
  k: number;
  di?: number;
  dj?: number;
  dk: number;
  f: IsoFrame;
  top: string;
  left: string;
  right: string;
}

/** A box seen from the classic isometric corner: top, lower-left, lower-right faces. */
function Box({ i, j, k, di = 1, dj = 1, dk, f, top, left, right }: BoxProps) {
  const t = k + dk;
  const topPts = [iso(i, j, t, f), iso(i + di, j, t, f), iso(i + di, j + dj, t, f), iso(i, j + dj, t, f)].join(' ');
  const rightPts = [iso(i + di, j, t, f), iso(i + di, j + dj, t, f), iso(i + di, j + dj, k, f), iso(i + di, j, k, f)].join(' ');
  const leftPts = [iso(i, j + dj, t, f), iso(i + di, j + dj, t, f), iso(i + di, j + dj, k, f), iso(i, j + dj, k, f)].join(' ');
  return (
    <g>
      <polygon points={leftPts} fill={left} />
      <polygon points={rightPts} fill={right} />
      <polygon points={topPts} fill={top} />
    </g>
  );
}

/* ---------- OpenCraft: voxel dig site ---------- */

const SITE_HEIGHTS = [
  [2, 3, 2, 2, 1],
  [3, 2, 2, 1, 2],
  [2, 1, 0, 1, 2],
  [2, 2, 1, 2, 3],
  [1, 2, 2, 2, 2],
];

function VoxelSite() {
  const f: IsoFrame = { s: 14, ox: 80, oy: 48 };
  const cubes: ReactNode[] = [];
  const cells: Array<[number, number]> = [];
  for (let i = 0; i < 5; i += 1) {
    for (let j = 0; j < 5; j += 1) cells.push([i, j]);
  }
  cells.sort((a, b) => a[0] + a[1] - (b[0] + b[1]));
  for (const [i, j] of cells) {
    const h = SITE_HEIGHTS[i][j];
    if (h === 0) {
      cubes.push(<Box key={`soil-${i}-${j}`} i={i} j={j} k={0} dk={0.35} f={f} top={SOIL} left={SOIL_DEEP} right={SOIL_DEEP} />);
      continue;
    }
    for (let k = 0; k < h; k += 1) {
      cubes.push(<Box key={`c-${i}-${j}-${k}`} i={i} j={j} k={k} dk={1} f={f} top={GREEN_LIGHT} left={GREEN_DEEP} right={GREEN} />);
    }
  }
  const [px, py] = iso(3.5, 4.5, 3, f).split(',').map(Number);
  return (
    <svg className="sf-voxel" viewBox="0 0 160 124" role="presentation" focusable="false">
      {cubes}
      <line x1={px} y1={py} x2={px} y2={py - 30} stroke={INK} strokeWidth={1.4} strokeLinecap="round" />
      <polygon points={`${px},${py - 30} ${px + 11},${py - 26} ${px},${py - 22}`} fill={SILVER} stroke={INK} strokeWidth={0.6} />
    </svg>
  );
}

/* ---------- AnimaLabs: fan of report pages ---------- */

const CHARTS: ReactNode[] = [
  <path key="c0" d="M8 30 C 18 28, 24 14, 32 16 S 48 8, 56 10" fill="none" stroke={INK} strokeWidth={1.1} />,
  <g key="c1" fill={INK}>
    <rect x={12} y={22} width={5} height={14} />
    <rect x={21} y={14} width={5} height={22} />
    <rect x={30} y={26} width={5} height={10} />
    <rect x={39} y={9} width={5} height={27} />
    <rect x={48} y={18} width={5} height={18} />
  </g>,
  <path key="c2" d="M8 20 L16 24 L24 12 L32 18 L40 8 L48 14 L56 6" fill="none" stroke={INK} strokeWidth={1.1} />,
  <g key="c3" fill={INK}>
    <rect x={12} y={30} width={5} height={6} />
    <rect x={21} y={24} width={5} height={12} />
    <rect x={30} y={16} width={5} height={20} />
    <rect x={39} y={20} width={5} height={16} />
    <rect x={48} y={10} width={5} height={26} />
  </g>,
  <path key="c4" d="M8 34 Q 24 34 32 20 T 56 8" fill="none" stroke={INK} strokeWidth={1.1} />,
];

function PageFan() {
  return (
    <div className="sf-fan">
      {CHARTS.map((chart, n) => (
        <div className="sf-page" key={n} style={{ '--i': n } as React.CSSProperties}>
          <svg viewBox="0 0 60 44" role="presentation" focusable="false">
            <path d="M8 4 V36 H56" fill="none" stroke={INK} strokeWidth={0.8} />
            {chart}
          </svg>
        </div>
      ))}
    </div>
  );
}

/* ---------- Diffex: folded accordion ribbon ---------- */

const RIBBON_X = [0, 96, 208, 300, 416, 512, 620, 720];
const RIBBON_TICKS: Array<[number, number, number]> = [
  [40, 60, 10],
  [70, 122, 6],
  [132, 88, 14],
  [162, 150, 8],
  [238, 70, 6],
  [272, 140, 12],
  [334, 100, 8],
  [382, 50, 10],
  [452, 160, 6],
  [474, 90, 14],
  [546, 120, 8],
  [582, 70, 6],
  [652, 110, 10],
  [694, 160, 8],
];

function AccordionRibbon() {
  const top = (n: number) => (n % 2 === 0 ? 6 : 30);
  const bot = (n: number) => (n % 2 === 0 ? 232 : 206);
  return (
    <svg className="sf-ribbon" viewBox="0 0 720 240" preserveAspectRatio="xMinYMid slice" role="presentation" focusable="false">
      {RIBBON_X.slice(0, -1).map((x0, n) => {
        const x1 = RIBBON_X[n + 1];
        const pts = `${x0},${top(n)} ${x1},${top(n + 1)} ${x1},${bot(n + 1)} ${x0},${bot(n)}`;
        return <polygon key={n} points={pts} fill={n % 2 === 0 ? INK : INK_EDGE} stroke={SILVER} strokeWidth={1} strokeLinejoin="round" />;
      })}
      {RIBBON_TICKS.map(([x, y, h], n) => (
        <rect key={n} x={x} y={y} width={2} height={h} fill={SILVER} />
      ))}
    </svg>
  );
}

/* ---------- Judi: microVM placement tray ---------- */

const TRAY_HEIGHTS = [
  [0.35, 0.7, 0.25],
  [0.55, 0.3, 0.8],
  [0.25, 0.6, 0.4],
  [0.7, 0.3, 0.5],
];

function JudiTray() {
  const f: IsoFrame = { s: 22, ox: 100, oy: 34 };
  const slabs: ReactNode[] = [];
  const cells: Array<[number, number]> = [];
  for (let i = 0; i < 4; i += 1) {
    for (let j = 0; j < 3; j += 1) cells.push([i, j]);
  }
  cells.sort((a, b) => a[0] + a[1] - (b[0] + b[1]));
  for (const [i, j] of cells) {
    const green = i === 2 && j === 1;
    slabs.push(
      <Box
        key={`slab-${i}-${j}`}
        i={i + 0.2}
        j={j + 0.2}
        k={0}
        di={0.6}
        dj={0.6}
        dk={TRAY_HEIGHTS[i][j]}
        f={f}
        top={green ? GREEN_LIGHT : SILVER}
        left={green ? GREEN_DEEP : SILVER_DEEP}
        right={green ? GREEN : SILVER_MID}
      />,
    );
  }
  return (
    <svg className="sf-tray" viewBox="0 0 200 124" role="presentation" focusable="false">
      <Box i={0} j={0} k={-0.22} di={4} dj={3} dk={0.22} f={f} top={SILVER} left={SILVER_DEEP} right={SILVER_MID} />
      <polygon
        points={[iso(0, 0, 0, f), iso(4, 0, 0, f), iso(4, 3, 0, f), iso(0, 3, 0, f)].join(' ')}
        fill="none"
        stroke={INK}
        strokeWidth={0.5}
        opacity={0.5}
      />
      {slabs}
    </svg>
  );
}

/* ---------- Purdue / RTX: route plate ---------- */

const ROUTE: Array<[number, number]> = [
  [14, 150],
  [70, 112],
  [124, 164],
  [182, 118],
  [204, 44],
  [262, 112],
  [312, 92],
];
const POSTS: Array<[number, number]> = [
  [60, 70],
  [150, 192],
  [228, 84],
  [286, 196],
];

function RoutePlate() {
  const project = (u: number, v: number): [number, number] => [u - 0.3 * v + 80, 0.42 * v + 20];
  const pts = ROUTE.map(([u, v]) => project(u, v));
  return (
    <svg className="sf-route" viewBox="0 0 420 170" role="presentation" focusable="false">
      <g transform="matrix(1 0 -0.3 0.42 80 20)">
        <rect x={0} y={0} width={320} height={280} rx={18} fill={SILVER} />
        <rect x={0} y={0} width={320} height={280} rx={18} fill="none" stroke={SILVER_DEEP} strokeWidth={1.5} />
      </g>
      {POSTS.map(([u, v], n) => {
        const [x, y] = project(u, v);
        return <ellipse key={`ps-${n}`} cx={x} cy={y} rx={6} ry={2.4} fill={SILVER_DEEP} />;
      })}
      <polyline points={pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')} fill="none" stroke={INK} strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" />
      {pts.map(([x, y], n) => (
        <ellipse key={`wp-${n}`} cx={x} cy={y} rx={4.2} ry={2.1} fill={SILVER_DEEP} stroke={INK} strokeWidth={0.8} />
      ))}
      {POSTS.map(([u, v], n) => {
        const [x, y] = project(u, v);
        return (
          <g key={`post-${n}`}>
            <rect x={x - 2} y={y - 24} width={4} height={24} fill={INK} />
            <rect x={x - 4} y={y - 27} width={8} height={3} fill={INK_EDGE} />
          </g>
        );
      })}
    </svg>
  );
}
