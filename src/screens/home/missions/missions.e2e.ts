/**
 * /missions: layout, accessibility and the new script, at six viewports. Run: npm run test:e2e
 * Modes (E2E_MODE): demo (default), live, blocked: see e2e-helpers.ts. Screenshots: ~/Developer/Al-Ostora-shots/refaey-final/<mode>/…
 *
 * Per state: no horizontal scroll, no overlapping boxes, no clipped text, equal card heights in a one-row layout,
 * text contrast, no console errors. Plus focus, Esc, reload, Back/Forward, tab order and reduced motion.
 */
import { expect, test } from '@playwright/test';
import { audit, check, LIVE, MODE, newPage, settle, shot, VIEWPORTS } from './e2e-helpers';

/** Reply labels to click, in order; each click shows the next beat. */
const STORIES = [
  {
    id: 'apollo',
    replies: ['So what did Armstrong do?', 'Was the light planned?', 'What was the rule?', 'Did the numbers hold?', 'And at the pole?', 'So what changes?'],
    facts: [3, 5], // beats (1-based) that use recorded Horizons facts and so carry the label
  },
  {
    id: 'change-4',
    replies: ['So where is Earth?', 'So how did it phone home?', 'And the messages?', 'And the Sun?', 'What about the pole?'],
    facts: [2, 5],
  },
  {
    id: 'im-2-athena',
    replies: ['What was it carrying?', 'How did it land?', 'What was the Sun doing?', 'What happened next?', 'What does our map say?', 'So what should I take from it?'],
    facts: [4, 6],
  },
];
const SEE = LIVE ? 'See the sky at touchdown' : 'Open this site in the planner';

for (const vp of VIEWPORTS) {
  test(`/missions at ${vp.name} [${MODE}]: every state`, async ({ browser }) => {
    const { ctx, page, errors } = await newPage(browser, vp);
    await page.goto('/missions');
    await page.waitForSelector('li[data-story]');
    await check(page, vp.name, 'list', errors);
    await expect(page.locator('li[data-story] button')).toHaveCount(3);
    if (MODE === 'live') await expect(page.locator('footer')).toContainText('Live NASA data');

    for (const story of STORIES) {
      await page.locator(`li[data-story="${story.id}"] button`).click();
      await expect(page).toHaveURL(new RegExp(`story=${story.id}`));
      await settle(page);
      await expect(page.locator('[aria-live="polite"]')).toBeVisible();
      await check(page, vp.name, `${story.id}-beat1`, errors);
      expect(await page.evaluate(() => document.activeElement?.getAttribute('aria-live')), 'focus is on the new beat').toBe('polite');

      for (const [i, label] of story.replies.entries()) {
        await page.getByRole('button', { name: label, exact: true }).click();
        await settle(page);
        expect(await page.evaluate(() => document.activeElement?.getAttribute('aria-live')), `focus on the new beat after "${label}"`).toBe('polite');
        const beatNo = i + 2;
        const last = i === story.replies.length - 1;
        await check(page, vp.name, `${story.id}-beat${beatNo}${last ? '-final' : ''}`, errors);
        // beats that use a recorded fact carry the "JPL Horizons · recorded" label (on every provider); the others do not
        const badge = page.getByText(/^JPL Horizons · recorded /);
        if (story.facts.includes(beatNo)) await expect(badge, `${story.id} beat ${beatNo}`).toBeVisible();
        else if (beatNo !== 6 || story.id !== 'im-2-athena') await expect(badge).toHaveCount(0);
      }
      // final beat: the three replies, with the hand-off label that matches the provider and no claim about the landing day on demo
      await expect(page.getByRole('button', { name: SEE })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Another story' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Plan my own landing' })).toBeVisible();
      if (!LIVE) await expect(page.getByRole('button', { name: 'See the sky at touchdown' })).toHaveCount(0);
      await expect(page.getByText(/as it is today/i)).toHaveCount(0);

      // "Another story" → list, focus back on the card we came from
      await page.getByRole('button', { name: 'Another story' }).click();
      await settle(page);
      await expect(page.locator('li[data-story] button')).toHaveCount(3);
      expect(await page.evaluate(() => document.activeElement?.closest('[data-story]')?.getAttribute('data-story'))).toBe(story.id);
    }

    // An explainer opens inside the story and "OK" returns to the beat it came from.
    await page.locator('li[data-story="apollo"] button').click();
    for (const label of STORIES[0].replies.slice(0, 4)) await page.getByRole('button', { name: label, exact: true }).click();
    await page.getByRole('button', { name: 'And at the pole?', exact: true }).click();
    await page.getByRole('button', { name: 'Why is the Sun so low?', exact: true }).click();
    await check(page, vp.name, 'apollo-explainer', errors);
    await page.getByRole('button', { name: 'OK', exact: true }).click();
    await expect(page.getByRole('button', { name: 'So what changes?', exact: true })).toBeVisible();

    // The URL keeps the story on reload; Esc and "← All stories" return to the list with focus on the card; Back/Forward work.
    await page.reload();
    await page.waitForSelector('[aria-live="polite"]');
    await check(page, vp.name, 'apollo-after-reload', errors);
    await page.keyboard.press('Escape');
    await settle(page);
    expect(await page.evaluate(() => document.activeElement?.closest('[data-story]')?.getAttribute('data-story')), 'Esc: focus on the card').toBe('apollo');
    await page.goBack();
    await page.waitForSelector('[aria-live="polite"]');
    await page.getByRole('button', { name: /All stories/ }).click();
    await settle(page);
    expect(await page.evaluate(() => document.activeElement?.closest('[data-story]')?.getAttribute('data-story')), '← All stories: focus on the card').toBe('apollo');
    await page.goBack();
    await page.waitForSelector('[aria-live="polite"]');
    expect(page.url()).toContain('story=apollo');

    // Tab order follows the visual order (top to bottom, then left to right).
    await page.evaluate(() => {
      const h = document.querySelector<HTMLElement>('h1')!;
      h.setAttribute('tabindex', '-1');
      h.focus();
    });
    const seen: { top: number; name: string }[] = [];
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press('Tab');
      const p = await page.evaluate(() => {
        const e = document.activeElement as HTMLElement;
        return { top: e.getBoundingClientRect().top + window.scrollY, name: (e.textContent ?? e.getAttribute('aria-label') ?? '').trim().slice(0, 24), inside: !!e.closest('[class*="_root_"]') };
      });
      if (!p.inside) break;
      seen.push(p);
    }
    expect(seen.length, 'tabbing reaches the story controls').toBeGreaterThan(1);
    for (let i = 1; i < seen.length; i++) expect(seen[i].top + 2 >= seen[i - 1].top, `tab order: "${seen[i - 1].name}" then "${seen[i].name}"`).toBe(true);

    // The hand-off does what it says (once, at the projector size).
    if (vp.name === '1280x720') {
      await page.goto('/missions?story=apollo');
      for (const label of STORIES[0].replies) await page.getByRole('button', { name: label, exact: true }).click();
      await page.getByRole('button', { name: SEE }).click();
      await expect(page).toHaveURL(LIVE ? /\/mission\/stand\?site=apollo-11&at=1969-07-20T20%3A17%3A40Z/ : /\/mission\/stand\?site=apollo-11$/);
      await page.goto('/missions?story=apollo');
      for (const label of STORIES[0].replies) await page.getByRole('button', { name: label, exact: true }).click();
      await page.getByRole('button', { name: 'Plan my own landing' }).click();
      await expect(page).toHaveURL(/\/mission(\?|$)/);
    }
    await shot(page, vp.name, 'last');
    await ctx.close();
  });
}

test(`reduced motion [${MODE}]: nothing animates in the story area`, async ({ browser }) => {
  const { ctx, page, errors } = await newPage(browser, VIEWPORTS[0], { reduced: true });
  await page.goto('/missions');
  await page.waitForSelector('li[data-story]');
  await page.locator('li[data-story="apollo"] button').click();
  await page.waitForSelector('[aria-live="polite"]');
  const running = await page.evaluate(() => {
    const root = document.querySelector('[class*="_root_"]')!;
    return root.getAnimations({ subtree: true }).filter((a) => a.playState === 'running').map((a) => (a.effect as KeyframeEffect).target?.tagName);
  });
  expect(running).toEqual([]);
  expect(await audit(page)).toEqual([]);
  expect(errors).toEqual([]);
  await ctx.close();
});
