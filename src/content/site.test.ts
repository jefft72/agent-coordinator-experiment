/// <reference types="node" />
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  chapters,
  education,
  experience,
  experienceProjects,
  hackathonProjects,
  identity,
  nav,
  projectById,
  projects,
  skills,
  ventureProjects,
} from './site';
import type { ProjectId } from './types';

const PUBLIC_DIR = fileURLToPath(new URL('../../public/', import.meta.url));

const ORDER: ProjectId[] = ['animalabs', 'opencraft', 'judi', 'rtx', 'diffex', 'uplate'];

/** Every destination the supervisor verified. Nothing else may be linked. */
const VERIFIED_LINKS = new Set([
  'https://devpost.com/software/anima-labs',
  'https://devpost.com/software/opencraft',
  'https://github.com/MarcDasilva/OpenCraft',
  'https://diffex.ai',
  'https://diffex.ai/white-paper',
  'https://github.com/jefft72/UPlate',
  'https://jefft72.github.io/UPlate/',
  'https://github.com/jefft72',
  'https://linkedin.com/in/j-tseng/',
  'mailto:tseng94@purdue.edu',
  'https://www.youtube.com/watch?v=UBaKKoPopSg',
  'https://www.youtube.com/watch?v=cbue_TqiOnI',
]);

/** Résumé details and wording that must never reach public content. */
const FORBIDDEN: Array<{ label: string; pattern: RegExp }> = [
  { label: 'graduation date', pattern: /\bgraduat(?:ion|ing)\b|\bexpected\b/i },
  { label: 'phone number', pattern: /(?:\+1[ .-]?)?\(?\b\d{3}\)?[ .-]\d{3}[ .-]\d{4}\b/ },
  { label: 'em dash', pattern: /—/ },
  { label: 'overall event win', pattern: /\b(grand prize|overall winner|first place|1st place|champion\w*)\b/i },
  { label: 'straight apostrophe (the module uses U+2019 throughout)', pattern: /'/ },
  { label: 'editorial label', pattern: /\b(visible summary|illustrative|abstract study)\b/i },
];

function collectStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') {
    out.push(value);
  } else if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, out);
  } else if (value && typeof value === 'object') {
    for (const item of Object.values(value)) collectStrings(item, out);
  }
  return out;
}

const everyString = collectStrings({
  identity,
  nav,
  chapters,
  projects,
  projectById,
  hackathonProjects,
  experienceProjects,
  ventureProjects,
  experience,
  education,
  skills,
});

/** All the prose a project puts on the page: summary, figures, and every contribution sentence. */
const text = (id: ProjectId) =>
  [projectById[id].summary, ...projectById[id].figures, ...projectById[id].contributions.flatMap((c) => c.body)].join(' ');

describe('project order', () => {
  it('lists the six projects in page order with matching ids', () => {
    expect(projects.map((project) => project.id)).toEqual(ORDER);
    expect(Object.keys(projectById).sort()).toEqual([...ORDER].sort());
    for (const id of ORDER) {
      expect(projectById[id].id).toBe(id);
      expect(projects.find((project) => project.id === id)).toBe(projectById[id]);
    }
  });

  it('groups the projects into the three chapters in page order', () => {
    expect(hackathonProjects.map((project) => project.id)).toEqual(['animalabs', 'opencraft']);
    expect(experienceProjects.map((project) => project.id)).toEqual(['judi', 'rtx']);
    expect(ventureProjects.map((project) => project.id)).toEqual(['diffex', 'uplate']);
    expect([...hackathonProjects, ...experienceProjects, ...ventureProjects]).toEqual(projects);
    expect(hackathonProjects.every((project) => project.award !== undefined)).toBe(true);
    expect([...experienceProjects, ...ventureProjects].every((project) => project.award === undefined)).toBe(true);
  });

  it('names the four chapters in order with numbered labels that match the navigation', () => {
    expect(chapters.map((chapter) => [chapter.id, chapter.number, chapter.title])).toEqual([
      ['hackathons', '01', 'Hackathons'],
      ['experience', '02', 'Experience'],
      ['ventures', '03', 'Ventures'],
      ['about', '04', 'About'],
    ]);
    for (const chapter of chapters) {
      expect(nav.map((item) => item.href)).toContain(`#${chapter.id}`);
    }
  });
});

describe('project fields', () => {
  it('gives every project a name, kind, role, summary, and at least two contributions', () => {
    for (const project of projects) {
      expect(project.name.trim(), project.id).not.toBe('');
      expect(project.kind.trim(), project.id).not.toBe('');
      expect(project.role.trim(), project.id).not.toBe('');
      expect(project.summary.trim(), project.id).not.toBe('');
      expect(project.contributions.length, project.id).toBeGreaterThanOrEqual(2);
    }
  });

  it('uses the verified names and plain descriptors', () => {
    expect(projects.map((project) => project.name)).toEqual([
      'AnimaLabs',
      'OpenCraft',
      'Judi Health',
      'Purdue Data Mine / RTX',
      'Diffex',
      'UPlate',
    ]);
    expect(projects.map((project) => project.kind)).toEqual([
      'Research agents and simulation reports',
      'Multi-agent coordination in Minecraft',
      'Firecracker execution platform',
      'Aircraft trajectory research',
      'Rust agent harness',
      'Campus dining and nutrition',
    ]);
  });

  it('states roles and dates from the résumé, with "to" rather than a dash', () => {
    expect(projectById.judi.role).toBe('Backend Software Engineering Intern, Judi Health (formerly Capital Rx)');
    expect(projectById.judi.dates).toBe('June 2026 to present, remote');
    expect(projectById.diffex.role).toBe('Co-founder, Diffex (Luntraa Inc.)');
    expect(projectById.diffex.dates).toBe('April 2026 to present, San Francisco');
    expect(projectById.rtx.role).toBe('Machine Learning Researcher, Purdue Data Mine with RTX Corporation');
    expect(projectById.rtx.dates).toBe('August 2026 to present, remote');
    expect(projectById.uplate.role).toBe('Co-founder');
    expect(projectById.uplate.dates).toBe('August 2025 to July 2026, remote');
    expect(projectById.animalabs.role).toBe('Cal Hacks 13.0 team project, agent layer and reporting pipeline');
    expect(projectById.animalabs.dates).toBeUndefined();
    expect(projectById.opencraft.role).toBe('HackPrinceton Spring 2026 team project, coordination backend');
    expect(projectById.opencraft.dates).toBeUndefined();
    for (const project of projects) {
      if (project.dates) expect(project.dates).not.toMatch(/[–—]/);
    }
  });

  it('writes every summary in the first person', () => {
    for (const project of projects) {
      expect(project.summary, project.id).toMatch(/^I(?:’m| )/);
    }
  });

  it('keeps each contribution sentence to one complete sentence', () => {
    for (const project of projects) {
      for (const contribution of project.contributions) {
        expect(contribution.id, project.id).toMatch(/^[a-z]+$/);
        expect(contribution.label.trim(), `${project.id} ${contribution.id}`).not.toBe('');
        expect(contribution.body.length, `${project.id} ${contribution.id}`).toBeGreaterThan(0);
        for (const sentence of contribution.body) {
          expect(sentence, project.id).toMatch(/^[A-Z].*\.$/);
          expect(sentence.match(/\. [A-Z]/g) ?? [], sentence).toHaveLength(0);
        }
      }
    }
  });

  it('gives each project distinct contribution ids and labels', () => {
    for (const project of projects) {
      const ids = project.contributions.map((c) => c.id);
      const labels = project.contributions.map((c) => c.label);
      expect(new Set(ids).size, project.id).toBe(ids.length);
      expect(new Set(labels).size, project.id).toBe(labels.length);
    }
  });

  it('uses the three labelled controls the brief names for each hackathon', () => {
    expect(projectById.animalabs.contributions.map((c) => c.label)).toEqual(['Research agent', 'Analyst agent', 'Reports']);
    expect(projectById.opencraft.contributions.map((c) => c.label)).toEqual(['Shared jobs', 'Agent memory', 'Integration testing']);
  });
});

describe('flows', () => {
  it('only reference steps that exist, and every step is reachable from a contribution', () => {
    for (const project of projects) {
      const flow = project.flow;
      const stepIds = new Set(flow?.steps.map((step) => step.id) ?? []);
      expect(stepIds.size, project.id).toBe(flow?.steps.length ?? 0);
      const referenced = new Set<string>();
      for (const contribution of project.contributions) {
        for (const step of contribution.steps ?? []) {
          expect(stepIds.has(step), `${project.id} ${contribution.id} references unknown step ${step}`).toBe(true);
          referenced.add(step);
        }
      }
      if (flow) {
        expect(flow.title.trim(), project.id).not.toBe('');
        expect([...stepIds].filter((id) => !referenced.has(id)), `${project.id} steps no contribution highlights`).toEqual([]);
      }
    }
  });

  it('name real concepts from the résumé rather than data', () => {
    expect(projectById.animalabs.flow?.steps.map((step) => step.label)).toEqual([
      'Europe PMC',
      'Research agent',
      'Simulation outputs',
      'Analyst agent',
      'LaTeX pipeline',
    ]);
    expect(projectById.opencraft.flow?.steps.map((step) => step.label)).toEqual([
      'Minecraft agents',
      'Supabase Postgres',
      'Realtime',
      'pgvector',
      'Integration harness',
    ]);
    expect(projectById.diffex.flow?.steps.map((step) => step.label)).toEqual([
      'Execution traces',
      'Cost and failure analysis',
      'Targeted harness changes',
      'Validation',
    ]);
    expect(projectById.judi.flow?.steps.map((step) => step.label)).toEqual([
      'Capacity-aware scheduler',
      'EC2 hosts',
      'Firecracker microVMs',
    ]);
    expect(projectById.rtx.flow?.steps.map((step) => step.label)).toEqual(['Waypoints', 'Dynamic obstacles', 'Planned path']);
    expect(projectById.uplate.flow).toBeUndefined();
    // Product names such as EC2 and 3D are fine; counts and measurements are not, except the report tally the résumé states.
    for (const project of projects) {
      for (const step of project.flow?.steps ?? []) {
        if (project.id === 'animalabs' && step.id === 'report') continue;
        expect(`${step.label} ${step.note ?? ''}`, `${project.id} ${step.id}`).not.toMatch(/(?<![A-Z])\d+(?:[.,]\d+)?(?:%|\+|M\b|k\b)?(?![A-Za-z])/);
      }
    }
  });
});

describe('awards', () => {
  it('appear on exactly the two hackathon projects with the exact event and track names', () => {
    expect(projects.filter((project) => project.award).map((project) => project.id)).toEqual(['animalabs', 'opencraft']);
    expect(projectById.animalabs.award).toEqual({
      event: 'Cal Hacks 13.0',
      titles: [
        { outcome: 'Winner', title: '[CREAO AI] Best AI-First Disruptor' },
        { outcome: 'Awarded', title: '[MLH] Commit Fellowship' },
      ],
      proof: { label: 'Project and awards on Devpost', href: 'https://devpost.com/software/anima-labs' },
    });
    expect(projectById.opencraft.award).toEqual({
      event: 'HackPrinceton Spring 2026',
      titles: [{ outcome: 'Winner', title: '[Dedalus] Best use of Dedalus Containers' }],
      proof: { label: 'Project and award on Devpost', href: 'https://devpost.com/software/opencraft' },
    });
  });

  it('mark each title as a track win or an awarded fellowship with the sponsor in square brackets', () => {
    for (const project of hackathonProjects) {
      const titles = project.award?.titles ?? [];
      expect(titles.length, project.id).toBeGreaterThan(0);
      for (const { outcome, title } of titles) {
        expect(['Winner', 'Awarded'], `${project.id} ${title}`).toContain(outcome);
        expect(title, project.id).toMatch(/^\[[^\]]+\] \S/);
      }
    }
  });

  it('are reachable from the project links as well as the proof', () => {
    for (const project of hackathonProjects) {
      const hrefs = project.links.map((link) => link.href);
      expect(hrefs, project.id).toContain(project.award?.proof.href);
    }
  });

  it('give both hackathons an explicit Watch demo link', () => {
    expect(projectById.animalabs.links.find((link) => link.label === 'Watch demo')?.href).toBe('https://www.youtube.com/watch?v=UBaKKoPopSg');
    expect(projectById.opencraft.links.find((link) => link.label === 'Watch demo')?.href).toBe('https://www.youtube.com/watch?v=cbue_TqiOnI');
  });
});

describe('links', () => {
  it('only point at verified destinations anywhere in the module', () => {
    const urls = everyString.filter((value) => /^(?:https?:|mailto:)/.test(value));
    expect(urls.length).toBeGreaterThan(0);
    for (const href of urls) {
      expect(VERIFIED_LINKS.has(href), `unverified link ${href}`).toBe(true);
    }
  });

  it('never embed a URL inside prose', () => {
    for (const value of everyString) {
      if (/^(?:https?:|mailto:)/.test(value)) continue;
      expect(value, value).not.toMatch(/https?:\/\/|mailto:|www\./i);
    }
  });

  it('never invent an AnimaLabs repository', () => {
    const hrefs = [
      ...projectById.animalabs.links.map((link) => link.href),
      projectById.animalabs.award?.proof.href,
    ];
    expect(hrefs.some((href) => href?.includes('github.com'))).toBe(false);
    expect(hrefs).toContain('https://devpost.com/software/anima-labs');
  });

  it('keep the OpenCraft source and Devpost destinations', () => {
    const hrefs = projectById.opencraft.links.map((link) => link.href);
    expect(hrefs).toContain('https://github.com/MarcDasilva/OpenCraft');
    expect(hrefs).toContain('https://devpost.com/software/opencraft');
  });

  it('give every link a label', () => {
    for (const project of projects) {
      for (const link of project.links) expect(link.label.trim(), link.href).not.toBe('');
    }
    for (const link of identity.contact) expect(link.label.trim(), link.href).not.toBe('');
  });

  it('leave Judi Health and RTX without links', () => {
    expect(projectById.judi.links).toEqual([]);
    expect(projectById.rtx.links).toEqual([]);
  });
});

describe('evidence', () => {
  it('ships every image from the public directory with alt text, caption, and dimensions', () => {
    const all = projects.flatMap((project) => project.evidence.map((item) => ({ id: project.id, ...item })));
    expect(all.map((item) => item.src)).toEqual([
      '/work/animalabs-demo.jpg',
      '/work/opencraft-demo.jpg',
      '/work/uplate-onboarding.png',
      '/work/uplate-0514.png',
      '/work/uplate-0523.png',
    ]);
    for (const item of all) {
      expect(item.src.startsWith('/work/'), item.src).toBe(true);
      expect(existsSync(join(PUBLIC_DIR, item.src.slice(1))), `${item.src} missing under public`).toBe(true);
      expect(item.alt.trim(), item.src).not.toBe('');
      expect(item.caption.trim(), item.src).not.toBe('');
      expect(item.width, item.src).toBeGreaterThan(0);
      expect(item.height, item.src).toBeGreaterThan(0);
    }
  });

  it('records the real pixel size of each file', () => {
    for (const item of projectById.animalabs.evidence.concat(projectById.opencraft.evidence)) {
      expect([item.width, item.height], item.src).toEqual([1280, 720]);
    }
    for (const item of projectById.uplate.evidence) {
      expect([item.width, item.height], item.src).toEqual([1206, 2622]);
    }
  });

  it('labels the video frames and app screens truthfully', () => {
    expect(projectById.animalabs.evidence[0].caption).toBe('Title frame from the demo video');
    expect(projectById.opencraft.evidence[0].caption).toBe('Scene from the demo video');
    expect(projectById.opencraft.evidence[0].alt).toBe(
      'Scene from the OpenCraft demo video: a Minecraft clearing with a wooden hut, a wheat field, a fenced cow pen, and an agent named cow_assassin standing in the open.',
    );
    expect(projectById.opencraft.evidence[0].alt).not.toMatch(/cobblestone/i);
    expect(projectById.uplate.evidence[0].caption).toBe('Onboarding screen from the shipped app');
    for (const item of projectById.uplate.evidence) expect(item.caption).toMatch(/shipped app$/);
  });

  it('is empty for the projects without public imagery', () => {
    expect(projectById.diffex.evidence).toEqual([]);
    expect(projectById.judi.evidence).toEqual([]);
    expect(projectById.rtx.evidence).toEqual([]);
  });
});

describe('quantitative claims', () => {
  it('scope each number the way the résumé does', () => {
    expect(projectById.diffex.figures).toContain('20% on SWE-bench Lite after one evolution cycle');
    expect(projectById.diffex.figures).toContain('$50,000 in compute awarded through the Daytona Grid Startup Initiative');
    expect(projectById.judi.figures.join(' ')).toContain('5M+ contracted lives');
    expect(text('judi')).toContain('pharmacy claim adjudication platform serving 5M+ contracted lives');
    expect(projectById.uplate.figures).toContain('150+ daily active users');
    expect(projectById.uplate.figures).toContain('Six engineers led');
    expect(projectById.animalabs.figures).toEqual(['7 simulation-based reports', '23 charts', 'Checksum-verified artifacts']);
  });

  it('never restate the compute award as funding or the score as a gain', () => {
    const diffex = text('diffex');
    expect(diffex).not.toMatch(/\$50,000 (?:in |of )?(?:funding|cash|investment|seed|raised)/i);
    expect(diffex).not.toMatch(/(?:raised|funding of|funded with) \$50,000/i);
    expect(diffex).not.toMatch(/20%(?: |-)?(?:point )?(?:improvement|gain|increase|boost|jump|better)/i);
    expect(diffex).not.toMatch(/(?:improved|increased|gained|boosted)(?: by)? 20%/i);
  });

  it('attributes the 5M+ scale to the platform, not to Jeffrey or the microVM system', () => {
    expect(text('judi')).not.toMatch(/I (?:built|serve|served|own) .*5M\+/i);
    expect(text('judi')).not.toMatch(/5M\+ (?:users|customers)/i);
    for (const contribution of projectById.judi.contributions) {
      if (contribution.id === 'claims') continue;
      expect(contribution.body.join(' '), `${contribution.id} must not carry the 5M+ figure`).not.toContain('5M+');
    }
  });

  it('keeps the hackathon and research figures free of numbers that are not in the résumé', () => {
    expect(projectById.opencraft.figures).toEqual(['Supabase Postgres, Realtime, and pgvector']);
    expect(projectById.rtx.figures).toEqual(['Mentored by Raytheon engineers']);
    for (const figure of [...projectById.opencraft.figures, ...projectById.rtx.figures]) {
      expect(figure).not.toMatch(/\d/);
    }
    expect(text('opencraft')).not.toMatch(/\d/);
    expect(text('rtx')).not.toMatch(/\d(?!D)/);
  });
});

describe('résumé coverage', () => {
  it.each([
    ['judi', 'leading development of a new Firecracker microVM platform on AWS'],
    ['judi', 'isolated execution environments'],
    ['judi', 'platform VP toward broader deployment across engineering workflows'],
    ['judi', 'capacity-aware scheduler that places microVMs across EC2 hosts and manages their lifecycle'],
    ['judi', 'Rust linter that checks type-safe function calls and integrated it into CI'],
    ['diffex', 'I architected a modular Rust harness with provider-agnostic model interfaces'],
    ['diffex', 'typed execution traces, tool orchestration, persistent sessions, and replayable evaluations'],
    ['diffex', 'attributes token and latency costs, and groups recurring failures'],
    ['diffex', 'proposes targeted harness changes and evaluates the candidates'],
    ['diffex', 'automated trace diagnosis and harness optimization'],
    ['rtx', 'unmanned aircraft, with real-time obstacle avoidance in dynamic airspace'],
    ['rtx', 'Raytheon engineers mentor the project’s work on mission-critical software'],
    ['rtx', '3D simulation environment that uses path-planning algorithms to generate synthetic flight data'],
    ['rtx', 'safety, route efficiency, and waypoint compliance'],
    ['uplate', 'built the Flutter app'],
    ['uplate', 'led a team of six engineers'],
    ['uplate', 'managed partnerships'],
    ['uplate', 'multi-page onboarding flow that retains dietary-profile choices'],
    ['uplate', 'semantic chunks and supplies relevant context to Google’s Gemini API'],
    ['animalabs', 'searches Europe PMC through Apify and proposes experiments with citations'],
    ['animalabs', 'turns simulation outputs into findings and compares them with published studies'],
    ['animalabs', 'agent-driven LaTeX reporting pipeline grounded in deterministic simulation analysis'],
    ['animalabs', 'The agent-driven reporting pipeline produces LaTeX reports and checksum-verified artifacts'],
    ['animalabs', 'Our team’s simulations reproduced published Parkinson’s disease findings on data the model was not fitted to'],
    ['opencraft', 'share jobs, state, and memory'],
    ['opencraft', 'Supabase Postgres, Realtime, and pgvector to store jobs, track agents, and share memory'],
    ['opencraft', 'simulates job contention, memory writes, and chat-based task handoff'],
  ] as Array<[ProjectId, string]>)('%s copy includes "%s"', (id, phrase) => {
    expect(text(id)).toContain(phrase);
  });

  it('never claims clinical validation for AnimaLabs', () => {
    expect(text('animalabs')).not.toMatch(/\b(clinical|clinically|treatment|cure|patients?|medical(?:ly)? effective)\b/i);
  });

  it('never describes the sculpture as a demonstration of any project', () => {
    for (const value of everyString) {
      expect(value, value).not.toMatch(/\b(sculpture|blade|study|pattern|phase|replay)\b/i);
    }
  });
});

describe('identity and navigation', () => {
  it('names Jeffrey Tseng with the three opening lines and verified contact destinations', () => {
    expect(identity.name).toBe('Jeffrey Tseng');
    expect(identity.first).toBe('Jeffrey');
    expect(identity.last).toBe('Tseng');
    expect(`${identity.first} ${identity.last}`).toBe(identity.name);
    expect(identity.lines).toEqual([
      'Computer science at Purdue',
      'Co-founder of Diffex',
      'Backend engineering intern at Judi Health',
    ]);
    expect(identity.contact.map((link) => [link.label, link.href])).toEqual([
      ['Email', 'mailto:tseng94@purdue.edu'],
      ['GitHub', 'https://github.com/jefft72'],
      ['LinkedIn', 'https://linkedin.com/in/j-tseng/'],
    ]);
  });

  it('exposes the five destinations in order', () => {
    expect(nav.map((item) => [item.label, item.href])).toEqual([
      ['Hackathons', '#hackathons'],
      ['Experience', '#experience'],
      ['Ventures', '#ventures'],
      ['About', '#about'],
      ['Contact', '#contact'],
    ]);
  });
});

describe('experience', () => {
  it('lists the four résumé rows, each expanding into an existing project', () => {
    expect(experience).toHaveLength(4);
    expect(experience.map((entry) => entry.organisation)).toEqual([
      'Judi Health, formerly Capital Rx',
      'Diffex / Luntraa Inc.',
      'Purdue Data Mine / RTX Corporation',
      'UPlate',
    ]);
    expect(experience.map((entry) => entry.project)).toEqual(['judi', 'diffex', 'rtx', 'uplate']);
    for (const entry of experience) {
      expect(entry.project && projectById[entry.project], entry.organisation).toBeDefined();
      expect(entry.role.trim()).not.toBe('');
      expect(entry.location.trim()).not.toBe('');
      expect(entry.dates).toMatch(/^[A-Z][a-z]+ \d{4} to (?:present|[A-Z][a-z]+ \d{4})$/);
    }
  });

  it('keeps the résumé dates and locations', () => {
    expect(experience.map((entry) => [entry.dates, entry.location])).toEqual([
      ['June 2026 to present', 'Remote'],
      ['April 2026 to present', 'San Francisco, California'],
      ['August 2026 to present', 'Remote'],
      ['August 2025 to July 2026', 'Remote'],
    ]);
    expect(experience[0].role).toContain('Summer and Fall 2026');
  });
});

describe('education and skills', () => {
  it('records Purdue with the listed coursework', () => {
    expect(education).toEqual({
      school: 'Purdue University',
      degree: 'B.S. in Computer Science',
      location: 'West Lafayette, Indiana',
      coursework: [
        'Systems Programming (C)',
        'Object-Oriented Programming',
        'Web Application Programming',
        'Discrete Math',
      ],
    });
  });

  it('lists the three skill groups exactly', () => {
    expect(skills).toEqual([
      { label: 'Languages', items: ['Python', 'C', 'Java', 'Rust', 'JavaScript'] },
      { label: 'Frameworks', items: ['FastAPI', 'LangChain', 'React', 'React Native', 'Flutter'] },
      {
        label: 'Data and infrastructure',
        items: ['AWS (EC2, VPC)', 'Firecracker', 'PostgreSQL', 'Supabase', 'Git', 'Google Cloud', 'Vertex AI'],
      },
    ]);
  });
});

describe('public content hygiene', () => {
  it('walks a non-trivial amount of copy', () => {
    expect(everyString.length).toBeGreaterThan(100);
  });

  it.each(FORBIDDEN)('contains no $label', ({ pattern }) => {
    for (const value of everyString) {
      expect(value, value).not.toMatch(pattern);
    }
  });

  it('contains no marketing adjectives or taglines', () => {
    const marketing = /\b(cutting[- ]edge|state[- ]of[- ]the[- ]art|world[- ]class|revolutionary|passionate|innovative|seamless|next[- ]generation)\b/i;
    for (const value of everyString) {
      expect(value, value).not.toMatch(marketing);
    }
  });

  it('has no leading or trailing whitespace in any string', () => {
    for (const value of everyString) {
      expect(value).toBe(value.trim());
    }
  });
});
