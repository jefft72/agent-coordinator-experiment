import { useRef, type KeyboardEvent } from 'react';
import { projectOrder, work, type ProjectId } from '../content/work';

interface WorkIndexProps {
  selected: ProjectId | null;
  onSelect: (id: ProjectId) => void;
}

/**
 * The permanent HTML index. Every project is a real button that selects it in
 * the contact sheet and the caption. Arrow keys move between items, Enter or
 * Space selects. Tab leaves the list.
 */
export function WorkIndex({ selected, onSelect }: WorkIndexProps) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next: number | null = null;
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') next = (index + 1) % projectOrder.length;
    if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') next = (index - 1 + projectOrder.length) % projectOrder.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = projectOrder.length - 1;
    if (next !== null) {
      event.preventDefault();
      refs.current[next]?.focus();
    }
  };

  const focusIndex = selected ? projectOrder.indexOf(selected) : 0;

  return (
    <nav className="index" id="work-index" aria-labelledby="work-index-heading" data-testid="work-index">
      <h2 className="index__heading" id="work-index-heading">
        Work
      </h2>
      <ol className="index__list">
        {projectOrder.map((id, i) => {
          const entry = work[id];
          const isSelected = selected === id;
          return (
            <li key={id} className="index__item" data-selected={isSelected ? 'true' : 'false'}>
              <button
                ref={(el) => {
                  refs.current[i] = el;
                }}
                type="button"
                className="index__button"
                data-testid={`index-${id}`}
                aria-pressed={isSelected}
                tabIndex={i === focusIndex ? 0 : -1}
                onClick={() => onSelect(id)}
                onKeyDown={(e) => onKeyDown(e, i)}
              >
                <span className="index__name">{entry.name}</span>
                <span className="index__descriptor">{entry.descriptor}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
