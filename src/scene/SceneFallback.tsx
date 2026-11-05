import { useEffect, useMemo, useState } from 'react';
import { BladeSvg } from './BladeSvg';
import { bladeCount, cameraFor, createField, type Viewport } from './bladeField';
import { buildFaces } from './faces';

function readViewport(): Viewport {
  if (typeof window === 'undefined') return { width: 1440, height: 900 };
  return { width: window.innerWidth || 1440, height: window.innerHeight || 900 };
}

/** The viewport size, refreshed on resize so the fallback keeps the scene's exact framing. */
function useViewport(): Viewport {
  const [viewport, setViewport] = useState(readViewport);
  useEffect(() => {
    let frame = 0;
    const onResize = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setViewport(readViewport()));
    };
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', onResize);
    };
  }, []);
  return viewport;
}

/**
 * Static composition with the same silhouette and framing as the WebGL scene,
 * projected through the same camera at the real viewport size. Used when WebGL
 * is unavailable, fails, or while the scene is still loading.
 */
export function SceneFallback({ compact }: { compact: boolean }) {
  const { width: viewW, height: viewH } = useViewport();
  const faces = useMemo(() => {
    const field = createField({ count: bladeCount(compact), compact });
    const camera = cameraFor(compact, { reveal: 1, fold: 0 }, undefined, { width: viewW, height: viewH });
    return buildFaces(field, camera, viewW, viewH);
  }, [compact, viewW, viewH]);
  return <BladeSvg faces={faces} viewW={viewW} viewH={viewH} fine={compact} className="scene-fallback" testId="scene-fallback" />;
}
