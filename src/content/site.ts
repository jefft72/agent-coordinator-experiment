/**
 * Single source of truth for every word on the site.
 * Every sentence is quoted or closely paraphrased from the supplied résumé copy.
 * No tagline, no positioning language, no graduation date, no phone number, no future award.
 * Apostrophes are the typographic form (U+2019) throughout.
 */

import type {
  Education,
  ExperienceEntry,
  Identity,
  NavItem,
  Project,
  ProjectId,
  SkillGroup,
} from './types';

export const identity: Identity = {
  name: 'Jeffrey Tseng',
  first: 'Jeffrey',
  last: 'Tseng',
  lines: ['Computer science at Purdue', 'Co-founder of Diffex', 'Backend engineering intern at Judi Health'],
  contact: [
    { label: 'Email', href: 'mailto:tseng94@purdue.edu' },
    { label: 'GitHub', href: 'https://github.com/jefft72' },
    { label: 'LinkedIn', href: 'https://linkedin.com/in/j-tseng/' },
  ],
};

export const nav: NavItem[] = [
  { label: 'Work', href: '#work' },
  { label: 'Hackathons', href: '#hackathons' },
  { label: 'About', href: '#about' },
  { label: 'Contact', href: '#contact' },
];

const animalabs: Project = {
  id: 'animalabs',
  name: 'AnimaLabs',
  kind: 'Research agents and simulation reports',
  role: 'Cal Hacks 13.0 team project, agent layer and reporting pipeline',
  summary:
    'I built the research and analyst agents, along with a LaTeX reporting pipeline grounded in deterministic simulation analysis.',
  figures: ['7 simulation-based reports', '23 charts', 'Checksum-verified artifacts'],
  details: [
    'The research agent searches Europe PMC through Apify and proposes experiments with citations.',
    'The analyst agent turns simulation outputs into findings and compares them with published studies.',
    'The reporting pipeline produces LaTeX reports and checksum-verified artifacts from the analysis.',
    'Our team’s simulations reproduced published Parkinson’s disease findings on data the model was not fitted to.',
  ],
  award: {
    event: 'Cal Hacks 13.0',
    titles: ['Best AI-First Disruptor, CREAO AI track', 'MLH Commit Fellowship'],
    proof: { label: 'Project and awards on Devpost', href: 'https://devpost.com/software/anima-labs' },
  },
  links: [
    { label: 'Project and awards on Devpost', href: 'https://devpost.com/software/anima-labs' },
    { label: 'Watch demo', href: 'https://www.youtube.com/watch?v=UBaKKoPopSg' },
  ],
  evidence: [
    {
      src: '/work/animalabs-demo.jpg',
      alt: 'Title frame of the AnimaLabs demo video: a petri dish with a C. elegans worm on a purple dotted ground, above the words Anima Labs and Agentic C. Elegans Research.',
      width: 1280,
      height: 720,
      caption: 'Title frame from the demo video',
    },
  ],
};

const opencraft: Project = {
  id: 'opencraft',
  name: 'OpenCraft',
  kind: 'Multi-agent coordination in Minecraft',
  role: 'HackPrinceton Spring 2026 team project, coordination backend',
  summary: 'I built the coordination backend that lets Minecraft agents share jobs, state, and memory.',
  figures: ['Supabase Postgres, Realtime, and pgvector'],
  details: [
    'The backend uses Supabase Postgres, Realtime, and pgvector to store jobs, track agents, and share memory.',
    'I built an integration harness that simulates job contention, memory writes, and chat-based task handoff.',
  ],
  award: {
    event: 'HackPrinceton Spring 2026',
    titles: ['Best use of Dedalus Containers'],
    proof: { label: 'Project and award on Devpost', href: 'https://devpost.com/software/opencraft' },
  },
  links: [
    { label: 'Project and award on Devpost', href: 'https://devpost.com/software/opencraft' },
    { label: 'Source', href: 'https://github.com/MarcDasilva/OpenCraft' },
    { label: 'Watch demo', href: 'https://www.youtube.com/watch?v=cbue_TqiOnI' },
  ],
  evidence: [
    {
      src: '/work/opencraft-demo.jpg',
      alt: 'Scene from the OpenCraft demo video: a Minecraft clearing with a wooden hut, a wheat field, and an agent named cow_assassin standing beside a cobblestone pile.',
      width: 1280,
      height: 720,
      caption: 'Scene from the demo video',
    },
  ],
};

const diffex: Project = {
  id: 'diffex',
  name: 'Diffex',
  kind: 'Rust agent harness',
  role: 'Co-founder, Diffex (Luntraa Inc.)',
  dates: 'April 2026 to present, San Francisco',
  summary:
    'I co-founded Diffex and built a Rust agent harness with an automated process for evaluating and improving it.',
  figures: [
    '20% on SWE-bench Lite after one evolution cycle',
    '$50,000 in compute awarded through the Daytona Grid Startup Initiative',
  ],
  details: [
    'The harness supports multiple model providers, typed execution traces, tool orchestration, persistent sessions, and replayable evaluations.',
    'The evolution pipeline examines execution traces, attributes token and latency costs, and groups recurring failures.',
    'It then proposes targeted harness changes and evaluates the candidates.',
    'After one cycle, the harness reached 20% on SWE-bench Lite through automated trace diagnosis and harness optimization.',
  ],
  links: [
    { label: 'Website', href: 'https://diffex.ai' },
    { label: 'White paper', href: 'https://diffex.ai/white-paper' },
  ],
  evidence: [],
};

const judi: Project = {
  id: 'judi',
  name: 'Judi Health',
  kind: 'Firecracker execution platform',
  role: 'Backend Software Engineering Intern, Judi Health (formerly Capital Rx)',
  dates: 'June 2026 to present, remote',
  summary:
    'I’m leading development of a Firecracker microVM platform on AWS that gives engineers and coding agents isolated execution environments.',
  figures: ['Pharmacy claim adjudication platform serving 5M+ contracted lives'],
  details: [
    'I designed a capacity-aware scheduler that places microVMs across EC2 hosts and manages their lifecycle.',
    'I’m working with the platform VP toward broader deployment across engineering workflows.',
    'I also develop backend services for a pharmacy claim adjudication platform serving 5M+ contracted lives.',
    'For the claims pipeline, I built a Rust linter that checks type-safe function calls and integrated it into CI.',
  ],
  links: [],
  evidence: [],
};

const rtx: Project = {
  id: 'rtx',
  name: 'Purdue Data Mine / RTX',
  kind: 'Aircraft trajectory research',
  role: 'Machine Learning Researcher, Purdue Data Mine with RTX Corporation',
  dates: 'August 2026 to present, remote',
  summary:
    'I’m developing an ML trajectory system for unmanned aircraft, with real-time obstacle avoidance in dynamic airspace.',
  figures: ['Mentored by Raytheon engineers'],
  details: [
    'Raytheon engineers mentor the project’s work on mission-critical software.',
    'I’m building a 3D simulation environment that uses path-planning algorithms to generate synthetic flight data.',
    'The work considers safety, route efficiency, and waypoint compliance when training the models.',
  ],
  links: [],
  evidence: [],
};

const uplate: Project = {
  id: 'uplate',
  name: 'UPlate',
  kind: 'Campus dining and nutrition',
  role: 'Co-founder',
  dates: 'August 2025 to July 2026, remote',
  summary:
    'I co-founded UPlate, built the Flutter app, and led a team of six engineers as it grew to 150+ daily active users.',
  figures: ['150+ daily active users', 'Six engineers led'],
  details: [
    'I managed partnerships and built the app end-to-end, including a multi-page onboarding flow that retains dietary-profile choices.',
    'I also built a retrieval pipeline that splits nutritional data into semantic chunks and supplies relevant context to Google’s Gemini API.',
  ],
  links: [
    { label: 'Website', href: 'https://jefft72.github.io/UPlate/' },
    { label: 'Source', href: 'https://github.com/jefft72/UPlate' },
  ],
  evidence: [
    {
      src: '/work/uplate-onboarding.png',
      alt: 'UPlate welcome screen on a phone: the app icon, the name UPlate, a line describing it as a dining companion for meal planning and nutrition tracking, and a Get Started button.',
      width: 1206,
      height: 2622,
      caption: 'Onboarding screen from the shipped app',
    },
    {
      src: '/work/uplate-0514.png',
      alt: 'UPlate profile step titled Tell us about yourself, with fields for name, age, sex, weight, height, meals per day, and a health goal.',
      width: 1206,
      height: 2622,
      caption: 'Dietary profile step of the onboarding flow in the shipped app',
    },
    {
      src: '/work/uplate-0523.png',
      alt: 'UPlate onboarding step titled Rank Dining Halls, listing five Purdue dining courts to drag into order above a Complete Setup button.',
      width: 1206,
      height: 2622,
      caption: 'Dining hall ranking step of the onboarding flow in the shipped app',
    },
  ],
};

/** Ordered as the page presents them: the two hackathon wins first, then the rest. */
export const projects: Project[] = [animalabs, opencraft, diffex, judi, rtx, uplate];

export const projectById: Record<ProjectId, Project> = { animalabs, opencraft, diffex, judi, rtx, uplate };

/** The two entries with an award, in page order. */
export const hackathonProjects: Project[] = projects.filter((project) => project.award !== undefined);

/** The remaining four, in page order. */
export const otherProjects: Project[] = projects.filter((project) => project.award === undefined);

export const experience: ExperienceEntry[] = [
  {
    organisation: 'Judi Health, formerly Capital Rx',
    role: 'Backend Software Engineering Intern, Summer and Fall 2026',
    dates: 'June 2026 to present',
    location: 'Remote',
    project: 'judi',
  },
  {
    organisation: 'Diffex / Luntraa Inc.',
    role: 'Co-founder',
    dates: 'April 2026 to present',
    location: 'San Francisco, California',
    project: 'diffex',
  },
  {
    organisation: 'Purdue Data Mine / RTX Corporation',
    role: 'Machine Learning Researcher',
    dates: 'August 2026 to present',
    location: 'Remote',
    project: 'rtx',
  },
  {
    organisation: 'UPlate',
    role: 'Co-founder',
    dates: 'August 2025 to July 2026',
    location: 'Remote',
    project: 'uplate',
  },
];

export const education: Education = {
  school: 'Purdue University',
  degree: 'B.S. in Computer Science',
  location: 'West Lafayette, Indiana',
  coursework: [
    'Systems Programming (C)',
    'Object-Oriented Programming',
    'Web Application Programming',
    'Discrete Math',
  ],
};

export const skills: SkillGroup[] = [
  { label: 'Languages', items: ['Python', 'C', 'Java', 'Rust', 'JavaScript'] },
  { label: 'Frameworks', items: ['FastAPI', 'LangChain', 'React', 'React Native', 'Flutter'] },
  {
    label: 'Data and infrastructure',
    items: ['AWS (EC2, VPC)', 'Firecracker', 'PostgreSQL', 'Supabase', 'Git', 'Google Cloud', 'Vertex AI'],
  },
];
