import type { ReactNode } from 'react';
import type { Chapter } from '../content/types';

export interface ChapterEntryProps {
  chapter: Chapter;
  /** Short text on the right of the label row, for example the two events. */
  aside?: ReactNode;
  children?: ReactNode;
}

/** The numbered label row and the chapter title, shared by every chapter. */
export function ChapterEntry({ chapter, aside, children }: ChapterEntryProps) {
  return (
    <div className="chapter__entry">
      <div className="chapter__label" data-testid={`chapter-label-${chapter.id}`}>
        <span className="label">
          {chapter.number} / {chapter.title}
        </span>
        {aside ? <span className="label chapter__label-aside">{aside}</span> : null}
      </div>
      <h2 className="chapter__title" id={`${chapter.id}-heading`}>
        {chapter.title}
      </h2>
      {children}
    </div>
  );
}
