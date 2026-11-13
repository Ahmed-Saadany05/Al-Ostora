/**
 * Layout and accessibility checks for /missions at six viewports. Run: npm run test:e2e
 * Screenshots go OUTSIDE the repo: ~/Developer/Al-Ostora-shots/missions/<viewport>/<state>.png
 *
 * Per state: no horizontal scroll, no overlapping boxes (figure, title, cards, back link, beat text, note, replies,
 * header, footer, fixed controls), no clipped text, equal card heights in a one-row layout, text contrast, no console errors.
 */
import { expect, test, type Browser, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

const SHOTS = path.join(homedir(), 'Developer', 'Al-Ostora-shots', 'missions');
const VIEWPORTS = [
  { name: '1280x720', width: 1280, height: 720 },
  { name: '1440x900', width: 1440, height: 900 },
  { name: '1024x768', width: 1024, height: 768 },
  { name: '900x700', width: 900, height: 700 },
  { name: '768x1024', width: 768, height: 1024 },
  { name: '390x844', width: 390, height: 844 },
];

/** Reply labels to click, in order; each click shows the next beat. */
const STORIES = [
  { id: 'im-2-athena', card: 'Athena (IM-2)', replies: ['What went wrong?', 'Why do a few hundred metres matter?'] },
  { id: 'change-4', card: "Chang'e 4", replies: ['So how did it phone home?', 'Clever. Anything else?'] },
  {
    id: 'apollo',
    card: 'Apollo landings',
    replies: ['Why not noon?', 'So when, then?', 'Was that easy to hit?', 'Any Sun trouble anyway?', 'Continue', 'So what does that mean?'],
  },
];

type Failure = string;

/** Everything checked for one state. Runs in the page. */
async function audit(page: Page): Promise<Failure[]> {
  return page.evaluate(() => {
    const out: string[] = [];
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const scrollable = document.documentElement.scrollHeight > vh + 1;
    if (document.documentElement.scrollWidth > vw) out.push(`horizontal scroll: ${document.documentElement.scrollWidth} > ${vw}`);

    const visible = (el: Element) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none';
    };
    const cls = (name: string) => [...document.querySelectorAll<HTMLElement>(`[class*="_${name}_"]`)].filter(visible);
    type Box = { group: string; label: string; el: Element; r: DOMRect };
    const boxes: Box[] = [];
    // Text scrolled out of the history area is not on screen: clamp every box to the scroll area that holds it.
    const shown = (el: Element) => {
      const r = el.getBoundingClientRect();
      const area = el.closest('[class*="_history_"]')?.getBoundingClientRect();
      if (!area) return r;
      return new DOMRect(Math.max(r.left, area.left), Math.max(r.top, area.top), Math.max(0, Math.min(r.right, area.right) - Math.max(r.left, area.left)), Math.max(0, Math.min(r.bottom, area.bottom) - Math.max(r.top, area.top)));
    };
    const add = (group: string, els: Element[]) => els.filter(visible).forEach((el, i) => boxes.push({ group, label: `${group}${els.length > 1 ? i : ''}: ${(el.textContent ?? '').trim().slice(0, 24)}`, el, r: shown(el) }));
    add('figure', cls('figure').flatMap((f) => [...f.querySelectorAll('img, span')].slice(0, 1)));
    add('title', [...document.querySelectorAll('h1')]);
    add('lead', cls('lead'));
    add('cards', [...document.querySelectorAll('li[data-story] button')]);
    add('back', cls('back').flatMap((b) => [...b.querySelectorAll('button')]));
    add('beat', [...cls('beatText'), ...cls('beatTitle')]);
    add('note', cls('note'));
    add('reply', cls('replyRow').flatMap((b) => [...b.querySelectorAll('button')]));
    add('header', cls('header'));
    add('footer', [...document.querySelectorAll('footer')]);
    const fixed = [...document.querySelectorAll<HTMLElement>('body *')].filter((el) => {
      if (!visible(el) || getComputedStyle(el).position !== 'fixed') return false;
      if (el.closest('footer, [class*="_header_"]')) return false;
      return /\S/.test(el.textContent ?? '') || el.matches('button, a, input, select');
    });
    add('fixed', fixed);

    // Overlaps (ignoring nesting). Header/footer are compared as they sit at load (scroll 0); content that starts below the fold is not covered yet.
    const inter = (a: DOMRect, b: DOMRect) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1;
    for (let i = 0; i < boxes.length; i++)
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i];
        const b = boxes[j];
        if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
        if (!inter(a.r, b.r)) continue;
        const sticky = [a, b].find((x) => x.group === 'footer');
        const other = sticky && (sticky === a ? b : a);
        if (other && other.r.top >= vh) continue;
        // A page that scrolls is covered by the sticky status bar at scroll 0 by design (every screen); it is checked at the bottom instead.
        if (sticky && scrollable) continue;
        out.push(`overlap: [${a.label}] × [${b.label}]`);
      }

    if (scrollable) {
      window.scrollTo(0, document.documentElement.scrollHeight);
      const foot = document.querySelector('footer')?.getBoundingClientRect();
      if (foot)
        for (const b of boxes.filter((x) => x.group !== 'footer' && x.group !== 'header')) {
          const r = b.el.getBoundingClientRect();
          if (inter(r, foot) && r.bottom > 0 && r.top < vh) out.push(`at the bottom of the page: [${b.label}] × [footer]`);
        }
      window.scrollTo(0, 0);
    }

    // Text: clipped or ellipsised? Every own-text element in the page area.
    const textEls = [...document.querySelectorAll<HTMLElement>('main *')].filter(
      (el) => visible(el) && [...el.childNodes].some((n) => n.nodeType === 3 && (n.textContent ?? '').trim()),
    );
    for (const el of textEls) {
      if (el.closest('.visually-hidden')) continue;
      const cs = getComputedStyle(el);
      const tag = `${el.tagName.toLowerCase()} "${(el.textContent ?? '').trim().slice(0, 28)}"`;
      if (cs.textOverflow === 'ellipsis') out.push(`ellipsis: ${tag}`);
      const r = el.getBoundingClientRect();
      // Clipped = something that hides overflow (itself or an ancestor, except the history scroll area) cuts the text off.
      for (let e: HTMLElement | null = el; e && e !== document.body; e = e.parentElement) {
        const o = getComputedStyle(e);
        if (o.overflowX === 'visible' && o.overflowY === 'visible') continue;
        if (e.matches('[class*="_history_"]')) break;
        const c = e.getBoundingClientRect();
        if (r.left < c.left - 1 || r.right > c.right + 1 || r.top < c.top - 1 || r.bottom > c.bottom + 1) out.push(`clipped by <${e.tagName.toLowerCase()}>: ${tag}`);
        if (e === el && (el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1)) out.push(`clipped (own scroll size): ${tag}`);
      }
      // a text element must stay inside its card
      const card = el.closest('li[data-story] button');
      if (card && cs.display !== 'inline') {
        const c = card.getBoundingClientRect();
        if (r.left < c.left - 1 || r.right > c.right + 1 || r.bottom > c.bottom + 1 || r.top < c.top - 1) out.push(`text outside its card: ${tag}`);
      }
    }
    // the newest earlier beat is fully visible in its scroll area
    const hist = cls('history')[0];
    if (hist) {
      const last = hist.lastElementChild?.getBoundingClientRect();
      const h = hist.getBoundingClientRect();
      if (last && (last.bottom > h.bottom + 1 || last.top < h.top - 1) && last.height <= h.height) out.push('newest earlier beat is cut off in its scroll area');
    }

    // Equal card heights (one row on desktop), and one row means the same top.
    const cards = boxes.filter((b) => b.group === 'cards').map((b) => b.r);
    if (cards.length === 3) {
      const hs = cards.map((c) => Math.round(c.height));
      if (vw >= 900) {
        if (Math.max(...hs) - Math.min(...hs) > 1) out.push(`cards have different heights: ${hs.join(', ')}`);
        if (new Set(cards.map((c) => Math.round(c.top))).size !== 1) out.push('cards are not in one row');
      }
    }

    // Beat text (current beat, without its title) in at most 3 lines at 1280 and wider.
    if (vw >= 1280) {
      const lines = cls('beat')[0] ? [...cls('beat')[0].querySelectorAll<HTMLElement>('[class*="_beatText_"]')].reduce((n, p) => n + Math.round(p.getBoundingClientRect().height / parseFloat(getComputedStyle(p).lineHeight)), 0) : 0;
      if (lines > 3) out.push(`current beat takes ${lines} lines at ${vw}px (max 3)`);
    }

    // Contrast of every visible text, against the nearest opaque background (the page is black).
    const parse = (c: string) => {
      const m = c.match(/rgba?\(([^)]+)\)/);
      if (!m) return [0, 0, 0, 1];
      const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
      return [p[0], p[1], p[2], p[3] ?? 1];
    };
    const over = (top: number[], under: number[]) => {
      const a = top[3];
      return [0, 1, 2].map((i) => top[i] * a + under[i] * (1 - a)).concat(1);
    };
    const bgOf = (el: Element) => {
      const layers: number[][] = [];
      for (let e: Element | null = el; e; e = e.parentElement) {
        const c = parse(getComputedStyle(e).backgroundColor);
        if (c[3] > 0) layers.push(c);
        if (c[3] === 1) break;
      }
      return layers.reduceRight((under, l) => over(l, under), [0, 0, 0, 1]);
    };
    const lum = (c: number[]) => {
      const f = (v: number) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
      return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
    };
    for (const el of textEls) {
      const cs = getComputedStyle(el);
      let alpha = 1;
      for (let e: Element | null = el; e; e = e.parentElement) alpha *= Number(getComputedStyle(e).opacity);
      const fg = parse(cs.color);
      const bg = bgOf(el);
      const text = over([fg[0], fg[1], fg[2], fg[3] * alpha], bg);
      const ratio = (Math.max(lum(text), lum(bg)) + 0.05) / (Math.min(lum(text), lum(bg)) + 0.05);
      const need = parseFloat(cs.fontSize) >= 24 ? 3 : 4.5;
      if (ratio < need) out.push(`contrast ${ratio.toFixed(2)} < ${need}: "${(el.textContent ?? '').trim().slice(0, 28)}" (${cs.color} on rgb(${bg.slice(0, 3).map(Math.round)}))`);
    }
    return out;
  });
}

async function shot(page: Page, vp: string, state: string) {
  const dir = path.join(SHOTS, vp);
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: path.join(dir, `${state}.png`) });
}

/** Wait for the dissolve and layout to settle. */
async function settle(page: Page) {
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => 0))));
  await page.waitForTimeout(120);
}

async function check(page: Page, vp: string, state: string, errors: string[]) {
  await settle(page);
  await shot(page, vp, state);
  const fails = await audit(page);
  expect(fails, `${vp} / ${state}`).toEqual([]);
  expect(errors, `console errors at ${vp} / ${state}`).toEqual([]);
}

async function newPage(browser: Browser, vp: { width: number; height: number }, reduced = false) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 160)));
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 160)));
  return { ctx, page, errors };
}

for (const vp of VIEWPORTS) {
  test(`/missions at ${vp.name}: every state`, async ({ browser }) => {
    const { ctx, page, errors } = await newPage(browser, vp);
    await page.goto('/missions');
    await page.waitForSelector('li[data-story]');
    await check(page, vp.name, 'list', errors);
    await expect(page.locator('li[data-story] button')).toHaveCount(3);

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
        const last = i === story.replies.length - 1;
        await check(page, vp.name, `${story.id}-beat${i + 2}${last ? '-final' : ''}`, errors);
      }
      // final beat: the note sits just before "See it yourself", and the three replies are there
      await expect(page.getByText('This opens the site as it is today, not the original landing day.')).toBeVisible();
      await expect(page.getByRole('button', { name: 'See it yourself' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Tell me another story' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Plan my own landing' })).toBeVisible();

      // "Tell me another story" → list, focus back on the card we came from
      await page.getByRole('button', { name: 'Tell me another story' }).click();
      await settle(page);
      await expect(page.locator('li[data-story] button')).toHaveCount(3);
      expect(await page.evaluate(() => document.activeElement?.closest('[data-story]')?.getAttribute('data-story'))).toBe(story.id);
    }

    // Esc and "← All stories" return to the list with focus on the card; the URL keeps the story on reload, Back/Forward work.
    await page.locator('li[data-story="apollo"] button').click();
    await settle(page);
    await page.getByRole('button', { name: 'Skip to the lesson' }).click();
    await check(page, vp.name, 'apollo-skip-to-lesson', errors);
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
    const seen: { top: number; left: number; name: string }[] = [];
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press('Tab');
      const p = await page.evaluate(() => {
        const e = document.activeElement as HTMLElement;
        const r = e.getBoundingClientRect();
        return { top: r.top + window.scrollY, left: r.left, name: (e.textContent ?? e.getAttribute('aria-label') ?? '').trim().slice(0, 24), inside: !!e.closest('[class*="_root_"]') };
      });
      if (!p.inside) break;
      seen.push(p);
    }
    expect(seen.length, 'tabbing reaches the story controls').toBeGreaterThan(1);
    for (let i = 1; i < seen.length; i++)
      expect(seen[i].top + 2 >= seen[i - 1].top, `tab order: "${seen[i - 1].name}" then "${seen[i].name}"`).toBe(true);

    // The actions of the final beat do what they say (once, at the projector size).
    if (vp.name === '1280x720') {
      await page.getByRole('button', { name: 'Skip to the lesson' }).click().catch(() => undefined);
      await page.getByRole('button', { name: 'So what does that mean?' }).click();
      await page.getByRole('button', { name: 'See it yourself' }).click();
      await expect(page).toHaveURL(/\/mission\/stand\?site=apollo-11/);
      await page.goto('/missions?story=apollo');
      await page.getByRole('button', { name: 'Skip to the lesson' }).click();
      await page.getByRole('button', { name: 'So what does that mean?' }).click();
      await page.getByRole('button', { name: 'Plan my own landing' }).click();
      await expect(page).toHaveURL(/\/mission(\?|$)/);
    }
    await ctx.close();
  });
}

test('reduced motion: nothing animates in the story area', async ({ browser }) => {
  const { ctx, page, errors } = await newPage(browser, VIEWPORTS[0], true);
  await page.goto('/missions');
  await page.waitForSelector('li[data-story]');
  await page.locator('li[data-story="apollo"] button').click();
  await page.waitForSelector('[aria-live="polite"]');
  const running = await page.evaluate(() => {
    const root = document.querySelector('[class*="_root_"]')!;
    return root.getAnimations({ subtree: true }).filter((a) => a.playState === 'running').map((a) => (a.effect as KeyframeEffect).target?.tagName);
  });
  expect(running).toEqual([]);
  await check(page, VIEWPORTS[0].name + '-reduced', 'apollo-beat1', errors);
  await ctx.close();
});

for (const vp of VIEWPORTS.slice(0, 4)) {
  test(`briefing path at ${vp.name}: "Explore past missions" lands on the same list`, async ({ browser }) => {
    const { ctx, page, errors } = await newPage(browser, vp, true); // reduced motion: no flight, same briefing
    await page.addInitScript(() => sessionStorage.setItem('refaey-home-intro-seen', '1'));
    await page.goto('/');
    await page.getByRole('button', { name: 'Begin the journey' }).click();
    await page.waitForSelector('section[role=dialog]', { timeout: 30_000 });
    for (let i = 0; i < 6 && (await page.locator('[data-reply]', { hasText: 'Explore past missions' }).count()) === 0; i++) {
      await page.locator('[data-reply]').first().click();
      await page.waitForTimeout(400);
    }
    await page.locator('[data-reply]', { hasText: 'Explore past missions' }).click();
    await page.waitForURL('**/missions');
    await page.waitForSelector('li[data-story]');
    await check(page, vp.name, 'list-via-briefing', errors);
    await ctx.close();
  });
}
