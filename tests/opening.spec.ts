/// <reference lib="dom" />
import { test, expect } from '@playwright/test';
import { identity, nav, hackathonProjects } from '../src/content/site';
import {
  SETTLED_LOAD_STATES,
  SETTLED_RENDER_STATES,
  article,
  collectConsoleErrors,
  documentScrollWidth,
  expectAtLeastOne,
  expectCleanLog,
  expectInViewport,
  focusedHref,
  gotoAndSettle,
  htmlRoot,
  requireBox,
  scene,
  scrollThroughPage,
  shiftTabUntilHref,
  skipUnlessProject,
  waitForLoadState,
  waitForRenderState,
} from './helpers';

test.describe('opening', () => {
  test('name, identity, nav, and the work sequence are present', async ({ page }, testInfo) => {
    await gotoAndSettle(page, '/?intro=skip');
    await expect(htmlRoot(page)).toHaveAttribute('data-load-state', 'bypassed');

    await expect(page.locator('section#opening[data-testid="opening"]')).toBeVisible();
    await expect(page.locator('h1#name')).toHaveText('Jeffrey Tseng');

    const identityBlock = page.getByTestId('identity');
    for (const line of identity.lines) {
      await expect(identityBlock).toContainText(line);
    }

    const siteNav = page.locator('header[data-testid="site-header"] nav[data-testid="site-nav"]');
    for (const item of nav) {
      const link = siteNav.locator(`a[href="${item.href}"]`);
      await expect(link, `nav link ${item.href}`).toHaveCount(1);
      await expect(link).toHaveText(item.label);
    }

    if (testInfo.project.name === 'desktop') {
      await expectInViewport(page.locator('h2#work-heading'));
      await expectInViewport(article(page, 'animalabs'));
    }

    expect(hackathonProjects).toHaveLength(2);
    for (const project of hackathonProjects) {
      const row = article(page, project.id);
      const award = project.award;
      expect(award, `${project.id} should carry an award`).toBeDefined();
      if (!award) continue;
      await expect(row).toContainText(award.event);
      for (const { title } of award.titles) {
        await expect(row).toContainText(title);
      }
      await expectAtLeastOne(row.locator(`a[href="${award.proof.href}"]`), `${project.id} proof link ${award.proof.href}`);
    }
  });

  test('scene renders by default', async ({ page }, testInfo) => {
    await page.goto('/');
    const stage = scene(page);
    const canvas = stage.locator('[data-testid="scene-webgl"] canvas');
    if (testInfo.project.name === 'desktop') {
      await expect(stage).toHaveAttribute('data-render-state', 'ready', { timeout: 15_000 });
      await expect(canvas).toHaveCount(1);
      await expect(canvas).toBeVisible();
      return;
    }
    // Phones may legitimately use the compact fallback; either way the stage must settle and be consistent.
    const state = await waitForRenderState(page, ['ready', 'fallback']);
    testInfo.annotations.push({ type: 'render-state', description: state });
    if (state === 'ready') {
      await expect(canvas).toHaveCount(1);
      await expect(canvas).toBeVisible();
    } else {
      await expect(page.getByTestId('scene-fallback')).toBeVisible();
      await expect(canvas).toHaveCount(0);
    }
  });

  test('?webgl=off renders the static fallback without a canvas', async ({ page }) => {
    await page.goto('/?webgl=off&intro=skip');
    await expect(scene(page)).toHaveAttribute('data-render-state', 'fallback', { timeout: 15_000 });
    const fallback = page.getByTestId('scene-fallback');
    await expect(fallback).toBeVisible();
    await expect
      .poll(() => fallback.locator('polygon').count(), { message: 'fallback should draw at least 50 polygons' })
      .toBeGreaterThanOrEqual(50);
    await expect(page.locator('canvas')).toHaveCount(0);
  });

  test('keyboard reaches the nav links in order and Enter on Work scrolls to the heading', async ({ page }) => {
    await gotoAndSettle(page, '/?intro=skip');

    const expected: string[] = nav.map((item) => item.href);
    const reached: string[] = [];
    const seen: string[] = [];
    for (let i = 0; i < 16 && reached.length < expected.length; i += 1) {
      await page.keyboard.press('Tab');
      const href = await focusedHref(page);
      seen.push(href ?? `(${await page.evaluate(() => document.activeElement?.tagName ?? 'none')})`);
      if (href && expected.includes(href) && !reached.includes(href)) reached.push(href);
    }
    expect(reached, `tab sequence was: ${seen.join(' > ')}`).toEqual(expected);

    expect(await shiftTabUntilHref(page, '#work'), 'Shift+Tab should return to the Work link').toBe(true);
    await page.keyboard.press('Enter');
    await expectInViewport(page.locator('h2#work-heading'));
  });

  test('default load and a full scroll produce no console errors or failed requests', async ({ page }, testInfo) => {
    skipUnlessProject(testInfo, 'desktop');
    const log = collectConsoleErrors(page);

    await page.goto('/');
    await waitForLoadState(page, SETTLED_LOAD_STATES);
    await waitForRenderState(page, SETTLED_RENDER_STATES);
    await page.evaluate(() => document.fonts.ready);
    await scrollThroughPage(page);
    await page.waitForTimeout(500);

    expectCleanLog(log);
  });

  test('no horizontal overflow at 320px', async ({ page }, testInfo) => {
    skipUnlessProject(testInfo, 'narrow');
    await gotoAndSettle(page, '/?intro=skip');
    expect(await documentScrollWidth(page), 'scroll width after load').toBeLessThanOrEqual(320);
    await scrollThroughPage(page);
    expect(await documentScrollWidth(page), 'scroll width after scrolling to the bottom').toBeLessThanOrEqual(320);
  });

  test('mobile: the name fits, Work follows it, and both awards read in sequence', async ({ page }, testInfo) => {
    skipUnlessProject(testInfo, 'mobile');
    await gotoAndSettle(page, '/?intro=skip');

    const name = page.locator('h1#name');
    await expect(name).toBeVisible();
    const nameBox = await requireBox(name);
    expect(nameBox.width, 'h1#name width').toBeLessThan(390);

    const headingBox = await requireBox(page.locator('h2#work-heading'));
    expect(headingBox.y, 'Work heading should sit below the name').toBeGreaterThanOrEqual(nameBox.y + nameBox.height);

    const row = article(page, 'animalabs');
    await row.scrollIntoViewIfNeeded();
    await expect(row).toBeVisible();

    const award = hackathonProjects.find((project) => project.id === 'animalabs')?.award;
    expect(award).toBeDefined();
    if (!award) return;
    expect(award.titles.length).toBeGreaterThanOrEqual(2);

    let previousTop = Number.NEGATIVE_INFINITY;
    for (const { title } of award.titles) {
      const titleNode = row.getByText(title).first();
      await titleNode.scrollIntoViewIfNeeded();
      await expect(titleNode, `award title "${title}"`).toBeVisible();
      const box = await requireBox(titleNode);
      expect(box.y, `"${title}" should follow the previous award`).toBeGreaterThanOrEqual(previousTop);
      previousTop = box.y;
    }
    await expect(row.getByRole('tab')).toHaveCount(0);
  });
});
