/// <reference lib="dom" />
import { test, expect, type Page } from '@playwright/test';
import { projects, projectById, experience, education, skills, identity } from '../src/content/site';
import type { Project } from '../src/content/types';
import {
  FORBIDDEN_TEXT,
  article,
  detailsButton,
  detailsDialog,
  expectAtLeastOne,
  gotoAndSettle,
  requireBox,
  skipUnlessProject,
} from './helpers';

async function expectDialogFor(page: Page, project: Project) {
  const dialog = detailsDialog(page);
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute('data-project', project.id);
  await expectAtLeastOne(dialog.locator('h2', { hasText: project.name }), `${project.id} dialog h2 with the name`);
  await expect(dialog).toContainText(project.role);
  for (const sentence of project.details) {
    await expect(dialog).toContainText(sentence);
  }
  for (const evidence of project.evidence) {
    await expectAtLeastOne(dialog.getByAltText(evidence.alt, { exact: true }), `${project.id} evidence alt "${evidence.alt}"`);
  }
  for (const link of project.links) {
    await expectAtLeastOne(dialog.locator(`a[href="${link.href}"]`), `${project.id} dialog link ${link.href}`);
  }
  return dialog;
}

async function openDetails(page: Page, project: Project) {
  const opener = detailsButton(page, project.id);
  await opener.scrollIntoViewIfNeeded();
  await expect(opener).toHaveText('Details');
  await opener.click();
  return expectDialogFor(page, project);
}

test.describe('work sequence', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    skipUnlessProject(testInfo, 'desktop', 'mobile');
    await gotoAndSettle(page, '/?intro=skip');
  });

  test('all six projects are rendered in order with their facts and links', async ({ page }) => {
    const articles = page.locator('article[data-testid^="project-"]');
    await expect(articles).toHaveCount(projects.length);
    const ids = await articles.evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-testid')));
    expect(ids).toEqual(projects.map((project) => `project-${project.id}`));

    await expect(page.locator('section#work[aria-labelledby="work-heading"] h2#work-heading')).toHaveText('Work');
    await expect(page.locator('section#hackathons[aria-labelledby="hackathons-heading"] h3#hackathons-heading')).toHaveText('Hackathons');
    await expect(page.locator('section#projects[aria-labelledby="projects-heading"]')).toHaveCount(1);

    for (const project of projects) {
      const row = article(page, project.id);
      await expect(row.locator('h4')).toContainText(project.name);
      await expect(row).toContainText(project.summary);
      for (const figure of project.figures) {
        await expect(row, `${project.id} figure "${figure}"`).toContainText(figure);
      }
      for (const link of project.links) {
        await expectAtLeastOne(row.locator(`a[href="${link.href}"]`), `${project.id} link ${link.href}`);
      }
    }
    await expect(article(page, 'animalabs').locator('a[href*="github.com"]')).toHaveCount(0);
  });

  test('external links open in a new tab with rel=noreferrer', async ({ page }) => {
    const external = page.locator('main a[href^="http"], section a[href^="http"]');
    const offenders = await external.evaluateAll((nodes) =>
      nodes
        .filter((node) => node.getAttribute('target') !== '_blank' || !(node.getAttribute('rel') ?? '').split(/\s+/).includes('noreferrer'))
        .map((node) => `${node.getAttribute('href')} target=${node.getAttribute('target')} rel=${node.getAttribute('rel')}`),
    );
    expect(offenders).toEqual([]);
  });

  test('details open for every project and Escape returns focus to the opener', async ({ page }) => {
    for (const project of projects) {
      const dialog = await openDetails(page, project);
      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden();
      await expect(detailsButton(page, project.id), `${project.id} opener should regain focus`).toBeFocused();
    }
  });

  test('the Close button closes the details', async ({ page }) => {
    const project = projectById.opencraft;
    const dialog = await openDetails(page, project);
    await dialog.locator('button[data-testid="details-close"]').click();
    await expect(dialog).toBeHidden();
    await expect(detailsButton(page, project.id)).toBeFocused();
  });

  test('a backdrop click closes the details', async ({ page }) => {
    const project = projectById.diffex;
    const dialog = await openDetails(page, project);
    const box = await requireBox(dialog);
    const viewport = page.viewportSize() ?? { width: 0, height: 0 };
    const roomAbove = box.y >= 8;
    const roomLeft = box.x >= 8;
    const roomBelow = viewport.height - (box.y + box.height) >= 8;
    test.skip(!roomAbove && !roomLeft && !roomBelow, 'the dialog fills the viewport, so there is no backdrop to click');

    const point = roomAbove
      ? { x: Math.round(viewport.width / 2), y: Math.round(box.y / 2) }
      : roomLeft
        ? { x: Math.round(box.x / 2), y: Math.round(viewport.height / 2) }
        : { x: Math.round(viewport.width / 2), y: Math.round(box.y + box.height + (viewport.height - box.y - box.height) / 2) };
    await page.mouse.click(point.x, point.y);
    await expect(dialog).toBeHidden();
  });
});

test.describe('record', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    skipUnlessProject(testInfo, 'desktop', 'mobile');
    await gotoAndSettle(page, '/?intro=skip');
  });

  test('experience lists every entry and Judi expands into its project', async ({ page }) => {
    const section = page.locator('section#experience[aria-labelledby="experience-heading"]');
    await expect(section).toHaveCount(1);
    expect(experience).toHaveLength(4);
    for (const entry of experience) {
      for (const text of [entry.organisation, entry.role, entry.dates, entry.location]) {
        await expect(section, `experience entry ${entry.organisation}: "${text}"`).toContainText(text);
      }
    }
    const opener = page.locator('button[data-testid="experience-details-judi"]');
    await opener.scrollIntoViewIfNeeded();
    await opener.click();
    await expectDialogFor(page, projectById.judi);
  });

  test('about lists education and every skill', async ({ page }) => {
    const section = page.locator('section#about[aria-labelledby="about-heading"]');
    await expect(section).toHaveCount(1);
    for (const text of [education.school, education.degree, education.location, ...education.coursework]) {
      await expect(section, `education "${text}"`).toContainText(text);
    }
    expect(skills.length).toBeGreaterThan(0);
    for (const group of skills) {
      await expect(section, `skill group "${group.label}"`).toContainText(group.label);
      for (const item of group.items) {
        await expect(section, `skill "${item}"`).toContainText(item);
      }
    }
  });

  test('contact carries the three contact links', async ({ page }) => {
    const section = page.locator('section#contact[aria-labelledby="contact-heading"]');
    await expect(section).toHaveCount(1);
    expect(identity.contact).toHaveLength(3);
    for (const link of identity.contact) {
      await expectAtLeastOne(section.locator(`a[href="${link.href}"]`), `contact link ${link.href}`);
    }
  });

  test('copy carries no stale dates, phone numbers, em dashes, or inflated claims', async ({ page }) => {
    const innerText = await page.evaluate(() => document.body.innerText);
    const textContent = await page.evaluate(() => document.body.textContent ?? '');
    for (const [label, pattern] of Object.entries(FORBIDDEN_TEXT)) {
      expect(innerText, `visible text matches ${label} ${pattern}`).not.toMatch(pattern);
      expect(textContent, `document text (including closed dialogs) matches ${label} ${pattern}`).not.toMatch(pattern);
    }

    // Hashed asset URLs and SVG geometry are not copy; strip them before scanning the markup.
    const html = (await page.content())
      .replace(/<svg[\s\S]*?<\/svg>/g, '')
      .replace(/\/assets\/[^"' >]+/g, '');
    expect(html, 'HTML source contains a phone number').not.toMatch(FORBIDDEN_TEXT.phone);
    expect(html, 'HTML source contains "expected"').not.toMatch(/\bexpected\b/i);
    expect(html, 'HTML source contains an em dash').not.toMatch(FORBIDDEN_TEXT.emDash);
  });
});
