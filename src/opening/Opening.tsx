import { identity } from '../content/site';
import { SceneHost, type SceneHostProps } from './SceneHost';
import './opening.css';

/**
 * The opening: the name owns the page, three factual lines sit above it, and
 * the sculpture fills the upper right and foreground behind. The Work heading
 * follows immediately in normal document flow; its solid field background
 * rises over the fixed canvas as the sculpture folds away on scroll.
 */
export function Opening({ scene }: { scene: SceneHostProps }) {
  return (
    <section className="opening" id="opening" data-testid="opening" aria-labelledby="name">
      <SceneHost {...scene} />
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
