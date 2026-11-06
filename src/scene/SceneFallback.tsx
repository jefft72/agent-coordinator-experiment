import { useEffect, useState } from 'react';
import { MonogramSvg } from './MonogramSvg';
import type { Viewport } from './monogram';

function readViewport(): Viewport {
  if (typeof window === 'undefined') return { width: 1440, height: 900 };
  return { width: window.innerWidth || 1440, height: window.innerHeight || 900 };
}

/** The viewport size, refreshed on resize so the poster keeps the scene's exact framing. */
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
  const viewport = useViewport();
  return <MonogramSvg viewport={viewport} compact={compact} className="scene-fallback" testId="scene-fallback" />;
}
