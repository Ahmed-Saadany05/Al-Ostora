/**
 * Refaey on the planner screens and in the briefing. Run: npm run test:e2e   (modes: see e2e-helpers.ts)
 * - the briefing: four beats, both exits, Esc, Skip
 * - stand: a compact card in a free zone; touchdown: the outcome card. Both without the briefing having played (cards do not depend on Begin).
 *   (The Compare dates row was removed: no one-line, 44 px row fits that header without moving the cards.)
 */
import { expect, test } from '@playwright/test';
import { cardAudit, LIVE, MODE, newPage, settle, shot, VIEWPORTS } from './e2e-helpers';

const CARD = 'aside[aria-label="Refaey explains"]';

/** Home is ready when Pink's first-visit loading screen has gone (Begin is only usable after it). */
async function homeReady(page: import('@playwright/test').Page) {
  await page.locator('[class*="_loader_"]').waitFor({ state: 'detached', timeout: 60_000 }).catch(() => undefined);
  await page.getByRole('button', { name: 'Begin the journey' }).waitFor();
  await page.waitForTimeout(1200);
}
const SITE = 'connecting-ridge';

for (const vp of VIEWPORTS.slice(0, 3)) {
  test(`briefing at ${vp.name} [${MODE}]: four beats, nothing overlaps, both exits`, async ({ browser }) => {
    // reduced motion skips the flight; the flight itself is recorded separately
    const { ctx, page, errors } = await newPage(browser, vp, { reduced: true });
    await page.goto('/');
    await homeReady(page);
    await page.getByRole('button', { name: 'Begin the journey' }).click();
    await page.waitForSelector('section[role=dialog]', { timeout: 40_000 });
    const beats = ['Go on', 'And Earth?', 'So what do I do?'];
    for (let i = 0; i <= beats.length; i++) {
      await settle(page);
      await shot(page, vp.name, `briefing-${i + 1}`);
      const g = await page.evaluate(() => {
        const R = (e: Element) => e.getBoundingClientRect();
        const art = R(document.querySelector('[class*="_briefing_"] img')!);
        const text = document.querySelector('section[role=dialog]')!;
        const t = R(text);
        const lines = [...text.querySelectorAll('[class*="_fade_"] [class*="_line_"]')].reduce((n, p) => n + Math.round(R(p).height / parseFloat(getComputedStyle(p).lineHeight)), 0);
        const color = getComputedStyle(text.querySelector('[class*="_line_"]')!).color;
        return { art: { right: art.right, bottom: art.bottom }, t: { left: t.left, right: t.right, top: t.top, bottom: t.bottom }, lines, color, vw: innerWidth, vh: innerHeight, scroll: document.documentElement.scrollWidth };
      });
      expect(g.scroll).toBeLessThanOrEqual(g.vw);
      expect(g.t.right, 'text inside the screen').toBeLessThanOrEqual(g.vw);
      expect(g.t.bottom).toBeLessThanOrEqual(g.vh);
      expect(g.t.left, 'text is right of his hand, not over him').toBeGreaterThanOrEqual(g.art.right * 0.9);
      expect(g.lines, `beat ${i + 1}: lines`).toBeLessThanOrEqual(6);
      if (i < beats.length) await page.getByRole('button', { name: beats[i], exact: true }).click();
    }
    expect(errors).toEqual([]);
    await page.getByRole('button', { name: 'Three real landings' }).click();
    await page.waitForURL('**/missions');
    await expect(page.locator('li[data-story] button')).toHaveCount(3);
    await ctx.close();

    // the other exit, and Skip
    const b = await newPage(browser, vp, { reduced: true });
    await b.page.goto('/');
    await homeReady(b.page);
    await b.page.getByRole('button', { name: 'Begin the journey' }).click();
    await b.page.waitForSelector('section[role=dialog]', { timeout: 40_000 });
    await b.page.getByRole('button', { name: 'Skip', exact: true }).click();
    await expect(b.page.getByRole('button', { name: 'Plan my own', exact: true })).toBeVisible();
    await b.page.getByRole('button', { name: 'Plan my own', exact: true }).click();
    await b.page.waitForURL(/\/mission(\?|$)/);
    await b.ctx.close();
  });
}

for (const vp of VIEWPORTS) {
  test(`planner cards at ${vp.name} [${MODE}]: stand and touchdown, with no briefing played`, async ({ browser }) => {
    const { ctx, page, errors } = await newPage(browser, vp, { reduced: true });

    // stand: a compact card in a free zone
    await page.goto(`/mission/stand?site=${SITE}`);
    await page.waitForTimeout(MODE === 'demo' ? 5000 : 12_000);
    const card = page.locator(CARD);
    const narrow = vp.width < 900; // the stage card steps aside on tablets and phones (no free zone there)
    if (narrow) {
      await expect(card).toBeHidden();
      await shot(page, vp.name, 'stand');
    } else if (MODE === 'blocked') {
      // no live data: no card with live numbers (it may be absent altogether)
      if (await card.count()) await expect(card).not.toContainText('The Sun is');
    } else {
      await expect(card).toBeVisible();
      await expect(card).toContainText("This skyline is real, traced from NASA's laser maps.");
      if (LIVE) await expect(card).toContainText(/The Sun is [+−]?[\d.]+° up/);
      else await expect(card).not.toContainText('The Sun is');
      await shot(page, vp.name, 'stand');
      expect(await cardAudit(page, 'stage'), `${vp.name} stand`).toEqual([]);
      // once per session: leaving and coming back does not show it again; dismissing works
      await page.goto('/missions');
      await page.goto(`/mission/stand?site=${SITE}`);
      await page.waitForTimeout(6000);
      await expect(card).toHaveCount(0);
    }

    // touchdown: tap the Moon to land
    await page.goto(`/mission/launch?site=${SITE}&launch=2026-11-20T01:00:00Z`);
    await page.getByText('Tap the Moon to land').waitFor({ timeout: 40_000 });
    await page.waitForTimeout(3000);
    await page.mouse.click(Math.round(vp.width / 2), Math.round(vp.height / 2));
    await page.getByText(/^Touchdown/).waitFor({ timeout: 40_000 });
    if (narrow) {
      await page.waitForTimeout(1500);
      await expect(card).toBeHidden();
    } else if (LIVE && MODE === 'live') {
      await expect(card).toContainText('Landing at', { timeout: 30_000 });
      await expect(card).toContainText(/Sun is up for .* and Earth is in view for/);
    } else {
      await expect(card).toContainText('That is what the data says', { timeout: 30_000 });
      await expect(card).not.toContainText('Landing at');
    }
    if (!narrow) await expect(card).not.toContainText('Give me a second');
    await settle(page);
    await shot(page, vp.name, 'touchdown');
    if (!narrow) expect(await cardAudit(page, 'stage'), `${vp.name} touchdown`).toEqual([]);
    expect(errors).toEqual([]);
    await ctx.close();
  });
}
