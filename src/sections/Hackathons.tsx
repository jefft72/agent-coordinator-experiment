import { awards, work } from '../content/work';
import './hackathons.css';

/**
 * The recognition chapter. Both hackathon projects get first-class space
 * right after the opening. Oxblood ground, pale-blue type, neutral image
 * lighting: the frames keep their own colors.
 */
export function Hackathons() {
  const anima = awards.find((a) => a.project === 'animalabs')!;
  const open = awards.find((a) => a.project === 'opencraft')!;

  return (
    <section className="hackathons" id="hackathons" aria-labelledby="hackathons-heading">
      <div className="hackathons__inner">
        <header className="hackathons__head">
          <h2 className="hackathons__heading" id="hackathons-heading">
            Hackathons
          </h2>
          <a className="hackathons__back" href="#work-index">
            Work index
          </a>
        </header>

        <article className="win win--animalabs" aria-labelledby="win-animalabs">
          <a className="win__media" href={work.animalabs.links[1].href} target="_blank" rel="noreferrer">
            <img
              src={anima.image.src}
              alt={anima.image.alt}
              width={anima.image.width}
              height={anima.image.height}
              loading="lazy"
              decoding="async"
            />
            <span className="win__media-label">Watch the demo on YouTube</span>
          </a>
          <div className="win__text">
            <h3 className="win__name" id="win-animalabs">
              AnimaLabs
            </h3>
            <p className="win__event">{anima.event}</p>
            <ul className="win__awards">
              {anima.categories.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
            <p className="win__fact">{work.animalabs.facts[0]}</p>
            <p className="win__fact">{work.animalabs.facts[1]}</p>
            <ul className="win__links">
              {work.animalabs.links.map((l) => (
                <li key={l.href}>
                  <a href={l.href} target="_blank" rel="noreferrer">
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </article>

        <article className="win win--opencraft" aria-labelledby="win-opencraft">
          <a className="win__media" href={work.opencraft.links[2].href} target="_blank" rel="noreferrer">
            <img
              src={open.image.src}
              alt={open.image.alt}
              width={open.image.width}
              height={open.image.height}
              loading="lazy"
              decoding="async"
            />
            <span className="win__media-label">Watch the demo on YouTube</span>
          </a>
          <div className="win__text">
            <h3 className="win__name" id="win-opencraft">
              OpenCraft
            </h3>
            <p className="win__event">{open.event}</p>
            <ul className="win__awards">
              {open.categories.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
            <p className="win__fact">{work.opencraft.facts[0]}</p>
            <p className="win__fact">{work.opencraft.facts[1]}</p>
            <ul className="win__links">
              {work.opencraft.links.map((l) => (
                <li key={l.href}>
                  <a href={l.href} target="_blank" rel="noreferrer">
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </article>
      </div>
    </section>
  );
}
