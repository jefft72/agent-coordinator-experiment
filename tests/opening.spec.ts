/// <reference lib="dom" />
import { test, expect, type Page } from '@playwright/test';
import { work, projectOrder, identity, type ProjectId } from '../src/content/work';

const RENDER_STATES = /^(ready|fallback|failed)$/;
const FORBIDDEN = [/\bgraduat(?:ion|ing)\b|\bexpected\b/i, /(?:\+1[ .-]?)?\(?\b\d{3}\)?[ .-]\d{3}[ .-]\d{4}\b/];

function indexButton(page: Page, id: ProjectId) {
  return page.getByTestId(`index-${id}`);
}

async function expectOnlySelected(page: Page, id: ProjectId | null) {
  for (const other of projectOrder) {
    await expect(indexButton(page, other)).toHaveAttribute('aria-pressed', other === id ? 'true' : 'false');
  }
  await expect(page.getByTestId('sheet')).toHaveAttribute('data-selected', id ?? 'none');
}

async function expectCaptionFor(page: Page, id: ProjectId) {
  const entry = work[id];
  const caption = page.getByTestId('caption');
  await expect(caption.getByTestId('caption-name')).toHaveText(entry.name);
  await expect(caption).toContainText(entry.roleLine);
  for (const fact of entry.facts) {
    await expect(caption).toContainText(fact);
  }
  for (const link of entry.links) {
    const anchor = caption.locator(`a[href="${link.href}"]`);
    await expect(anchor).toHaveCount(1);
    await expect(anchor).toContainText(link.label);
  }
}

test.describe('opening content', () => {
  test('name, identity, index, and recognition strip are present', async ({ page }) => {
    await page.goto('/');

    const opening = page.locator('section#opening[data-testid="opening"]');
    await expect(opening).toBeVisible();
    await expect(page.locator('h1#name')).toHaveText('Jeffrey Tseng');

    const id = page.getByTestId('identity');
    for (const line of identity.lines) {
      await expect(id).toContainText(line);
    }
    await expect(id.locator('a[href="mailto:tseng94@purdue.edu"]')).toHaveCount(1);
    await expect(id.locator('a[href="https://github.com/jefft72"]')).toHaveCount(1);
    await expect(id.locator('a[href="https://linkedin.com/in/j-tseng/"]')).toHaveCount(1);

    const index = page.getByTestId('work-index');
    await expect(index.locator('button[data-testid^="index-"]')).toHaveCount(6);
    for (const pid of projectOrder) {
      await expect(index.locator(`button[data-testid="index-${pid}"]`)).toHaveAttribute('aria-pressed', 'false');
    }

    await expect(page.getByTestId('caption')).toContainText('Six');

    const strip = page.getByTestId('recognition-strip');
    for (const text of [
      'Cal Hacks 13.0',
      'Best AI-First Disruptor',
      'MLH Commit Fellowship',
      'HackPrinceton Spring 2026',
      'Best use of Dedalus Containers',
    ]) {
      await expect(strip).toContainText(text);
    }
    await expect(strip.locator('a[href="https://devpost.com/software/anima-labs"]')).toHaveCount(1);
    await expect(strip.locator('a[href="https://devpost.com/software/opencraft"]')).toHaveCount(1);

    await expect(page.locator('section#hackathons')).toHaveCount(1);
    const openingBox = await opening.boundingBox();
    const hackathonsBox = await page.locator('section#hackathons').boundingBox();
    expect(openingBox).not.toBeNull();
    expect(hackathonsBox).not.toBeNull();
    expect(hackathonsBox!.y).toBeGreaterThan(openingBox!.y);
  });

  test('mobile: first project links and the strip are reachable', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'mobile project only');
    await page.goto('/');
    const tops: number[] = [];
    for (const pid of projectOrder) {
      const box = await indexButton(page, pid).boundingBox();
      if (box) tops.push(box.y);
    }
    expect(tops.length).toBeGreaterThan(0);
    expect(Math.min(...tops)).toBeLessThan(844);
    await expect(page.getByTestId('recognition-strip')).toHaveCount(1);
  });
});

test.describe('selection', () => {
  test('clicking an index entry selects it and fills the caption', async ({ page }) => {
    await page.goto('/');
    await expectOnlySelected(page, null);

    await indexButton(page, 'opencraft').click();
    await expectOnlySelected(page, 'opencraft');
    await expectCaptionFor(page, 'opencraft');

    await indexButton(page, 'diffex').click();
    await expectOnlySelected(page, 'diffex');
    await expectCaptionFor(page, 'diffex');
  });

  test('keyboard: arrows move focus, Enter and Space select', async ({ page }) => {
    await page.goto('/');
    await indexButton(page, 'diffex').focus();
    await expect(indexButton(page, 'diffex')).toBeFocused();

    await page.keyboard.press('ArrowDown');
    await expect(indexButton(page, 'judi')).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(indexButton(page, 'animalabs')).toBeFocused();
    await page.keyboard.press('Enter');
    await expectOnlySelected(page, 'animalabs');
    await expectCaptionFor(page, 'animalabs');

    await page.keyboard.press('ArrowDown');
    await expect(indexButton(page, 'opencraft')).toBeFocused();
    await page.keyboard.press('Space');
    await expectOnlySelected(page, 'opencraft');

    await page.keyboard.press('ArrowUp');
    await expect(indexButton(page, 'animalabs')).toBeFocused();

    // Roving tabindex: exactly one of the six buttons is in the tab order.
    const tabbable = await page
      .getByTestId('work-index')
      .locator('button[data-testid^="index-"]')
      .evaluateAll((els) => els.filter((el) => (el as HTMLElement).tabIndex === 0).length);
    expect(tabbable).toBe(1);
  });
});

test.describe('sheet rendering', () => {
  test('?webgl=off shows the fallback and selection still updates', async ({ page }) => {
    await page.goto('/?webgl=off');
    const sheet = page.getByTestId('sheet');
    await expect(sheet).toHaveAttribute('data-render-state', 'fallback', { timeout: 8_000 });
    const fallback = page.getByTestId('sheet-fallback');
    await expect(fallback).toBeVisible();
    await expect(fallback).toHaveAttribute('data-selected', 'none');
    await expect(sheet.locator('[data-testid="sheet-webgl"] canvas')).toHaveCount(0);

    await indexButton(page, 'judi').click();
    await expect(sheet).toHaveAttribute('data-selected', 'judi');
    await expect(fallback).toHaveAttribute('data-selected', 'judi');
    await expect(fallback.locator('[data-artifact="judi"]')).toHaveAttribute('data-state', 'selected');
    await expect(fallback.locator('[data-artifact="judi"]')).toBeVisible();
    await expect(fallback.locator('[data-artifact="opencraft"]')).toHaveAttribute('data-state', 'dimmed');

    await indexButton(page, 'uplate').click();
    await expect(sheet).toHaveAttribute('data-selected', 'uplate');
    await expect(fallback.locator('[data-artifact="uplate"]')).toBeVisible();
    await expect(fallback.locator('img[alt="UPlate onboarding screen"]')).toHaveCount(1);
  });

  test('the sheet settles into a render state and is never blank', async ({ page }, testInfo) => {
    await page.goto('/');
    const sheet = page.getByTestId('sheet');
    await expect(sheet).toHaveAttribute('data-render-state', RENDER_STATES, { timeout: 8_000 });

    const box = await sheet.boundingBox();
    expect(box).not.toBeNull();
    const minHeight = testInfo.project.name === 'desktop' ? 200 : 180;
    expect(box!.height).toBeGreaterThan(minHeight);

    const canvas = sheet.locator('[data-testid="sheet-webgl"] canvas');
    const fallback = sheet.locator('[data-testid="sheet-fallback"]');
    const state = await sheet.getAttribute('data-render-state');
    if (state === 'ready') {
      await expect(canvas).toBeVisible();
    } else {
      await expect(fallback).toBeVisible();
    }
    const visible = (await canvas.count()) > 0 ? await canvas.first().isVisible() : await fallback.isVisible();
    expect(visible).toBe(true);
  });
});

test.describe('layout and hygiene', () => {
  test('no horizontal overflow at 320px', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'narrow', 'narrow project only');
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(320);
  });

  test('served HTML and rendered text contain no stale resume details', async ({ page }) => {
    const response = await page.request.get('/');
    expect(response.ok()).toBe(true);
    // Hashed asset filenames are not content; strip them before scanning.
    const html = (await response.text()).replace(/\/assets\/[^"' >]+/g, '');
    for (const needle of FORBIDDEN) {
      expect(html, `served HTML contains "${needle}"`).not.toMatch(needle);
    }

    await page.goto('/');
    await expect(page.locator('h1#name')).toHaveText('Jeffrey Tseng');
    const text = await page.evaluate(() => document.body.innerText);
    for (const needle of FORBIDDEN) {
      expect(text, `page text contains "${needle}"`).not.toMatch(needle);
    }
  });

  test('no console errors or page errors on load', async ({ page }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.goto('/');
    await expect(page.getByTestId('sheet')).toHaveAttribute('data-render-state', RENDER_STATES, { timeout: 8_000 });
    await page.waitForTimeout(500);

    expect(pageErrors, pageErrors.join('\n')).toEqual([]);
    expect(consoleErrors, consoleErrors.join('\n')).toEqual([]);
  });
});
