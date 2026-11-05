import { work, type ProjectId } from '../content/work';

interface CaptionProps {
  selected: ProjectId | null;
}

/**
 * One caption under the contact sheet. At rest it says what the sheet is.
 * With a selection it names the project, the role, the facts, and the links.
 */
export function Caption({ selected }: CaptionProps) {
  if (!selected) {
    return (
      <div className="caption caption--rest" data-testid="caption" aria-live="polite">
        <p className="caption__rest">
          Six projects, in the order of the index. The AnimaLabs and OpenCraft frames are stills from the demo
          videos and the UPlate screen is from the shipped app. Every other object is an illustrative model.
        </p>
      </div>
    );
  }

  const entry = work[selected];
  return (
    <div className="caption" data-testid="caption" aria-live="polite">
      <div className="caption__head">
        <h3 className="caption__name" data-testid="caption-name">
          {entry.name}
        </h3>
        <p className="caption__role">{entry.roleLine}</p>
        <p className="caption__artifact">{entry.artifact}</p>
      </div>
      <div className="caption__body">
        {entry.facts.map((fact) => (
          <p key={fact} className="caption__fact">
            {fact}
          </p>
        ))}
        {entry.links.length > 0 ? (
          <ul className="caption__links">
            {entry.links.map((link) => (
              <li key={link.href}>
                <a href={link.href} target="_blank" rel="noreferrer">
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
