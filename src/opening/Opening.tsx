import { identity } from '../content/site';
import './opening.css';

/**
 * The opening: the name owns the page, three factual lines sit above it, and
 * the sculpture fills the upper right and foreground behind. The section is
 * transparent so the fixed scene beneath the page shows through it. On
 * desktop it is pinned with position: sticky while the first chapter rises
 * over it at scroll speed; the name recedes and the sculpture folds away as
 * that happens (driven by --handoff and --fold from the scroll controller),
 * and once covered the section is hidden until the reader scrolls back. On
 * phones and under reduced motion the opening simply scrolls away.
 */
export function Opening() {
  return (
    <section className="opening" id="opening" data-testid="opening" data-zone="opening" aria-labelledby="name">
      <div className="opening__identity" data-testid="identity">
        {identity.lines.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>
      <h1 className="opening__name" id="name">
        <span className="opening__first">{identity.first}</span> <span className="opening__last">{identity.last}</span>
      </h1>
    </section>
  );
}
