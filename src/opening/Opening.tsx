import { useState } from 'react';
import { awards, identity, work, type ProjectId } from '../content/work';
import { Caption } from './Caption';
import { SheetStage } from './SheetStage';
import { WorkIndex } from './WorkIndex';
import './opening.css';

export function Opening() {
  const [selected, setSelected] = useState<ProjectId | null>(null);

  return (
    <section className="opening" id="opening" data-testid="opening" aria-labelledby="name">
      <header className="masthead">
        <h1 className="masthead__name" id="name">
          <span className="masthead__first">Jeffrey</span> <span className="masthead__last">Tseng</span>
        </h1>
        <div className="identity" data-testid="identity">
          <ul className="identity__lines">
            {identity.lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <ul className="identity__contact">
            {identity.contact.map((c) => (
              <li key={c.href}>
                <a href={c.href} rel={c.href.startsWith('mailto:') ? undefined : 'me noreferrer'}>
                  {c.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </header>

      <div className="spread">
        <WorkIndex selected={selected} onSelect={(id) => setSelected((cur) => (cur === id ? null : id))} />
        <div className="stage">
          <SheetStage selected={selected} />
        </div>
        <Caption selected={selected} />
      </div>

      <aside className="strip" data-testid="recognition-strip" aria-labelledby="strip-heading">
        <h2 className="strip__heading" id="strip-heading">
          <a href="#hackathons">Hackathons</a>
        </h2>
        {awards.map((award) => (
          <div key={award.project} className="strip__award">
            <p className="strip__project">
              <span className="strip__name">{work[award.project].name}</span>
              <span className="strip__event">{award.event}</span>
            </p>
            <ul className="strip__categories">
              {award.categories.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
            <p className="strip__links">
              {award.links.map((l) => (
                <a key={l.href} href={l.href} target="_blank" rel="noreferrer">
                  {l.label}
                </a>
              ))}
            </p>
          </div>
        ))}
      </aside>
    </section>
  );
}
