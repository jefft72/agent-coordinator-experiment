/// <reference lib="dom" />
import { test, expect, type Page } from '@playwright/test';
import { projects, projectById, experience, education, skills, identity } from '../src/content/site';
import type { Project } from '../src/content/types';
import {
  FORBIDDEN_TEXT,
  article,
  detailsButton,
  detailsDialog,
  expectAnchorPlaced,
  expectAtLeastOne,
  gotoAndSettle,
  requireBox,
  skipUnlessProject,
  waitForRenderState,
  waitForScrollIdle,
} from './helpers';

/** WCAG contrast ratio between two CSS rgb()/rgba() colours; an alpha below 1 is treated as opaque for a conservative check. */
function contrastRatio(foreground: string, background: string): number {
  const channel = (value: number) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  const luminance = (color: string) => {
    const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (!match) throw new Error(`unparsable colour ${color}`);
    return 0.2126 * channel(Number(match[1])) + 0.7152 * channel(Number(match[2])) + 0.0722 * channel(Number(match[3]));
  };
  const a = luminance(foreground);
  const b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

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

  test('every row responds visibly on keyboard focus and settles on blur', async ({ page }) => {
    for (const project of projects) {
      const row = article(page, project.id);
      const rule = row.locator(`canvas[data-testid="blade-rule-${project.id}"]`);
      await expect(row).toHaveAttribute('data-active', 'false');
      await expect(rule).toHaveAttribute('data-state', 'rest');
      const rest = await rule.evaluate((el) => (el as HTMLCanvasElement).toDataURL());

      await detailsButton(page, project.id).focus();
      await expect(row).toHaveAttribute('data-active', 'true');
      await expect(rule).toHaveAttribute('data-state', 'active');
      await expect
        .poll(() => rule.evaluate((el) => (el as HTMLCanvasElement).toDataURL()), {
          message: `${project.id}: the blade rule should redraw while focused`,
        })
        .not.toBe(rest);

      await page.keyboard.press('Shift+Tab');
      await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
      await expect(row).toHaveAttribute('data-active', 'false');
      await expect(rule).toHaveAttribute('data-state', 'rest');
      await expect
        .poll(() => rule.evaluate((el) => (el as HTMLCanvasElement).toDataURL()), {
          message: `${project.id}: the blade rule should settle back to rest`,
          timeout: 5_000,
        })
        .toBe(rest);
    }
  });

  test('the row response is a still pattern under reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.reload();
    await gotoAndSettle(page, '/?intro=skip');
    const project = projectById.diffex;
    const rule = article(page, project.id).locator('canvas');
    const rest = await rule.evaluate((el) => (el as HTMLCanvasElement).toDataURL());
    await detailsButton(page, project.id).focus();
    await expect(rule).toHaveAttribute('data-state', 'active');
    await page.waitForTimeout(200);
    const first = await rule.evaluate((el) => (el as HTMLCanvasElement).toDataURL());
    expect(first).not.toBe(rest);
    await page.waitForTimeout(400);
    expect(await rule.evaluate((el) => (el as HTMLCanvasElement).toDataURL()), 'still under reduced motion').toBe(first);
  });

  test('the details dialog is a readable light surface in the top layer', async ({ page }) => {
    const project = projectById.animalabs;
    const dialog = await openDetails(page, project);
    const sample = await dialog.evaluate((el) => {
      const dialogStyle = getComputedStyle(el);
      const heading = el.querySelector('h2');
      const body = el.querySelector('.details__body p');
      const close = el.querySelector('[data-testid="details-close"]');
      const colorOf = (node: Element | null) => (node ? getComputedStyle(node).color : 'none');
      return {
        position: dialogStyle.position,
        background: dialogStyle.backgroundColor,
        heading: colorOf(heading),
        body: colorOf(body),
        close: colorOf(close),
        closeBox: close?.getBoundingClientRect().height ?? 0,
      };
    });
    expect(sample.position, 'a modal dialog keeps its native top-layer positioning').toBe('fixed');
    for (const [label, color] of [['heading', sample.heading], ['body', sample.body], ['close', sample.close]]) {
      expect(contrastRatio(color, sample.background), `${label} ${color} on ${sample.background} should reach 4.5:1`).toBeGreaterThanOrEqual(4.5);
    }
    expect(sample.closeBox, 'the Close control should have a rendered height').toBeGreaterThan(0);
    await expect(dialog.locator('h2')).toHaveText(project.name);
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(detailsButton(page, project.id)).toBeFocused();
  });

  test('a live reduced-motion change stops the row animation', async ({ page }, testInfo) => {
    skipUnlessProject(testInfo, 'desktop');
    const rule = article(page, 'animalabs').locator('canvas[data-testid="blade-rule-animalabs"]');
    await rule.scrollIntoViewIfNeeded();
    await article(page, 'animalabs').hover();
    await expect(rule).toHaveAttribute('data-state', 'active');
    await page.waitForTimeout(800);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForTimeout(300);
    const first = await rule.evaluate((el) => (el as HTMLCanvasElement).toDataURL());
    await page.waitForTimeout(600);
    const second = await rule.evaluate((el) => (el as HTMLCanvasElement).toDataURL());
    expect(second, 'the rule should hold still once the preference changes').toBe(first);
    await expect(rule).toHaveAttribute('data-state', 'active');
  });

  test('the Close control stays reachable at the bottom of a long details and hands focus back', async ({ page }) => {
    const project = projectById.animalabs;
    const dialog = await openDetails(page, project);
    const inner = dialog.locator('.details__inner');
    await inner.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
    await page.waitForTimeout(300);
    expect(await inner.evaluate((el) => el.scrollTop), 'the details should have scrolled').toBeGreaterThan(200);
    const close = dialog.locator('button[data-testid="details-close"]');
    const box = await requireBox(close);
    const viewport = page.viewportSize() ?? { width: 0, height: 0 };
    expect(box.y, 'Close should be within the viewport').toBeGreaterThanOrEqual(0);
    expect(box.y + box.height, 'Close should be within the viewport').toBeLessThanOrEqual(viewport.height);
    const covered = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.getAttribute('data-testid'), {
      x: box.x + box.width / 2,
      y: box.y + box.height / 2,
    });
    expect(covered, 'Close should be the topmost element at its centre').toBe('details-close');
    await close.click();
    await expect(dialog).toBeHidden();
    await expect(detailsButton(page, project.id)).toBeFocused();
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

  test('clicking the header links lands each heading below the fixed header', async ({ page }) => {
    for (const target of ['work', 'hackathons', 'about', 'contact']) {
      // Chrome can drop a fragment navigation issued while the previous smooth scroll is still animating.
      await waitForScrollIdle(page);
      await page.locator(`header[data-testid="site-header"] a[href="#${target}"]`).click();
      await expectAnchorPlaced(page, target);
    }
  });

  test('activating a header link from the keyboard lands the heading below the header', async ({ page }) => {
    await page.locator('header[data-testid="site-header"] a[href="#about"]').focus();
    await page.keyboard.press('Enter');
    await expectAnchorPlaced(page, 'about');
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

/**
 * Cold fragment navigation: every test runs in a fresh browser context, so
 * these are real first visits to a section link. The browser's own fragment
 * scroll runs before React renders the target, so the page must settle the
 * fragment itself once the content and fonts exist.
 */
test.describe('cold section links', () => {
  test.beforeEach(({ page }, testInfo) => {
    void page;
    skipUnlessProject(testInfo, 'desktop', 'mobile');
  });

  for (const target of ['hackathons', 'work', 'about', 'contact']) {
    test(`a fresh visit to /?webgl=off#${target} lands on the heading`, async ({ page }) => {
      await gotoAndSettle(page, `/?webgl=off#${target}`);
      await page.waitForLoadState('networkidle');
      await waitForRenderState(page, ['fallback']);
      await expectAnchorPlaced(page, target);
      expect(await page.evaluate(() => window.scrollY), 'the page should have scrolled').toBeGreaterThan(0);
    });
  }

  test('a fresh visit to /#hackathons with the scene lands on the heading and keeps the awards readable', async ({ page }) => {
    await gotoAndSettle(page, '/#hackathons');
    await expectAnchorPlaced(page, 'hackathons');
    for (const project of ['animalabs', 'opencraft']) {
      await expect(article(page, project)).toBeVisible();
    }
  });

  test('a fresh visit under reduced motion lands on the heading without smooth scrolling', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await gotoAndSettle(page, '/#about');
    await expectAnchorPlaced(page, 'about');
  });

  test('back from a section link returns to the top, and forward lands on the section again', async ({ page }) => {
    await gotoAndSettle(page, '/?intro=skip');
    await page.locator('a[href="#about"]').first().click();
    await expectAnchorPlaced(page, 'about');
    await waitForScrollIdle(page);
    await page.goBack();
    await expect.poll(() => page.evaluate(() => window.scrollY), { timeout: 8_000 }).toBeLessThan(10);
    await waitForScrollIdle(page);
    await page.goForward();
    await expectAnchorPlaced(page, 'about');
  });
});
