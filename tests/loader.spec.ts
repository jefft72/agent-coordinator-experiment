/// <reference lib="dom" />
import { test, expect } from '@playwright/test';
import { INTRO_MEASURE, LOAD_DEADLINE_MS, REVEAL_MS } from '../src/loader/useLoadSequence';
import {
  INTRO_STORAGE_KEY,
  expectAnchorPlaced,
  expectInViewport,
  firstLoadState,
  htmlRoot,
  intro,
  loadStateHistory,
  measureDurations,
  recordLoadStates,
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
    await recordLoadStates(page);
    const started = Date.now();
    await page.goto('/?scene=stall', { waitUntil: 'commit' });
    await waitForLoadState(page, ['ready'], 15_000);
    // Wall time includes navigation, chunk loading, and React mount, so it varies with the machine and is only recorded.
    testInfo.annotations.push({ type: 'stall-elapsed-ms', description: String(Date.now() - started) });

    // The loader's own interval, from the first deadline tick to finish, is what the deadline promises.
    // The loader finishes once per page, so a second measure would mean a double finish.
    const durations = await measureDurations(page, INTRO_MEASURE);
    expect(durations, `${INTRO_MEASURE} measures recorded`).toHaveLength(1);
    const [duration] = durations;
    testInfo.annotations.push({ type: 'stall-intro-ms', description: duration.toFixed(0) });
    expect(duration, 'a stalled scene must wait out the whole deadline').toBeGreaterThanOrEqual(LOAD_DEADLINE_MS);
    // Two slow frames of slack beyond the deadline and the reveal, for a throttled software renderer.
    expect(duration, 'the deadline, then the reveal, with nothing added').toBeLessThanOrEqual(LOAD_DEADLINE_MS + REVEAL_MS + 400);
    expect(await loadStateHistory(page), 'the stall reveals before it is ready').toEqual(['loading', 'reveal', 'ready']);

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

  test('a failed scene chunk keeps the page readable with the fallback', async ({ page }, testInfo) => {
    await recordLoadStates(page);
    const started = Date.now();
    await page.goto('/?scene=chunk-fail', { waitUntil: 'commit' });
    // Navigation, script execution, and the initial effects vary under shared-runner load (one public CI run
    // took over five seconds to reach the failure signal although every asset arrived within 130 ms), so the
    // wall time is only recorded.
    await waitForLoadState(page, ['failed'], 15_000);
    testInfo.annotations.push({ type: 'chunk-fail-elapsed-ms', description: String(Date.now() - started) });

    // The loader's own promise: a scene failure ends the intro as soon as it is reported, inside the deadline
    // rather than waiting it out, and goes straight to failed without a reveal.
    const durations = await measureDurations(page, INTRO_MEASURE);
    expect(durations, `${INTRO_MEASURE} measures recorded`).toHaveLength(1);
    const [duration] = durations;
    testInfo.annotations.push({ type: 'chunk-fail-intro-ms', description: duration.toFixed(0) });
    expect(duration, 'a failed scene ends the intro before the deadline, not at it').toBeLessThan(LOAD_DEADLINE_MS);
    expect(await loadStateHistory(page), 'the failure ends the intro directly').toEqual(['loading', 'failed']);

    await waitForRenderState(page, ['failed']);
    await expect(scene(page).locator('[data-testid="scene-fallback"]')).toBeVisible();
    await expect(intro(page)).toBeHidden();
    await expect(page.locator('h1#name')).toBeVisible();
    // The opening still fills the first viewport, and Hackathons is reachable by scrolling.
    const viewport = page.viewportSize() ?? { width: 0, height: 0 };
    const chapterTop = (await page.locator('section#hackathons').boundingBox())?.y ?? 0;
    expect(chapterTop, 'no chapter peeks into the first viewport').toBeGreaterThanOrEqual(viewport.height);
    await page.locator('#hackathons').evaluate((el) => el.scrollIntoView({ block: 'start', behavior: 'instant' }));
    await expectInViewport(page.locator('[data-testid="chapter-label-hackathons"]'));
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
