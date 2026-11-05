import { useContext } from 'react';
import { experience } from '../content/site';
import { DetailsContext } from './ProjectDetails';
import './sections.css';

/** The four positions, each opening the matching project in the details dialog. */
export function Experience() {
  const { openDetails } = useContext(DetailsContext);

  return (
    <section className="sec" id="experience" aria-labelledby="experience-heading">
      <div className="sec__inner">
        <h2 className="sec__heading" id="experience-heading">
          Experience
        </h2>
        <ul className="record">
          {experience.map((entry) => {
            const projectId = entry.project;
            return (
              <li className="rec" key={`${entry.organisation} ${entry.role}`}>
                <h3 className="rec__org">{entry.organisation}</h3>
                <div className="rec__facts">
                  <p className="rec__role">{entry.role}</p>
                  <p className="rec__small">{entry.dates}</p>
                  <p className="rec__small">{entry.location}</p>
                </div>
                {projectId ? (
                  <div className="rec__aside">
                    <button
                      type="button"
                      className="details-button"
                      data-testid={`experience-details-${projectId}`}
                      aria-haspopup="dialog"
                      onClick={(event) => openDetails(projectId, event.currentTarget)}
                    >
                      Details
                    </button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
