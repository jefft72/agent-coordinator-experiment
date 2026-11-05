/// <reference lib="dom" />
import { test, expect } from '@playwright/test';
import {
  INTRO_STORAGE_KEY,
  expectAnchorPlaced,
  expectInViewport,
  firstLoadState,
  htmlRoot,
  intro,
  scene,
  skipIntroButton,
  skipUnlessProject,
  tabUntilFocused,
  waitForLoadState,
  waitForRenderState,
} from './helpers';

test.describe('loader', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    skipUnlessProject(testInfo, 'desktop');
    // Pin the motion preference so the default-load tests are deterministic.
    await page.emulateMedia({ reducedMotion: 'no-preference' });
  });

  test('default load shows the intro, reveals, and marks the session', async ({ page }) => {
    await page.goto('/', { waitUntil: 'commit' });

    const first = await firstLoadState(page);
    expect(['loading', 'reveal'], `first observed load state was "${first}"`).toContain(first);

    await expect(intro(page)).toBeVisible();
    const skip = skipIntroButton(page);
    await expect(skip).toBeVisible();
    await expect(skip).toHaveAccessibleName('Skip intro');

    await waitForLoadState(page, ['ready'], 15_000);
    await expect(intro(page)).toBeHidden();
    expect(await page.evaluate((key) => sessionStorage.getItem(key), INTRO_STORAGE_KEY)).toBe('seen');
  });

  test('skip intro bypasses the loader from the keyboard', async ({ page }) => {
    await page.goto('/', { waitUntil: 'commit' });
    const skip = skipIntroButton(page);
    await expect(skip).toBeVisible();

    if (await tabUntilFocused(page, skip, 6)) {
      await expect(skip).toBeFocused();
      await page.keyboard.press('Enter');
    } else {
      await skip.click();
    }

    await expect(htmlRoot(page)).toHaveAttribute('data-load-state', 'bypassed', { timeout: 2_000 });
    await expect(intro(page)).toBeHidden();
    await expect(page.locator('h1#name')).toBeVisible();
  });

  test('?scene=stall gives up on the scene within the deadline', async ({ page }, testInfo) => {
    const started = Date.now();
    await page.goto('/?scene=stall', { waitUntil: 'commit' });
    await expect(htmlRoot(page)).toHaveAttribute('data-load-state', /^(bypassed|ready)$/, { timeout: 4_000 });
    const elapsed = Date.now() - started;
    testInfo.annotations.push({ type: 'stall-elapsed-ms', description: String(elapsed) });
    expect(elapsed, 'time from navigation to a readable page').toBeLessThanOrEqual(4_000);

    await expect(page.locator('h1#name')).toBeVisible();
    await expect(intro(page)).toBeHidden();
  });

  test('?scene=fail still yields a readable page with the fallback', async ({ page }) => {
    await page.goto('/?scene=fail');
    await waitForLoadState(page, ['failed', 'bypassed', 'ready']);
    await waitForRenderState(page, ['failed', 'fallback']);
    await expect(scene(page).locator('[data-testid="scene-fallback"]')).toBeVisible();
    await expect(page.locator('h1#name')).toBeVisible();
    await expect(intro(page)).toBeHidden();
  });

  test('a failed scene chunk keeps the page readable with the fallback', async ({ page }) => {
    await page.goto('/?scene=chunk-fail', { waitUntil: 'commit' });
    await waitForLoadState(page, ['failed', 'ready', 'bypassed'], 6_000);
    await waitForRenderState(page, ['failed']);
    await expect(scene(page).locator('[data-testid="scene-fallback"]')).toBeVisible();
    await expect(page.locator('h1#name')).toBeVisible();
    await expectInViewport(page.locator('h2#work-heading'));
  });

  test('a returning visit bypasses the intro', async ({ page }) => {
    await page.addInitScript((key) => sessionStorage.setItem(key, 'seen'), INTRO_STORAGE_KEY);
    await page.goto('/');
    await expect(htmlRoot(page)).toHaveAttribute('data-load-state', 'bypassed', { timeout: 500 });
    await expect(intro(page)).toBeHidden({ timeout: 500 });
    await expect(page.locator('h1#name')).toBeVisible();
  });

  test('a hash link bypasses the intro and lands the heading below the header', async ({ page }) => {
    await page.goto('/#hackathons');
    await expect(htmlRoot(page)).toHaveAttribute('data-load-state', 'bypassed');
    await expectAnchorPlaced(page, 'hackathons');
  });

  test('reduced motion settles quickly without the intro', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/', { waitUntil: 'commit' });
    await expect(htmlRoot(page)).toHaveAttribute('data-load-state', /^(ready|bypassed)$/, { timeout: 4_000 });
    await expect(intro(page)).toBeHidden();
    await waitForRenderState(page, ['ready', 'fallback']);
    await expect(page.locator('h1#name')).toBeVisible();
  });
});
