/// <reference lib="dom" />
import { test, expect, type Page } from '@playwright/test';
import { chapters, education, experience, hackathonProjects, identity, nav, projectById, projects, skills } from '../src/content/site';
import type { Project } from '../src/content/types';
import {
  FORBIDDEN_TEXT,
  article,
  chapter,
  contrastRatio,
  contributionPanel,
  contributionTab,
  expectAnchorPlaced,
  expectAtLeastOne,
  flowStep,
  gotoAndSettle,
  requireBox,
  scrollThroughPage,
  skipUnlessProject,
  waitForRenderState,
  waitForScrollIdle,
} from './helpers';

const CHAPTER_IDS = ['hackathons', 'experience', 'ventures', 'about', 'contact'];

/** Asserts a computed rgb() colour is within two units per channel of the authored one. */
function expectNear(color: string, rgb: [number, number, number]) {
  const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  expect(match, `unparsable colour ${color}`).not.toBeNull();
  const channels = match ? [Number(match[1]), Number(match[2]), Number(match[3])] : [];
  channels.forEach((value, i) => expect(Math.abs(value - rgb[i]), `${color} vs rgb(${rgb.join(', ')})`).toBeLessThanOrEqual(2));
}

/** Every sentence a project must show on the main page, with no control pressed. */
async function expectProjectOnPage(page: Page, project: Project) {
  const node = article(page, project.id);
  await expect(node, `${project.id} article`).toHaveCount(1);
  await expect(node.locator(`h3#project-title-${project.id}`)).toHaveText(project.name);
  await expect(node).toContainText(project.role);
  if (project.dates) await expect(node).toContainText(project.dates);
  await expect(node).toContainText(project.summary);
  for (const figure of project.figures) {
    await expect(node, `${project.id} figure "${figure}"`).toContainText(figure);
  }
  for (const link of project.links) {
    await expectAtLeastOne(node.locator(`a[href="${link.href}"]`), `${project.id} link ${link.href}`);
  }
  for (const evidence of project.evidence) {
    await expectAtLeastOne(node.locator(`img[alt="${evidence.alt}"]`), `${project.id} image "${evidence.alt}"`);
    await expect(node).toContainText(evidence.caption);
  }
  const award = project.award;
  if (award) {
    await expect(node).toContainText(award.event);
    for (const { title } of award.titles) await expect(node).toContainText(title);
    await expectAtLeastOne(node.locator(`a[href="${award.proof.href}"]`), `${project.id} proof link`);
  }
}

test.describe('chapters', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    skipUnlessProject(testInfo, 'desktop', 'mobile');
    await gotoAndSettle(page, '/?intro=skip');
  });

  test('the five destinations follow the opening in order, each on its own surface', async ({ page }) => {
    const order = await page.evaluate((ids) => {
      const tops = ids.map((id) => {
        const el = document.getElementById(id);
        return el ? el.getBoundingClientRect().top + window.scrollY : Number.NaN;
      });
      return { tops, openingBottom: (document.getElementById('opening')?.offsetHeight ?? 0) };
    }, CHAPTER_IDS);
    for (let i = 0; i < CHAPTER_IDS.length; i += 1) {
      expect(order.tops[i], `#${CHAPTER_IDS[i]} should exist`).not.toBeNaN();
      if (i > 0) expect(order.tops[i], `#${CHAPTER_IDS[i]} should follow #${CHAPTER_IDS[i - 1]}`).toBeGreaterThan(order.tops[i - 1]);
    }
    for (const { id, title, number } of chapters) {
      const section = chapter(page, id);
      await expect(section).toHaveAttribute('aria-labelledby', `${id}-heading`);
      await expect(section.locator(`h2#${id}-heading`)).toHaveText(title);
      await expect(page.locator(`[data-testid="chapter-label-${id}"]`)).toContainText(`${number} / ${title}`);
    }
    await expect(chapter(page, 'contact').locator('h2#contact-heading')).toHaveText('Contact');

    // Each chapter paints a different surface from the one before it, and OpenCraft from AnimaLabs.
    const surfaces = await page.evaluate(() => {
      const of = (selector: string) => {
        const el = document.querySelector(selector);
        return el ? getComputedStyle(el).backgroundColor : 'missing';
      };
      return {
        hackathons: of('[data-testid="chapter-hackathons"]'),
        opencraft: of('[data-testid="project-opencraft"]'),
        experience: of('[data-testid="chapter-experience"]'),
        ventures: of('[data-testid="chapter-ventures"]'),
        about: of('[data-testid="chapter-about"]'),
      };
    });
    // Headless Chrome colour-manages the computed values by a unit or two.
    expectNear(surfaces.hackathons, [58, 44, 72]);
    expectNear(surfaces.opencraft, [28, 44, 15]);
    expectNear(surfaces.experience, [236, 235, 230]);
    expectNear(surfaces.ventures, [10, 11, 13]);
    expectNear(surfaces.about, [22, 23, 27]);
  });

  test('all six projects are readable on the main page without opening anything', async ({ page }) => {
    const articles = page.locator('article[data-testid^="project-"]');
    await expect(articles).toHaveCount(projects.length);
    const ids = await articles.evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-testid')));
    expect(ids).toEqual(projects.map((project) => `project-${project.id}`));
    for (const project of projects) await expectProjectOnPage(page, project);
    await expect(article(page, 'animalabs').locator('a[href*="github.com"]')).toHaveCount(0);
    await expect(page.locator('dialog')).toHaveCount(0);
    await expect(page.locator('canvas:not([data-testid="scene"] canvas)')).toHaveCount(0);
  });

  test('every contribution sentence is on the page, in blocks or behind a labelled control', async ({ page }) => {
    for (const project of projects) {
      const node = article(page, project.id);
      const tabs = node.locator('[role="tab"]');
      if ((await tabs.count()) === 0) {
        for (const contribution of project.contributions) {
          const block = node.locator(`[data-testid="contribution-${project.id}-${contribution.id}"]`);
          await expect(block).toContainText(contribution.label);
          for (const sentence of contribution.body) await expect(block, `${project.id} ${contribution.id}`).toContainText(sentence);
        }
        continue;
      }
      expect(hackathonProjects.map((p) => p.id), `${project.id} should only use tabs in the hackathon chapter`).toContain(project.id);
      for (const contribution of project.contributions) {
        const tab = contributionTab(page, project.id, contribution.id);
        await expect(tab).toHaveText(contribution.label);
        await tab.scrollIntoViewIfNeeded();
        await tab.click();
        await expect(tab).toHaveAttribute('aria-selected', 'true');
        const panel = contributionPanel(page, project.id);
        await expect(panel).toHaveAttribute('data-contribution', contribution.id);
        for (const sentence of contribution.body) await expect(panel, `${project.id} ${contribution.id}`).toContainText(sentence);
      }
    }
  });

  test('both hackathon wins are encountered in order by scrolling, before any other role', async ({ page }) => {
    const positions = await page.evaluate(() => {
      const top = (selector: string) => {
        const el = document.querySelector(selector);
        return el ? el.getBoundingClientRect().top + window.scrollY : Number.NaN;
      };
      return {
        index: top('[data-testid="hackathons-index"]'),
        animalabs: top('[data-testid="award-animalabs"]'),
        opencraft: top('[data-testid="award-opencraft"]'),
        judi: top('[data-testid="project-judi"]'),
      };
    });
    expect(positions.index).toBeLessThan(positions.animalabs);
    expect(positions.animalabs).toBeLessThan(positions.opencraft);
    expect(positions.opencraft).toBeLessThan(positions.judi);

    const index = page.locator('[data-testid="hackathons-index"]');
    for (const project of hackathonProjects) {
      await expect(index).toContainText(project.name);
      await expect(index).toContainText(project.award?.event ?? '');
      for (const { title } of project.award?.titles ?? []) await expect(index).toContainText(title);
    }

    // Scroll the way a reader would and confirm each award block passes through the viewport.
    const seen = await page.evaluate(async () => {
      const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
      const targets = ['award-animalabs', 'award-opencraft'];
      const seenIds: string[] = [];
      const step = Math.max(200, Math.floor(window.innerHeight * 0.6));
      for (let i = 0; i < 80; i += 1) {
        for (const id of targets) {
          const r = document.querySelector(`[data-testid="${id}"]`)?.getBoundingClientRect();
          if (r && r.top >= 0 && r.bottom <= window.innerHeight && !seenIds.includes(id)) seenIds.push(id);
        }
        if (seenIds.length === targets.length) break;
        window.scrollBy({ top: step, behavior: 'instant' });
        await sleep(40);
      }
      return seenIds;
    });
    expect(seen).toEqual(['award-animalabs', 'award-opencraft']);
  });

  test('the hackathon media arrives inside the chapter viewport and the first role arrives with Experience', async ({ page }, testInfo) => {
    const vh = page.viewportSize()?.height ?? 0;
    const clearance = await page.evaluate(() => Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-clearance')));
    // Land the chapter under the header the way the navigation does, let the arrivals settle, then measure what the reader sees.
    await page.locator('#hackathons').evaluate((el) => el.scrollIntoView({ block: 'start', behavior: 'instant' }));
    await waitForScrollIdle(page, 200);
    await page.waitForTimeout(200);
    const media = await requireBox(article(page, 'animalabs').locator('img').first());
    if (testInfo.project.name === 'desktop') {
      expect(media.y, 'the real AnimaLabs media starts inside the first Hackathons viewport').toBeLessThan(vh * 0.6);
      expect(media.y + media.height, 'and at least half of it shows there').toBeGreaterThan(vh);
    }
    await page.locator('#experience').evaluate((el) => el.scrollIntoView({ block: 'start', behavior: 'instant' }));
    await waitForScrollIdle(page, 200);
    await page.waitForTimeout(250);
    const heading = await requireBox(page.locator('h2#experience-heading'));
    const judi = article(page, 'judi');
    const judiBox = await requireBox(judi);
    const lead = await requireBox(judi.locator('.project__lead'));
    expect(heading.y, 'the chapter heading is placed under the header').toBeGreaterThanOrEqual(clearance - 2);
    expect(judiBox.y - (heading.y + heading.height), 'no blank band between EXPERIENCE and the first role').toBeLessThanOrEqual(120);
    expect(lead.y, 'the Firecracker lead is inside the first Experience viewport').toBeLessThan(vh * 0.75);
    if (testInfo.project.name === 'mobile') {
      const title = await requireBox(judi.locator('h3.project__title'));
      expect(lead.y - title.y, 'on phones the lead follows the employer name directly').toBeLessThanOrEqual(120);
      const facts = await requireBox(judi.locator('dl.experience__facts'));
      expect(facts.y, 'the condensed facts sit right after the lead').toBeGreaterThan(lead.y);
      expect(facts.y - (lead.y + lead.height)).toBeLessThanOrEqual(40);
      expect(facts.height, 'the facts read as a compact block, not a ledger').toBeLessThanOrEqual(120);
    }
  });

  test('arrivals and takeovers are scroll-linked, settle in reading position, and reverse on the way back up', async ({ page }) => {
    const spread = article(page, 'opencraft');
    const head = spread.locator('.spread__head');
    const readSpread = () =>
      spread.evaluate((el) => ({
        state: el.dataset.revealState,
        reveal: Number(el.style.getPropertyValue('--reveal')),
        transform: getComputedStyle(el.querySelector('.spread__head')!).transform,
        opacity: Number(getComputedStyle(el.querySelector('.spread__head')!).opacity),
        clip: getComputedStyle(el.querySelector('.spread__media')!).clipPath,
      }));
    const placeTop = async (selector: string, fraction: number) => {
      await page.evaluate(
        ({ selector, fraction }) => {
          const top = document.querySelector(selector)!.getBoundingClientRect().top + window.scrollY;
          window.scrollTo({ top: top - window.innerHeight * fraction, behavior: 'instant' });
        },
        { selector, fraction },
      );
      await page.waitForTimeout(120);
    };

    // Far below the viewport: pending, moved aside, and transparent, but fully in the document.
    let state = await readSpread();
    expect(state.state).toBe('pending');
    expect(state.reveal).toBe(0);
    expect(state.opacity).toBe(0);
    expect(state.clip).not.toBe('none');
    await expect(head).toHaveCount(1);

    // Top edge at 85% of the viewport: arriving, part way through its travel.
    await placeTop('#project-opencraft', 0.85);
    state = await readSpread();
    expect(state.state).toBe('arriving');
    expect(state.reveal).toBeGreaterThan(0);
    expect(state.reveal).toBeLessThan(1);
    expect(state.opacity).toBeGreaterThan(0);
    expect(state.opacity).toBeLessThan(1);
    expect(state.transform).not.toMatch(/^(none|matrix\(1, 0, 0, 1, 0, 0\))$/);
    const midway = state.reveal;

    // In the reading zone: settled, no transform, no clip, full opacity.
    await placeTop('#project-opencraft', 0.15);
    state = await readSpread();
    expect(state.state).toBe('settled');
    expect(state.reveal).toBe(1);
    expect(state.opacity).toBe(1);
    expect(state.transform).toMatch(/^(none|matrix\(1, 0, 0, 1, 0, 0\))$/);
    expect(state.clip).toMatch(/^(none|inset\(0(px|%)? 0(px|%)? 0(px|%)? 0(px|%)?\))$/);
    await expect(head.locator('h3')).toBeVisible();

    // Back up to the same position: the same intermediate value, so the motion is reversible.
    await placeTop('#project-opencraft', 0.85);
    state = await readSpread();
    expect(state.state).toBe('arriving');
    expect(state.reveal).toBeCloseTo(midway, 2);

    // The Experience takeover: its surface rising writes --takeover on itself and --covered on the chapter
    // beneath; only the OpenCraft media plane recedes, and every word of the outgoing spread stays opaque.
    await placeTop('#experience', 0.65);
    const takeover = await page.evaluate(() => {
      const opaque = (selector: string) => Number(getComputedStyle(document.querySelector(selector)!).opacity);
      return {
        takeover: Number(document.getElementById('experience')!.style.getPropertyValue('--takeover')),
        covered: Number(document.getElementById('hackathons')!.style.getPropertyValue('--covered')),
        title: getComputedStyle(document.getElementById('experience-heading')!).transform,
        recedes: getComputedStyle(document.querySelector('#project-opencraft .recedes')!).transform,
        recedesIsMedia: document.querySelector('#project-opencraft .recedes')!.classList.contains('spread__media'),
        mediaOpacity: opaque('#project-opencraft .recedes'),
        textOpacity: [
          opaque('#project-opencraft [role="tabpanel"]'),
          opaque('#project-opencraft [data-testid="flow-opencraft"]'),
          opaque('#project-opencraft .spread__proof'),
          opaque('#project-opencraft .spread__head'),
        ],
      };
    });
    expect(takeover.takeover).toBeGreaterThan(0);
    expect(takeover.takeover).toBeLessThan(1);
    expect(takeover.covered).toBeCloseTo(takeover.takeover, 3);
    expect(takeover.title).not.toMatch(/^(none|matrix\(1, 0, 0, 1, 0, 0\))$/);
    expect(takeover.recedesIsMedia).toBe(true);
    expect(takeover.recedes).not.toMatch(/^(none|matrix\(1, 0, 0, 1, 0, 0\))$/);
    expect(takeover.mediaOpacity).toBe(1);
    expect(takeover.textOpacity).toEqual([1, 1, 1, 1]);
    await placeTop('#experience', 0.05);
    const settled = await page.evaluate(() => ({
      takeover: Number(document.getElementById('experience')!.style.getPropertyValue('--takeover')),
      title: getComputedStyle(document.getElementById('experience-heading')!).transform,
      lead: getComputedStyle(document.querySelector('[data-testid="project-judi"] .project__lead')!).transform,
    }));
    expect(settled.takeover).toBe(1);
    expect(settled.title).toMatch(/^(none|matrix\(1, 0, 0, 1, 0, 0\))$/);
    expect(settled.lead).toMatch(/^(none|matrix\(1, 0, 0, 1, 0, 0\))$/);
    for (const id of ['ventures', 'about']) {
      await expect(page.locator(`#${id}`)).toHaveAttribute('data-takeover', '');
    }
  });

  test('desktop: the OpenCraft media holds while the light Experience surface advances over it', async ({ page }, testInfo) => {
    skipUnlessProject(testInfo, 'desktop');
    const clearance = await page.evaluate(() => Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-clearance')));
    const media = article(page, 'opencraft').locator('figure.spread__media');
    expect(await media.evaluate((el) => getComputedStyle(el).position)).toBe('sticky');
    // Read down the right column: the media stays at the top of the viewport while the text scrolls.
    await page.locator('#project-opencraft .spread__proof').evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await page.waitForTimeout(150);
    let box = await requireBox(media);
    // Held at the header line; the recede may already have lifted it by up to 4vh.
    const held = clearance + 16;
    expect(box.y, 'the media is held under the header').toBeLessThanOrEqual(held + 1);
    expect(box.y, 'the media is held under the header').toBeGreaterThanOrEqual(held - 40);
    // The cover: Experience's surface rises over the held media before the media is pushed away.
    await page.evaluate(() => {
      const top = document.getElementById('experience')!.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({ top: top - window.innerHeight * 0.55, behavior: 'instant' });
    });
    await page.waitForTimeout(150);
    box = await requireBox(media);
    const experience = await requireBox(chapter(page, 'experience'));
    expect(experience.y, 'the paper edge has risen above the bottom of the held media').toBeLessThan(box.y + box.height);
    expect(experience.y, 'and the media is still visible above it').toBeGreaterThan(box.y + 40);
    expect(box.y, 'the media is still held, not pushed').toBeLessThanOrEqual(held + 1);
    expect(box.y, 'the media is still held, not pushed').toBeGreaterThanOrEqual(held - 40);
    const text = await page.evaluate(() =>
      ['[role="tabpanel"]', '[data-testid="flow-opencraft"]', '.spread__proof'].map((s) => Number(getComputedStyle(document.querySelector(`#project-opencraft ${s}`)!).opacity)),
    );
    expect(text).toEqual([1, 1, 1]);
    // Under reduced motion the same reader meets plain document order: no hold, no overlap.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForTimeout(100);
    expect(await media.evaluate((el) => getComputedStyle(el).position)).not.toBe('sticky');
    const stacked = await page.evaluate(() => {
      const hack = document.getElementById('hackathons')!.getBoundingClientRect();
      const exp = document.getElementById('experience')!.getBoundingClientRect();
      return exp.top - hack.bottom;
    });
    expect(Math.round(stacked)).toBe(0);
  });

  test('the AnimaLabs controls change the explanation and highlight the matching steps', async ({ page }) => {
    const project = projectById.animalabs;
    const panel = contributionPanel(page, project.id);
    await contributionTab(page, project.id, 'research').scrollIntoViewIfNeeded();
    await expect(contributionTab(page, project.id, 'research')).toHaveAttribute('aria-selected', 'true');
    await expect(panel).toContainText('Europe PMC');
    await expect(flowStep(page, project.id, 'search')).toHaveAttribute('data-active', 'true');
    await expect(flowStep(page, project.id, 'compare')).toHaveAttribute('data-active', 'false');

    const before = await panel.innerText();
    await contributionTab(page, project.id, 'analyst').click();
    await expect(panel).toHaveAttribute('data-contribution', 'analyst');
    expect(await panel.innerText()).not.toBe(before);
    await expect(panel).toContainText('compares them with published studies');
    await expect(flowStep(page, project.id, 'simulate')).toHaveAttribute('data-active', 'true');
    await expect(flowStep(page, project.id, 'compare')).toHaveAttribute('data-active', 'true');
    await expect(flowStep(page, project.id, 'search')).toHaveAttribute('data-active', 'false');
    await expect(flowStep(page, project.id, 'compare')).toHaveAttribute('aria-current', 'step');

    // Keyboard: the arrow keys move the selection and the focus; Home returns.
    await contributionTab(page, project.id, 'analyst').focus();
    await page.keyboard.press('ArrowRight');
    await expect(contributionTab(page, project.id, 'reports')).toBeFocused();
    await expect(panel).toHaveAttribute('data-contribution', 'reports');
    await expect(panel).toContainText('23 charts');
    await expect(flowStep(page, project.id, 'report')).toHaveAttribute('data-active', 'true');
    await page.keyboard.press('Home');
    await expect(contributionTab(page, project.id, 'research')).toBeFocused();
    await expect(panel).toHaveAttribute('data-contribution', 'research');

    // Inactive steps stay readable with a single dim, not alpha on top of opacity; the selected step is told by rule and weight.
    await contributionTab(page, project.id, 'analyst').click();
    // The step colours transition over 200ms; sample once they have settled.
    await page.waitForTimeout(350);
    const steps = await page.evaluate((id) => {
      const read = (step: string) => {
        const el = document.querySelector<HTMLElement>(`[data-testid="flow-step-${id}-${step}"]`)!;
        const label = el.querySelector<HTMLElement>('.flow__step-label')!;
        const alpha = (color: string) => {
          const match = color.match(/rgba?\(\d+,\s*\d+,\s*\d+(?:,\s*([\d.]+))?\)/);
          return match ? (match[1] === undefined ? 1 : Number(match[1])) : Number.NaN;
        };
        return {
          opacity: Number(getComputedStyle(el).opacity),
          labelAlpha: alpha(getComputedStyle(label).color),
          weight: Number(getComputedStyle(label).fontWeight),
          rule: getComputedStyle(el).borderTopWidth,
        };
      };
      return { inactive: read('search'), active: read('compare') };
    }, project.id);
    expect(steps.inactive.opacity).toBe(1);
    expect(steps.active.opacity).toBe(1);
    expect(steps.inactive.labelAlpha).toBeGreaterThanOrEqual(0.8);
    expect(steps.active.labelAlpha).toBe(1);
    expect(steps.active.weight).toBeGreaterThan(steps.inactive.weight);
    expect(Number.parseFloat(steps.active.rule)).toBeGreaterThan(Number.parseFloat(steps.inactive.rule));

    // The award, summary, and proof never move behind the controls.
    const node = article(page, project.id);
    for (const { title } of project.award?.titles ?? []) await expect(node.getByText(title)).toBeVisible();
    await expect(node.getByText(project.summary)).toBeVisible();
    await expect(node.locator(`a[href="${project.award?.proof.href}"]`).first()).toBeVisible();
  });

  test('the OpenCraft controls explain the backend and highlight the schematic', async ({ page }) => {
    const project = projectById.opencraft;
    const panel = contributionPanel(page, project.id);
    await contributionTab(page, project.id, 'memory').scrollIntoViewIfNeeded();
    await contributionTab(page, project.id, 'memory').click();
    await expect(panel).toContainText('pgvector');
    await expect(flowStep(page, project.id, 'pgvector')).toHaveAttribute('data-active', 'true');
    await expect(flowStep(page, project.id, 'realtime')).toHaveAttribute('data-active', 'false');
    await contributionTab(page, project.id, 'testing').click();
    await expect(panel).toContainText('job contention, memory writes, and chat-based task handoff');
    await expect(flowStep(page, project.id, 'harness')).toHaveAttribute('data-active', 'true');
    await expect(flowStep(page, project.id, 'pgvector')).toHaveAttribute('data-active', 'false');
    const node = article(page, project.id);
    await expect(node.locator('a[href="https://github.com/MarcDasilva/OpenCraft"]').first()).toBeVisible();
    await expect(node.locator('a[href="https://devpost.com/software/opencraft"]').first()).toBeVisible();
  });

  test('Watch demo opens the real video in a new tab without loading it inline', async ({ page }) => {
    await expect(page.locator('iframe')).toHaveCount(0);
    await expect(page.locator('video')).toHaveCount(0);
    await page.context().route('https://www.youtube.com/**', (route) =>
      route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>intercepted</title>' }),
    );
    const link = article(page, 'animalabs').locator('a[href="https://www.youtube.com/watch?v=UBaKKoPopSg"]').first();
    await link.scrollIntoViewIfNeeded();
    await expect(link).toHaveText('Watch demo');
    await expect(link).toHaveAttribute('target', '_blank');
    const [popup] = await Promise.all([page.waitForEvent('popup'), link.click()]);
    await popup.waitForLoadState();
    expect(popup.url()).toBe('https://www.youtube.com/watch?v=UBaKKoPopSg');
    await popup.close();
    await expect(page.locator('iframe')).toHaveCount(0);
  });

  test('external links open in a new tab with rel=noreferrer', async ({ page }) => {
    const external = page.locator('main a[href^="http"]');
    const offenders = await external.evaluateAll((nodes) =>
      nodes
        .filter((node) => node.getAttribute('target') !== '_blank' || !(node.getAttribute('rel') ?? '').split(/\s+/).includes('noreferrer'))
        .map((node) => `${node.getAttribute('href')} target=${node.getAttribute('target')} rel=${node.getAttribute('rel')}`),
    );
    expect(offenders).toEqual([]);
  });

  test('experience carries both roles with their leads, scope, and diagrams on the light surface', async ({ page }) => {
    const section = chapter(page, 'experience');
    for (const entry of experience.filter((item) => item.project === 'judi' || item.project === 'rtx')) {
      for (const text of [entry.organisation, entry.role, entry.dates, entry.location]) {
        await expect(section, `experience entry ${entry.organisation}: "${text}"`).toContainText(text);
      }
    }
    const judi = article(page, 'judi');
    await expect(judi).toContainText('Firecracker execution platform');
    await expect(judi.locator('[data-testid="schematic-judi"]')).toBeVisible();
    for (const step of projectById.judi.flow?.steps ?? []) await expect(judi).toContainText(step.label);
    await expect(judi.locator('[data-testid="contribution-judi-claims"]')).toContainText('5M+ contracted lives');
    await expect(judi.locator('[data-testid="schematic-judi"]')).not.toContainText('5M+');

    const rtx = article(page, 'rtx');
    await expect(rtx).toContainText('Aircraft trajectory research');
    await expect(rtx).toContainText('Mentored by Raytheon engineers');
    const diagram = rtx.locator('[data-testid="diagram-rtx"]');
    await expect(diagram).toBeVisible();
    for (const step of projectById.rtx.flow?.steps ?? []) await expect(rtx).toContainText(step.label);

    const ink = await section.evaluate((el) => {
      const lead = el.querySelector('.project__lead') ?? el.querySelector('h3');
      return { surface: getComputedStyle(el).backgroundColor, text: lead ? getComputedStyle(lead).color : 'none' };
    });
    expect(contrastRatio(ink.text, ink.surface), `${ink.text} on ${ink.surface}`).toBeGreaterThanOrEqual(7);
  });

  test('ventures tells Diffex typographically and UPlate through its real screenshots', async ({ page }) => {
    const diffex = article(page, 'diffex');
    await expect(diffex).toContainText('$50,000 in compute awarded through the Daytona Grid Startup Initiative');
    await expect(diffex).toContainText('20% on SWE-bench Lite after one evolution cycle');
    await expect(diffex.locator('[data-testid="flow-diffex"]')).toBeVisible();
    await expect(diffex.locator('img')).toHaveCount(0);

    const uplate = article(page, 'uplate');
    const gallery = uplate.locator('[data-testid="gallery-uplate"]');
    await gallery.scrollIntoViewIfNeeded();
    const counter = uplate.locator('[data-testid="gallery-uplate-counter"]');
    const next = uplate.locator('button[data-testid="gallery-uplate-next"]');
    const prev = uplate.locator('button[data-testid="gallery-uplate-prev"]');
    const evidence = projectById.uplate.evidence;
    await expect(counter).toHaveText('1 / 3');
    await expect(gallery.locator('img:visible')).toHaveCount(1);
    await expect(gallery.locator('img:visible')).toHaveAttribute('alt', evidence[0].alt);
    await expect(gallery).toContainText(evidence[0].caption);
    await next.click();
    await expect(counter).toHaveText('2 / 3');
    await expect(gallery.locator('img:visible')).toHaveAttribute('alt', evidence[1].alt);
    await expect(gallery).toContainText(evidence[1].caption);
    await next.click();
    await expect(counter).toHaveText('3 / 3');
    await expect(gallery.locator('img:visible')).toHaveAttribute('alt', evidence[2].alt);
    await next.click();
    await expect(counter).toHaveText('1 / 3');
    await prev.click();
    await expect(counter).toHaveText('3 / 3');
    await expect(gallery.locator('img:visible')).toHaveAttribute('alt', evidence[2].alt);
    await expect(prev).toHaveAccessibleName(/previous/i);
    await expect(next).toHaveAccessibleName(/next/i);
    const shown = gallery.locator('img:visible');
    await expect.poll(() => shown.evaluate((img) => (img as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  });

  test('the header marks the current chapter and takes its surface', async ({ page }) => {
    const header = page.locator('header[data-testid="site-header"]');
    const current = () => header.locator('a[aria-current="true"]');
    for (const id of ['hackathons', 'experience', 'ventures', 'about', 'contact']) {
      await page.locator(`#${id}`).evaluate((el) => el.scrollIntoView({ block: 'start', behavior: 'instant' }));
      await waitForScrollIdle(page, 200);
      // The last destination may not reach the header line when the page cannot scroll further.
      const atBottom = await page.evaluate(() => Math.ceil(window.scrollY + window.innerHeight) >= document.documentElement.scrollHeight - 1);
      const accepted = id === 'contact' && atBottom ? /^#(about|contact)$/ : new RegExp(`^#${id}$`);
      await expect(current(), `current link at #${id}`).toHaveAttribute('href', accepted);
      // The header colour transitions over 320ms; sample once it has settled.
      await page.waitForTimeout(450);
      const sample = await page.evaluate(() => {
        const head = document.querySelector('header[data-testid="site-header"]') as HTMLElement;
        const link = head.querySelector('a[aria-current="true"]') as HTMLElement;
        return { background: getComputedStyle(head).backgroundColor, link: getComputedStyle(link).color, zone: document.documentElement.dataset.zone };
      });
      expect(contrastRatio(sample.link, sample.background), `${id}: ${sample.link} on ${sample.background}`).toBeGreaterThanOrEqual(4.5);
      if (id === 'experience') {
        expect(sample.zone).toBe('experience');
        expectNear(sample.background, [236, 235, 230]);
      }
      if (id === 'hackathons') expectNear(sample.background, [58, 44, 72]);
    }
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await waitForScrollIdle(page, 200);
    await expect(current()).toHaveCount(0);
  });

  test('clicking the header links lands each heading below the fixed header', async ({ page }) => {
    for (const target of CHAPTER_IDS) {
      // Chrome can drop a fragment navigation issued while the previous smooth scroll is still animating.
      await waitForScrollIdle(page);
      await page.locator(`header[data-testid="site-header"] a[href="#${target}"]`).click();
      await expectAnchorPlaced(page, target);
    }
  });

  test('activating a header link from the keyboard lands the heading below the header', async ({ page }) => {
    await page.locator('header[data-testid="site-header"] a[href="#ventures"]').focus();
    await page.keyboard.press('Enter');
    await expectAnchorPlaced(page, 'ventures');
  });

  test('about lists education and every skill, and contact carries the three links', async ({ page }) => {
    const about = chapter(page, 'about');
    for (const text of [education.school, education.degree, education.location, ...education.coursework]) {
      await expect(about, `education "${text}"`).toContainText(text);
    }
    for (const group of skills) {
      await expect(about, `skill group "${group.label}"`).toContainText(group.label);
      for (const item of group.items) await expect(about, `skill "${item}"`).toContainText(item);
    }
    const contact = chapter(page, 'contact');
    expect(identity.contact).toHaveLength(3);
    for (const link of identity.contact) {
      await expectAtLeastOne(contact.locator(`a[href="${link.href}"]`), `contact link ${link.href}`);
    }
    await expect(contact).toContainText('tseng94@purdue.edu');
    expect(nav.map((item) => item.href)).toContain('#contact');
  });

  test('reduced motion keeps the chapters, drops the handoff transforms, and switches controls at once', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.reload();
    await gotoAndSettle(page, '/?intro=skip');
    const height = await page.evaluate(() => document.getElementById('opening')?.offsetHeight ?? 0);
    await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), Math.round(height * 0.5));
    await page.waitForTimeout(200);
    const transform = await page.locator('h1#name').evaluate((el) => getComputedStyle(el).transform);
    expect(transform, 'the name must not be scaled by scroll under reduced motion').toBe('none');
    expect(await page.evaluate(() => document.documentElement.style.getPropertyValue('--fold'))).toBe('0.0000');
    expect(await page.locator('section#opening').evaluate((el) => getComputedStyle(el).position)).not.toBe('sticky');
    for (const id of CHAPTER_IDS) await expect(page.locator(`#${id}`)).toHaveCount(1);
    // Nothing arrives or recedes: every chapter shows complete and in place at once.
    const moved = await page.evaluate(() =>
      Array.from(document.querySelectorAll<HTMLElement>('[data-reveal], [data-takeover], .spread__head, .recedes, .plane, .arrive'))
        .filter((el) => el.style.getPropertyValue('--reveal') || el.style.getPropertyValue('--takeover') || el.dataset.revealState || getComputedStyle(el).opacity !== '1')
        .map((el) => el.className.toString()),
    );
    expect(moved).toEqual([]);
    const tab = contributionTab(page, 'opencraft', 'testing');
    await tab.scrollIntoViewIfNeeded();
    await tab.click();
    await expect(contributionPanel(page, 'opencraft')).toHaveAttribute('data-contribution', 'testing');
  });

  test('copy carries no stale dates, phone numbers, em dashes, or inflated claims', async ({ page }) => {
    const innerText = await page.evaluate(() => document.body.innerText);
    const textContent = await page.evaluate(() => document.body.textContent ?? '');
    for (const [label, pattern] of Object.entries(FORBIDDEN_TEXT)) {
      expect(innerText, `visible text matches ${label} ${pattern}`).not.toMatch(pattern);
      expect(textContent, `document text matches ${label} ${pattern}`).not.toMatch(pattern);
    }
    expect(textContent).not.toMatch(/abstract study|\breplay\b|\bphase\b/i);

    // Hashed asset URLs and SVG geometry are not copy; strip them before scanning the markup.
    const html = (await page.content())
      .replace(/<svg[\s\S]*?<\/svg>/g, '')
      .replace(/\/assets\/[^"' >]+/g, '');
    expect(html, 'HTML source contains a phone number').not.toMatch(FORBIDDEN_TEXT.phone);
    expect(html, 'HTML source contains "expected"').not.toMatch(/\bexpected\b/i);
    expect(html, 'HTML source contains an em dash').not.toMatch(FORBIDDEN_TEXT.emDash);
  });

  test('a full scroll keeps every control and line inside the viewport width', async ({ page }) => {
    await scrollThroughPage(page, 60);
    const width = page.viewportSize()?.width ?? 0;
    const overflow = await page.evaluate((limit) => {
      const out: string[] = [];
      for (const el of Array.from(document.querySelectorAll<HTMLElement>('main h2, main h3, main p, main button, main a, main li, main img, main svg'))) {
        const r = el.getBoundingClientRect();
        if (r.width === 0) continue;
        if (r.right > limit + 1 || r.left < -1) out.push(`${el.tagName.toLowerCase()} "${(el.textContent ?? '').trim().slice(0, 30)}" ${Math.round(r.left)}..${Math.round(r.right)}`);
      }
      return out;
    }, width);
    expect(overflow).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    const box = await requireBox(chapter(page, 'contact'));
    expect(box.width).toBeLessThanOrEqual(width);
  });
});

/**
 * Cold fragment navigation: every test runs in a fresh browser context, so
 * these are real first visits to a chapter link. The browser's own fragment
 * scroll runs before React renders the target, so the page must settle the
 * fragment itself once the content and fonts exist.
 */
test.describe('cold chapter links', () => {
  test.beforeEach(({ page }, testInfo) => {
    void page;
    skipUnlessProject(testInfo, 'desktop', 'mobile');
  });

  for (const target of CHAPTER_IDS) {
    test(`a fresh visit to /?webgl=off#${target} lands on the heading`, async ({ page }) => {
      await gotoAndSettle(page, `/?webgl=off#${target}`);
      await page.waitForLoadState('networkidle');
      await waitForRenderState(page, ['fallback']);
      await expectAnchorPlaced(page, target);
      expect(await page.evaluate(() => window.scrollY), 'the page should have scrolled').toBeGreaterThan(0);
    });
  }

  test('a fresh visit to /#hackathons with the scene lands on the heading and keeps both wins readable', async ({ page }) => {
    await gotoAndSettle(page, '/#hackathons');
    await expectAnchorPlaced(page, 'hackathons');
    await expect(page.locator('[data-testid="hackathons-index"]')).toBeVisible();
    for (const project of ['animalabs', 'opencraft']) {
      await expect(article(page, project)).toBeVisible();
    }
  });

  test('a fresh visit under reduced motion lands on the heading without smooth scrolling', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await gotoAndSettle(page, '/#experience');
    await expectAnchorPlaced(page, 'experience');
  });

  test('back from a chapter link returns to the top, and forward lands on the chapter again', async ({ page }) => {
    await gotoAndSettle(page, '/?intro=skip');
    await page.locator('header a[href="#about"]').first().click();
    await expectAnchorPlaced(page, 'about');
    await waitForScrollIdle(page);
    await page.goBack();
    await expect.poll(() => page.evaluate(() => window.scrollY), { timeout: 8_000 }).toBeLessThan(10);
    await waitForScrollIdle(page);
    await page.goForward();
    await expectAnchorPlaced(page, 'about');
  });
});
