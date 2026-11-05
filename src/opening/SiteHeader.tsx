import { useEffect, useState } from 'react';
import { identity, nav } from '../content/site';

/** Mirrors html[data-chapter], which the zone tracker writes from scroll position. */
function useCurrentChapter(): string {
  const [chapter, setChapter] = useState('');
  useEffect(() => {
    const root = document.documentElement;
    const read = () => setChapter(root.dataset.chapter ?? '');
    read();
    const observer = new MutationObserver(read);
    observer.observe(root, { attributes: true, attributeFilter: ['data-chapter'] });
    return () => observer.disconnect();
  }, []);
  return chapter;
}

/**
 * Fixed header: the name as a home link and the chapter navigation. The
 * current chapter is marked with aria-current and a solid underline; the
 * colours follow the zone under the header through --zone-field and
 * --zone-paper.
 */
export function SiteHeader() {
  const current = useCurrentChapter();
  return (
    <header className="site-header" data-testid="site-header">
      <a className="site-header__home label" href="#top">
        {identity.name}
      </a>
      <nav className="site-nav" data-testid="site-nav" aria-label="Chapters">
        <ul className="site-nav__list">
          {nav.map((item) => {
            const on = item.href === `#${current}`;
            return (
              <li key={item.href}>
                <a className="site-nav__link label" href={item.href} aria-current={on ? 'true' : undefined}>
                  {item.label}
                </a>
              </li>
            );
          })}
        </ul>
      </nav>
    </header>
  );
}
