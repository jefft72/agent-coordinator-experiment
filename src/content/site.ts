/**
 * Single source of truth for every word on the site.
 * Every sentence is quoted or closely paraphrased from the supplied résumé copy.
 * No tagline, no positioning language, no graduation date, no phone number, no future award.
 * Apostrophes are the typographic form (U+2019) throughout.
 */

import type {
  Chapter,
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

/** The chapters after the opening, in page order. Contact is a destination inside About. */
export const chapters: Chapter[] = [
  { id: 'hackathons', number: '01', title: 'Hackathons' },
  { id: 'experience', number: '02', title: 'Experience' },
  { id: 'ventures', number: '03', title: 'Ventures' },
  { id: 'about', number: '04', title: 'About' },
];

export const nav: NavItem[] = [
  { label: 'Hackathons', href: '#hackathons' },
  { label: 'Experience', href: '#experience' },
  { label: 'Ventures', href: '#ventures' },
  { label: 'About', href: '#about' },
  { label: 'Contact', href: '#contact' },
];

const animalabs: Project = {
  id: 'animalabs',
  name: 'AnimaLabs',
  kind: 'Research agents and simulation reports',
  role: 'Cal Hacks 13.0 team project, agent layer and reporting pipeline',
  summary:
    'I built the research and analyst agents, along with an agent-driven LaTeX reporting pipeline grounded in deterministic simulation analysis.',
  figures: ['7 simulation-based reports', '23 charts', 'Checksum-verified artifacts'],
  contributions: [
    {
      id: 'research',
      label: 'Research agent',
      body: ['The research agent searches Europe PMC through Apify and proposes experiments with citations.'],
      steps: ['search', 'propose'],
    },
    {
      id: 'analyst',
      label: 'Analyst agent',
      body: [
        'The analyst agent turns simulation outputs into findings and compares them with published studies.',
        'Our team’s simulations reproduced published Parkinson’s disease findings on data the model was not fitted to.',
      ],
      steps: ['simulate', 'compare'],
    },
    {
      id: 'reports',
      label: 'Reports',
      body: [
        'The agent-driven reporting pipeline produces LaTeX reports and checksum-verified artifacts from the analysis.',
        'The pipeline produced 7 simulation-based reports and 23 charts, with every artifact checksum-verified.',
      ],
      steps: ['report'],
    },
  ],
  flow: {
    title: 'How a report is produced',
    steps: [
      { id: 'search', label: 'Europe PMC', note: 'searched through Apify' },
      { id: 'propose', label: 'Research agent', note: 'proposes cited experiments' },
      { id: 'simulate', label: 'Simulation outputs', note: 'deterministic analysis' },
      { id: 'compare', label: 'Analyst agent', note: 'findings against published studies' },
      { id: 'report', label: 'LaTeX pipeline', note: '7 reports, 23 charts, checksum-verified' },
    ],
  },
  award: {
    event: 'Cal Hacks 13.0',
    titles: [
      { outcome: 'Winner', title: '[CREAO AI] Best AI-First Disruptor' },
      { outcome: 'Awarded', title: '[MLH] Commit Fellowship' },
    ],
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
  contributions: [
    {
      id: 'jobs',
      label: 'Shared jobs',
      body: [
        'The backend uses Supabase Postgres, Realtime, and pgvector to store jobs, track agents, and share memory.',
        'Jobs and each agent’s state are stored in Postgres, and Supabase Realtime pushes the changes out to the agents.',
      ],
      steps: ['agents', 'postgres', 'realtime'],
    },
    {
      id: 'memory',
      label: 'Agent memory',
      body: ['Shared memory is kept in pgvector, so an agent can retrieve what another agent has already recorded.'],
      steps: ['agents', 'pgvector'],
    },
    {
      id: 'testing',
      label: 'Integration testing',
      body: ['I built an integration harness that simulates job contention, memory writes, and chat-based task handoff.'],
      steps: ['harness'],
    },
  ],
  flow: {
    title: 'What the backend coordinates',
    steps: [
      { id: 'agents', label: 'Minecraft agents', note: 'take jobs, report state, write memory' },
      { id: 'postgres', label: 'Supabase Postgres', note: 'jobs and agent state' },
      { id: 'realtime', label: 'Realtime', note: 'shared state updates' },
      { id: 'pgvector', label: 'pgvector', note: 'shared memory' },
      { id: 'harness', label: 'Integration harness', note: 'job contention, memory writes, chat handoff' },
    ],
  },
  award: {
    event: 'HackPrinceton Spring 2026',
    titles: [{ outcome: 'Winner', title: '[Dedalus] Best use of Dedalus Containers' }],
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
      alt: 'Scene from the OpenCraft demo video: a Minecraft clearing with a wooden hut, a wheat field, a fenced cow pen, and an agent named cow_assassin standing in the open.',
      width: 1280,
      height: 720,
      caption: 'Scene from the demo video',
    },
  ],
};

const judi: Project = {
  id: 'judi',
  name: 'Judi Health',
  kind: 'Firecracker execution platform',
  role: 'Backend Software Engineering Intern, Judi Health (formerly Capital Rx)',
  dates: 'June 2026 to present, remote',
  summary:
    'I’m leading development of a new Firecracker microVM platform on AWS that gives engineers and coding agents isolated execution environments.',
  figures: ['Pharmacy claim adjudication platform serving 5M+ contracted lives'],
  contributions: [
    {
      id: 'platform',
      label: 'New platform',
      body: [
        'The platform runs Firecracker microVMs on AWS so that engineers and coding agents each get an isolated execution environment.',
        'I’m working with the platform VP toward broader deployment across engineering workflows.',
      ],
      steps: ['microvm'],
    },
    {
      id: 'scheduler',
      label: 'Capacity scheduler and lifecycle',
      body: ['I designed a capacity-aware scheduler that places microVMs across EC2 hosts and manages their lifecycle.'],
      steps: ['scheduler', 'hosts'],
    },
    {
      id: 'claims',
      label: 'Claims backend',
      body: ['I also develop backend services for a pharmacy claim adjudication platform serving 5M+ contracted lives.'],
    },
    {
      id: 'linter',
      label: 'Rust linter in CI',
      body: ['For the claims pipeline, I built a Rust linter that checks type-safe function calls and integrated it into CI.'],
    },
  ],
  flow: {
    title: 'Scope of the microVM platform',
    steps: [
      { id: 'scheduler', label: 'Capacity-aware scheduler', note: 'placement and lifecycle' },
      { id: 'hosts', label: 'EC2 hosts', note: 'placement by available capacity' },
      { id: 'microvm', label: 'Firecracker microVMs', note: 'isolated execution for engineers and coding agents' },
    ],
  },
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
  contributions: [
    {
      id: 'trajectory',
      label: 'Trajectory system',
      body: [
        'I’m developing the system that plans trajectories for unmanned aircraft and avoids obstacles in real time as the airspace changes.',
        'Raytheon engineers mentor the project’s work on mission-critical software.',
      ],
      steps: ['path', 'obstacle'],
    },
    {
      id: 'simulation',
      label: 'Simulation and synthetic flight data',
      body: ['I’m building a 3D simulation environment that uses path-planning algorithms to generate synthetic flight data.'],
      steps: ['path'],
    },
    {
      id: 'objectives',
      label: 'Training objectives',
      body: ['The work considers safety, route efficiency, and waypoint compliance when training the models.'],
      steps: ['waypoint'],
    },
  ],
  flow: {
    title: 'The planning problem',
    steps: [
      { id: 'waypoint', label: 'Waypoints', note: 'waypoint compliance' },
      { id: 'obstacle', label: 'Dynamic obstacles', note: 'avoided in real time' },
      { id: 'path', label: 'Planned path', note: 'synthetic flight data from the simulation' },
    ],
  },
  links: [],
  evidence: [],
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
  contributions: [
    {
      id: 'harness',
      label: 'Harness',
      body: [
        'I architected a modular Rust harness with provider-agnostic model interfaces, typed execution traces, tool orchestration, persistent sessions, and replayable evaluations.',
      ],
      steps: ['traces'],
    },
    {
      id: 'evolution',
      label: 'Evolution pipeline',
      body: [
        'The evolution pipeline examines execution traces, attributes token and latency costs, and groups recurring failures.',
        'It then proposes targeted harness changes and evaluates the candidates.',
      ],
      steps: ['analysis', 'changes', 'validation'],
    },
    {
      id: 'result',
      label: 'Result',
      body: ['After one cycle, the harness reached 20% on SWE-bench Lite through automated trace diagnosis and harness optimization.'],
      steps: ['validation'],
    },
  ],
  flow: {
    title: 'One evolution cycle',
    steps: [
      { id: 'traces', label: 'Execution traces', note: 'typed, replayable' },
      { id: 'analysis', label: 'Cost and failure analysis', note: 'token and latency costs, recurring failures' },
      { id: 'changes', label: 'Targeted harness changes', note: 'proposed from the analysis' },
      { id: 'validation', label: 'Validation', note: 'candidate changes evaluated, replayable' },
    ],
  },
  links: [
    { label: 'Website', href: 'https://diffex.ai' },
    { label: 'White paper', href: 'https://diffex.ai/white-paper' },
  ],
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
  contributions: [
    {
      id: 'app',
      label: 'Flutter app and onboarding',
      body: [
        'I managed partnerships and built the app end-to-end, including a multi-page onboarding flow that retains dietary-profile choices.',
      ],
    },
    {
      id: 'retrieval',
      label: 'Nutrition retrieval for Gemini',
      body: [
        'I also built a retrieval pipeline that splits nutritional data into semantic chunks and supplies relevant context to Google’s Gemini API.',
      ],
    },
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

/** Ordered as the page presents them: the two hackathon wins, the two experience roles, the two ventures. */
export const projects: Project[] = [animalabs, opencraft, judi, rtx, diffex, uplate];

export const projectById: Record<ProjectId, Project> = { animalabs, opencraft, judi, rtx, diffex, uplate };

/** The two entries with an award, in page order. */
export const hackathonProjects: Project[] = [animalabs, opencraft];

/** The internship and the research position, in page order. */
export const experienceProjects: Project[] = [judi, rtx];

/** The two co-founded companies, in page order. */
export const ventureProjects: Project[] = [diffex, uplate];

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
