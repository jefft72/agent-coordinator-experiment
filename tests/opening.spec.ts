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
  openingHeight,
  requireBox,
  scene,
  scrollThroughPage,
  scrollTo,
  shiftTabUntilHref,
  skipUnlessProject,
  waitForLoadState,
  waitForRenderState,
} from './helpers';

test.describe('opening', () => {
  test('name, identity, nav, and the Hackathons announcement are present', async ({ page }, testInfo) => {
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

    // The next chapter announces itself at the bottom of the first viewport.
    const announcement = page.locator('[data-testid="chapter-label-hackathons"]');
    await expectInViewport(announcement);
    await expect(announcement).toContainText('01 / Hackathons');
    const box = await requireBox(announcement);
    const viewport = page.viewportSize() ?? { width: 0, height: 0 };
    expect(box.y + box.height, 'the announcement should be fully inside the first viewport').toBeLessThanOrEqual(viewport.height);
    void testInfo;

    expect(hackathonProjects).toHaveLength(2);
    for (const project of hackathonProjects) {
      const spread = article(page, project.id);
      const award = project.award;
      expect(award, `${project.id} should carry an award`).toBeDefined();
      if (!award) continue;
      await expect(spread).toContainText(award.event);
      for (const { title } of award.titles) {
        await expect(spread).toContainText(title);
      }
      await expectAtLeastOne(spread.locator(`a[href="${award.proof.href}"]`), `${project.id} proof link ${award.proof.href}`);
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

  test('the scene never paints over readable content at any scroll position', async ({ page }, testInfo) => {
    await gotoAndSettle(page, '/?intro=skip');
    await waitForRenderState(page, SETTLED_RENDER_STATES);
    // The canvas ignores pointer events, so make it hit-testable: elementFromPoint follows paint order.
    await page.addStyleTag({ content: '[data-testid="scene"], [data-testid="scene"] * { pointer-events: auto !important; }' });
    const height = page.viewportSize()?.height ?? 900;
    const positions = [0, 0.2, 0.4, 0.6, 0.8, 1.0, 1.3, 2.2].map((f) => Math.round(f * height));
    for (const y of positions) {
      await scrollTo(page, y);
      await page.waitForTimeout(250);
      const covered = await page.evaluate(() => {
        const stage = document.querySelector('[data-testid="scene"]');
        const selectors = 'h1, h2, h3, h4, p, a, button, li, .opening__identity p';
        const hits: string[] = [];
        for (const el of Array.from(document.querySelectorAll<HTMLElement>(selectors))) {
          if (el.closest('[data-testid="intro"]')) continue;
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0 || r.bottom <= 0 || r.top >= innerHeight) continue;
          const x = Math.min(innerWidth - 1, Math.max(0, r.left + Math.min(r.width, 40) / 2));
          const cy = Math.min(innerHeight - 1, Math.max(0, r.top + r.height / 2));
          const top = document.elementFromPoint(x, cy);
          if (top && stage?.contains(top)) hits.push(`${el.tagName.toLowerCase()} "${(el.textContent ?? '').trim().slice(0, 24)}" at ${Math.round(cy)}`);
        }
        return hits;
      });
      expect(covered, `${testInfo.project.name}: scene paints over content at scrollY ${y}`).toEqual([]);
    }
  });

  test('?webgl=off renders the static fallback without any canvas', async ({ page }) => {
    await page.goto('/?webgl=off&intro=skip');
    await expect(scene(page)).toHaveAttribute('data-render-state', 'fallback', { timeout: 15_000 });
    const fallback = page.getByTestId('scene-fallback');
    await expect(fallback).toBeVisible();
    await expect
      .poll(() => fallback.locator('polygon').count(), { message: 'fallback should draw at least 50 polygons' })
      .toBeGreaterThanOrEqual(50);
    await expect(page.locator('canvas')).toHaveCount(0);
  });

  test('keyboard reaches the nav links in order and Enter on Hackathons scrolls to the heading', async ({ page }) => {
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

    expect(await shiftTabUntilHref(page, '#hackathons'), 'Shift+Tab should return to the Hackathons link').toBe(true);
    await page.keyboard.press('Enter');
    await expectInViewport(page.locator('h2#hackathons-heading'));
  });

  test('desktop: the opening pins while Hackathons rises over it, then hides until the reader returns', async ({ page }, testInfo) => {
    skipUnlessProject(testInfo, 'desktop');
    await gotoAndSettle(page, '/?intro=skip');
    await waitForRenderState(page, SETTLED_RENDER_STATES);
    const end = await openingHeight(page);
    expect(end).toBeGreaterThan(400);
    const viewport = page.viewportSize() ?? { width: 0, height: 0 };
    expect(end, 'the opening leaves room for the announcement').toBeLessThan(viewport.height);

    await scrollTo(page, Math.round(end * 0.5));
    await page.waitForTimeout(250);
    await expect(htmlRoot(page)).toHaveAttribute('data-handoff', 'moving');
    const pinned = await requireBox(page.locator('section#opening'));
    expect(Math.round(pinned.y), 'the opening stays pinned at the top during the handoff').toBe(0);
    const chapterTop = (await requireBox(page.locator('section#hackathons'))).y;
    expect(chapterTop, 'the chapter has risen over the lower half of the opening').toBeLessThan(viewport.height * 0.5);
    expect(chapterTop).toBeGreaterThan(0);
    await expect(scene(page)).toHaveAttribute('data-active', 'true');
    const handoff = Number(await page.evaluate(() => document.documentElement.style.getPropertyValue('--handoff')));
    expect(handoff).toBeGreaterThan(0.4);
    expect(handoff).toBeLessThan(0.6);
    const transform = await page.locator('h1#name').evaluate((el) => getComputedStyle(el).transform);
    expect(transform, 'the name recedes while the chapter rises').not.toBe('none');

    await scrollTo(page, end + 40);
    await page.waitForTimeout(350);
    await expect(htmlRoot(page)).toHaveAttribute('data-handoff', 'done');
    await expect(scene(page)).toHaveAttribute('data-active', 'false');
    expect(await page.locator('section#opening').evaluate((el) => getComputedStyle(el).visibility)).toBe('hidden');
    await expect(page.locator('h2#hackathons-heading')).toBeVisible();

    await scrollTo(page, 0);
    await page.waitForTimeout(350);
    await expect(htmlRoot(page)).toHaveAttribute('data-handoff', 'rest');
    await expect(scene(page)).toHaveAttribute('data-active', 'true');
    await expect(page.locator('h1#name')).toBeVisible();
  });

  test('phones: the opening scrolls away naturally instead of pinning', async ({ page }, testInfo) => {
    skipUnlessProject(testInfo, 'mobile', 'narrow');
    await gotoAndSettle(page, '/?intro=skip');
    await scrollTo(page, 200);
    await page.waitForTimeout(200);
    const box = await requireBox(page.locator('section#opening'));
    expect(Math.round(box.y)).toBe(-200);
    expect(await page.locator('h1#name').evaluate((el) => getComputedStyle(el).transform)).toBe('none');
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

  test('compact: the identity lines stay clear of the artwork', async ({ page }, testInfo) => {
    skipUnlessProject(testInfo, 'mobile', 'narrow');
    // The fallback projects the same blades through the same camera, so its polygons stand in for the WebGL silhouette.
    await gotoAndSettle(page, '/?intro=skip&webgl=off');
    await expect(scene(page)).toHaveAttribute('data-render-state', 'fallback');
    const identityBox = await requireBox(page.getByTestId('identity'));
    const art = await page.evaluate(() => {
      let left = Infinity;
      let top = Infinity;
      let right = -Infinity;
      let bottom = -Infinity;
      for (const polygon of Array.from(document.querySelectorAll('[data-testid="scene-fallback"] polygon'))) {
        const r = polygon.getBoundingClientRect();
        left = Math.min(left, r.left);
        top = Math.min(top, r.top);
        right = Math.max(right, r.right);
        bottom = Math.max(bottom, r.bottom);
      }
      return { left, top, right, bottom };
    });
    const overlapsVertically = art.top < identityBox.y + identityBox.height && art.bottom > identityBox.y;
    const overlapsHorizontally = art.left < identityBox.x + identityBox.width && art.right > identityBox.x;
    expect(
      overlapsVertically && overlapsHorizontally,
      `artwork ${JSON.stringify(art)} overlaps the identity block ${JSON.stringify(identityBox)}`,
    ).toBe(false);
    expect(art.top, 'the artwork should start below the identity lines').toBeGreaterThanOrEqual(identityBox.y + identityBox.height);
    const announcement = await requireBox(page.locator('[data-testid="chapter-label-hackathons"]'));
    expect(art.bottom, 'the artwork should end above the announcement').toBeLessThanOrEqual(announcement.y);
  });

  test('mobile: the name fits, Hackathons follows it, and both awards read in sequence', async ({ page }, testInfo) => {
    skipUnlessProject(testInfo, 'mobile');
    await gotoAndSettle(page, '/?intro=skip');

    const name = page.locator('h1#name');
    await expect(name).toBeVisible();
    const nameBox = await requireBox(name);
    expect(nameBox.width, 'h1#name width').toBeLessThan(390);

    const headingBox = await requireBox(page.locator('h2#hackathons-heading'));
    expect(headingBox.y, 'the Hackathons heading should sit below the name').toBeGreaterThanOrEqual(nameBox.y + nameBox.height);

    const spread = article(page, 'animalabs');
    await spread.scrollIntoViewIfNeeded();
    await expect(spread).toBeVisible();

    const award = hackathonProjects.find((project) => project.id === 'animalabs')?.award;
    expect(award).toBeDefined();
    if (!award) return;
    expect(award.titles.length).toBeGreaterThanOrEqual(2);

    let previousTop = Number.NEGATIVE_INFINITY;
    for (const { title } of award.titles) {
      const titleNode = spread.getByText(title).first();
      await titleNode.scrollIntoViewIfNeeded();
      await expect(titleNode, `award title "${title}"`).toBeVisible();
      const box = await requireBox(titleNode);
      expect(box.y, `"${title}" should follow the previous award`).toBeGreaterThanOrEqual(previousTop);
      previousTop = box.y;
    }
    // Single column: the media follows the award and the controls follow the media.
    const media = await requireBox(spread.locator('img').first());
    const controls = await requireBox(spread.locator('[role="tablist"]'));
    expect(media.y).toBeGreaterThan(previousTop);
    expect(controls.y).toBeGreaterThan(media.y + media.height - 1);
  });
});
