import type { FocusEvent } from 'react';
import type { Link, Project, ProjectId } from '../content/types';
import { motion } from '../scene/motion';
import './sections.css';

const EXTERNAL = /^https?:\/\//;

/** Anchor for a content link. External destinations open in a new tab. */
export function ContentLink({ link, className }: { link: Link; className?: string }) {
  const external = EXTERNAL.test(link.href);
  return (
    <a
      className={className}
      href={link.href}
      target={external ? '_blank' : undefined}
      rel={external ? 'noreferrer' : undefined}
    >
      {link.label}
    </a>
  );
}

export interface ProjectRowProps {
  project: Project;
  /** Called with the project id and the Details button, so the dialog can hand focus back. */
  onDetails: (id: ProjectId, opener: HTMLElement) => void;
}

/**
 * One project in the work sequence: name and award or role on the left,
 * summary and figures in the middle, links and Details on the right.
 * Hover and focus hand the project id to the scene through the motion store.
 */
export function ProjectRow({ project, onDetails }: ProjectRowProps) {
  const nameId = `project-name-${project.id}`;
  const { award } = project;
  // The award proof is shown under the award, so drop it from the general list.
  const links = project.links.filter((link) => link.href !== award?.proof.href);

  const focus = () => {
    motion.focus = project.id;
  };
  const blur = (event: FocusEvent<HTMLElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget)) motion.focus = null;
  };
  const leave = () => {
    motion.focus = null;
  };

  return (
    <article
      className="row"
      data-testid={`project-${project.id}`}
      aria-labelledby={nameId}
      onPointerEnter={focus}
      onPointerLeave={leave}
      onFocus={focus}
      onBlur={blur}
    >
      <div className="row__title">
        <h4 className="row__name" id={nameId}>
          {project.name}
        </h4>
        {award ? (
          <div className="row__award">
            <p className="label">{award.event}</p>
            <ul className="row__titles">
              {award.titles.map((title) => (
                <li key={title}>{title}</li>
              ))}
            </ul>
            <ContentLink className="row__proof" link={award.proof} />
          </div>
        ) : (
          <div className="row__meta">
            <p className="label">{project.kind}</p>
            <p className="row__role">{project.role}</p>
          </div>
        )}
      </div>

      <div className="row__facts">
        <p className="row__summary">{project.summary}</p>
        {project.figures.length > 0 ? (
          <ul className="row__figures">
            {project.figures.map((figure) => (
              <li key={figure}>{figure}</li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="row__aside">
        {links.length > 0 ? (
          <ul className="row__links">
            {links.map((link) => (
              <li key={link.href}>
                <ContentLink link={link} />
              </li>
            ))}
          </ul>
        ) : null}
        <button
          type="button"
          className="details-button"
          data-testid={`details-${project.id}`}
          aria-haspopup="dialog"
          aria-describedby={nameId}
          onClick={(event) => onDetails(project.id, event.currentTarget)}
        >
          Details
        </button>
      </div>
    </article>
  );
}
