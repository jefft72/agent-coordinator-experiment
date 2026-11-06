import type { FlowStep } from '../content/types';

export interface FlowProps {
  /** Project id, used for stable test ids. */
  project: string;
  title: string;
  steps: FlowStep[];
  /** Ids of the steps to highlight, or an empty list to show every step equally. */
  active?: readonly string[];
  className?: string;
  /** Marks the figure for the scroll reveal tracker. */
  reveal?: boolean;
}

/**
 * A labelled row of named steps. The selected contribution highlights its
 * steps; with nothing selected every step reads equally.
 */
export function Flow({ project, title, steps, active = [], className, reveal = false }: FlowProps) {
  const highlighting = active.length > 0;
  return (
    <figure
      className={className ? `flow ${className}` : 'flow'}
      data-testid={`flow-${project}`}
      data-highlighting={highlighting ? 'true' : 'false'}
      data-reveal={reveal ? '' : undefined}
    >
      <figcaption className="flow__title label">{title}</figcaption>
      <ol className="flow__steps">
        {steps.map((step) => {
          const on = active.includes(step.id);
          return (
            <li
              key={step.id}
              className="flow__step"
              data-testid={`flow-step-${project}-${step.id}`}
              data-active={on ? 'true' : 'false'}
              aria-current={on ? 'step' : undefined}
            >
              <span className="flow__step-label">{step.label}</span>
              {step.note ? <span className="flow__step-note">{step.note}</span> : null}
            </li>
          );
        })}
      </ol>
    </figure>
  );
}
