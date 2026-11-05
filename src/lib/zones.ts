/**
 * Tracks which surface zone sits under the fixed header, so the header can
 * take that zone's colours and the navigation can mark the current chapter.
 *
 * Every element with data-zone is observed against a one-pixel band at the
 * header's bottom edge. When several zones touch the band (at a boundary, or
 * because the pinned opening always does) the last one in document order
 * wins, which is the one that has risen over the others. The result is
 * written to html[data-zone] and html[data-chapter]; nothing re-renders.
 */
export function installZoneTracker(): () => void {
  const root = document.documentElement;
  const zones = Array.from(document.querySelectorAll<HTMLElement>('[data-zone]'));
  if (zones.length === 0 || typeof IntersectionObserver === 'undefined') return () => undefined;

  const intersecting = new Set<HTMLElement>();
  let observer: IntersectionObserver | null = null;

  const publish = () => {
    let current: HTMLElement | null = null;
    for (const zone of zones) if (intersecting.has(zone)) current = zone;
    const zone = current?.dataset.zone ?? zones[0].dataset.zone ?? '';
    const chapter = current?.dataset.chapter ?? '';
    if (root.dataset.zone !== zone) root.dataset.zone = zone;
    if (root.dataset.chapter !== chapter) root.dataset.chapter = chapter;
  };

  const clearance = () => {
    const value = getComputedStyle(root).getPropertyValue('--header-clearance').trim();
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 86;
  };

  const connect = () => {
    observer?.disconnect();
    intersecting.clear();
    const line = clearance();
    const below = Math.max(0, (window.innerHeight || 0) - line - 1);
    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) intersecting.add(entry.target as HTMLElement);
          else intersecting.delete(entry.target as HTMLElement);
        }
        publish();
      },
      { rootMargin: `-${line}px 0px -${below}px 0px`, threshold: 0 },
    );
    for (const zone of zones) observer.observe(zone);
  };

  let frame = 0;
  const onResize = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(connect);
  };

  connect();
  window.addEventListener('resize', onResize);
  return () => {
    cancelAnimationFrame(frame);
    window.removeEventListener('resize', onResize);
    observer?.disconnect();
    delete root.dataset.zone;
    delete root.dataset.chapter;
  };
}
