/**
 * Content model shared by the opening, the chapters, and the tests.
 * Every string in `site.ts` is quoted or closely paraphrased from the supplied résumé copy.
 * No tagline, no graduation date, no phone number, no future award.
 */

export type ProjectId = 'animalabs' | 'opencraft' | 'judi' | 'rtx' | 'diffex' | 'uplate';

export type ChapterId = 'hackathons' | 'experience' | 'ventures' | 'about';

export interface Link {
  label: string;
  href: string;
}

export interface AwardTitle {
  /** Track win or awarded fellowship. Never an overall event win. */
  outcome: 'Winner' | 'Awarded';
  /** Exact award name with the sponsor in square brackets, for example "[MLH] Commit Fellowship". */
  title: string;
}

export interface Award {
  /** Event name exactly as verified, for example "Cal Hacks 13.0". */
  event: string;
  /** Exact track award names with their outcome. Never an overall event win. */
  titles: AwardTitle[];
  /** Proof destination, for example the Devpost page. */
  proof: Link;
}

export interface Evidence {
  /** Path under the public directory, without the deployment base. */
  src: string;
  alt: string;
  width: number;
  height: number;
  /** Short truthful caption, for example "Title frame from the demo video". */
  caption: string;
}

/** One step in a project's labelled flow or schematic. Named concepts only, never invented data. */
export interface FlowStep {
  id: string;
  /** Short name of the step, for example "Europe PMC". */
  label: string;
  /** Short qualifier shown under the label, for example "searched through Apify". */
  note?: string;
}

/**
 * One part of Jeffrey's work on a project: a control label and the sentences
 * it reveals. The hackathon spreads present these as tabs; the other
 * chapters lay them out as adjacent blocks.
 */
export interface Contribution {
  id: string;
  /** Control label, for example "Research agent". */
  label: string;
  /** One or more complete sentences of what Jeffrey built, closely paraphrased from the résumé. */
  body: string[];
  /** Ids of the flow steps this contribution highlights. */
  steps?: string[];
}

export interface Project {
  id: ProjectId;
  name: string;
  /** Plain descriptor, for example "Rust agent harness". Doubles as the visible lead where the brief asks for one. */
  kind: string;
  /** Organisation or event and role, one short line. */
  role: string;
  /** Dates when the résumé supplies them. Omitted for hackathons. */
  dates?: string;
  /** One or two sentences of what Jeffrey personally built, first person. */
  summary: string;
  /** Short measurable facts scoped exactly as the résumé scopes them. */
  figures: string[];
  /** The labelled parts of Jeffrey's work. Every résumé sentence for the project lives here. */
  contributions: Contribution[];
  /** Optional labelled flow or schematic the contributions can highlight. */
  flow?: { title: string; steps: FlowStep[] };
  /** Present only for the two hackathon wins. */
  award?: Award;
  links: Link[];
  evidence: Evidence[];
}

export interface ExperienceEntry {
  organisation: string;
  role: string;
  dates: string;
  location: string;
  /** Project this entry expands into, when one exists. */
  project?: ProjectId;
}

export interface Education {
  school: string;
  degree: string;
  location: string;
  coursework: string[];
}

export interface SkillGroup {
  label: string;
  items: string[];
}

export interface Identity {
  name: string;
  first: string;
  last: string;
  /** Two or three short factual lines for the opening. */
  lines: string[];
  contact: Link[];
}

export interface NavItem {
  label: string;
  href: `#${string}`;
}

export interface Chapter {
  id: ChapterId;
  /** Two-digit chapter number shown in the entry label, for example "01". */
  number: string;
  title: string;
}
