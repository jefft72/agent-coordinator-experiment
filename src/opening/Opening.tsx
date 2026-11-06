import { identity } from '../content/site';
import './opening.css';

/**
 * The opening: one full viewport that belongs to the name, three factual
 * lines, and the split shell in the upper right (on phones, under the
 * lines). The section is transparent so the fixed scene beneath the page
 * shows through it. On desktop it is pinned with position: sticky while the
 * first chapter rises over it at scroll speed; the name recedes and the
 * shells close and turn away as that happens (driven by --handoff and
 * --fold from the scroll controller), and once covered the section is
 * hidden until the reader scrolls back. On phones and under reduced motion
 * the opening simply scrolls away.
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
