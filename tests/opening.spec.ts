/// <reference lib="dom" />
import { test, expect } from '@playwright/test';
import { identity, nav, hackathonProjects } from '../src/content/site';
import {
  SETTLED_LOAD_STATES,
  SETTLED_RENDER_STATES,
  article,
  collectConsoleErrors,
  documentScrollWidth,
  expectAtLeastOne,
  expectCleanLog,
  expectInViewport,
  focusedHref,
  gotoAndSettle,
  htmlRoot,
  openingHeight,
  requireBox,
  scene,
  scrollThroughPage,
  scrollTo,
  shiftTabUntilHref,
  skipUnlessProject,
  waitForLoadState,
  waitForRenderState,
} from './helpers';

test.describe('opening', () => {
  test('name, identity, and nav are present, and the opening fills the first viewport with no chapter peek', async ({ page }) => {
    await gotoAndSettle(page, '/?intro=skip');
    await expect(htmlRoot(page)).toHaveAttribute('data-load-state', 'bypassed');

    await expect(page.locator('section#opening[data-testid="opening"]')).toBeVisible();
    await expect(page.locator('h1#name')).toHaveText('Jeffrey Tseng');

    const identityBlock = page.getByTestId('identity');
    for (const line of identity.lines) {
      await expect(identityBlock).toContainText(line);
    }

    const siteNav = page.locator('header[data-testid="site-header"] nav[data-testid="site-nav"]');
    for (const item of nav) {
      const link = siteNav.locator(`a[href="${item.href}"]`);
      await expect(link, `nav link ${item.href}`).toHaveCount(1);
      await expect(link).toHaveText(item.label);
    }

    // The first resting viewport belongs to the name: nothing of Hackathons shows until the reader scrolls.
    const viewport = page.viewportSize() ?? { width: 0, height: 0 };
    const rest = await page.evaluate(() => ({
      scrollY: window.scrollY,
      openingBottom: document.getElementById('opening')!.getBoundingClientRect().bottom,
      chapterTop: document.getElementById('hackathons')!.getBoundingClientRect().top,
      labelTop: document.querySelector('[data-testid="chapter-label-hackathons"]')!.getBoundingClientRect().top,
      nameBottom: document.getElementById('name')!.getBoundingClientRect().bottom,
    }));
    expect(rest.scrollY).toBe(0);
    expect(rest.openingBottom, 'the opening reaches the bottom of the viewport').toBeGreaterThanOrEqual(viewport.height);
    expect(rest.chapterTop, 'Hackathons starts below the first viewport').toBeGreaterThanOrEqual(viewport.height);
    expect(rest.labelTop, 'the Hackathons label is below the first viewport').toBeGreaterThanOrEqual(viewport.height);
    expect(rest.nameBottom, 'the name sits inside the first screen').toBeLessThanOrEqual(viewport.height);

    expect(hackathonProjects).toHaveLength(2);
    for (const project of hackathonProjects) {
      const spread = article(page, project.id);
      const award = project.award;
      expect(award, `${project.id} should carry an award`).toBeDefined();
      if (!award) continue;
      await expect(spread).toContainText(award.event);
      for (const { title } of award.titles) {
        await expect(spread).toContainText(title);
      }
      await expectAtLeastOne(spread.locator(`a[href="${award.proof.href}"]`), `${project.id} proof link ${award.proof.href}`);
    }
  });

  test('scene renders by default', async ({ page }, testInfo) => {
    await page.goto('/');
    const stage = scene(page);
    const canvas = stage.locator('[data-testid="scene-webgl"] canvas');
    if (testInfo.project.name === 'desktop') {
      await expect(stage).toHaveAttribute('data-render-state', 'ready', { timeout: 15_000 });
      await expect(canvas).toHaveCount(1);
      await expect(canvas).toBeVisible();
      return;
    }
    // Phones may legitimately use the compact fallback; either way the stage must settle and be consistent.
    const state = await waitForRenderState(page, ['ready', 'fallback']);
    testInfo.annotations.push({ type: 'render-state', description: state });
    if (state === 'ready') {
      await expect(canvas).toHaveCount(1);
      await expect(canvas).toBeVisible();
    } else {
      await expect(page.getByTestId('scene-fallback')).toBeVisible();
      await expect(canvas).toHaveCount(0);
    }
  });

  test('the scene never paints over readable content at any scroll position', async ({ page }, testInfo) => {
    await gotoAndSettle(page, '/?intro=skip');
    await waitForRenderState(page, SETTLED_RENDER_STATES);
    // The canvas ignores pointer events, so make it hit-testable: elementFromPoint follows paint order.
    await page.addStyleTag({ content: '[data-testid="scene"], [data-testid="scene"] * { pointer-events: auto !important; }' });
    const height = page.viewportSize()?.height ?? 900;
    const positions = [0, 0.2, 0.4, 0.6, 0.8, 1.0, 1.3, 2.2].map((f) => Math.round(f * height));
    for (const y of positions) {
      await scrollTo(page, y);
      await page.waitForTimeout(250);
      const covered = await page.evaluate(() => {
        const stage = document.querySelector('[data-testid="scene"]');
        const selectors = 'h1, h2, h3, h4, p, a, button, li, .opening__identity p';
        const hits: string[] = [];
        for (const el of Array.from(document.querySelectorAll<HTMLElement>(selectors))) {
          if (el.closest('[data-testid="intro"]')) continue;
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0 || r.bottom <= 0 || r.top >= innerHeight) continue;
          const x = Math.min(innerWidth - 1, Math.max(0, r.left + Math.min(r.width, 40) / 2));
          const cy = Math.min(innerHeight - 1, Math.max(0, r.top + r.height / 2));
          const top = document.elementFromPoint(x, cy);
          if (top && stage?.contains(top)) hits.push(`${el.tagName.toLowerCase()} "${(el.textContent ?? '').trim().slice(0, 24)}" at ${Math.round(cy)}`);
        }
        return hits;
      });
      expect(covered, `${testInfo.project.name}: scene paints over content at scrollY ${y}`).toEqual([]);
    }
  });

  test('?webgl=off renders the static poster of both letters without any canvas', async ({ page }) => {
    await page.goto('/?webgl=off&intro=skip');
    await expect(scene(page)).toHaveAttribute('data-render-state', 'fallback', { timeout: 15_000 });
    const fallback = page.getByTestId('scene-fallback');
    await expect(fallback).toBeVisible();
    await expect(fallback.locator('g[data-part="j"]')).toHaveCount(1);
    await expect(fallback.locator('g[data-part="t"]')).toHaveCount(1);
    await expect(fallback.locator('g[data-part] path')).toHaveCount(6);
    // The poster is projected at the real viewport size: measured on the front faces (the second path of each
    // letter, under the dark back and the bevel band), the J sits left of the T with a clear gap and both share the same lines.
    const parts = await fallback.locator('g[data-part]').evaluateAll((nodes) =>
      nodes.map((node) => {
        const r = node.querySelector('path:nth-of-type(2)')!.getBoundingClientRect();
        return { part: node.getAttribute('data-part'), left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height };
      }),
    );
    const j = parts.find((p) => p.part === 'j')!;
    const t = parts.find((p) => p.part === 't')!;
    expect(j.width).toBeGreaterThan(60);
    expect(t.width).toBeGreaterThan(60);
    expect(t.left - j.right, 'a visible gap separates the letters').toBeGreaterThan(Math.max(6, j.height * 0.03));
    expect(Math.abs(j.height - t.height) / j.height, 'the letters share their height').toBeLessThan(0.12);
    await expect(page.locator('canvas')).toHaveCount(0);
  });

  test('keyboard reaches the nav links in order and Enter on Hackathons scrolls to the heading', async ({ page }) => {
    await gotoAndSettle(page, '/?intro=skip');

    const expected: string[] = nav.map((item) => item.href);
    const reached: string[] = [];
    const seen: string[] = [];
    for (let i = 0; i < 16 && reached.length < expected.length; i += 1) {
      await page.keyboard.press('Tab');
      const href = await focusedHref(page);
      seen.push(href ?? `(${await page.evaluate(() => document.activeElement?.tagName ?? 'none')})`);
      if (href && expected.includes(href) && !reached.includes(href)) reached.push(href);
    }
    expect(reached, `tab sequence was: ${seen.join(' > ')}`).toEqual(expected);

    expect(await shiftTabUntilHref(page, '#hackathons'), 'Shift+Tab should return to the Hackathons link').toBe(true);
    await page.keyboard.press('Enter');
    await expectInViewport(page.locator('h2#hackathons-heading'));
  });

  test('desktop: the opening pins while Hackathons rises over it, then hides until the reader returns', async ({ page }, testInfo) => {
    skipUnlessProject(testInfo, 'desktop');
    await gotoAndSettle(page, '/?intro=skip');
    await waitForRenderState(page, SETTLED_RENDER_STATES);
    const end = await openingHeight(page);
    const viewport = page.viewportSize() ?? { width: 0, height: 0 };
    expect(end, 'the handoff distance is the full first viewport').toBe(viewport.height);

    await scrollTo(page, Math.round(end * 0.5));
    await page.waitForTimeout(250);
    await expect(htmlRoot(page)).toHaveAttribute('data-handoff', 'moving');
    const pinned = await requireBox(page.locator('section#opening'));
    expect(Math.round(pinned.y), 'the opening stays pinned at the top during the handoff').toBe(0);
    const chapterTop = (await requireBox(page.locator('section#hackathons'))).y;
    expect(chapterTop, 'the chapter has risen over the lower half of the opening').toBeLessThanOrEqual(viewport.height * 0.5);
    expect(chapterTop).toBeGreaterThan(0);
    await expect(scene(page)).toHaveAttribute('data-active', 'true');
    const handoff = Number(await page.evaluate(() => document.documentElement.style.getPropertyValue('--handoff')));
    expect(handoff).toBeGreaterThan(0.4);
    expect(handoff).toBeLessThan(0.6);
    const transform = await page.locator('h1#name').evaluate((el) => getComputedStyle(el).transform);
    expect(transform, 'the name recedes while the chapter rises').not.toBe('none');
    expect(await page.evaluate(() => document.documentElement.style.getPropertyValue('--handoff-px'))).toMatch(/^\d+px$/);

    // The identity plane stays ahead of the rising surface: at no point does the plum edge cut through the name.
    for (const fraction of [0.2, 0.35, 0.5, 0.7, 0.85]) {
      await scrollTo(page, Math.round(end * fraction));
      await page.waitForTimeout(150);
      const { nameBottom, nameOpacity, chapterTop } = await page.evaluate(() => ({
        nameBottom: document.querySelector('h1#name')!.getBoundingClientRect().bottom,
        nameOpacity: Number(getComputedStyle(document.querySelector('h1#name')!).opacity),
        chapterTop: document.querySelector('section#hackathons')!.getBoundingClientRect().top,
      }));
      if (nameOpacity > 0.05) expect(nameBottom, `at ${fraction} of the handoff the surface edge must stay below the name`).toBeLessThan(chapterTop);
    }
    const fold = Number(await page.evaluate(() => document.documentElement.style.getPropertyValue('--fold')));
    expect(fold, 'the letters have turned and travelled almost completely by 85% of the handoff').toBeGreaterThan(0.85);

    await scrollTo(page, end + 40);
    await page.waitForTimeout(350);
    await expect(htmlRoot(page)).toHaveAttribute('data-handoff', 'done');
    await expect(scene(page)).toHaveAttribute('data-active', 'false');
    expect(await page.locator('section#opening').evaluate((el) => getComputedStyle(el).visibility)).toBe('hidden');
    await expect(page.locator('h2#hackathons-heading')).toBeVisible();

    await scrollTo(page, 0);
    await page.waitForTimeout(350);
    await expect(htmlRoot(page)).toHaveAttribute('data-handoff', 'rest');
    await expect(scene(page)).toHaveAttribute('data-active', 'true');
    await expect(page.locator('h1#name')).toBeVisible();
  });

  test('desktop: reduced motion never pins or hides the opening and shows every chapter settled', async ({ page }, testInfo) => {
    skipUnlessProject(testInfo, 'desktop');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await gotoAndSettle(page, '/?intro=skip');
    await page.mouse.wheel(0, 400);
    await page.waitForTimeout(400);
    const opening = await page.locator('section#opening').evaluate((el) => ({
      position: getComputedStyle(el).position,
      top: el.getBoundingClientRect().top,
      visibility: getComputedStyle(el).visibility,
    }));
    expect(opening.position, 'the opening must not be sticky under reduced motion').not.toBe('sticky');
    expect(Math.round(opening.top)).toBe(-400);
    expect(opening.visibility).toBe('visible');
    await scrollTo(page, (await openingHeight(page)) + 600);
    await page.waitForTimeout(300);
    expect(await page.locator('section#opening').evaluate((el) => getComputedStyle(el).visibility)).toBe('visible');
    // No arrival or takeover is ever written, and every arriving element sits in place at full opacity.
    const motion = await page.evaluate(() => {
      const nodes = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal], [data-takeover], .arrive, .plane, .recedes, .spread__head, .spread__media'));
      return nodes
        .map((el) => ({
          tag: `${el.tagName.toLowerCase()}.${el.className.toString().split(' ')[0]}`,
          reveal: el.style.getPropertyValue('--reveal'),
          takeover: el.style.getPropertyValue('--takeover'),
          state: el.dataset.revealState ?? '',
          transform: getComputedStyle(el).transform,
          opacity: getComputedStyle(el).opacity,
          clip: getComputedStyle(el).clipPath,
        }))
        .filter((item) => item.reveal || item.takeover || item.state || !['none', 'matrix(1, 0, 0, 1, 0, 0)'].includes(item.transform) || item.opacity !== '1' || item.clip !== 'none');
    });
    expect(motion).toEqual([]);
  });

  test('desktop: the choreography follows a live change of the reduced-motion preference in both directions', async ({ page }, testInfo) => {
    skipUnlessProject(testInfo, 'desktop');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await gotoAndSettle(page, '/?intro=skip&webgl=off');
    const placeExperience = async () => {
      await page.evaluate(() => {
        const top = document.getElementById('experience')!.getBoundingClientRect().top + window.scrollY;
        window.scrollTo({ top: top - 700, behavior: 'instant' });
      });
      await page.waitForTimeout(200);
    };
    const read = () =>
      page.evaluate(() => ({
        takeover: document.getElementById('experience')!.style.getPropertyValue('--takeover'),
        title: getComputedStyle(document.getElementById('experience-heading')!).transform,
        written: document.querySelectorAll('[data-reveal][style*="--reveal"]').length,
        openingPosition: getComputedStyle(document.getElementById('opening')!).position,
      }));
    await placeExperience();
    let state = await read();
    expect(state.takeover).toBe('');
    expect(state.written).toBe(0);
    expect(state.title).toMatch(/^(none|matrix\(1, 0, 0, 1, 0, 0\))$/);
    expect(state.openingPosition).not.toBe('sticky');

    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await placeExperience();
    state = await read();
    expect(Number(state.takeover)).toBeGreaterThan(0);
    expect(Number(state.takeover)).toBeLessThan(1);
    expect(state.written).toBeGreaterThan(0);
    expect(state.title).not.toMatch(/^(none|matrix\(1, 0, 0, 1, 0, 0\))$/);
    expect(state.openingPosition).toBe('sticky');

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForTimeout(200);
    state = await read();
    expect(state.takeover).toBe('');
    expect(state.written).toBe(0);
    expect(state.title).toMatch(/^(none|matrix\(1, 0, 0, 1, 0, 0\))$/);
    expect(state.openingPosition).not.toBe('sticky');
  });

  test('desktop: tablet widths keep the employer headings on two lines inside the rail', async ({ page }, testInfo) => {
    skipUnlessProject(testInfo, 'desktop');
    await page.setViewportSize({ width: 820, height: 1100 });
    await gotoAndSettle(page, '/?intro=skip');
    await page.locator('#experience').evaluate((el) => el.scrollIntoView({ block: 'start', behavior: 'instant' }));
    await page.waitForTimeout(400);
    const headings = await page.locator('section#experience h3.project__title').evaluateAll((nodes) =>
      nodes.map((el) => {
        const r = el.getBoundingClientRect();
        const rail = el.parentElement!.getBoundingClientRect();
        return { text: el.textContent, height: r.height, lineHeight: Number.parseFloat(getComputedStyle(el).lineHeight), right: r.right, railRight: rail.right };
      }),
    );
    expect(headings.length).toBe(2);
    for (const heading of headings) {
      expect(heading.height, `"${heading.text}" should wrap to at most two lines`).toBeLessThanOrEqual(heading.lineHeight * 2 + 2);
      expect(heading.right, `"${heading.text}" overflows its rail`).toBeLessThanOrEqual(heading.railRight + 1);
    }
    expect(await documentScrollWidth(page)).toBeLessThanOrEqual(820);
  });

  test('phones: every destination fits inside the viewport and anchors clear the taller header', async ({ page }, testInfo) => {
    skipUnlessProject(testInfo, 'mobile', 'narrow');
    await gotoAndSettle(page, '/?intro=skip');
    const width = page.viewportSize()?.width ?? 0;
    const links = await page.locator('header[data-testid="site-header"] nav a').evaluateAll((nodes) =>
      nodes.map((el) => {
        const r = el.getBoundingClientRect();
        return { text: el.textContent, left: r.left, right: r.right, bottom: r.bottom };
      }),
    );
    expect(links.map((link) => link.text)).toEqual(nav.map((item) => item.label));
    for (const link of links) {
      expect(link.left, `${link.text} starts inside the viewport`).toBeGreaterThanOrEqual(0);
      expect(link.right, `${link.text} ends inside the viewport`).toBeLessThanOrEqual(width);
    }
    const header = await page.evaluate(() => {
      const el = document.querySelector('header[data-testid="site-header"]')!;
      return { height: el.getBoundingClientRect().height, clearance: Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-clearance')) };
    });
    expect(Math.max(...links.map((link) => link.bottom)), 'the last row of links sits inside the header').toBeLessThanOrEqual(header.height);
    expect(header.clearance, 'anchor clearance is derived from the real header height').toBeGreaterThanOrEqual(header.height);
  });

  test('phones: the opening scrolls away naturally instead of pinning', async ({ page }, testInfo) => {
    skipUnlessProject(testInfo, 'mobile', 'narrow');
    await gotoAndSettle(page, '/?intro=skip');
    await scrollTo(page, 200);
    await page.waitForTimeout(200);
    const box = await requireBox(page.locator('section#opening'));
    expect(Math.round(box.y)).toBe(-200);
    expect(await page.locator('h1#name').evaluate((el) => getComputedStyle(el).transform)).toBe('none');
  });

  test('default load and a full scroll produce no console errors or failed requests', async ({ page }, testInfo) => {
    skipUnlessProject(testInfo, 'desktop');
    const log = collectConsoleErrors(page);

    await page.goto('/');
    await waitForLoadState(page, SETTLED_LOAD_STATES);
    await waitForRenderState(page, SETTLED_RENDER_STATES);
    await page.evaluate(() => document.fonts.ready);
    await scrollThroughPage(page);
    await page.waitForTimeout(500);

    expectCleanLog(log);
  });

  test('no horizontal overflow at 320px', async ({ page }, testInfo) => {
    skipUnlessProject(testInfo, 'narrow');
    await gotoAndSettle(page, '/?intro=skip');
    expect(await documentScrollWidth(page), 'scroll width after load').toBeLessThanOrEqual(320);
    await scrollThroughPage(page);
    expect(await documentScrollWidth(page), 'scroll width after scrolling to the bottom').toBeLessThanOrEqual(320);
  });

  test('compact: the artwork is framed under the identity lines with a quiet lower margin', async ({ page }, testInfo) => {
    skipUnlessProject(testInfo, 'mobile', 'narrow');
    // The poster projects the same letters through the same camera, so its paths stand in for the WebGL silhouette.
    await gotoAndSettle(page, '/?intro=skip&webgl=off');
    await expect(scene(page)).toHaveAttribute('data-render-state', 'fallback');
    const identityBox = await requireBox(page.getByTestId('identity'));
    const viewport = page.viewportSize() ?? { width: 0, height: 0 };
    const art = await page.evaluate(() => {
      let left = Infinity;
      let top = Infinity;
      let right = -Infinity;
      let bottom = -Infinity;
      for (const path of Array.from(document.querySelectorAll('[data-testid="scene-fallback"] g[data-part] path'))) {
        const r = path.getBoundingClientRect();
        left = Math.min(left, r.left);
        top = Math.min(top, r.top);
        right = Math.max(right, r.right);
        bottom = Math.max(bottom, r.bottom);
      }
      return { left, top, right, bottom };
    });
    expect(art.top, 'the artwork starts below the identity lines').toBeGreaterThanOrEqual(identityBox.y + identityBox.height + 8);
    expect(art.bottom, 'a quiet margin stays under the artwork').toBeLessThanOrEqual(viewport.height - 40);
    expect(art.left).toBeGreaterThanOrEqual(0);
    expect(art.right).toBeLessThanOrEqual(viewport.width);
    const width = art.right - art.left;
    expect(width / viewport.width, 'the form reads within the content width').toBeGreaterThan(0.6);
    expect(width / viewport.width).toBeLessThan(0.92);
  });

  test('the opening fills the visible viewport at rest on short screens too', async ({ page }, testInfo) => {
    skipUnlessProject(testInfo, 'desktop');
    await page.setViewportSize({ width: 1366, height: 768 });
    await gotoAndSettle(page, '/?intro=skip');
    const rest = await page.evaluate(() => ({
      openingBottom: document.getElementById('opening')!.getBoundingClientRect().bottom,
      chapterTop: document.getElementById('hackathons')!.getBoundingClientRect().top,
      nameBottom: document.getElementById('name')!.getBoundingClientRect().bottom,
      identityBottom: document.querySelector('[data-testid="identity"]')!.getBoundingClientRect().bottom,
      nameTop: document.getElementById('name')!.getBoundingClientRect().top,
    }));
    expect(rest.openingBottom).toBeGreaterThanOrEqual(768);
    expect(rest.chapterTop).toBeGreaterThanOrEqual(768);
    expect(rest.nameBottom).toBeLessThanOrEqual(768);
    expect(rest.identityBottom, 'the lines stay above the name').toBeLessThan(rest.nameTop);
  });

  test('mobile: the name fits, Hackathons follows it, and both awards read in sequence', async ({ page }, testInfo) => {
    skipUnlessProject(testInfo, 'mobile');
    await gotoAndSettle(page, '/?intro=skip');

    const name = page.locator('h1#name');
    await expect(name).toBeVisible();
    const nameBox = await requireBox(name);
    expect(nameBox.width, 'h1#name width').toBeLessThan(390);

    const headingBox = await requireBox(page.locator('h2#hackathons-heading'));
    expect(headingBox.y, 'the Hackathons heading should sit below the name').toBeGreaterThanOrEqual(nameBox.y + nameBox.height);

    const spread = article(page, 'animalabs');
    await spread.scrollIntoViewIfNeeded();
    await expect(spread).toBeVisible();

    const award = hackathonProjects.find((project) => project.id === 'animalabs')?.award;
    expect(award).toBeDefined();
    if (!award) return;
    expect(award.titles.length).toBeGreaterThanOrEqual(2);

    let previousTop = Number.NEGATIVE_INFINITY;
    for (const { title } of award.titles) {
      const titleNode = spread.getByText(title).first();
      await titleNode.scrollIntoViewIfNeeded();
      await expect(titleNode, `award title "${title}"`).toBeVisible();
      const box = await requireBox(titleNode);
      expect(box.y, `"${title}" should follow the previous award`).toBeGreaterThanOrEqual(previousTop);
      previousTop = box.y;
    }
    // Single column: the media follows the award and the controls follow the media.
    const media = await requireBox(spread.locator('img').first());
    const controls = await requireBox(spread.locator('[role="tablist"]'));
    expect(media.y).toBeGreaterThan(previousTop);
    expect(controls.y).toBeGreaterThan(media.y + media.height - 1);
  });
});
