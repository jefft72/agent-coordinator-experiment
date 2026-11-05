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

    await page.locator('h2#work-heading').evaluate((el) => el.scrollIntoView({ block: 'start', behavior: 'instant' }));
    await page.waitForTimeout(600);
    await page.screenshot({ path: shot('desktop-work', page) });

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
    await page.mouse.wheel(0, 700);
    await page.waitForTimeout(900);

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
});

test.describe('narrow', () => {
  test.use({ viewport: { width: 320, height: 700 } });

  test('opening', async ({ page }) => {
    await page.goto('/');
    await settle(page);
    await page.screenshot({ path: shot('narrow-opening', page) });
  });
});
