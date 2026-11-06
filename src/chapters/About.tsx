import type { CSSProperties } from 'react';
import { chapters, education, identity, skills } from '../content/site';
import { ChapterEntry } from './ChapterEntry';
import { ContentLink } from './ContentLink';
import './chapters.css';
import './about.css';

const chapter = chapters[3];

/** The visible form of a contact destination: the address for mail, the path for a profile. */
function destination(href: string): string {
  if (href.startsWith('mailto:')) return href.slice('mailto:'.length);
  return href.replace(/^https?:\/\//, '').replace(/\/$/, '');
}

/**
 * Chapter 04. A quiet graphite surface with room for the reference material:
 * education with its coursework, the complete grouped skill list, and then
 * the contact destinations as the last words on the page.
 */
export function About() {
  return (
    <section
      className="chapter surface--quiet about"
      id="about"
      data-testid="chapter-about"
      data-zone="about"
      data-chapter="about"
      data-takeover=""
      aria-labelledby="about-heading"
    >
      <div className="chapter__inner">
        <ChapterEntry chapter={chapter} aside={`${education.school}, ${education.location}`} />
        <div className="about__grid">
          <div className="about__education plane" style={{ '--travel': '12vh' } as CSSProperties}>
            <h3 className="label about__heading">Education</h3>
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
          <div className="about__skills plane" style={{ '--travel': '16vh' } as CSSProperties}>
            <h3 className="label about__heading">Skills</h3>
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

      <section
        className="contact"
        id="contact"
        data-testid="chapter-contact"
        data-zone="about"
        data-chapter="contact"
        data-reveal=""
        aria-labelledby="contact-heading"
      >
        <div className="chapter__inner">
          <h2 className="contact__heading arrive" id="contact-heading">
            Contact
          </h2>
          <ul className="contact__links">
            {identity.contact.map((link, index) => (
              <li key={link.href} className="arrive" style={{ '--i': index + 1 } as CSSProperties}>
                <ContentLink className="contact__link" link={link} />
                <span className="contact__destination">{destination(link.href)}</span>
              </li>
            ))}
          </ul>
          <p className="contact__name label arrive" style={{ '--i': 4 } as CSSProperties}>
            {identity.name}
          </p>
        </div>
      </section>
    </section>
  );
}
