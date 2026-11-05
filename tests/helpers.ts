/// <reference lib="dom" />
import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';

export type LoadState = 'loading' | 'reveal' | 'ready' | 'bypassed' | 'failed';
export type RenderState = 'ready' | 'fallback' | 'failed';

export const SETTLED_LOAD_STATES: readonly LoadState[] = ['ready', 'bypassed', 'failed'];
export const SETTLED_RENDER_STATES: readonly RenderState[] = ['ready', 'fallback', 'failed'];

export const INTRO_STORAGE_KEY = 'jt:intro';

/** Patterns that must never appear in rendered copy. */
export const FORBIDDEN_TEXT = {
  staleDates: /\bgraduat(?:ion|ing)\b|\bexpected\b/i,
  phone: /(?:\+1[ .-]?)?\(?\b\d{3}\)?[ .-]\d{3}[ .-]\d{4}\b/,
  emDash: /—/,
  inflatedClaims: /\b(grand prize|overall winner|first place|1st place)\b/i,
} as const;

export function stateRegex(states: readonly string[]): RegExp {
  return new RegExp(`^(${states.join('|')})$`);
}

export function htmlRoot(page: Page): Locator {
  return page.locator('html');
}

export function scene(page: Page): Locator {
  return page.getByTestId('scene');
}

export function intro(page: Page): Locator {
  return page.getByTestId('intro');
}

export function skipIntroButton(page: Page): Locator {
  return page.locator('button[data-testid="skip-intro"]');
}

export function article(page: Page, id: string): Locator {
  return page.locator(`article[data-testid="project-${id}"]`);
}

export function detailsButton(page: Page, id: string): Locator {
  return page.locator(`button[data-testid="details-${id}"]`);
}

export function detailsDialog(page: Page): Locator {
  return page.locator('dialog[data-testid="project-details"]');
}

/** Skips the current test unless it runs in the named project. */
export function skipUnlessProject(testInfo: TestInfo, ...names: string[]): void {
  test.skip(!names.includes(testInfo.project.name), `${names.join(' or ')} project only`);
}

/** Waits for html[data-load-state] to settle on one of the given states and returns it. */
export async function waitForLoadState(
  page: Page,
  states: readonly LoadState[],
  timeout = 15_000,
): Promise<LoadState> {
  await expect(htmlRoot(page)).toHaveAttribute('data-load-state', stateRegex(states), { timeout });
  return (await htmlRoot(page).getAttribute('data-load-state')) as LoadState;
}

/** Waits for [data-testid="scene"][data-render-state] to settle on one of the given states. */
export async function waitForRenderState(
  page: Page,
  states: readonly RenderState[],
  timeout = 15_000,
): Promise<RenderState> {
  await expect(scene(page)).toHaveAttribute('data-render-state', stateRegex(states), { timeout });
  return (await scene(page).getAttribute('data-render-state')) as RenderState;
}

/** Returns the first value of html[data-load-state] observed after navigation. */
export async function firstLoadState(page: Page, timeout = 10_000): Promise<string> {
  const handle = await page.waitForFunction(
    () => document.documentElement.dataset.loadState ?? null,
    undefined,
    { polling: 'raf', timeout },
  );
  const value = await handle.jsonValue();
  await handle.dispose();
  return String(value);
}

/** Navigates, waits for the loader to settle, and waits for web fonts. */
export async function gotoAndSettle(page: Page, path: string, timeout = 15_000): Promise<LoadState> {
  await page.goto(path);
  const state = await waitForLoadState(page, SETTLED_LOAD_STATES, timeout);
  await page.evaluate(() => document.fonts.ready);
  return state;
}

export interface ConsoleLog {
  consoleErrors: string[];
  pageErrors: string[];
  failedRequests: string[];
}

/** Records console errors, uncaught page errors, and failed network requests. Nothing is filtered. */
export function collectConsoleErrors(page: Page): ConsoleLog {
  const log: ConsoleLog = { consoleErrors: [], pageErrors: [], failedRequests: [] };
  page.on('console', (message) => {
    if (message.type() === 'error') log.consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => log.pageErrors.push(error.message));
  page.on('response', (response) => {
    if (response.status() >= 400) log.failedRequests.push(`${response.status()} ${response.url()}`);
  });
  page.on('requestfailed', (request) => {
    log.failedRequests.push(`failed ${request.url()} (${request.failure()?.errorText ?? 'unknown'})`);
  });
  return log;
}

export function expectCleanLog(log: ConsoleLog): void {
  expect(log.pageErrors, `uncaught page errors:\n${log.pageErrors.join('\n')}`).toEqual([]);
  expect(log.consoleErrors, `console errors:\n${log.consoleErrors.join('\n')}`).toEqual([]);
  expect(log.failedRequests, `failed requests:\n${log.failedRequests.join('\n')}`).toEqual([]);
}

/** Resolves the bounding box or fails with the selector in the message. */
export async function requireBox(locator: Locator): Promise<{ x: number; y: number; width: number; height: number }> {
  const box = await locator.boundingBox();
  expect(box, `${locator.toString()} has no bounding box`).not.toBeNull();
  return box as { x: number; y: number; width: number; height: number };
}

/**
 * Asserts the element's top edge lies inside the viewport. Polls so smooth
 * scrolling and layout settling cannot make it flaky.
 */
export async function expectInViewport(locator: Locator, viewportHeight?: number): Promise<void> {
  const page = locator.page();
  const height = viewportHeight ?? page.viewportSize()?.height ?? 0;
  await expect
    .poll(
      async () => {
        const box = await locator.boundingBox();
        if (!box) return 'no bounding box';
        if (box.y < -1) return `top ${Math.round(box.y)} is above the viewport`;
        if (box.y >= height) return `top ${Math.round(box.y)} is below the ${height}px viewport`;
        return 'in viewport';
      },
      { message: `${locator.toString()} should be within the viewport` },
    )
    .toBe('in viewport');
}

export async function expectAtLeastOne(locator: Locator, description?: string): Promise<void> {
  await expect
    .poll(() => locator.count(), { message: description ?? `${locator.toString()} should exist` })
    .toBeGreaterThan(0);
}

/** Scrolls through the whole document in viewport-sized steps and ends at the bottom. */
export async function scrollThroughPage(page: Page, pause = 120): Promise<void> {
  await page.evaluate(async (pauseMs) => {
    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const step = Math.max(200, Math.floor(window.innerHeight * 0.8));
    let previous = -1;
    for (let i = 0; i < 200 && window.scrollY !== previous; i += 1) {
      previous = window.scrollY;
      window.scrollBy({ top: step, behavior: 'instant' });
      await sleep(pauseMs);
    }
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' });
    await sleep(pauseMs);
  }, pause);
}

export async function scrollToTop(page: Page): Promise<void> {
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
}

export function documentScrollWidth(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth);
}

export function focusedHref(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const active = document.activeElement;
    return active instanceof HTMLAnchorElement ? active.getAttribute('href') : null;
  });
}

/** Presses Tab until the locator is focused. Returns false when the budget runs out. */
export async function tabUntilFocused(page: Page, locator: Locator, maxTabs = 12): Promise<boolean> {
  for (let i = 0; i < maxTabs; i += 1) {
    await page.keyboard.press('Tab');
    if (await locator.evaluate((el) => el === document.activeElement)) return true;
  }
  return false;
}

/** Presses Shift+Tab until the focused anchor has the given href. */
export async function shiftTabUntilHref(page: Page, href: string, maxTabs = 12): Promise<boolean> {
  for (let i = 0; i < maxTabs; i += 1) {
    if ((await focusedHref(page)) === href) return true;
    await page.keyboard.press('Shift+Tab');
  }
  return (await focusedHref(page)) === href;
}
