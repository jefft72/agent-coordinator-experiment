/// <reference lib="dom" />
import path from 'node:path';
import { test, expect, type Page } from '@playwright/test';

const OUT_DIR = path.resolve(process.cwd(), '.context');
const SETTLED = /^(ready|fallback)$/;

function shot(name: string) {
  return path.join(OUT_DIR, `${name}.png`);
}

async function settle(page: Page) {
  await expect(page.getByTestId('sheet')).toHaveAttribute('data-render-state', SETTLED, { timeout: 8_000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1_200);
}

test.describe('opening screenshots', () => {
  test.setTimeout(90_000);

  test('rest pose', async ({ page }, testInfo) => {
    const project = testInfo.project.name;
    await page.goto('/');
    await settle(page);
    await page.screenshot({ path: shot(`opening-${project}`), fullPage: false });
    await page.screenshot({ path: shot(`opening-${project}-full`), fullPage: true });
  });

  test('desktop: selected OpenCraft and the fallback', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'desktop project only');
    await page.goto('/');
    await settle(page);
    await page.getByTestId('index-opencraft').click();
    await expect(page.getByTestId('sheet')).toHaveAttribute('data-selected', 'opencraft');
    await page.waitForTimeout(1_200);
    await page.screenshot({ path: shot('opening-desktop-selected-opencraft'), fullPage: false });

    await page.goto('/?webgl=off');
    await settle(page);
    await expect(page.getByTestId('sheet-fallback')).toBeVisible();
    await page.screenshot({ path: shot('opening-desktop-fallback'), fullPage: false });
  });

  test('mobile: the fallback', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'mobile project only');
    await page.goto('/?webgl=off');
    await settle(page);
    await expect(page.getByTestId('sheet-fallback')).toBeVisible();
    await page.screenshot({ path: shot('opening-mobile-fallback'), fullPage: false });
  });
});
