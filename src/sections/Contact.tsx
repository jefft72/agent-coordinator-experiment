import { identity } from '../content/site';
import { ContentLink } from './ProjectRow';
import './sections.css';

/** The three contact links, large, and the name as a sign-off. */
export function Contact() {
  return (
    <section className="sec contact" id="contact" aria-labelledby="contact-heading">
      <div className="sec__inner">
        <h2 className="sec__heading" id="contact-heading">
          Contact
        </h2>
        <ul className="contact__links">
          {identity.contact.map((link) => (
            <li key={link.href}>
              <ContentLink className="contact__link" link={link} />
            </li>
          ))}
        </ul>
        <p className="contact__name">{identity.name}</p>
      </div>
    </section>
  );
}
