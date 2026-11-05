/**
 * Single source of truth for every word on the opening spread.
 * Every claim is quoted from the resume. Do not add positioning language,
 * invented interests, or a tagline.
 */

export type ProjectId = 'diffex' | 'judi' | 'animalabs' | 'opencraft' | 'rtx' | 'uplate';

export const projectOrder: ProjectId[] = ['diffex', 'judi', 'animalabs', 'opencraft', 'rtx', 'uplate'];

export interface WorkLink {
  label: string;
  href: string;
}

export interface WorkEntry {
  id: ProjectId;
  /** Plain project name, set in Ortica in the index and caption. */
  name: string;
  /** One short factual descriptor shown in the index under the name. */
  descriptor: string;
  /** Role, organisation, dates, place. One line in the caption. */
  roleLine: string;
  /** Two or three factual sentences shown when the project is selected. */
  facts: string[];
  /** What the artifact in the contact sheet actually is. Truthful, no overclaim. */
  artifact: string;
  links: WorkLink[];
}

export const work: Record<ProjectId, WorkEntry> = {
  diffex: {
    id: 'diffex',
    name: 'Diffex',
    descriptor: 'Co-founder. Rust agent harness and self-evolution pipeline.',
    roleLine: 'Luntraa Inc. Co-founder, April 2026 to present, San Francisco.',
    facts: [
      'Architected a modular Rust agent harness: provider-agnostic model interfaces, typed execution traces, tool orchestration, persistent session state, and replayable evaluation infrastructure.',
      'Built the evidence-driven self-evolution pipeline. It analyzes execution traces, attributes token and latency costs, clusters recurring failures, generates targeted harness modifications, and validates candidates.',
      'Reached 20% on SWE-bench Lite after a single evolution cycle. Awarded $50,000 in compute through the Daytona Grid Startup Initiative.',
    ],
    artifact: 'Illustrative folded execution trace, not a product screenshot.',
    links: [{ label: 'diffex.ai', href: 'https://diffex.ai' }],
  },
  judi: {
    id: 'judi',
    name: 'Judi Health',
    descriptor: 'Backend intern. Firecracker microVM platform on AWS.',
    roleLine: 'Formerly Capital Rx. Backend software engineering intern, summer and fall 2026, remote.',
    facts: [
      'Leading a greenfield Firecracker microVM execution platform on AWS that gives engineers and coding agents isolated sandboxes, working with the platform VP toward broader deployment across Judi engineering workflows.',
      'Designed the capacity-aware scheduler that places microVMs across EC2 hosts and manages their lifecycle.',
      'Developing backend services for a pharmacy claim adjudication platform serving 5M+ contracted lives. Built a Rust linter that enforces type-safe function calls across the claims pipeline and runs in CI.',
    ],
    artifact: 'Illustrative microVM placement tray, not employer infrastructure.',
    links: [],
  },
  animalabs: {
    id: 'animalabs',
    name: 'AnimaLabs',
    descriptor: 'Agent layer and LaTeX reporting pipeline. Cal Hacks 13.0.',
    roleLine: 'Cal Hacks 13.0 team project. Built the full agent layer and the reporting pipeline.',
    facts: [
      'A research agent searches Europe PMC via Apify and proposes cited experiments. An analyst agent turns simulation outputs into observable findings benchmarked against published studies.',
      'The agent-driven LaTeX reporting pipeline is grounded in deterministic simulation analysis and generated 7 simulation-based reports and 23 charts with checksum-verified artifacts.',
      'Best AI-First Disruptor, CREAO AI track, and the MLH Commit Fellowship at Cal Hacks 13.0. The team’s simulations reproduced published Parkinson’s disease findings on data the model was not fitted to.',
    ],
    artifact: 'Title frame from the demo video with illustrative report pages.',
    links: [
      { label: 'Devpost', href: 'https://devpost.com/software/anima-labs' },
      { label: 'Watch demo', href: 'https://www.youtube.com/watch?v=UBaKKoPopSg' },
    ],
  },
  opencraft: {
    id: 'opencraft',
    name: 'OpenCraft',
    descriptor: 'Multi-agent coordination backend. HackPrinceton Spring 2026.',
    roleLine: 'HackPrinceton Spring 2026 team project. Built the coordination backend and integration harness.',
    facts: [
      'Engineered the multi-agent coordination backend for Minecraft using Supabase, with Postgres, Realtime, and pgvector as shared state for jobs, agents, and memory.',
      'Built the integration harness that simulates job contention, memory writes, and chat-based task handoff.',
      'Best use of Dedalus Containers, HackPrinceton Spring 2026.',
    ],
    artifact: 'Frame from the demo video with an illustrative voxel build site.',
    links: [
      { label: 'Devpost', href: 'https://devpost.com/software/opencraft' },
      { label: 'Source', href: 'https://github.com/MarcDasilva/OpenCraft' },
      { label: 'Watch demo', href: 'https://www.youtube.com/watch?v=cbue_TqiOnI' },
    ],
  },
  rtx: {
    id: 'rtx',
    name: 'Purdue / RTX',
    descriptor: 'ML researcher. UAV trajectory system with obstacle avoidance.',
    roleLine: 'Purdue Data Mine with RTX Corporation. Machine learning researcher, August 2026 to present, remote.',
    facts: [
      'Developing an ML-based trajectory system for unmanned aircraft with real-time obstacle avoidance in dynamic airspace, mentored by Raytheon engineers on mission-critical software.',
      'Building a 3D simulation environment that synthesizes flight data through path-planning algorithms and trains models optimized for safety, route efficiency, and waypoint compliance.',
    ],
    artifact: 'Illustrative route plate, not project data.',
    links: [],
  },
  uplate: {
    id: 'uplate',
    name: 'UPlate',
    descriptor: 'Co-founder. Flutter dining app with RAG over nutrition data.',
    roleLine: 'Co-founder, August 2025 to July 2026, remote.',
    facts: [
      'Campus dining and nutrition app grown to 150+ daily active users. Led six engineers and managed partnerships.',
      'Engineered a RAG pipeline with semantic chunking over nutritional data, serving context to Google’s Gemini API.',
      'Built the Flutter app end to end, including the stateful multi-page onboarding flow that collects user dietary profiles.',
    ],
    artifact: 'Onboarding screen from the shipped app.',
    links: [
      { label: 'Source', href: 'https://github.com/jefft72/UPlate' },
      { label: 'Live site', href: 'https://jefft72.github.io/UPlate/' },
    ],
  },
};

export const identity = {
  name: 'Jeffrey Tseng',
  lines: ['Computer science, Purdue', 'Co-founder, Diffex', 'Backend engineering, Judi Health'],
  contact: [
    { label: 'Email', href: 'mailto:tseng94@purdue.edu' },
    { label: 'GitHub', href: 'https://github.com/jefft72' },
    { label: 'LinkedIn', href: 'https://linkedin.com/in/j-tseng/' },
  ],
} as const;

export interface Award {
  project: ProjectId;
  event: string;
  categories: string[];
  links: WorkLink[];
  image: { src: string; alt: string; width: number; height: number };
}

/** Exact award wording. Both are track prizes, never overall event wins. */
export const awards: Award[] = [
  {
    project: 'animalabs',
    event: 'Cal Hacks 13.0',
    categories: ['Best AI-First Disruptor, CREAO AI track', 'MLH Commit Fellowship'],
    links: work.animalabs.links,
    image: {
      src: '/work/animalabs-demo.jpg',
      alt: 'Title frame of the AnimaLabs demo video: a petri dish with a C. elegans worm on a purple dotted ground.',
      width: 1280,
      height: 720,
    },
  },
  {
    project: 'opencraft',
    event: 'HackPrinceton Spring 2026',
    categories: ['Best use of Dedalus Containers'],
    links: work.opencraft.links,
    image: {
      src: '/work/opencraft-demo.jpg',
      alt: 'Frame from the OpenCraft demo video: a Minecraft clearing with a wooden hut, a wheat field, and an agent named cow_assassin.',
      width: 1280,
      height: 720,
    },
  },
];

export const images = {
  animalabs: '/work/animalabs-demo.jpg',
  opencraft: '/work/opencraft-demo.jpg',
  uplateOnboarding: '/work/uplate-onboarding.png',
} as const;
