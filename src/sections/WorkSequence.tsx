import { useContext } from 'react';
import { hackathonProjects, otherProjects } from '../content/site';
import { ProjectRow } from './ProjectRow';
import { DetailsContext } from './ProjectDetails';
import './sections.css';

/** The Work heading, the Hackathons group, and the remaining projects. */
export function WorkSequence() {
  const { openDetails } = useContext(DetailsContext);

  return (
    <section className="work" id="work" aria-labelledby="work-heading">
      <div className="sec__inner">
        <h2 className="work__heading" id="work-heading">
          Work
        </h2>
      </div>

      <section className="group" id="hackathons" aria-labelledby="hackathons-heading">
        <div className="sec__inner">
          <h3 className="group__heading" id="hackathons-heading">
            Hackathons
          </h3>
          {hackathonProjects.map((project) => (
            <ProjectRow key={project.id} project={project} onDetails={openDetails} />
          ))}
        </div>
      </section>

      <section className="group" id="projects" aria-labelledby="projects-heading">
        <div className="sec__inner">
          <h3 className="group__heading" id="projects-heading">
            Projects
          </h3>
          {otherProjects.map((project) => (
            <ProjectRow key={project.id} project={project} onDetails={openDetails} />
          ))}
        </div>
      </section>
    </section>
  );
}
