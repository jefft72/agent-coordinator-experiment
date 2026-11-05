import { useEffect, useState } from 'react';

/** Mirrors document.visibilityState, so timelines can pause in a hidden tab and resume when shown. */
export function useDocumentVisible(): boolean {
  const [visible, setVisible] = useState(() => (typeof document === 'undefined' ? true : document.visibilityState !== 'hidden'));
  useEffect(() => {
    const onChange = () => setVisible(document.visibilityState !== 'hidden');
    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  }, []);
  return visible;
}
