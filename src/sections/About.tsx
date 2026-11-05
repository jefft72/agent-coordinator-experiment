import { education, skills } from '../content/site';
import './sections.css';

/** Education and skills, as plain lists. */
export function About() {
  return (
    <section className="sec" id="about" aria-labelledby="about-heading">
      <div className="sec__inner">
        <h2 className="sec__heading" id="about-heading">
          About
        </h2>
        <div className="about">
          <div className="about__column">
            <h3 className="about__label">Education</h3>
            <p className="about__school">{education.school}</p>
            <p className="about__degree">{education.degree}</p>
            <p className="about__small">{education.location}</p>
            <h4 className="label about__sublabel">Coursework</h4>
            <ul className="about__courses">
              {education.coursework.map((course) => (
                <li key={course}>{course}</li>
              ))}
            </ul>
          </div>

          <div className="about__column">
            <h3 className="about__label">Skills</h3>
            {skills.map((group) => (
              <div className="about__group" key={group.label}>
                <h4 className="label about__sublabel">{group.label}</h4>
                <ul className="about__items">
                  {group.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
