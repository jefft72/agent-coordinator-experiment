import { identity, nav } from '../content/site';

export function SiteHeader() {
  return (
    <header className="site-header" data-testid="site-header">
      <a className="site-header__home label" href="#top">
        {identity.name}
      </a>
      <nav className="site-nav" data-testid="site-nav" aria-label="Sections">
        <ul className="site-nav__list">
          {nav.map((item) => (
            <li key={item.href}>
              <a className="site-nav__link label" href={item.href}>
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
