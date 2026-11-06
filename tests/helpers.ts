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

export function chapter(page: Page, id: string): Locator {
  return page.locator(`section[data-testid="chapter-${id}"]`);
}

export function contributionTab(page: Page, project: string, id: string): Locator {
  return page.locator(`button[data-testid="contribution-${project}-${id}"]`);
}

export function contributionPanel(page: Page, project: string): Locator {
  return page.locator(`[data-testid="contribution-panel-${project}"]`);
}

export function flowStep(page: Page, project: string, id: string): Locator {
  return page.locator(`[data-testid="flow-step-${project}-${id}"]`);
}

/** The height of the opening, which is also the scroll distance of the handoff. */
export function openingHeight(page: Page): Promise<number> {
  return page.evaluate(() => document.getElementById('opening')?.offsetHeight ?? 0);
}

export async function scrollTo(page: Page, top: number): Promise<void> {
  await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), top);
}

/** WCAG contrast ratio between two CSS rgb()/rgba() colours; an alpha below 1 is treated as opaque for a conservative check. */
export function contrastRatio(foreground: string, background: string): number {
  const channel = (value: number) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  const luminance = (color: string) => {
    const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (!match) throw new Error(`unparsable colour ${color}`);
    return 0.2126 * channel(Number(match[1])) + 0.7152 * channel(Number(match[2])) + 0.0722 * channel(Number(match[3]));
  };
  const a = luminance(foreground);
  const b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/**
 * Contrast of text as it is actually seen: the colour's alpha and the element's
 * opacity are composited over the background before the ratio is measured.
 */
export function compositedContrast(foreground: string, background: string, opacity = 1): number {
  const parse = (color: string) => {
    const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/);
    if (!match) throw new Error(`unparsable colour ${color}`);
    return { rgb: [Number(match[1]), Number(match[2]), Number(match[3])], alpha: match[4] === undefined ? 1 : Number(match[4]) };
  };
  const text = parse(foreground);
  const field = parse(background);
  const coverage = text.alpha * opacity;
  const seen = text.rgb.map((channel, i) => Math.round(channel * coverage + field.rgb[i] * (1 - coverage)));
  return contrastRatio(`rgb(${seen.join(', ')})`, `rgb(${field.rgb.join(', ')})`);
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

/**
 * Asserts that the heading of the section `#id` has been scrolled into place:
 * below the fixed header and near it, unless the document cannot scroll any
 * further, in which case the heading must at least be fully inside the
 * viewport. Polls because smooth scrolling may still be in flight.
 */
export async function expectAnchorPlaced(page: Page, id: string): Promise<void> {
  const header = page.locator('header[data-testid="site-header"]');
  const headerBox = await requireBox(header);
  const headerBottom = headerBox.y + headerBox.height;
  const viewportHeight = page.viewportSize()?.height ?? 0;
  const heading = page.locator(`#${id} h2, #${id} h3`).first();
  await expect
    .poll(
      async () => {
        const box = await heading.boundingBox();
        if (!box) return 'no box';
        const atBottom = await page.evaluate(
          () => Math.ceil(window.scrollY + window.innerHeight) >= document.documentElement.scrollHeight - 1,
        );
        if (box.y < headerBottom - 1) return `top ${Math.round(box.y)} is under the ${Math.round(headerBottom)}px header`;
        if (box.y + box.height > viewportHeight) return `bottom ${Math.round(box.y + box.height)} is below the viewport`;
        if (!atBottom && box.y > headerBottom + 120) return `top ${Math.round(box.y)} is far below the header at scrollY ${await page.evaluate(() => window.scrollY)}`;
        return 'placed';
      },
      { message: `#${id} heading placement`, timeout: 8_000 },
    )
    .toBe('placed');
}

/** Resolves once window.scrollY has not changed for `quiet` milliseconds. */
export async function waitForScrollIdle(page: Page, quiet = 300, timeout = 8_000): Promise<void> {
  await page.evaluate(
    ({ quiet, timeout }) =>
      new Promise<void>((resolve) => {
        const started = performance.now();
        let last = window.scrollY;
        let since = performance.now();
        const tick = () => {
          const now = performance.now();
          if (window.scrollY !== last) {
            last = window.scrollY;
            since = now;
          }
          if (now - since >= quiet || now - started >= timeout) resolve();
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
    { quiet, timeout },
  );
}
