/// <reference types="node" />
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { awards, identity, images, projectOrder, work, type ProjectId } from './work';

const PUBLIC_DIR = fileURLToPath(new URL('../../public/', import.meta.url));

/** Every destination the supervisor verified. Nothing else may be linked. */
const VERIFIED_LINKS = new Set([
  'https://devpost.com/software/anima-labs',
  'https://devpost.com/software/opencraft',
  'https://github.com/MarcDasilva/OpenCraft',
  'https://diffex.ai',
  'https://github.com/jefft72/UPlate',
  'https://jefft72.github.io/UPlate/',
  'https://github.com/jefft72',
  'https://linkedin.com/in/j-tseng/',
  'mailto:tseng94@purdue.edu',
  'https://www.youtube.com/watch?v=UBaKKoPopSg',
  'https://www.youtube.com/watch?v=cbue_TqiOnI',
]);

/** Resume details that must never reach public content. */
const FORBIDDEN: Array<{ label: string; pattern: RegExp }> = [
  { label: 'graduation date', pattern: /\bgraduat(?:ion|ing)\b|\bexpected\b/i },
  { label: 'phone number', pattern: /(?:\+1[ .-]?)?\(?\b\d{3}\)?[ .-]\d{3}[ .-]\d{4}\b/ },
  { label: 'em dash', pattern: /\u2014/ },
  { label: 'overall event win', pattern: /\b(grand prize|overall winner|first place|1st place)\b/i },
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

const everyString = collectStrings({ work, identity, awards, images });

describe('project index', () => {
  it('lists each project exactly once and keys entries by their own id', () => {
    const ids = Object.keys(work) as ProjectId[];
    expect([...projectOrder].sort()).toEqual([...ids].sort());
    expect(new Set(projectOrder).size).toBe(projectOrder.length);
    for (const id of ids) {
      expect(work[id].id).toBe(id);
    }
  });

  it('gives every project a name, descriptor, role line, facts, and artifact note', () => {
    for (const id of projectOrder) {
      const entry = work[id];
      expect(entry.name.trim()).not.toBe('');
      expect(entry.descriptor.trim()).not.toBe('');
      expect(entry.roleLine.trim()).not.toBe('');
      expect(entry.artifact.trim()).not.toBe('');
      expect(entry.facts.length).toBeGreaterThanOrEqual(2);
      expect(entry.facts.length).toBeLessThanOrEqual(3);
    }
  });
});

describe('links', () => {
  it('only point at verified destinations', () => {
    const hrefs = [
      ...projectOrder.flatMap((id) => work[id].links.map((link) => link.href)),
      ...awards.flatMap((award) => award.links.map((link) => link.href)),
      ...identity.contact.map((link) => link.href),
    ];
    expect(hrefs.length).toBeGreaterThan(0);
    for (const href of hrefs) {
      expect(VERIFIED_LINKS.has(href), `unverified link ${href}`).toBe(true);
    }
  });

  it('never invent an AnimaLabs repository', () => {
    const hrefs = work.animalabs.links.map((link) => link.href);
    expect(hrefs.some((href) => href.includes('github.com'))).toBe(false);
    expect(hrefs).toContain('https://devpost.com/software/anima-labs');
  });
});

describe('awards', () => {
  it('use the exact track award names for both hackathons', () => {
    const animalabs = awards.find((award) => award.project === 'animalabs');
    const opencraft = awards.find((award) => award.project === 'opencraft');
    expect(animalabs?.event).toBe('Cal Hacks 13.0');
    expect(animalabs?.categories).toEqual(['Best AI-First Disruptor, CREAO AI track', 'MLH Commit Fellowship']);
    expect(opencraft?.event).toBe('HackPrinceton Spring 2026');
    expect(opencraft?.categories).toEqual(['Best use of Dedalus Containers']);
    expect(awards).toHaveLength(2);
  });

  it('ship the award imagery from the public directory with alt text', () => {
    for (const award of awards) {
      expect(award.image.src.startsWith('/work/')).toBe(true);
      expect(existsSync(new URL(`.${award.image.src}`, `file://${PUBLIC_DIR}`)), award.image.src).toBe(true);
      expect(award.image.alt.trim()).not.toBe('');
      expect(award.image.width).toBeGreaterThan(0);
      expect(award.image.height).toBeGreaterThan(0);
    }
    for (const src of Object.values(images)) {
      expect(existsSync(new URL(`.${src}`, `file://${PUBLIC_DIR}`)), src).toBe(true);
    }
  });
});

describe('quantitative claims', () => {
  const facts = (id: ProjectId) => work[id].facts.join(' ');

  it('scope each number the way the resume does', () => {
    expect(facts('diffex')).toContain('$50,000 in compute');
    expect(facts('diffex')).toContain('20% on SWE-bench Lite after a single evolution cycle');
    expect(facts('judi')).toContain('pharmacy claim adjudication platform serving 5M+ contracted lives');
    expect(facts('uplate')).toContain('150+ daily active users');
    expect(facts('uplate')).toContain('six engineers');
    expect(facts('animalabs')).toContain('7 simulation-based reports and 23 charts');
  });

  it('never restate the compute award as funding or the score as a gain', () => {
    expect(facts('diffex')).not.toMatch(/\$50,000 (in )?(funding|cash|investment)/i);
    expect(facts('diffex')).not.toMatch(/20% (improvement|gain|increase|boost)/i);
  });
});

describe('identity', () => {
  it('names Jeffrey Tseng with verified contact destinations', () => {
    expect(identity.name).toBe('Jeffrey Tseng');
    const hrefs = identity.contact.map((link) => link.href);
    expect(hrefs).toContain('mailto:tseng94@purdue.edu');
    expect(hrefs).toContain('https://github.com/jefft72');
    expect(hrefs).toContain('https://linkedin.com/in/j-tseng/');
  });
});

describe('public content hygiene', () => {
  it.each(FORBIDDEN)('contains no $label', ({ pattern }) => {
    for (const text of everyString) {
      expect(text, text).not.toMatch(pattern);
    }
  });
});
