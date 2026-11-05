import { createContext, useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import type { Project, ProjectId } from '../content/types';
import { projectById } from '../content/site';
import { withBase } from '../lib/base';
import { ContentLink } from './ProjectRow';
import './sections.css';

export interface DetailsApi {
  /** Project currently shown in the dialog, or null while it is closed. */
  openId: ProjectId | null;
  /**
   * Open the details dialog for a project. Pass the control that triggered it so
   * focus returns there on close; falls back to document.activeElement.
   */
  openDetails: (id: ProjectId, opener?: HTMLElement | null) => void;
  /** Close the dialog if it is open. Focus returns to the opener. */
  closeDetails: () => void;
}

function missingProvider(): never {
  throw new Error('DetailsProvider is missing above this component.');
}

// eslint-disable-next-line react-refresh/only-export-components -- the context belongs beside the dialog; a separate module would need a new file outside this folder's ownership.
export const DetailsContext = createContext<DetailsApi>({
  openId: null,
  openDetails: missingProvider,
  closeDetails: missingProvider,
});

interface OpenState {
  id: ProjectId;
  opener: HTMLElement | null;
}

/**
 * Owns the single project details dialog. Wrap the sections in it; rows call
 * openDetails from the context (see useDetails in ./index.ts).
 */
export function DetailsProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState<OpenState | null>(null);

  const api: DetailsApi = {
    openId: open?.id ?? null,
    openDetails(id, opener) {
      const active = document.activeElement;
      setOpen({ id, opener: opener ?? (active instanceof HTMLElement ? active : null) });
    },
    closeDetails() {
      setOpen(null);
    },
  };

  return (
    <DetailsContext value={api}>
      {children}
      {open ? (
        <ProjectDetails project={projectById[open.id]} opener={open.opener} onClose={() => setOpen(null)} />
      ) : null}
    </DetailsContext>
  );
}

const OPEN_CLASS = 'details-open';

export interface ProjectDetailsProps {
  project: Project;
  /** Element that opened the dialog; focus returns to it on close. */
  opener?: HTMLElement | null;
  /** Called once the native dialog has closed. */
  onClose: () => void;
}

/**
 * Native modal dialog for one project. Mount it to open it; it calls showModal()
 * on mount, locks page scroll, and returns focus to the opener when it closes.
 */
export function ProjectDetails({ project, opener = null, onClose }: ProjectDetailsProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const openerRef = useRef(opener);

  useEffect(() => {
    openerRef.current = opener;
  }, [opener]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    // Start on the Close control rather than the scroll container Chrome would pick.
    dialog.querySelector<HTMLElement>('[data-testid="details-close"]')?.focus();
    document.documentElement.classList.add(OPEN_CLASS);
    return () => {
      document.documentElement.classList.remove(OPEN_CLASS);
      // Unmounted while still open (closed through state): close it and hand focus back.
      if (dialog.open) {
        dialog.close();
        openerRef.current?.focus();
      }
    };
  }, []);

  const handleClose = () => {
    // A close event queued by the StrictMode effect replay lands after showModal() ran again.
    if (ref.current?.open) return;
    openerRef.current?.focus();
    onClose();
  };

  const handleBackdropClick = (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target === event.currentTarget) ref.current?.close();
  };

  const { award } = project;
  const links = project.links.filter((link) => link.href !== award?.proof.href);

  return (
    <dialog
      ref={ref}
      className="details"
      data-testid="project-details"
      data-project={project.id}
      aria-labelledby="details-heading"
      onClose={handleClose}
      onClick={handleBackdropClick}
    >
      <div className="details__inner">
        <div className="details__bar">
          <button
            type="button"
            className="details-button"
            data-testid="details-close"
            onClick={() => ref.current?.close()}
          >
            Close
          </button>
        </div>

        <h2 className="details__name" id="details-heading">
          {project.name}
        </h2>

        {award ? (
          <div className="details__award">
            <p className="label">{award.event}</p>
            <ul className="details__titles">
              {award.titles.map(({ outcome, title }) => (
                <li key={title}>
                  <span className="label">{outcome}</span> {title}
                </li>
              ))}
            </ul>
            <ContentLink className="details__proof" link={award.proof} />
          </div>
        ) : null}

        <p className="details__role">{project.role}</p>
        {project.dates ? <p className="details__dates">{project.dates}</p> : null}

        <p className="details__summary">{project.summary}</p>

        <div className="details__body">
          {project.details.map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </div>

        {project.figures.length > 0 ? (
          <ul className="details__figures">
            {project.figures.map((figure) => (
              <li key={figure}>{figure}</li>
            ))}
          </ul>
        ) : null}

        {project.evidence.map((item) => (
          <figure className="details__figure" key={item.src}>
            <img
              src={withBase(item.src)}
              alt={item.alt}
              width={item.width}
              height={item.height}
              loading="lazy"
              decoding="async"
            />
            <figcaption>{item.caption}</figcaption>
          </figure>
        ))}

        {links.length > 0 ? (
          <ul className="details__links">
            {links.map((link) => (
              <li key={link.href}>
                <ContentLink link={link} />
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </dialog>
  );
}
