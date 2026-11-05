import { useState } from 'react';
import { chapters, hackathonProjects } from '../content/site';
import type { Contribution, Project } from '../content/types';
import { ChapterEntry } from './ChapterEntry';
import { ContentLink } from './ContentLink';
import { ContributionTabs } from './Contributions';
import { Flow } from './Flow';
import { Media } from './Media';
import './chapters.css';
import './hackathons.css';

const chapter = chapters[0];

/** The award block: event, exact titles with their outcome, and the proof link. */
function AwardBlock({ project }: { project: Project }) {
  const { award } = project;
  if (!award) return null;
  return (
    <div className="award" data-testid={`award-${project.id}`}>
      <p className="label award__event">{award.event}</p>
      <ul className="award__titles">
        {award.titles.map(({ outcome, title }) => (
          <li key={title}>
            <span className="label">{outcome}</span> {title}
          </li>
        ))}
      </ul>
      <ContentLink className="award__proof" link={award.proof} />
    </div>
  );
}

interface SpreadProps {
  project: Project;
  /** Which side the media sits on at desktop width. */
  media: 'right' | 'left';
  /** Surface zone the spread paints; the first spread shares the chapter's. */
  zone?: string;
  surface?: string;
  eager?: boolean;
}

/**
 * One authored spread: the title and award enter from the text side, the real
 * media holds the other side at its real aspect ratio, the contribution
 * controls reveal Jeffrey's work in a reserved area, and the selected
 * contribution highlights its steps in the labelled flow under the media.
 * Everything is in document order, so the article reads completely without
 * the controls.
 */
function Spread({ project, media, zone, surface, eager = false }: SpreadProps) {
  const [selected, setSelected] = useState<Contribution>(project.contributions[0]);
  const titleId = `project-title-${project.id}`;
  const proofHref = project.award?.proof.href;
  const links = project.links.filter((link) => link.href !== proofHref);
  const evidence = project.evidence[0];
  const className = ['spread', `spread--media-${media}`, surface].filter(Boolean).join(' ');

  return (
    <article
      className={className}
      id={`project-${project.id}`}
      data-testid={`project-${project.id}`}
      data-zone={zone}
      data-chapter={zone ? 'hackathons' : undefined}
      aria-labelledby={titleId}
    >
      <div className="chapter__inner spread__grid">
        <header className="spread__head">
          <p className="label spread__kicker">{project.kind}</p>
          <h3 className="project__title" id={titleId}>
            {project.name}
          </h3>
          <AwardBlock project={project} />
          <p className="summary spread__summary">{project.summary}</p>
          <ul className="spread__figures" data-testid={`figures-${project.id}`}>
            {project.figures.map((figure) => (
              <li key={figure}>{figure}</li>
            ))}
          </ul>
        </header>

        {evidence ? <Media className="spread__media" item={evidence} eager={eager} /> : null}

        <div className="spread__contrib">
          <ContributionTabs project={project.id} contributions={project.contributions} onSelect={setSelected} />
        </div>

        {project.flow ? (
          <Flow
            className="spread__flow"
            project={project.id}
            title={project.flow.title}
            steps={project.flow.steps}
            active={selected.steps ?? []}
          />
        ) : null}

        <div className="spread__proof">
          <p className="label spread__role">{project.role}</p>
          <ul className="links">
            {links.map((link) => (
              <li key={link.href}>
                <ContentLink className="link--strong" link={link} />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </article>
  );
}

/**
 * Chapter 01. The entry names both projects and both verified wins at once;
 * then AnimaLabs holds the plum surface with its media on the right, and
 * OpenCraft reverses the balance on the forest surface.
 */
export function Hackathons() {
  const [animalabs, opencraft] = hackathonProjects;
  return (
    <section
      className="chapter surface--plum hackathons"
      id="hackathons"
      data-testid="chapter-hackathons"
      data-zone="hackathons"
      data-chapter="hackathons"
      aria-labelledby="hackathons-heading"
    >
      <div className="chapter__inner">
        <ChapterEntry chapter={chapter} aside="Two team projects, two track wins">
          <ul className="hack__index" data-testid="hackathons-index">
            {hackathonProjects.map((project) => (
              <li className="hack__index-item" key={project.id}>
                <a className="hack__index-name" href={`#project-${project.id}`}>
                  {project.name}
                </a>
                <p className="label hack__index-event">{project.award?.event}</p>
                <ul className="hack__index-titles">
                  {project.award?.titles.map(({ outcome, title }) => (
                    <li key={title}>
                      <span className="label">{outcome}</span> {title}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </ChapterEntry>
      </div>

      <Spread project={animalabs} media="right" eager />
      <Spread project={opencraft} media="left" zone="opencraft" surface="surface--forest" />
    </section>
  );
}
