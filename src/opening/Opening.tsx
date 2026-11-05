import { identity } from '../content/site';
import './opening.css';

/**
 * The opening: the name owns the page, three factual lines sit above it, and
 * the sculpture fills the upper right and foreground behind. The section is
 * transparent so the fixed scene beneath the page shows through it; the Work
 * section that follows paints a solid field and rises over the canvas as the
 * sculpture folds away on scroll.
 */
export function Opening() {
  return (
    <section className="opening" id="opening" data-testid="opening" aria-labelledby="name">
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
