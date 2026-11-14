/**
 * Refaey's motion: one animation at a time, off when it should be off. Demo mode only (it does not depend on data).
 * - reduced motion and the app's own Motion toggle: zero frame changes over 3 s
 * - hidden tab: paused, and resumes
 * - the hop: lunar arc, rate-limited, one of four lines; also after a finished story
 * - the walk-in on the briefing: once per session
 * - no long task (> 50 ms) while he idles and hops
 */
import { expect, test, type Page } from '@playwright/test';
import { MODE, newPage, VIEWPORTS } from './e2e-helpers';

test.skip(MODE !== 'demo', 'motion does not depend on the data provider');
const vp = VIEWPORTS[0];

/** What is on screen: the strip, the frame offset and the transform of the sprite. */
const look = (page: Page) =>
  page.evaluate(() => {
    const s = document.querySelector<HTMLElement>('[class*="_actorStage_"]')!;
    return `${s.style.backgroundImage.split('/').pop()}|${s.style.backgroundPosition}|${s.style.transform}`;
  });
/** Sample the sprite's look every `every` ms for `ms`. */
async function sample(page: Page, ms: number, every = 120) {
  const seen: string[] = [];
  for (let t = 0; t < ms; t += every) {
    seen.push(await look(page));
    await page.waitForTimeout(every);
  }
  return seen;
}
async function openApollo(page: Page) {
  await page.goto('/missions');
  await page.waitForSelector('[class*="_actorStage_"]');
}
const actor = (page: Page) => page.locator('[class*="_actor_"]').first();

test('reduced motion: zero frame changes over 3 s, and a poke does nothing', async ({ browser }) => {
  const { ctx, page } = await newPage(browser, vp, { reduced: true });
  await openApollo(page);
  const seen = await sample(page, 3000);
  expect(new Set(seen).size, seen.join('\n')).toBe(1);
  await actor(page).click();
  await page.waitForTimeout(500);
  await expect(page.getByRole('status')).toHaveCount(0);
  expect(new Set(await sample(page, 1000)).size).toBe(1);
  await ctx.close();
});

test("the app's Motion toggle: off freezes him on the first idle frame, on brings him back", async ({ browser }) => {
  const { ctx, page } = await newPage(browser, vp);
  await openApollo(page);
  const moving = await sample(page, 2400);
  expect(new Set(moving).size, 'idle plays when motion is on').toBeGreaterThan(2);
  await page.getByRole('button', { name: /^Motion on/ }).click();
  await expect(page.getByRole('button', { name: /^Motion off/ })).toBeVisible();
  await page.waitForTimeout(300);
  const frozen = await sample(page, 3000);
  expect(new Set(frozen).size, frozen.slice(0, 4).join(' / ')).toBe(1);
  expect(frozen[0]).toContain('idle-strip');
  expect(frozen[0]).toContain('0px 0px'); // frame 1
  await actor(page).click();
  await page.waitForTimeout(400);
  expect(await page.getByRole('status').count(), 'no hop, no line, when motion is off').toBe(0);
  await page.getByRole('button', { name: /^Motion off/ }).click();
  expect(new Set(await sample(page, 2400)).size).toBeGreaterThan(2);
  await ctx.close();
});

test('a hidden tab pauses him; coming back resumes', async ({ browser }) => {
  const { ctx, page } = await newPage(browser, vp);
  await openApollo(page);
  expect(new Set(await sample(page, 1500)).size).toBeGreaterThan(1);
  const setVisibility = (v: 'hidden' | 'visible') =>
    page.evaluate((state) => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
      document.dispatchEvent(new Event('visibilitychange'));
    }, v);
  await setVisibility('hidden');
  await page.waitForTimeout(300);
  expect(new Set(await sample(page, 1500)).size, 'frozen while hidden').toBe(1);
  await setVisibility('visible');
  expect(new Set(await sample(page, 2400)).size, 'moving again').toBeGreaterThan(1);
  await ctx.close();
});

test('poking him: a hop on a lunar arc, one of four lines for two seconds, one poke per three seconds', async ({ browser }) => {
  const { ctx, page } = await newPage(browser, vp);
  await openApollo(page);
  const height = await actor(page).evaluate((e) => e.getBoundingClientRect().height);
  await actor(page).click();
  const quip = page.getByRole('status');
  await expect(quip).toHaveText(/Low gravity\. Everything's a trampoline\.|That tickles\. Probably\. The suit is thick\.|Still no launch date\. Still optimistic\.|In Cairo, this hop would hit a balcony\./);
  const seen = await sample(page, 2000, 40);
  expect(seen.some((l) => l.startsWith('hop-strip')), 'the hop strip plays').toBe(true);
  const lifts = seen.map((l) => Number(/translate\([^,]+, (-?[\d.]+)px/.exec(l)?.[1] ?? 0));
  const peak = Math.min(...lifts);
  // 0.4 m of a 1.8 m suit: about a fifth of his height (sampled every 40 ms, so a little under the exact top)
  expect(-peak).toBeGreaterThan(height * 0.15);
  expect(-peak).toBeLessThan(height * 0.26);
  await expect(quip).toHaveCount(0); // gone after two seconds
  // within three seconds of the first poke, a second one is ignored
  await actor(page).click();
  await page.waitForTimeout(200);
  await expect(page.getByRole('status')).toHaveCount(0);
  await page.waitForTimeout(1200);
  await actor(page).click();
  await expect(page.getByRole('status')).toHaveCount(1);
  // back to idle once it has landed
  await page.waitForTimeout(2600);
  expect((await look(page)).startsWith('idle-strip')).toBe(true);
  await ctx.close();
});

test('finishing a story makes him hop', async ({ browser }) => {
  const { ctx, page } = await newPage(browser, vp);
  await page.goto('/missions?story=apollo');
  await page.waitForSelector('[aria-live="polite"]');
  for (const c of ['Low in the sky', 'How low?', 'Did they always hit it?', 'And our engine?', 'And at the pole?']) await page.getByRole('button', { name: c, exact: true }).click();
  const watch = page.evaluate(
    () =>
      new Promise<boolean>((resolve) => {
        const s = document.querySelector<HTMLElement>('[class*="_actorStage_"]')!;
        const t = window.setInterval(() => s.style.backgroundImage.includes('hop-strip') && (window.clearInterval(t), resolve(true)), 30);
        window.setTimeout(() => (window.clearInterval(t), resolve(false)), 2500);
      }),
  );
  await page.getByRole('button', { name: "So you can't pick the angle.", exact: true }).click();
  expect(await watch, 'the hop strip plays when the lesson is learned').toBe(true);
  await ctx.close();
});

test('the walk-in happens once per session, on the briefing', async ({ browser }) => {
  const { ctx, page } = await newPage(browser, vp);
  await page.goto('/');
  await page.locator('[class*="_loader_"]').waitFor({ state: 'detached', timeout: 60_000 }).catch(() => undefined);
  await page.getByRole('button', { name: 'Begin the journey' }).waitFor();
  await page.waitForTimeout(1500);
  await page.getByRole('button', { name: 'Begin the journey' }).click();
  await page.waitForSelector('[class*="_actorStage_"]', { timeout: 60_000 });
  const seen = await sample(page, 1700, 40);
  expect(seen.some((l) => l.startsWith('walk-strip')), 'he walks in').toBe(true);
  const walkFrames = seen.filter((l) => l.startsWith('walk-strip'));
  expect(walkFrames.length * 40, 'at most 1.2 s of walking (plus sampling)').toBeLessThanOrEqual(1400);
  expect((await look(page)).startsWith('idle-strip'), 'then he idles').toBe(true);
  expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem('refaey-seen')!).state.walkedIn)).toBe(true);
  await ctx.close();

  // already walked in this session: the briefing starts with him standing
  const again = await newPage(browser, vp);
  await again.page.addInitScript(() => {
    if (!sessionStorage.getItem('refaey-seen')) sessionStorage.setItem('refaey-seen', JSON.stringify({ state: { seen: {}, walkedIn: true }, version: 0 }));
  });
  await again.page.goto('/');
  await again.page.locator('[class*="_loader_"]').waitFor({ state: 'detached', timeout: 60_000 }).catch(() => undefined);
  await again.page.getByRole('button', { name: 'Begin the journey' }).waitFor();
  await again.page.waitForTimeout(1500);
  await again.page.getByRole('button', { name: 'Begin the journey' }).click();
  await again.page.waitForSelector('[class*="_actorStage_"]', { timeout: 60_000 });
  const second = await sample(again.page, 1500, 40);
  expect(second.some((l) => l.startsWith('walk-strip')), 'no second walk-in').toBe(false);
  await again.ctx.close();
});

test('no long task (> 50 ms) while he idles and hops', async ({ browser }) => {
  const { ctx, page } = await newPage(browser, vp);
  await page.addInitScript(() => {
    (window as unknown as { __long: number[] }).__long = [];
    new PerformanceObserver((l) => l.getEntries().forEach((e) => (window as unknown as { __long: number[] }).__long.push(Math.round(e.duration)))).observe({ type: 'longtask', buffered: true });
  });
  await openApollo(page);
  await page.waitForTimeout(800);
  await page.evaluate(() => ((window as unknown as { __long: number[] }).__long.length = 0)); // after the page itself has loaded
  await page.waitForTimeout(2500);
  await actor(page).click();
  await page.waitForTimeout(2600);
  expect(await page.evaluate(() => (window as unknown as { __long: number[] }).__long)).toEqual([]);
  await ctx.close();
});
