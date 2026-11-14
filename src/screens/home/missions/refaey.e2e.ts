/**
 * Refaey in the briefing and on the planner screens. Run: npm run test:e2e   (modes: see e2e-helpers.ts)
 * - the briefing: every beat of every branch (from the script data), callsign pick, Skip, source card, explainer, every exit
 * - Stand: a compact card in a free zone (from Compare dates it opens with "My old window is gone."); touchdown: the ending
 * - the introduction for someone who skipped the briefing
 */
import { expect, test, type Page } from '@playwright/test';
import { cardAudit, LIVE, MODE, newPage, settle, shot, VIEWPORTS } from './e2e-helpers';
import { BRIEFING } from './story-model';

const CARD = 'aside[aria-label="Refaey explains"]';
const SITE = 'connecting-ridge';
const FUTURE = '2026-11-20T01:00:00Z'; // a moment inside the plan's window, as Compare dates links carry
const click = (page: Page, name: string) => page.getByRole('button', { name, exact: true }).click();
/** What Refaey is saying right now (the visible beat, not the hidden copy used to count lines). */
const said = (page: Page, text: RegExp) => page.locator('section[role=dialog] [class*="_fade_"]').filter({ hasText: text });

/** Home is ready when Pink's first-visit loading screen has gone (Begin is only usable after it). */
async function homeReady(page: Page) {
  await page.locator('[class*="_loader_"]').waitFor({ state: 'detached', timeout: 60_000 }).catch(() => undefined);
  await page.getByRole('button', { name: 'Begin the journey' }).waitFor();
  await page.waitForTimeout(1200);
}
async function startBriefing(page: Page) {
  await page.goto('/');
  await homeReady(page);
  await page.getByRole('button', { name: 'Begin the journey' }).click();
  await page.waitForSelector('section[role=dialog]', { timeout: 40_000 });
  await settle(page);
}
/** Click through a path of reply labels. */
async function follow(page: Page, clicks: string[]) {
  for (const c of clicks) await click(page, c);
  await settle(page);
}

for (const vp of VIEWPORTS.slice(0, 3)) {
  test(`briefing at ${vp.name} [${MODE}]: every beat of every branch, nothing overlaps`, async ({ browser }) => {
    // reduced motion skips the flight; the flight itself is recorded separately
    const { ctx, page, errors } = await newPage(browser, vp, { reduced: true });
    for (const beat of BRIEFING(LIVE)) {
      await page.goto('/');
      await startBriefing(page);
      await follow(page, beat.clicks);
      await shot(page, vp.name, `briefing-${beat.id}`);
      const g = await page.evaluate(() => {
        const R = (e: Element) => e.getBoundingClientRect();
        const art = R(document.querySelector('[class*="_briefing_"] [class*="_actor_"]')!);
        const text = document.querySelector('section[role=dialog]')!;
        const t = R(text);
        const lines = [...text.querySelectorAll('[class*="_fade_"] [class*="_line_"]')].reduce((n, p) => n + Math.round(R(p).height / parseFloat(getComputedStyle(p).lineHeight)), 0);
        return { art: { right: art.right }, t: { left: t.left, right: t.right, top: t.top, bottom: t.bottom }, lines, vw: innerWidth, vh: innerHeight, scroll: document.documentElement.scrollWidth };
      });
      expect(g.scroll, beat.id).toBeLessThanOrEqual(g.vw);
      expect(g.t.right, `${beat.id}: text inside the screen`).toBeLessThanOrEqual(g.vw);
      expect(g.t.bottom, beat.id).toBeLessThanOrEqual(g.vh);
      expect(g.t.top, beat.id).toBeGreaterThanOrEqual(0);
      expect(g.t.left, `${beat.id}: text is right of him, not over him`).toBeGreaterThanOrEqual(g.art.right * 0.9);
      expect(g.lines, `${beat.id}: lines`).toBeLessThanOrEqual(6);
    }
    expect(errors).toEqual([]);
    await ctx.close();
  });

  test(`briefing at ${vp.name} [${MODE}]: callsign, Skip, source card, explainer, and every exit`, async ({ browser }) => {
    // 1. a source card, an explainer, the callsign; the callsign carries to /missions
    let b = await newPage(browser, vp, { reduced: true });
    await startBriefing(b.page);
    await follow(b.page, ['Supposed to?', 'So we pick a new one?', "What's the catch?"]);
    const b4 = await b.page.locator('section[role=dialog]').innerText();
    await click(b.page, 'How do you know?');
    await expect(b.page.locator('section[role=dialog]').filter({ hasText: /Shadows near the Moon’s South Pole/ })).toBeVisible();
    const link = b.page.getByRole('link', { name: /Open the source/ });
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('href', /science\.nasa\.gov/);
    await shot(b.page, vp.name, 'briefing-source-card');
    await click(b.page, 'Back');
    expect(await b.page.locator('section[role=dialog]').innerText(), 'Back returns to b4').toBe(b4);
    await click(b.page, 'That low?');
    await click(b.page, 'Why is the Sun so low?'); // explainer
    await expect(said(b.page, /axis is tilted only about 1\.5°/)).toBeVisible();
    await click(b.page, 'Back');
    await click(b.page, 'Got it.');
    await expect(said(b.page, /First, a callsign\./)).toBeVisible();
    await shot(b.page, vp.name, 'briefing-callsign');
    await click(b.page, 'Shams');
    await expect(said(b.page, /Shams: “sun” in Arabic/)).toBeVisible();
    await click(b.page, 'Next');
    await expect(said(b.page, /^Shams needs a new landing\./)).toBeVisible();
    await shot(b.page, vp.name, 'briefing-b7');
    await click(b.page, "What's real here?");
    await expect(said(b.page, /I'm made up, and so is Shams\./)).toBeVisible();
    await click(b.page, 'Back');
    await click(b.page, 'Show me the landings');
    await b.page.waitForURL('**/missions');
    await expect(b.page.getByText(/Refaey's homework before Shams flies/)).toBeVisible();
    await expect(b.page.getByText(/what Shams does differently/)).toBeVisible();
    // a new document keeps the callsign for the session (sessionStorage)
    await b.page.reload();
    await expect(b.page.getByText(/Refaey's homework before Shams flies/)).toBeVisible();
    expect(b.errors).toEqual([]);
    await b.ctx.close();

    // 2. Skip jumps to the last beat with the default callsign; planning exit
    b = await newPage(browser, vp, { reduced: true });
    await startBriefing(b.page);
    await expect(b.page.getByRole('button', { name: 'Skip', exact: true })).toBeVisible();
    await click(b.page, 'Skip');
    await expect(said(b.page, /^Ostora-1 needs a new landing\./)).toBeVisible();
    await expect(b.page.getByRole('button', { name: 'Skip', exact: true })).toHaveCount(0);
    await click(b.page, 'Straight to planning');
    await b.page.waitForURL(/\/mission(\?|$)/);
    await b.ctx.close();

    // 3. "Open the sources" goes to /about; Esc goes to Step 1
    b = await newPage(browser, vp, { reduced: true });
    await startBriefing(b.page);
    await click(b.page, 'Skip');
    await click(b.page, "What's real here?");
    await click(b.page, 'Open the sources');
    await b.page.waitForURL('**/about');
    await b.ctx.close();
    b = await newPage(browser, vp, { reduced: true });
    await startBriefing(b.page);
    await b.page.keyboard.press('Escape');
    await b.page.waitForURL(/\/mission(\?|$)/);
    await b.ctx.close();
  });
}

for (const vp of VIEWPORTS) {
  test(`planner cards at ${vp.name} [${MODE}]: stand and touchdown`, async ({ browser }) => {
    const { ctx, page, errors } = await newPage(browser, vp, { reduced: true, briefed: true });
    const card = page.locator(CARD);
    const narrow = vp.width < 900; // the stage card steps aside on tablets and phones (no free zone there)

    // stand, arriving from Compare dates (a moment in the plan's window in the link)
    await page.goto(`/mission/stand?site=${SITE}&at=${FUTURE}`);
    await page.waitForTimeout(MODE === 'demo' ? 5000 : 12_000);
    if (narrow) {
      await expect(card).toBeHidden();
      await shot(page, vp.name, 'stand');
    } else if (MODE === 'blocked') {
      if (await card.count()) await expect(card).not.toContainText('Sun +');
    } else {
      await expect(card).toBeVisible();
      await expect(card).toContainText("My old window is gone. This is the view from Ostora-1's hatch.");
      await expect(card).toContainText("The skyline is traced from NASA's laser maps.");
      if (LIVE) await expect(card).toContainText(/Sun \+?[\d.]+° up, sets in|I'd be in the dark here|can't call home from here/);
      else await expect(card).not.toContainText('sets in');
      await shot(page, vp.name, 'stand');
      expect(await cardAudit(page, 'stage'), `${vp.name} stand`).toEqual([]);
      // once per session: leaving and coming back does not show it again
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
    } else if (MODE === 'live') {
      await expect(card).toContainText(/Ostora-1 is down at .+, .+\./, { timeout: 30_000 });
      await expect(card).toContainText(/First daytime: .+ of sunlight, Earth in view for/);
    } else if (MODE === 'blocked') {
      await expect(card).toContainText("That's my landing. Thank you for planning it with me.", { timeout: 30_000 });
    } else {
      await expect(card).toContainText("Those numbers need live NASA data, so I'll keep quiet rather than guess.", { timeout: 30_000 });
      await expect(card).not.toContainText(/\d/);
    }
    if (!narrow) await expect(card).not.toContainText('Give me a second');
    await settle(page);
    await shot(page, vp.name, 'touchdown');
    if (!narrow) {
      expect(await cardAudit(page, 'stage'), `${vp.name} touchdown`).toEqual([]);
      await expect(page.getByRole('button', { name: "What's real here?" })).toBeVisible();
      await click(page, "What's real here?");
      await expect(card).toContainText("I'm made up, and so is Ostora-1.");
    }
    expect(errors).toEqual([]);
    await ctx.close();
  });
}

test(`someone who skipped the briefing meets Refaey first, on the first card [${MODE}]`, async ({ browser }) => {
  const { ctx, page } = await newPage(browser, VIEWPORTS[0], { reduced: true });
  await page.goto(`/mission/stand?site=${SITE}`);
  await page.waitForTimeout(MODE === 'demo' ? 5000 : 12_000);
  test.skip(MODE === 'blocked', 'no sky data to show a card on');
  const card = page.locator(CARD);
  await expect(card).toContainText("I'm Refaey. My launch slipped, and I need a new landing. Help me pick one?");
  await click(page, 'Who are you?');
  await expect(card).toContainText('Made up, by the way. The Moon is real.');
  await click(page, 'Okay, I will help.');
  await expect(card).toContainText("This is the view from Ostora-1's hatch.");
  await ctx.close();
});
