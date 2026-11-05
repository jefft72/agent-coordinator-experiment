/// <reference lib="dom" />
import { test, expect } from '@playwright/test';
import {
  collectConsoleErrors,
  expectCleanLog,
  gotoAndSettle,
  scrollThroughPage,
  skipUnlessProject,
  waitForRenderState,
} from './helpers';

const BASE_PATH = '/agent-coordinator-experiment/';
const ASSET_PATTERN = /\.(?:woff2?|ttf|otf|png|jpe?g|svg|webp|avif|gif)$/i;

test.use({ baseURL: `http://localhost:4174${BASE_PATH}` });

test.describe('project page base', () => {
  test('assets, fonts, and the scene resolve under the base path', async ({ page }, testInfo) => {
    skipUnlessProject(testInfo, 'desktop');
    const log = collectConsoleErrors(page);
    const requestedUrls: string[] = [];
    page.on('request', (request) => requestedUrls.push(request.url()));

    // Relative to the baseURL, so this lands on /agent-coordinator-experiment/?intro=skip.
    await gotoAndSettle(page, '?intro=skip');
    expect(new URL(page.url()).pathname).toBe(BASE_PATH);
    const renderState = await waitForRenderState(page, ['ready', 'fallback']);
    testInfo.annotations.push({ type: 'render-state', description: renderState });

    await scrollThroughPage(page);

    // The gallery shows one screenshot at a time; step through it so every image is requested.
    const next = page.locator('button[data-testid="gallery-uplate-next"]');
    await next.scrollIntoViewIfNeeded();
    await next.click();
    await next.click();

    const images = page.locator('img');
    const imageCount = await images.count();
    expect(imageCount, 'the page should render at least one image').toBeGreaterThan(0);
    for (let i = 0; i < imageCount; i += 1) {
      const image = images.nth(i);
      const src = await image.getAttribute('src');
      expect(src ?? '', `image src ${src} should start with ${BASE_PATH}`).toMatch(new RegExp(`^(?:https?://[^/]+)?${BASE_PATH.replace(/\//g, '\\/')}`));
      if (await image.isHidden()) continue;
      await image.scrollIntoViewIfNeeded().catch(() => undefined);
      await expect
        .poll(() => image.evaluate((node) => (node as HTMLImageElement).naturalWidth), {
          message: `image ${src} should decode`,
        })
        .toBeGreaterThan(0);
    }

    const fonts = await page.evaluate(async () => {
      const faces: FontFace[] = [];
      document.fonts.forEach((face) => {
        if (face.family.replace(/["']/g, '').startsWith('Archivo')) faces.push(face);
      });
      await Promise.allSettled(faces.map((face) => face.load()));
      return {
        faces: faces.map((face) => ({ family: face.family, weight: face.weight, status: face.status })),
        extraCondensedBlack: document.fonts.check("900 16px 'Archivo ExtraCondensed'"),
      };
    });
    expect(fonts.faces.length, 'Archivo faces should be registered').toBeGreaterThan(0);
    const unloaded = fonts.faces.filter((face) => face.status !== 'loaded');
    expect(unloaded, `Archivo faces that did not load: ${JSON.stringify(unloaded)}`).toEqual([]);
    expect(fonts.extraCondensedBlack, 'Archivo ExtraCondensed 900 should be available').toBe(true);

    const assetUrls = requestedUrls.filter((url) => ASSET_PATTERN.test(new URL(url).pathname));
    expect(assetUrls.some((url) => /\.woff2?$/i.test(new URL(url).pathname)), 'at least one font should be requested').toBe(true);
    expect(assetUrls.some((url) => /\.(?:png|jpe?g|svg|webp|avif|gif)$/i.test(new URL(url).pathname)), 'at least one image should be requested').toBe(true);
    const offBase = assetUrls.filter((url) => !new URL(url).pathname.startsWith(BASE_PATH));
    expect(offBase, 'asset requests outside the base path').toEqual([]);

    expectCleanLog(log);
  });
});
