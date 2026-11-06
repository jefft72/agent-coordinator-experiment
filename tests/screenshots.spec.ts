/// <reference lib="dom" />
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect, devices, type Browser, type Page } from '@playwright/test';
import {
  SETTLED_LOAD_STATES,
  SETTLED_RENDER_STATES,
  contributionTab,
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
const CHAPTER_SHOTS: Array<[string, string]> = [
  ['hackathons', '#hackathons'],
  ['animalabs', '#project-animalabs'],
  ['opencraft', '#project-opencraft'],
  ['experience', '#experience'],
  ['judi', '[data-testid="project-judi"]'],
  ['rtx', '[data-testid="project-rtx"]'],
  ['ventures', '#ventures'],
  ['diffex', '[data-testid="project-diffex"]'],
  ['uplate', '[data-testid="project-uplate"]'],
  ['about', '#about'],
  ['contact', '#contact'],
];

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

async function landOn(page: Page, selector: string) {
  await page.locator(selector).first().evaluate((el) => el.scrollIntoView({ block: 'start', behavior: 'instant' }));
  await page.waitForTimeout(500);
}

/** Settled viewports of the opening handoff and every chapter, in page order. */
async function chapterShots(prefix: string, page: Page) {
  await page.goto('/?intro=skip');
  await settle(page, 600);
  await page.screenshot({ path: shot(`${prefix}-opening`, page) });
  const end = await page.evaluate(() => document.getElementById('opening')?.offsetHeight ?? 0);
  for (const fraction of [0.35, 0.7]) {
    await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), Math.round(end * fraction));
    await page.waitForTimeout(600);
    await page.screenshot({ path: shot(`${prefix}-handoff-${Math.round(fraction * 100)}`, page) });
  }
  for (const [name, selector] of CHAPTER_SHOTS) {
    await landOn(page, selector);
    await page.screenshot({ path: shot(`${prefix}-${name}`, page) });
  }
  await landOn(page, '#project-animalabs');
  await contributionTab(page, 'animalabs', 'analyst').click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: shot(`${prefix}-animalabs-analyst`, page) });
  await landOn(page, '[data-testid="project-uplate"]');
  await page.locator('button[data-testid="gallery-uplate-next"]').click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: shot(`${prefix}-uplate-2`, page) });
  await scrollThroughPage(page);
  await scrollToTop(page);
  await page.waitForTimeout(600);
  await page.screenshot({ path: shot(`${prefix}-full`, page), fullPage: true });
}

/**
 * One continuous recording: cold load, then native scrolling down the whole
 * page and back up to the name, with frames at the handoff, each spread's
 * arrival, and each chapter's takeover in both directions, then a real
 * contribution change and a real proof link.
 */
async function journey(browser: Browser, baseURL: string | undefined, name: string, viewport: { width: number; height: number }, mobile: boolean) {
  fs.mkdirSync(SCREENS_DIR, { recursive: true });
  const context = await browser.newContext({
    baseURL,
    viewport,
    recordVideo: { dir: SCREENS_DIR, size: viewport },
    ...(mobile ? { userAgent: iphone.userAgent, deviceScaleFactor: iphone.deviceScaleFactor, isMobile: true, hasTouch: true } : {}),
  });
  const page = await context.newPage();
  const video = page.video();
  await page.context().route('https://www.youtube.com/**', (route) =>
    route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>Watch demo opened in a new tab</title>' }),
  );
  await page.goto('/');
  await settle(page, 500);
  if (!mobile) {
    await page.mouse.move(400, 300);
    await page.waitForTimeout(300);
  }
  const marks = await page.evaluate(() => {
    const top = (id: string) => (document.getElementById(id)?.getBoundingClientRect().top ?? 0) + window.scrollY;
    return {
      end: document.getElementById('opening')?.offsetHeight ?? 0,
      animalabs: top('project-animalabs'),
      opencraft: top('project-opencraft'),
      experience: top('experience'),
      ventures: top('ventures'),
      about: top('about'),
      max: document.documentElement.scrollHeight - window.innerHeight,
    };
  });
  const vh = viewport.height;
  const frames: Array<[string, number]> = [
    ['handoff-25', marks.end * 0.25],
    ['handoff-50', marks.end * 0.5],
    ['handoff-75', marks.end * 0.75],
    ['animalabs-arriving', marks.animalabs - vh * 0.6],
    ['opencraft-arriving', marks.opencraft - vh * 0.6],
    ['experience-cover-40', marks.experience - vh * 0.6],
    ['experience-cover-80', marks.experience - vh * 0.3],
    ['ventures-takeover', marks.ventures - vh * 0.55],
    ['about-takeover', marks.about - vh * 0.55],
  ];
  const step = mobile ? 70 : 110;
  const scroll = async (direction: 1 | -1) => {
    const pending = frames.map(([label, y]) => ({ label, y }));
    for (let guard = 0; guard < 2_000; guard += 1) {
      const y = await page.evaluate(() => window.scrollY);
      if (direction > 0 ? y >= marks.max - 1 : y <= 0) break;
      for (const frame of [...pending]) {
        if (direction > 0 ? y >= frame.y : y <= frame.y) {
          pending.splice(pending.indexOf(frame), 1);
          await page.waitForTimeout(80);
          await page.screenshot({ path: shot(`${name}-${direction > 0 ? 'down' : 'up'}-${frame.label}`, page) });
        }
      }
      if (mobile) await page.evaluate((dy) => window.scrollBy({ top: dy, behavior: 'instant' }), step * direction);
      else await page.mouse.wheel(0, step * direction);
      await page.waitForTimeout(40);
    }
  };
  await scroll(1);
  await page.waitForTimeout(700);
  await scroll(-1);
  await page.waitForTimeout(700);
  // A real contribution change and a real proof link, then back to the chapter.
  await page.locator('#project-animalabs').evaluate((el) => el.scrollIntoView({ block: 'start', behavior: 'smooth' }));
  await page.waitForTimeout(1_200);
  await contributionTab(page, 'animalabs', 'analyst').click();
  await page.waitForTimeout(900);
  await contributionTab(page, 'animalabs', 'reports').click();
  await page.waitForTimeout(900);
  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    page.locator('article[data-testid="project-animalabs"] a[href="https://www.youtube.com/watch?v=UBaKKoPopSg"]').first().click(),
  ]);
  await popup.waitForLoadState();
  await page.waitForTimeout(600);
  await popup.close();
  await page.waitForTimeout(400);
  await page.close();
  const target = path.join(SCREENS_DIR, `${name}.webm`);
  if (video) {
    await video.saveAs(target);
    await video.delete();
  }
  await context.close();
  expect(fs.existsSync(target)).toBe(true);
}

test.describe('desktop', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('settled chapters', async ({ page }) => {
    await chapterShots('desktop', page);
  });

  test('journey video', async ({ browser, baseURL }) => {
    await journey(browser, baseURL, 'desktop-journey', { width: 1440, height: 900 }, false);
  });

  test('fallback, reduced motion, loading', async ({ page }) => {
    await page.goto('/?webgl=off');
    await settle(page);
    await page.screenshot({ path: shot('desktop-fallback', page) });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await settle(page);
    await page.screenshot({ path: shot('desktop-reduced', page) });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto('/?scene=stall', { waitUntil: 'commit' });
    await page.waitForSelector('[data-testid="intro"]', { state: 'attached', timeout: 300 }).catch(() => undefined);
    await page.screenshot({ path: shot('desktop-loading', page) });
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

  test('settled chapters', async ({ page }) => {
    await chapterShots('mobile', page);
  });

  test('journey video', async ({ browser, baseURL }) => {
    await journey(browser, baseURL, 'mobile-journey', { width: 390, height: 844 }, true);
  });
});

test.describe('narrow', () => {
  test.use({ viewport: { width: 320, height: 700 } });

  test('opening and full page', async ({ page }) => {
    await page.goto('/');
    await settle(page);
    await page.screenshot({ path: shot('narrow-opening', page) });
    await scrollThroughPage(page);
    await scrollToTop(page);
    await page.waitForTimeout(400);
    await page.screenshot({ path: shot('narrow-full', page), fullPage: true });
  });
});
