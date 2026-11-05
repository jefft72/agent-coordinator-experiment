import type { CSSProperties, ReactNode } from 'react';
import { chapters, experience, experienceProjects } from '../content/site';
import type { ExperienceEntry, FlowStep, Project, ProjectId } from '../content/types';
import { ChapterEntry } from './ChapterEntry';
import { ContentLink } from './ContentLink';
import { ContributionBlocks } from './Contributions';
import { Media } from './Media';
import './experience.css';

const chapter = chapters.find((entry) => entry.id === 'experience') ?? chapters[1];

/**
 * Where a project's figures sit: beside the named contribution block in the
 * reading field's margin, or in the article header when nothing is named.
 * Judi's claims figure belongs with the claims backend, never with the microVMs.
 */
const FIGURES_BESIDE: Partial<Record<ProjectId, string>> = { judi: 'claims' };

/**
 * 02 / Experience: a light surface, a tall band of air under the title, then
 * two long-form articles. Each article is a narrow employer rail (sticky on
 * desktop) beside a wide reading field that carries the engineering scope.
 */
export function Experience() {
  return (
    <section
      className="chapter surface--light experience"
      id="experience"
      data-testid="chapter-experience"
      data-zone="experience"
      data-chapter="experience"
      aria-labelledby="experience-heading"
    >
      <div className="chapter__inner">
        <ChapterEntry chapter={chapter} aside={experienceProjects.map((project) => project.name).join(', ')} />
        <div className="experience__articles">
          {experienceProjects.map((project) => (
            <ExperienceArticle
              key={project.id}
              project={project}
              entry={experience.find((item) => item.project === project.id)}
              diagram={project.flow ? diagramFor(project, project.flow) : null}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function diagramFor(project: Project, flow: NonNullable<Project['flow']>): ReactNode {
  if (project.id === 'judi') return <JudiSchematic project={project.id} flow={flow} />;
  if (project.id === 'rtx') return <RtxDiagram project={project.id} flow={flow} />;
  return null;
}

interface ExperienceArticleProps {
  project: Project;
  entry: ExperienceEntry | undefined;
  diagram: ReactNode;
}

function ExperienceArticle({ project, entry, diagram }: ExperienceArticleProps) {
  const besideId = FIGURES_BESIDE[project.id];
  const besideIndex = besideId ? project.contributions.findIndex((contribution) => contribution.id === besideId) : -1;
  const marginFigures = besideIndex >= 0 ? project.figures : [];
  const headerFigures = besideIndex >= 0 ? [] : project.figures;
  const scopeStyle = {
    '--rows': project.contributions.length,
    '--figure-row': besideIndex + 1,
  } as CSSProperties;

  return (
    <article className="experience__article" data-testid={`project-${project.id}`} aria-labelledby={`project-title-${project.id}`}>
      <div className="experience__rail">
        <h3 className="project__title" id={`project-title-${project.id}`}>
          {project.name}
        </h3>
        {entry ? (
          <dl className="experience__facts">
            <div className="experience__fact">
              <dt className="label">Organisation</dt>
              <dd>{entry.organisation}</dd>
            </div>
            <div className="experience__fact">
              <dt className="label">Role</dt>
              <dd>{entry.role}</dd>
            </div>
            <div className="experience__fact">
              <dt className="label">Dates</dt>
              <dd>{entry.dates}</dd>
            </div>
            <div className="experience__fact">
              <dt className="label">Location</dt>
              <dd>{entry.location}</dd>
            </div>
          </dl>
        ) : null}
      </div>

      <div className="experience__field">
        <header className="experience__header">
          <p className="project__lead">{project.kind}</p>
          <p className="experience__meta">
            <span className="experience__role">{project.role}</span>
            {project.dates ? <span className="experience__dates">{project.dates}</span> : null}
          </p>
          {headerFigures.length > 0 ? (
            <ul className="experience__figures">
              {headerFigures.map((figure) => (
                <li className="experience__figure" key={figure}>
                  {figure}
                </li>
              ))}
            </ul>
          ) : null}
          <p className="summary experience__summary">{project.summary}</p>
        </header>

        {diagram}

        <div className="experience__scope" style={scopeStyle}>
          <ContributionBlocks project={project.id} contributions={project.contributions} />
          {marginFigures.length > 0 ? (
            <ul className="experience__figures experience__figures--margin">
              {marginFigures.map((figure) => (
                <li className="experience__figure" key={figure}>
                  {figure}
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        {project.evidence.length > 0 ? (
          <div className="experience__evidence">
            {project.evidence.map((item) => (
              <Media item={item} key={item.src} />
            ))}
          </div>
        ) : null}

        {project.links.length > 0 ? (
          <p className="links experience__links">
            {project.links.map((link) => (
              <ContentLink link={link} className="link--strong" key={link.href} />
            ))}
          </p>
        ) : null}
      </div>
    </article>
  );
}

interface DiagramProps {
  project: ProjectId;
  flow: NonNullable<Project['flow']>;
}

/**
 * Scope schematic for the microVM platform: the three named steps as boxes
 * in a row (a column on mobile) joined by arrows. The step labels and notes
 * are the only words; the caption says what the drawing is and is not.
 */
function JudiSchematic({ project, flow }: DiagramProps) {
  return (
    <figure className="schematic" data-testid={`schematic-${project}`}>
      <figcaption className="label schematic__title">{flow.title}</figcaption>
      <ol className="schematic__nodes">
        {flow.steps.map((step) => (
          <li className="schematic__node" data-testid={`schematic-step-${project}-${step.id}`} data-step={step.id} key={step.id}>
            <span className="schematic__label">{step.label}</span>
            {step.note ? <span className="schematic__note">{step.note}</span> : null}
          </li>
        ))}
      </ol>
      <p className="diagram__note">Scope illustration, not production architecture.</p>
    </figure>
  );
}

/* Geometry of the conceptual path diagram, in viewBox units. */
const VIEW = { width: 600, height: 440 };
const WAYPOINTS = [
  { x: 80, y: 350, label: { x: 100, y: 356, anchor: 'start' } },
  { x: 220, y: 160, label: { x: 200, y: 150, anchor: 'end' } },
  { x: 380, y: 300, label: { x: 380, y: 336, anchor: 'middle' } },
  { x: 520, y: 120, label: { x: 520, y: 92, anchor: 'middle' } },
] as const;
const OBSTACLES = [
  { x: 300, y: 200, r: 50, ghost: { x: 286, y: 180 }, motion: { x: 0.6, y: 0.8 }, label: { x: 300, y: 116 } },
  { x: 470, y: 230, r: 44, ghost: { x: 484, y: 210 }, motion: { x: -0.7, y: 0.7 }, label: { x: 470, y: 306 } },
] as const;
/* One smooth path through the four waypoints, bending below the first zone and above the second. */
const PATH = 'M 80 350 C 120 260, 160 180, 220 160 C 210 275, 330 300, 380 300 C 380 200, 430 130, 520 120';
/* Direction chevrons at the midpoint of each segment, rotated along the path. */
const CHEVRONS = [
  { x: 142.5, y: 228.75, angle: -56.3 },
  { x: 277.5, y: 273, angle: 30.5 },
  { x: 416, y: 176, angle: -52.8 },
] as const;

/**
 * Conceptual path diagram for the trajectory research: labelled waypoints,
 * two labelled dynamic obstacle zones (each with its earlier position and
 * direction of movement), and a planned path through the waypoints that
 * routes around the zones. The legend uses the flow step labels and notes.
 */
function RtxDiagram({ project, flow }: DiagramProps) {
  const description =
    'Conceptual path diagram: a planned path passes through four labelled waypoints and routes around two labelled dynamic obstacle zones that are moving through the airspace.';
  return (
    <figure className="diagram">
      <figcaption className="label diagram__title">{flow.title}</figcaption>
      <div className="diagram__layout">
        <svg
          className="diagram__svg"
          data-testid={`diagram-${project}`}
          viewBox={`0 0 ${VIEW.width} ${VIEW.height}`}
          width="100%"
          role="img"
          aria-label={description}
          focusable="false"
        >
          <title>{description}</title>
          <defs>
            <pattern id={`diagram-${project}-grid`} width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeOpacity="0.08" strokeWidth="1" />
            </pattern>
          </defs>
          <rect x="0" y="0" width={VIEW.width} height={VIEW.height} fill={`url(#diagram-${project}-grid)`} />

          {OBSTACLES.map((zone, index) => {
            const start = { x: zone.x + zone.r * zone.motion.x, y: zone.y + zone.r * zone.motion.y };
            const end = { x: start.x + 24 * zone.motion.x, y: start.y + 24 * zone.motion.y };
            const angle = (Math.atan2(zone.motion.y, zone.motion.x) * 180) / Math.PI;
            return (
              <g className="diagram__obstacle" key={index}>
                <circle cx={zone.ghost.x} cy={zone.ghost.y} r={zone.r} fill="none" stroke="var(--paper-dim)" strokeWidth="1.25" strokeDasharray="4 5" />
                <circle cx={zone.x} cy={zone.y} r={zone.r} fill="var(--paper-dim)" fillOpacity="0.16" stroke="var(--paper-dim)" strokeWidth="1.5" />
                <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke="var(--paper-dim)" strokeWidth="1.5" />
                <path d="M -6 -4.5 L 0 0 L -6 4.5" fill="none" stroke="var(--paper-dim)" strokeWidth="1.5" transform={`translate(${end.x} ${end.y}) rotate(${angle})`} />
                <text className="diagram__text diagram__text--dim" x={zone.label.x} y={zone.label.y} textAnchor="middle">
                  Dynamic obstacle
                </text>
              </g>
            );
          })}

          <path d={PATH} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          {CHEVRONS.map((chevron) => (
            <path
              key={`${chevron.x}-${chevron.y}`}
              d="M -7 -5 L 0 0 L -7 5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              transform={`translate(${chevron.x} ${chevron.y}) rotate(${chevron.angle})`}
            />
          ))}

          {WAYPOINTS.map((point, index) => (
            <g className="diagram__waypoint" key={index}>
              <circle cx={point.x} cy={point.y} r="12" fill="var(--field)" stroke="currentColor" strokeWidth="1.5" />
              <circle cx={point.x} cy={point.y} r="5" fill="currentColor" />
              <text className="diagram__text" x={point.label.x} y={point.label.y} textAnchor={point.label.anchor}>
                Waypoint {index + 1}
              </text>
            </g>
          ))}
        </svg>
        <ul className="diagram__legend" aria-label="Legend">
          {flow.steps.map((step) => (
            <li className="diagram__key" data-testid={`diagram-key-${project}-${step.id}`} key={step.id}>
              <LegendSwatch step={step} />
              <span className="diagram__key-text">
                <span className="diagram__key-label">{step.label}</span>
                {step.note ? <span className="diagram__key-note">{step.note}</span> : null}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <p className="diagram__note">Conceptual diagram of the planning problem, not research output.</p>
    </figure>
  );
}

/** The legend swatch repeats the drawing's own mark for each named step. */
function LegendSwatch({ step }: { step: FlowStep }) {
  return (
    <svg className="diagram__swatch" viewBox="0 0 32 24" width="32" height="24" aria-hidden="true" focusable="false">
      {step.id === 'waypoint' ? (
        <>
          <circle cx="16" cy="12" r="9" fill="var(--field)" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="16" cy="12" r="3.5" fill="currentColor" />
        </>
      ) : step.id === 'obstacle' ? (
        <circle cx="16" cy="12" r="9" fill="var(--paper-dim)" fillOpacity="0.16" stroke="var(--paper-dim)" strokeWidth="1.5" />
      ) : (
        <>
          <path d="M 2 19 C 10 19, 12 5, 22 5 L 30 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M 24 1 L 30 5 L 24 9" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
    </svg>
  );
}
