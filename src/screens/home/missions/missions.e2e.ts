/**
 * /missions: layout, accessibility and the story, at six viewports. Run: npm run test:e2e
 * Modes (E2E_MODE): demo (default), live, blocked: see e2e-helpers.ts. Screenshots: ~/Developer/Al-Ostora-shots/refaey-story/<mode>/…
 * The beats to visit come from the script data itself (story-model.ts), so every branch is covered whatever the script says.
 *
 * Per state: no horizontal scroll, no overlapping boxes, no clipped text, equal card heights in a one-row layout,
 * text contrast, no console errors. Plus focus, Esc, reload, Back/Forward, tab order, source cards, the notebook and reduced motion.
 */
import { expect, test, type Page } from '@playwright/test';
import { audit, check, LIVE, MODE, newPage, settle, shot, VIEWPORTS } from './e2e-helpers';
import { FACT_TOKEN, STORIES } from './story-model';

const SEE = (live: boolean) => (live ? 'See the sky at touchdown' : 'Open this site in the planner');
const click = (page: Page, name: string) => page.getByRole('button', { name, exact: true }).click();

async function openStory(page: Page, id: string, clicks: string[]) {
  await page.locator(`li[data-story="${id}"] button`).click();
  await page.waitForSelector('[aria-live="polite"]');
  for (const c of clicks) await click(page, c);
  await settle(page);
}

for (const vp of VIEWPORTS) {
  test(`/missions at ${vp.name} [${MODE}]: every beat of every branch`, async ({ browser }) => {
    const { ctx, page, errors } = await newPage(browser, vp, { reduced: true });
    await page.goto('/missions');
    await page.waitForSelector('li[data-story]');
    await check(page, vp.name, 'list', errors);
    await expect(page.locator('li[data-story] button')).toHaveCount(3);
    await expect(page.getByText(/Refaey is fiction; the missions and numbers are real\./).first()).toBeVisible();
    await expect(page.getByText(/I've studied these three a hundred times/).first()).toBeVisible();
    if (MODE === 'live') await expect(page.locator('footer')).toContainText('Live NASA data');

    for (const story of STORIES) {
      for (const beat of story.beats(LIVE)) {
        // back to the list inside the page (no reload), then down this beat's path
        if (await page.getByRole('button', { name: /All stories/ }).count()) await page.getByRole('button', { name: /All stories/ }).click();
        await page.waitForSelector('li[data-story]');
        await openStory(page, story.id, beat.clicks);
        expect(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]') || document.activeElement?.getAttribute('aria-live') === 'polite'), `focus on the new beat (${beat.id})`).toBe(true);
        await check(page, vp.name, `${story.id}-${beat.id}`, errors);
        // beats that use a recorded fact carry the "JPL Horizons · recorded" label (on every provider); the others do not
        const usesFacts = beat.node.lines.some((l) => FACT_TOKEN.test(l));
        const badge = page.getByText(/^JPL Horizons · recorded /).first();
        if (usesFacts) await expect(badge, `${story.id} ${beat.id}`).toBeVisible();
        else await expect(badge, `${story.id} ${beat.id}`).toHaveCount(0);
        // every beat has 2–3 replies, except a final beat's three and a marked transition's one
        const replies = await page.locator('[class*="_replyRow_"] button, [role="dialog"] [data-reply]').count();
        expect(replies, `${beat.id} replies`).toBeGreaterThanOrEqual(beat.node.transition ? 1 : 2);
        expect(replies).toBeLessThanOrEqual(3);
        if (beat.node.learns) {
          await expect(page.getByRole('button', { name: SEE(LIVE) })).toBeVisible();
          if (!LIVE) await expect(page.getByRole('button', { name: 'See the sky at touchdown' })).toHaveCount(0);
          await expect(page.getByRole('button', { name: "Plan Ostora-1's landing" })).toBeVisible();
          await expect(page.getByText(/as it is today/i).first()).toHaveCount(0);
        }
      }
    }
    await ctx.close();
  });

  test(`/missions at ${vp.name} [${MODE}]: guess beats, source cards, the notebook, focus, Esc, reload, Back and Forward`, async ({ browser }) => {
    const { ctx, page, errors } = await newPage(browser, vp, { reduced: true });
    await page.goto('/missions');
    await page.waitForSelector('li[data-story]');

    // A guess beat: each answer gets its own reaction, then they rejoin.
    await page.locator('li[data-story="change-4"] button').click();
    await click(page, 'Never');
    await expect(page.getByText(/^Correct, and slightly creepy\./).first()).toBeVisible();
    await click(page, 'So how did it phone home?');
    await expect(page.getByText(/China launched a relay first/).first()).toBeVisible();
    await page.getByRole('button', { name: 'All stories' }).click();
    await page.locator('li[data-story="change-4"] button').click();
    await click(page, 'Once a month');
    await expect(page.getByText(/^Sadly, never\./).first()).toBeVisible();
    await click(page, 'So how did it phone home?');
    await expect(page.getByText(/China launched a relay first/).first()).toBeVisible();

    // "How do you know?": a source card with a link that opens in a new tab, and Back to the same beat
    await page.goto('/missions?story=apollo');
    await click(page, 'Low in the sky');
    await click(page, 'How low?');
    const beatText = await page.locator('[aria-live="polite"]').innerText();
    await click(page, 'How do you know?');
    await expect(page.getByText('NASA SP-4029: Apollo 11 summary').first()).toBeVisible();
    const link = page.getByRole('link', { name: /Open the source/ });
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', /noopener/);
    await expect(link).toHaveAttribute('href', /nasa\.gov/);
    await check(page, vp.name, 'source-card', errors);
    await click(page, 'Back');
    expect(await page.locator('[aria-live="polite"]').innerText(), 'Back returns to the same beat').toBe(beatText);

    // An explainer opens inside the story and "OK" returns to the beat it came from.
    await click(page, 'Did they always hit it?');
    await click(page, 'And our engine?');
    await click(page, 'And at the pole?');
    await click(page, 'Why not land somewhere easier?');
    await click(page, 'Why is the Sun so low?');
    await check(page, vp.name, 'explainer', errors);
    await click(page, 'OK');
    await expect(page.getByRole('button', { name: 'Fair.', exact: true })).toBeVisible();

    // The notebook: finishing a story marks its card; reload keeps it; all three change the line and show the plan button.
    for (const [id, route] of [
      ['apollo', ['Low in the sky', 'How low?', 'Did they always hit it?', 'And our engine?', 'And at the pole?', "So you can't pick the angle."]],
      ['change-4', ['Never', 'So how did it phone home?', 'Clever.', 'And power?', 'Lucky them.', 'So what will you do?']],
      ['im-2-athena', ['What was it there for?', 'And then?', 'Ouch.', 'About 2°', 'What happened?', "That's harsh.", 'So what will you do?']],
    ] as const) {
      await page.goto('/missions');
      await openStory(page, id, [...route]);
      await expect(page.getByRole('button', { name: 'Another story' })).toBeVisible();
      await click(page, 'Another story');
      await expect(page.locator(`li[data-story="${id}"]`)).toContainText('Lesson learned');
    }
    await expect(page.getByText(/^Three lessons in the notebook\. Ostora-1 is ready for a site\. Are you\?/).first()).toBeVisible();
    await expect(page.getByRole('link', { name: "Plan Ostora-1's landing" })).toBeVisible();
    await check(page, vp.name, 'list-all-learned', errors);
    await page.reload();
    await page.waitForSelector('li[data-story]');
    await expect(page.locator('li[data-story]', { hasText: 'Lesson learned' })).toHaveCount(3);

    // Esc and "← All stories" return to the list with focus on the card; the URL keeps the story on reload; Back/Forward work.
    await page.locator('li[data-story="apollo"] button').click();
    await page.waitForSelector('[aria-live="polite"]');
    await page.reload();
    await page.waitForSelector('[aria-live="polite"]');
    if (await page.locator('[data-refaey-stage]').count()) {
      // Refaey is placed in the screen: Esc closes the balloon (he stays); clicking him opens it again at the same beat.
      const beatNow = await page.locator('[role="dialog"] [aria-live="polite"]').innerText();
      await page.keyboard.press('Escape');
      await expect(page.locator('[role="dialog"]')).toHaveCount(0);
      await page.getByRole('button', { name: /Refaey: open/ }).click();
      await expect(page.locator('[role="dialog"]')).toHaveCount(1);
      expect(await page.locator('[role="dialog"] [aria-live="polite"]').innerText(), 'reopens at the same beat').toBe(beatNow);
      await page.getByRole('button', { name: /All stories/ }).click();
      await settle(page);
    } else {
      await page.keyboard.press('Escape');
      await settle(page);
    }
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
      const apollo = STORIES[0];
      const final = apollo.beats(LIVE).find((b) => b.node.learns)!;
      await page.goto('/missions');
      await openStory(page, apollo.id, final.clicks);
      await page.getByRole('button', { name: SEE(LIVE) }).click();
      await expect(page).toHaveURL(LIVE ? /\/mission\/stand\?site=apollo-11&at=1969-07-20T20%3A17%3A40Z/ : /\/mission\/stand\?site=apollo-11$/);
      await page.goto('/missions');
      await openStory(page, apollo.id, final.clicks);
      await page.getByRole('button', { name: "Plan Ostora-1's landing" }).click();
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
