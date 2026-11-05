/// <reference lib="dom" />
import { test, expect, type Locator, type Page } from '@playwright/test';
import { projects, projectById } from '../src/content/site';
import { article, detailsButton, detailsDialog, gotoAndSettle, requireBox, skipUnlessProject } from './helpers';

function stage(page: Page): Locator {
  return page.locator('[data-testid="project-stage"]');
}

function stageView(page: Page): Locator {
  return page.locator('[data-testid="stage-view"]');
}

/** Opens the details for a project and, on compact layouts, opens the collapsed stage. */
async function openStage(page: Page, id: string) {
  const opener = detailsButton(page, id);
  await opener.scrollIntoViewIfNeeded();
  await opener.click();
  await expect(detailsDialog(page)).toBeVisible();
  const toggle = page.locator('[data-testid="stage-open"]');
  if (await toggle.count()) await toggle.click();
  await expect(stageView(page)).toBeVisible();
}

/**
 * A short fingerprint of the stage picture: the WebGL canvas keeps its drawing
 * buffer so it can be read back, the SVG serialises. Hashed so assertion
 * messages stay readable.
 */
async function picture(page: Page): Promise<string> {
  return stageView(page).evaluate(async (view) => {
    const canvas = view.querySelector('canvas');
    const source = canvas ? canvas.toDataURL() : (view.querySelector('svg')?.outerHTML ?? '');
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(source));
    return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
  });
}

/** Waits until two pictures `quiet` ms apart agree, then returns that picture. */
async function settledPicture(page: Page, quiet = 350): Promise<string> {
  let previous = await picture(page);
  for (let i = 0; i < 24; i += 1) {
    await page.waitForTimeout(quiet);
    const next = await picture(page);
    if (next === previous) return next;
    previous = next;
  }
  throw new Error('the stage picture did not settle');
}

async function setPhase(page: Page, percent: number) {
  await page.locator('[data-testid="stage-phase"]').fill(String(percent));
}

async function closeDetails(page: Page) {
  await page.keyboard.press('Escape');
  await expect(detailsDialog(page)).toBeHidden();
}

test.describe('project stage', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    skipUnlessProject(testInfo, 'desktop', 'mobile');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await gotoAndSettle(page, '/?intro=skip');
  });

  test('the stage plays the pattern on open, holds at the end, and suspends the opening scene', async ({ page }) => {
    await expect(page.locator('html')).toHaveAttribute('data-scene-suspended', 'false');
    await openStage(page, 'animalabs');
    await expect(stage(page)).toHaveAttribute('data-renderer', 'webgl');
    await expect(page.locator('html')).toHaveAttribute('data-scene-suspended', 'true');
    await expect(stage(page)).toHaveAttribute('data-mode', 'playing');
    const early = await picture(page);
    await expect(stage(page)).toHaveAttribute('data-mode', 'paused', { timeout: 12_000 });
    await expect(stage(page)).toHaveAttribute('data-phase', '1.00');
    const end = await picture(page);
    expect(end, 'the surface should have moved during playback').not.toBe(early);
    await closeDetails(page);
    await expect(page.locator('html')).toHaveAttribute('data-scene-suspended', 'false');
  });

  test('the stage is a substantial picture with readable facts beside it', async ({ page }, testInfo) => {
    await openStage(page, 'opencraft');
    const box = await requireBox(stageView(page));
    if (testInfo.project.name === 'mobile') {
      expect(box.height).toBeGreaterThanOrEqual(220);
      expect(box.height).toBeLessThanOrEqual(260);
    } else {
      expect(box.height).toBeGreaterThanOrEqual(360);
      expect(box.height).toBeLessThanOrEqual(440);
    }
    expect(box.width).toBeGreaterThan(300);
    const dialog = detailsDialog(page);
    await expect(dialog).toContainText('Abstract study');
    await expect(dialog).toContainText(projectById.opencraft.study);
    await expect(dialog).not.toContainText('Not a recording');
    for (const sentence of projectById.opencraft.details) await expect(dialog).toContainText(sentence);
    await closeDetails(page);
  });

  test('every project shows its own pattern, and Reset returns to the shared rest pose', async ({ page }) => {
    const ends = new Map<string, string>();
    let rest: string | null = null;
    for (const project of projects) {
      await openStage(page, project.id);
      await page.locator('[data-testid="stage-reset"]').click();
      await expect(stage(page)).toHaveAttribute('data-mode', 'rest');
      const atRest = await settledPicture(page);
      if (rest === null) rest = atRest;
      else expect(atRest, `${project.id}: the rest pose should be the same sculpture`).toBe(rest);

      await setPhase(page, 100);
      await expect(stage(page)).toHaveAttribute('data-mode', 'paused');
      await expect(stage(page)).toHaveAttribute('data-phase', '1.00');
      const end = await settledPicture(page);
      expect(end, `${project.id}: phase 1 should differ from rest`).not.toBe(rest);
      for (const [other, image] of ends) {
        expect(end, `${project.id} and ${other} should not look alike at phase 1`).not.toBe(image);
      }
      ends.set(project.id, end);
      await closeDetails(page);
    }
    expect(ends.size).toBe(projects.length);
  });

  test('the phase slider inspects a static phase from the keyboard and Replay restarts', async ({ page }) => {
    await openStage(page, 'diffex');
    await expect(stage(page)).toHaveAttribute('data-mode', 'paused', { timeout: 12_000 });
    const slider = page.locator('[data-testid="stage-phase"]');
    await slider.focus();
    await page.keyboard.press('Home');
    await expect(stage(page)).toHaveAttribute('data-phase', '0.00');
    const start = await settledPicture(page);
    for (let i = 0; i < 10; i += 1) await page.keyboard.press('ArrowRight');
    await expect(stage(page)).toHaveAttribute('data-phase', '0.10');
    await expect(stage(page)).toHaveAttribute('data-mode', 'paused');
    const stepped = await settledPicture(page);
    expect(stepped, 'ten steps of the slider should change the picture').not.toBe(start);

    await page.locator('[data-testid="stage-replay"]').focus();
    await page.keyboard.press('Enter');
    await expect(stage(page)).toHaveAttribute('data-mode', 'playing');
    await expect(stage(page)).toHaveAttribute('data-mode', 'paused', { timeout: 12_000 });
    await closeDetails(page);
  });

  test('reduced motion exposes the phases as immediate states without continuous movement', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await gotoAndSettle(page, '/?intro=skip');
    await openStage(page, 'judi');
    await expect(stage(page)).toHaveAttribute('data-mode', 'paused');
    await expect(stage(page)).toHaveAttribute('data-phase', '1.00');
    const end = await settledPicture(page);
    await page.waitForTimeout(600);
    expect(await picture(page), 'nothing should move under reduced motion').toBe(end);
    await setPhase(page, 0);
    const start = await settledPicture(page, 150);
    expect(start).not.toBe(end);
    await page.locator('[data-testid="stage-replay"]').click();
    await expect(stage(page)).toHaveAttribute('data-mode', 'paused');
    await expect(stage(page)).toHaveAttribute('data-phase', '1.00');
    await closeDetails(page);
  });

  test('a live reduced-motion change during playback jumps to the end state', async ({ page }) => {
    await openStage(page, 'uplate');
    await expect(stage(page)).toHaveAttribute('data-mode', 'playing');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(stage(page)).toHaveAttribute('data-mode', 'paused', { timeout: 2_000 });
    await expect(stage(page)).toHaveAttribute('data-phase', '1.00');
    await closeDetails(page);
  });

  test('without WebGL the stage is a static study whose controls change it immediately', async ({ page }) => {
    await gotoAndSettle(page, '/?intro=skip&webgl=off');
    await openStage(page, 'rtx');
    await expect(stage(page)).toHaveAttribute('data-renderer', 'svg');
    await expect(stage(page)).toHaveAttribute('data-mode', 'paused');
    await expect(stage(page)).toHaveAttribute('data-phase', '1.00');
    const fallback = page.locator('[data-testid="stage-fallback"]');
    await expect
      .poll(() => fallback.locator('polygon').count(), { message: 'the study should draw the blades' })
      .toBeGreaterThanOrEqual(50);
    const end = await picture(page);
    await setPhase(page, 50);
    expect(await picture(page)).not.toBe(end);
    await page.locator('[data-testid="stage-reset"]').click();
    await expect(stage(page)).toHaveAttribute('data-mode', 'rest');
    expect(await picture(page)).not.toBe(end);
    await closeDetails(page);
  });

  test('a hidden tab pauses the timeline with its phase kept, and it resumes when shown', async ({ page }) => {
    await openStage(page, 'animalabs');
    await expect(stage(page)).toHaveAttribute('data-mode', 'playing');
    await page.waitForTimeout(1_200);
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.waitForTimeout(300);
    const held = await stage(page).getAttribute('data-phase');
    expect(Number(held)).toBeGreaterThan(0);
    expect(Number(held)).toBeLessThan(1);
    await page.waitForTimeout(900);
    expect(await stage(page).getAttribute('data-phase'), 'the phase should hold while hidden').toBe(held);
    await expect(stage(page)).toHaveAttribute('data-mode', 'playing');
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await expect.poll(() => stage(page).getAttribute('data-phase').then(Number)).toBeGreaterThan(Number(held));
    await expect(stage(page)).toHaveAttribute('data-mode', 'paused', { timeout: 12_000 });
    await closeDetails(page);
  });

  test('scrolling the stage out of the dialog pauses the timeline, and it resumes when scrolled back', async ({ page }) => {
    await openStage(page, 'animalabs');
    await expect(stage(page)).toHaveAttribute('data-mode', 'playing');
    await expect(stage(page)).toHaveAttribute('data-visible', 'true');
    await page.waitForTimeout(800);
    const inner = detailsDialog(page).locator('.details__inner');
    await inner.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
    await expect(stage(page)).toHaveAttribute('data-visible', 'false');
    await page.waitForTimeout(200);
    const held = await stage(page).getAttribute('data-phase');
    expect(Number(held)).toBeGreaterThan(0);
    expect(Number(held)).toBeLessThan(1);
    await page.waitForTimeout(900);
    expect(await stage(page).getAttribute('data-phase'), 'the phase should hold while the stage is offscreen').toBe(held);
    await inner.evaluate((el) => {
      el.scrollTop = 0;
    });
    await expect(stage(page)).toHaveAttribute('data-visible', 'true');
    await expect.poll(() => stage(page).getAttribute('data-phase').then(Number)).toBeGreaterThan(Number(held));
    await closeDetails(page);
  });

  test('mobile: the stage opens from an explicit control, starts when opened, works by touch, and hides again', async ({ page }, testInfo) => {
    skipUnlessProject(testInfo, 'mobile');
    const opener = detailsButton(page, 'animalabs');
    await opener.scrollIntoViewIfNeeded();
    await opener.tap();
    await expect(detailsDialog(page)).toBeVisible();
    await expect(stage(page)).toHaveAttribute('data-open', 'false');
    await expect(stageView(page)).toHaveCount(0);
    // Collapsed, the timeline must not run: the study starts when it is opened.
    await page.waitForTimeout(1_500);
    await expect(stage(page)).toHaveAttribute('data-phase', '0.00');
    await page.locator('[data-testid="stage-open"]').tap();
    await expect(stage(page)).toHaveAttribute('data-open', 'true');
    await expect(stageView(page)).toBeVisible();
    await expect.poll(() => stage(page).getAttribute('data-phase').then(Number)).toBeGreaterThan(0);
    await page.locator('[data-testid="stage-replay"]').tap();
    await expect(stage(page)).toHaveAttribute('data-mode', 'playing');
    await page.locator('[data-testid="stage-reset"]').tap();
    await expect(stage(page)).toHaveAttribute('data-mode', 'rest');
    await page.locator('[data-testid="stage-close"]').tap();
    await expect(stageView(page)).toHaveCount(0);
    await closeDetails(page);
    await expect(article(page, 'animalabs')).toBeVisible();
  });
});
