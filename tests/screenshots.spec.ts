/// <reference lib="dom" />
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect, devices, type Page } from '@playwright/test';
import {
  SETTLED_LOAD_STATES,
  SETTLED_RENDER_STATES,
  detailsButton,
  detailsDialog,
  scrollThroughPage,
  scrollToTop,
  waitForLoadState,
  waitForRenderState,
} from './helpers';

/**
 * Visual captures for review. Not part of the default run: the `screenshots`
 * project only exists when requested (see playwright.config.ts), so invoke
 * `npm run screenshots` or `npx playwright test --project=screenshots`.
 */

const SCREENS_DIR = fileURLToPath(new URL('../.context/screens/', import.meta.url));
const iphone = devices['iPhone 14'];

function shot(name: string, page: Page): string {
  fs.mkdirSync(SCREENS_DIR, { recursive: true });
  const viewport = page.viewportSize() ?? { width: 0, height: 0 };
  return path.join(SCREENS_DIR, `${name}-${viewport.width}x${viewport.height}.png`);
}

async function settle(page: Page, pause = 1_200) {
  await waitForLoadState(page, SETTLED_LOAD_STATES);
  await waitForRenderState(page, SETTLED_RENDER_STATES);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(pause);
}

test.describe('desktop', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('opening, work, full page, and details', async ({ page }) => {
    await page.goto('/');
    await settle(page);
    await page.screenshot({ path: shot('desktop-opening', page) });

    await page.evaluate(() => window.scrollTo({ top: Math.round(window.innerHeight * 0.45), behavior: 'instant' }));
    await page.waitForTimeout(700);
    await page.screenshot({ path: shot('desktop-mid-scroll', page) });

    await page.locator('h2#work-heading').evaluate((el) => el.scrollIntoView({ block: 'start', behavior: 'instant' }));
    await page.waitForTimeout(600);
    await page.screenshot({ path: shot('desktop-work', page) });

    await detailsButton(page, 'opencraft').focus();
    await page.waitForTimeout(900);
    await page.screenshot({ path: shot('desktop-work-focus-opencraft', page) });

    await scrollThroughPage(page);
    await scrollToTop(page);
    await page.waitForTimeout(600);
    await page.screenshot({ path: shot('desktop-full', page), fullPage: true });

    await detailsButton(page, 'animalabs').scrollIntoViewIfNeeded();
    await detailsButton(page, 'animalabs').click();
    await expect(detailsDialog(page)).toBeVisible();
    await page.waitForTimeout(600);
    await page.screenshot({ path: shot('desktop-details-animalabs', page) });
  });

  test('stage at rest, mid-phase, and at the end', async ({ page }) => {
    await page.goto('/?intro=skip');
    await settle(page, 300);
    await detailsButton(page, 'animalabs').scrollIntoViewIfNeeded();
    await detailsButton(page, 'animalabs').click();
    const stage = page.locator('[data-testid="project-stage"]');
    await expect(stage).toHaveAttribute('data-mode', 'paused', { timeout: 12_000 });
    await page.waitForTimeout(600);
    await page.screenshot({ path: shot('desktop-stage-animalabs-end', page) });
    await page.locator('[data-testid="stage-phase"]').fill('35');
    await page.waitForTimeout(800);
    await page.screenshot({ path: shot('desktop-stage-animalabs-phase35', page) });
    await page.locator('[data-testid="stage-reset"]').click();
    await page.waitForTimeout(1_600);
    await page.screenshot({ path: shot('desktop-stage-animalabs-rest', page) });
  });

  test('stage clip switching between two project patterns', async ({ browser, baseURL }) => {
    fs.mkdirSync(SCREENS_DIR, { recursive: true });
    const context = await browser.newContext({
      baseURL,
      viewport: { width: 1440, height: 900 },
      recordVideo: { dir: SCREENS_DIR, size: { width: 1440, height: 900 } },
    });
    const page = await context.newPage();
    const video = page.video();
    await page.goto('/?intro=skip');
    await settle(page, 300);
    for (const id of ['animalabs', 'opencraft']) {
      await detailsButton(page, id).scrollIntoViewIfNeeded();
      await detailsButton(page, id).click();
      await expect(detailsDialog(page)).toBeVisible();
      await expect(page.locator('[data-testid="project-stage"]')).toHaveAttribute('data-mode', 'paused', { timeout: 12_000 });
      await page.waitForTimeout(500);
      await page.locator('[data-testid="stage-replay"]').click();
      await page.waitForTimeout(2_500);
      await page.locator('[data-testid="stage-phase"]').fill('60');
      await page.waitForTimeout(900);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(400);
    }
    await page.close();
    const target = path.join(SCREENS_DIR, 'desktop-stage-switch.webm');
    if (video) {
      await video.saveAs(target);
      await video.delete();
    }
    await context.close();
    expect(fs.existsSync(target)).toBe(true);
  });

  test('fallback', async ({ page }) => {
    await page.goto('/?webgl=off');
    await settle(page);
    await page.screenshot({ path: shot('desktop-fallback', page) });
  });

  test('reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await settle(page);
    await page.screenshot({ path: shot('desktop-reduced', page) });
  });

  test('loading', async ({ page }) => {
    await page.goto('/?scene=stall', { waitUntil: 'commit' });
    await page
      .waitForSelector('[data-testid="intro"]', { state: 'attached', timeout: 300 })
      .catch(() => undefined);
    await page.screenshot({ path: shot('desktop-loading', page) });
  });

  test('motion video', async ({ browser, baseURL }) => {
    fs.mkdirSync(SCREENS_DIR, { recursive: true });
    const context = await browser.newContext({
      baseURL,
      viewport: { width: 1440, height: 900 },
      recordVideo: { dir: SCREENS_DIR, size: { width: 1440, height: 900 } },
    });
    const page = await context.newPage();
    const video = page.video();
    expect(video, 'the context should record a video').not.toBeNull();

    await page.goto('/');
    await settle(page, 400);

    const from = { x: 160, y: 200 };
    const to = { x: 1280, y: 720 };
    const steps = 12;
    await page.mouse.move(from.x, from.y);
    for (let i = 1; i <= steps; i += 1) {
      await page.mouse.move(from.x + ((to.x - from.x) * i) / steps, from.y + ((to.y - from.y) * i) / steps);
      await page.waitForTimeout(60);
    }
    await page.waitForTimeout(900);
    await page.mouse.move(400, 300);
    await page.waitForTimeout(700);
    // Native scroll into Work and both wins, then a row response and one details interaction.
    for (let i = 0; i < 6; i += 1) {
      await page.mouse.wheel(0, 140);
      await page.waitForTimeout(140);
    }
    await page.waitForTimeout(700);
    const row = await page.locator('article[data-testid="project-opencraft"]').boundingBox();
    if (row) {
      await page.mouse.move(row.x + 320, row.y + 40);
      await page.waitForTimeout(1_100);
    }
    await detailsButton(page, 'animalabs').click();
    await expect(detailsDialog(page)).toBeVisible();
    await page.waitForTimeout(1_000);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(600);

    await page.close();
    const target = path.join(SCREENS_DIR, 'desktop-motion.webm');
    if (video) {
      await video.saveAs(target);
      await video.delete();
    }
    await context.close();
    expect(fs.existsSync(target)).toBe(true);
  });
});

test.describe('mobile', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    userAgent: iphone.userAgent,
    deviceScaleFactor: iphone.deviceScaleFactor,
    isMobile: true,
    hasTouch: true,
  });

  test('opening and full page', async ({ page }) => {
    await page.goto('/');
    await settle(page);
    await page.screenshot({ path: shot('mobile-opening', page) });
    await scrollThroughPage(page);
    await scrollToTop(page);
    await page.waitForTimeout(600);
    await page.screenshot({ path: shot('mobile-full', page), fullPage: true });
  });

  test('stage at rest and at the end', async ({ page }) => {
    await page.goto('/?intro=skip');
    await settle(page, 300);
    await detailsButton(page, 'opencraft').scrollIntoViewIfNeeded();
    await detailsButton(page, 'opencraft').tap();
    await expect(detailsDialog(page)).toBeVisible();
    await page.locator('[data-testid="stage-open"]').tap();
    const stage = page.locator('[data-testid="project-stage"]');
    await expect(stage).toHaveAttribute('data-mode', 'paused', { timeout: 12_000 });
    await page.waitForTimeout(600);
    await page.screenshot({ path: shot('mobile-stage-opencraft-end', page) });
    await page.locator('[data-testid="stage-reset"]').tap();
    await page.waitForTimeout(1_600);
    await page.screenshot({ path: shot('mobile-stage-opencraft-rest', page) });
  });
});

test.describe('narrow', () => {
  test.use({ viewport: { width: 320, height: 700 } });

  test('opening', async ({ page }) => {
    await page.goto('/');
    await settle(page);
    await page.screenshot({ path: shot('narrow-opening', page) });
  });
});
