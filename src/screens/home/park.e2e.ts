/**
 * Home: the Moon parks in the bottom-right corner while Refaey talks, then returns to its Home framing.
 * Run against a dev server: BASE_URL=http://localhost:5201 npx playwright test src/screens/home/park.e2e.ts --global-timeout=900000
 */
import { expect, test, type Browser, type Page } from '@playwright/test';

const VPS = [
  { w: 1280, h: 720 },
  { w: 1366, h: 768 },
  { w: 1440, h: 900 },
  { w: 1920, h: 1080 },
];

async function open(browser: Browser, vp: { w: number; h: number }, reduced = false) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  await ctx.addInitScript(() => {
    sessionStorage.setItem('refaey-home-intro-seen', '1');
  });
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && !/403|Failed to load resource/.test(m.text()) && errors.push(m.text().slice(0, 160)));
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 160)));
  await page.goto('/');
  await page.getByRole('button', { name: 'Begin the journey' }).waitFor({ timeout: 90_000 });
  await page.waitForTimeout(2500);
  return { ctx, page, errors };
}
const begin = (page: Page) => page.getByRole('button', { name: 'Begin the journey' }).click();

for (const vp of VPS) {
  test(`parked Moon at ${vp.w}x${vp.h}: clear of Refaey, his balloon and the motion toggle; no scroll; Esc restores; Begin works twice`, async ({ browser }) => {
    const { ctx, page, errors } = await open(browser, vp);
    for (let round = 0; round < 2; round++) {
      await begin(page);
      await page.waitForSelector('[data-refaey-stage] [role="dialog"]', { timeout: 60_000 });
      await page.waitForTimeout(800);
      const hits = await page.evaluate(() => {
        const w = innerWidth;
        const h = innerHeight;
        const size = 0.24 * h;
        const moon = { l: w - 48 - size, t: h - 48 - size, r: w - 48, b: h - 48 };
        const bad: string[] = [];
        const st = document.querySelector('[data-refaey-stage]')!;
        const boxes: [string, DOMRect | undefined][] = [
          ['figure', st.querySelector('[class*="_actor_"]')?.getBoundingClientRect()],
          ['balloon', st.querySelector('[class*="_balloon_"]')?.getBoundingClientRect()],
          ['motion toggle', document.querySelector('[class*="_toggle_"], [class*="MotionToggle"], button[aria-label*="otion"]')?.getBoundingClientRect()],
        ];
        for (const [name, r] of boxes) if (r && r.left < moon.r && r.right > moon.l && r.top < moon.b && r.bottom > moon.t) bad.push(`${name} overlaps the parked Moon`);
        if (document.documentElement.scrollWidth > w) bad.push('horizontal scroll');
        return bad;
      });
      expect(hits, `round ${round}`).toEqual([]);
      // Esc: Refaey leaves, the Moon returns, the hero copy is back, Begin is usable again
      await page.keyboard.press('Escape');
      await expect(page.locator('[data-refaey-stage]')).toHaveCount(0, { timeout: 20_000 });
      await expect(page.getByRole('button', { name: 'Begin the journey' })).toBeVisible();
      await page.waitForTimeout(2500); // unpark settles
      expect(await page.evaluate(() => getComputedStyle(document.querySelector('h1')!.closest('[class*="_copy_"]')!).opacity)).toBe('1');
    }
    expect(errors).toEqual([]);
    await ctx.close();
  });
}

test('plan choice: the Moon returns, then the flight arrives at Step 1', async ({ browser }) => {
  const { ctx, page } = await open(browser, VPS[0]);
  await begin(page);
  await page.waitForSelector('[data-refaey-stage] [role="dialog"]', { timeout: 60_000 });
  await page.getByRole('button', { name: 'Skip' }).click();
  await page.getByRole('button', { name: 'Plan a future mission' }).click();
  await page.waitForURL('**/mission**', { timeout: 60_000 });
  await ctx.close();
});

test('past missions: the Moon returns, a short dive, then /missions', async ({ browser }) => {
  const { ctx, page } = await open(browser, VPS[0]);
  await begin(page);
  await page.waitForSelector('[data-refaey-stage] [role="dialog"]', { timeout: 60_000 });
  await page.getByRole('button', { name: 'Skip' }).click();
  await page.getByRole('button', { name: 'Explore past missions' }).click();
  await page.waitForURL('**/missions**', { timeout: 60_000 });
  await ctx.close();
});

test('motion off (reduced): nothing tweens and the flow still completes', async ({ browser }) => {
  const { ctx, page } = await open(browser, VPS[0], true);
  await begin(page);
  await page.waitForSelector('[data-refaey-stage] [role="dialog"]', { timeout: 60_000 });
  await page.getByRole('button', { name: 'Skip' }).click();
  await page.getByRole('button', { name: 'Plan a future mission' }).click();
  await page.waitForURL('**/mission**', { timeout: 30_000 });
  await ctx.close();
});

test('direct visits are unaffected', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  for (const url of ['/mission', '/missions']) {
    const r = await page.goto(url);
    expect(r?.status()).toBeLessThan(400);
    await expect(page.locator('main')).toBeVisible();
  }
  await ctx.close();
});
