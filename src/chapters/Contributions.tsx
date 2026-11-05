import { useId, useRef, useState, type KeyboardEvent } from 'react';
import type { Contribution } from '../content/types';

export interface ContributionTabsProps {
  /** Project id, used for stable ids and test ids. */
  project: string;
  contributions: Contribution[];
  /** Called with the selected contribution so the spread can highlight its steps. */
  onSelect?: (contribution: Contribution) => void;
  className?: string;
}

/**
 * The labelled controls that reveal one part of Jeffrey's work in a reserved
 * area: a tablist with roving focus, arrow keys, Home, and End. The first
 * contribution is shown on load, so the area never reads empty, and the
 * award, summary, and proof links of the article stay outside it.
 */
export function ContributionTabs({ project, contributions, onSelect, className }: ContributionTabsProps) {
  const base = useId();
  const [selected, setSelected] = useState(0);
  const tabs = useRef<Array<HTMLButtonElement | null>>([]);

  const select = (index: number, focus = false) => {
    const next = (index + contributions.length) % contributions.length;
    setSelected(next);
    onSelect?.(contributions[next]);
    if (focus) tabs.current[next]?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const keys: Record<string, () => void> = {
      ArrowRight: () => select(index + 1, true),
      ArrowDown: () => select(index + 1, true),
      ArrowLeft: () => select(index - 1, true),
      ArrowUp: () => select(index - 1, true),
      Home: () => select(0, true),
      End: () => select(contributions.length - 1, true),
    };
    const action = keys[event.key];
    if (!action) return;
    event.preventDefault();
    action();
  };

  const current = contributions[selected];
  return (
    <div className={className ? `contrib ${className}` : 'contrib'} data-testid={`contributions-${project}`}>
      <div className="contrib__list" role="tablist" aria-label="Jeffrey’s work on this project">
        {contributions.map((contribution, index) => {
          const on = index === selected;
          return (
            <button
              key={contribution.id}
              ref={(el) => {
                tabs.current[index] = el;
              }}
              type="button"
              role="tab"
              id={`${base}-tab-${contribution.id}`}
              className="contrib__tab"
              data-testid={`contribution-${project}-${contribution.id}`}
              aria-selected={on}
              aria-controls={`${base}-panel`}
              tabIndex={on ? 0 : -1}
              onClick={() => select(index)}
              onKeyDown={(event) => onKeyDown(event, index)}
            >
              {contribution.label}
            </button>
          );
        })}
      </div>
      <div
        className="contrib__panel body"
        role="tabpanel"
        id={`${base}-panel`}
        data-testid={`contribution-panel-${project}`}
        data-contribution={current.id}
        aria-labelledby={`${base}-tab-${current.id}`}
        tabIndex={0}
      >
        {current.body.map((sentence) => (
          <p key={sentence}>{sentence}</p>
        ))}
      </div>
    </div>
  );
}

/** The same contributions as adjacent labelled blocks, every one visible. */
export function ContributionBlocks({ project, contributions, className }: { project: string; contributions: Contribution[]; className?: string }) {
  return (
    <div className={className ? `blocks ${className}` : 'blocks'} data-testid={`contributions-${project}`}>
      {contributions.map((contribution) => (
        <div className="block body" key={contribution.id} data-testid={`contribution-${project}-${contribution.id}`}>
          <h4 className="block__label">{contribution.label}</h4>
          {contribution.body.map((sentence) => (
            <p key={sentence}>{sentence}</p>
          ))}
        </div>
      ))}
    </div>
  );
}
