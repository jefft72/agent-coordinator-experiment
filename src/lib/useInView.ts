import { useEffect, useState, type RefObject } from 'react';

/**
 * Whether any part of the element is inside the viewport, including the
 * clipping of ancestor scroll containers. Starts true until the observer
 * reports, so a freshly mounted element is not treated as hidden.
 */
export function useInView(ref: RefObject<Element | null>): boolean {
  const [inView, setInView] = useState(true);
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) setInView(entry.isIntersecting);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return inView;
}
