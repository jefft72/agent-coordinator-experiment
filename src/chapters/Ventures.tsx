import { useState, type KeyboardEvent } from 'react';
import { chapters, projectById } from '../content/site';
import type { Project } from '../content/types';
import { ChapterEntry } from './ChapterEntry';
import { ContentLink } from './ContentLink';
import { ContributionBlocks } from './Contributions';
import { Flow } from './Flow';
import { Media } from './Media';
import './ventures.css';

const chapter = chapters.find((entry) => entry.id === 'ventures') ?? chapters[2];
const diffex = projectById.diffex;
const uplate = projectById.uplate;

/**
 * 03 / Ventures: the dark field returns with two vertically sequenced product
 * stories that share no card template. Diffex is told in wide type, with the
 * two evidence figures set large beside their qualifications. UPlate reverses
 * the balance: the real phone screenshots carry the weight beside the name.
 */
export function Ventures() {
  return (
    <section
      className="chapter"
      id="ventures"
      data-testid="chapter-ventures"
      data-zone="ventures"
      data-chapter="ventures"
      aria-labelledby="ventures-heading"
    >
      <div className="chapter__inner">
        <ChapterEntry chapter={chapter} aside={`${diffex.name} / ${uplate.name}`} />
        <DiffexStory project={diffex} />
        <UplateStory project={uplate} />
      </div>
    </section>
  );
}

/** Kind, role, and dates, adjacent to the name in both stories. */
function Meta({ project }: { project: Project }) {
  return (
    <div className="venture__meta">
      <p className="venture__kind">{project.kind}</p>
      <p className="venture__role">{project.role}</p>
      {project.dates ? <p className="venture__dates">{project.dates}</p> : null}
    </div>
  );
}

function Links({ project }: { project: Project }) {
  return (
    <ul className="links venture__links">
      {project.links.map((link) => (
        <li key={link.href}>
          <ContentLink link={link} className="link--strong" />
        </li>
      ))}
    </ul>
  );
}

/**
 * Splits a figure at the first space after its number, so the number can be
 * set large with its qualification immediately underneath in the same block.
 * The full string stays in the DOM as "number qualification".
 */
function splitFigure(figure: string): { number: string; qualification: string } {
  const space = figure.indexOf(' ');
  if (space === -1) return { number: figure, qualification: '' };
  return { number: figure.slice(0, space), qualification: figure.slice(space + 1) };
}

/** Diffex: a very large name, the meta at its baseline, two qualified figures side by side, the flow, the blocks, the links. */
function DiffexStory({ project }: { project: Project }) {
  return (
    <article className="venture venture--diffex" data-testid={`project-${project.id}`} aria-labelledby={`project-title-${project.id}`}>
      <header className="venture-diffex__head">
        <h3 className="project__title venture-diffex__title" id={`project-title-${project.id}`}>
          {project.name}
        </h3>
        <Meta project={project} />
      </header>
      <ul className="venture-diffex__figures">
        {project.figures.map((figure) => {
          const { number, qualification } = splitFigure(figure);
          return (
            <li key={figure} className="venture-diffex__figure">
              <strong className="venture-diffex__number">{number}</strong>{' '}
              <span className="venture-diffex__qualification">{qualification}</span>
            </li>
          );
        })}
      </ul>
      <p className="summary venture-diffex__summary">{project.summary}</p>
      {project.flow ? (
        <Flow project={project.id} title={project.flow.title} steps={project.flow.steps} className="venture-diffex__flow" />
      ) : null}
      <ContributionBlocks project={project.id} contributions={project.contributions} className="venture-diffex__blocks" />
      <Links project={project} />
    </article>
  );
}

/** UPlate: the screenshot gallery on the left, the name and the reading column on the right. */
function UplateStory({ project }: { project: Project }) {
  return (
    <article className="venture venture--uplate" data-testid={`project-${project.id}`} aria-labelledby={`project-title-${project.id}`}>
      <header className="venture-uplate__head">
        <h3 className="project__title" id={`project-title-${project.id}`}>
          {project.name}
        </h3>
        <Meta project={project} />
      </header>
      <Gallery project={project} />
      <div className="venture-uplate__text">
        <ul className="venture-uplate__stats">
          {project.figures.map((figure) => (
            <li key={figure}>{figure}</li>
          ))}
        </ul>
        <p className="summary venture-uplate__summary">{project.summary}</p>
        <ContributionBlocks project={project.id} contributions={project.contributions} className="venture-uplate__blocks" />
        <Links project={project} />
      </div>
    </article>
  );
}

/**
 * One real screenshot at a time at its real aspect ratio. Every Media item is
 * in the DOM so each alt text and caption is present; the non-current ones
 * carry the hidden attribute. Previous and Next wrap around, and ArrowLeft and
 * ArrowRight move the gallery while focus is inside it.
 */
function Gallery({ project }: { project: Project }) {
  const slides = project.evidence;
  const count = slides.length;
  const [current, setCurrent] = useState(0);
  // Every screenshot lazy-loads until the reader reaches for the gallery; then
  // the hidden ones fetch too, so the first Next shows a picture, not a gap.
  const [warm, setWarm] = useState(false);
  const warmUp = () => setWarm(true);

  if (count === 0) return null;

  const step = (delta: number) => {
    warmUp();
    setCurrent((index) => (index + delta + count) % count);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowLeft') step(-1);
    else if (event.key === 'ArrowRight') step(1);
    else return;
    event.preventDefault();
  };

  return (
    <div
      className="gallery"
      data-testid={`gallery-${project.id}`}
      role="group"
      aria-roledescription="carousel"
      aria-label={`${project.name} screenshots`}
      onKeyDown={onKeyDown}
      onPointerEnter={warmUp}
      onFocus={warmUp}
    >
      <div className="gallery__controls">
        <button
          type="button"
          className="gallery__button"
          data-testid={`gallery-${project.id}-prev`}
          aria-label="Previous screenshot"
          onClick={() => step(-1)}
        >
          <Arrow direction="left" />
        </button>
        <span className="gallery__counter" data-testid={`gallery-${project.id}-counter`} aria-live="polite" aria-atomic="true">
          {`${current + 1} / ${count}`}
        </span>
        <button
          type="button"
          className="gallery__button"
          data-testid={`gallery-${project.id}-next`}
          aria-label="Next screenshot"
          onClick={() => step(1)}
        >
          <Arrow direction="right" />
        </button>
      </div>
      <div className="gallery__slides">
        {slides.map((item, index) => (
          <div
            key={item.src}
            className="gallery__slide"
            role="group"
            aria-roledescription="slide"
            aria-label={`${index + 1} of ${count}`}
            hidden={index !== current}
          >
            <Media item={item} eager={warm} />
          </div>
        ))}
      </div>
    </div>
  );
}

function Arrow({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {direction === 'left' ? <path d="M16 10H4m5-5-5 5 5 5" /> : <path d="M4 10h12m-5-5 5 5-5 5" />}
    </svg>
  );
}
