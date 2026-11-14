/**
 * Refaey in the screen (figure + one balloon): placement on /missions list and story at the seven viewports.
 * Per state: the figure and the balloon stay inside the safe viewport (below the header, above the status bar) and 16 px clear of every
 * visible text, control, icon and landmark; feet on the ground line when standing; no horizontal scroll; focus and Esc work; under 900 px
 * (or when nothing fits) the plain layout shows instead. Motion: still with reduced motion, alive otherwise.
 */
import { expect, test, type Page } from '@playwright/test';
import { audit, MODE, newPage, shot } from './e2e-helpers';

const VPS = [
  { name: '1280x720', width: 1280, height: 720 },
  { name: '1366x768', width: 1366, height: 768 },
  { name: '1440x900', width: 1440, height: 900 },
  { name: '1920x1080', width: 1920, height: 1080 },
  { name: '1024x768', width: 1024, height: 768 },
  { name: '768x1024', width: 768, height: 1024 },
  { name: '390x844', width: 390, height: 844 },
];

async function placement(page: Page) {
  return page.evaluate(() => {
    const st = document.querySelector<HTMLElement>('[data-refaey-stage]');
    if (!st) return null;
    const R = (e: Element) => e.getBoundingClientRect();
    const fig = R(st.querySelector('[class*="_actor_"]')!);
    const bal = st.querySelector('[class*="_balloon_"]');
    const rects: { name: string; r: DOMRect }[] = [];
    const vis = (e: Element) => {
      const cs = getComputedStyle(e);
      const r = R(e);
      return cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 0 && r.height > 0;
    };
    document.querySelectorAll('main :is(a,button,input,h1,h2,p,label,svg,img,[role="region"]), header :is(a,button), footer *').forEach((e) => {
      if (st.contains(e) || e.contains(st) || !vis(e) || e.closest('[aria-hidden="true"]')) return;
      if ([...e.childNodes].some((n) => n.nodeType === 3 && n.textContent?.trim()) || e.matches('a,button,input,svg,img')) rects.push({ name: (e.textContent ?? e.tagName).trim().slice(0, 20), r: R(e) });
    });
    const header = R(document.querySelector('header')!).bottom;
    const footer = R(document.querySelector('footer')!).top;
    const near = (a: DOMRect, b: DOMRect) => a.left < b.right + 15 && b.left < a.right + 15 && a.top < b.bottom + 15 && b.top < a.bottom + 15;
    const hits: string[] = [];
    for (const [label, box] of [['figure', fig], ['balloon', bal ? R(bal) : null]] as const) {
      if (!box) continue;
      if (box.left < 0 || box.right > innerWidth || box.top < header || box.bottom > footer + 1) hits.push(`${label} outside the safe area`);
      for (const o of rects) {
        // the cards row is what a standing figure stands on: he touches its top edge by design
        const shrunk = label === 'figure' && st.dataset.pose === 'stand' ? new DOMRect(box.x, box.y, box.width, box.height - 17) : box;
        if (near(shrunk, o.r)) hits.push(`${label} too close to "${o.name}"`);
      }
    }
    const cards = document.querySelector('[data-refaey-anchor="cards"]');
    return { slot: st.dataset.slot!, pose: st.dataset.pose!, hits, feetOff: st.dataset.pose === 'stand' && cards ? Math.abs(fig.bottom - R(cards).top) : null, scrollX: document.documentElement.scrollWidth > innerWidth };
  });
}

for (const vp of VPS) {
  test(`stage at ${vp.name} [${MODE}]: list and story`, async ({ browser }) => {
    const { ctx, page, errors } = await newPage(browser, vp, { reduced: true, briefed: true });
    for (const url of ['/missions', '/missions?story=apollo']) {
      await page.goto(url);
      await page.waitForSelector('main h1');
      await page.waitForTimeout(900);
      const p = await placement(page);
      const tag = `${vp.name} ${url}`;
      await shot(page, vp.name, `stage-${url.includes('story') ? 'story' : 'list'}`);
      if (vp.width < 900) {
        expect(p, `${tag}: under 900 px the plain layout shows`).toBeNull();
        expect(await audit(page), tag).toEqual([]);
        continue;
      }
      if (!p) {
        // nothing fit: the plain layout must pass the existing audit
        expect(await audit(page), `${tag} (fallback)`).toEqual([]);
        continue;
      }
      expect(p.hits, tag).toEqual([]);
      expect(p.scrollX, `${tag}: horizontal scroll`).toBe(false);
      if (p.feetOff !== null) expect(p.feetOff, `${tag}: feet on the ground line`).toBeLessThanOrEqual(1);
      expect(await audit(page), tag).toEqual([]);
      await page.evaluate(() => ((window as unknown as { __slot: string }).__slot = document.querySelector<HTMLElement>('[data-refaey-stage]')!.dataset.slot!));
      console.log(`${tag}: slot ${p.slot}`);
    }
    expect(errors).toEqual([]);
    await ctx.close();
  });
}

test('stage: Esc closes the balloon, he stays, clicking him reopens; replies keep the anchor', async ({ browser }) => {
  const { ctx, page } = await newPage(browser, VPS[0], { reduced: true, briefed: true });
  await page.goto('/missions?story=apollo');
  await page.waitForSelector('[role="dialog"]');
  const before = await page.locator('[data-refaey-stage]').getAttribute('data-fig');
  await page.getByRole('button', { name: 'Low in the sky', exact: true }).click();
  expect(await page.locator('[data-refaey-stage]').getAttribute('data-fig'), 'the anchor does not move between beats').toBe(before);
  await page.keyboard.press('Escape');
  await expect(page.locator('[role="dialog"]')).toHaveCount(0);
  await expect(page.locator('[data-refaey-stage]')).toHaveCount(1);
  await page.getByRole('button', { name: /Refaey: open/ }).press('Enter');
  await expect(page.locator('[role="dialog"]')).toHaveCount(1);
  await ctx.close();
});

test('stage motion: reduced motion is still; motion on drifts', async ({ browser }) => {
  const look = (page: Page) => page.evaluate(() => document.querySelector<HTMLElement>('[class*="_actorStage_"]')!.style.transform + document.querySelector<HTMLElement>('[class*="_actorStage_"]')!.style.backgroundPosition);
  for (const reduced of [true, false]) {
    const { ctx, page } = await newPage(browser, VPS[0], { reduced, briefed: true });
    await page.goto('/missions?story=apollo');
    await page.waitForSelector('[role="dialog"]');
    await page.waitForTimeout(500);
    const seen = new Set<string>();
    for (let t = 0; t < 3000; t += 100) {
      seen.add(await look(page));
      await page.waitForTimeout(100);
    }
    if (reduced) expect(seen.size, 'zero frame changes over 3 s').toBe(1);
    else expect(seen.size, 'drifts').toBeGreaterThan(3);
    await ctx.close();
  }
});
