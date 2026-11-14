/**
 * Shared by the Refaey browser checks (missions.e2e.ts, refaey.e2e.ts).
 * Modes: E2E_MODE = demo (default) | live (server started with VITE_DATA_PROVIDER=live, BASE_URL set) | blocked (live, with /api/horizons aborted).
 * Screenshots go OUTSIDE the repo: ~/Developer/Al-Ostora-shots/refaey-story/<mode>/<viewport>/<state>.png
 */
import { expect, type Browser, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

export const MODE = (process.env.E2E_MODE ?? 'demo') as 'demo' | 'live' | 'blocked';
export const LIVE = MODE !== 'demo';
export const SHOTS = path.join(homedir(), 'Developer', 'Al-Ostora-shots', 'refaey-story', MODE);
export const VIEWPORTS = [
  { name: '1280x720', width: 1280, height: 720 },
  { name: '1440x900', width: 1440, height: 900 },
  { name: '1920x1080', width: 1920, height: 1080 },
  { name: '1024x768', width: 1024, height: 768 },
  { name: '768x1024', width: 768, height: 1024 },
  { name: '390x844', width: 390, height: 844 },
];
/** The briefing was already played this session (so a test that needs the Home → briefing path starts fresh without it). */
export const BRIEFED = JSON.stringify({ state: { seen: {}, briefed: true }, version: 0 });

export type Failure = string;

/** Everything checked for one state. Runs in the page. */
export async function audit(page: Page): Promise<Failure[]> {
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
    add('figure', cls('actor'));
    add('balloon', cls('balloon'));
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
      if (el.closest('footer, [class*="_header_"], [data-refaey-stage]')) return false;
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

export async function shot(page: Page, vp: string, state: string) {
  const dir = path.join(SHOTS, vp);
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: path.join(dir, `${state}.png`) });
}

/** Wait for the dissolve and layout to settle. */
export async function settle(page: Page) {
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => 0))));
  await page.waitForTimeout(120);
}

export async function check(page: Page, vp: string, state: string, errors: string[]) {
  await settle(page);
  await shot(page, vp, state);
  const fails = await audit(page);
  expect(fails, `${vp} / ${state}`).toEqual([]);
  expect(errors, `console errors at ${vp} / ${state}`).toEqual([]);
}

export async function newPage(browser: Browser, vp: { width: number; height: number }, opts: { reduced?: boolean; briefed?: boolean } = {}) {
  const { reduced = false, briefed = false } = opts;
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  await ctx.addInitScript(
    ([store, isBriefed]) => {
      sessionStorage.setItem('refaey-home-intro-seen', '1');
      if (isBriefed && !sessionStorage.getItem('refaey-seen')) sessionStorage.setItem('refaey-seen', store as string);
    },
    [BRIEFED, briefed] as const,
  );
  // Blocked mode: the live provider cannot reach /api/horizons. Refaey must show no live numbers and nothing may crash.
  if (MODE === 'blocked') await ctx.route('**/api/horizons**', (r) => r.abort());
  const page = await ctx.newPage();
  const errors: string[] = [];
  const network = /Failed to load resource|net::ERR|Horizons|Failed to fetch/i;
  page.on('console', (m) => m.type() === 'error' && !(MODE === 'blocked' && network.test(m.text())) && errors.push(m.text().slice(0, 160)));
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 160)));
  return { ctx, page, errors };
}

const CARD = 'aside[aria-label="Refaey explains"]';

/**
 * The Refaey card on a planner screen: inside the viewport, no horizontal scroll, no overlap with any text or control on the
 * screen, a 40 px bust, text contrast, and (stage placement) at most 360 px wide.
 */
export async function cardAudit(page: Page, kind: 'row' | 'stage'): Promise<Failure[]> {
  return page.evaluate(
    ({ sel, kind }) => {
      const out: string[] = [];
      const card = document.querySelector(sel);
      if (!card) return ['no Refaey card on screen'];
      const vw = innerWidth;
      const vh = innerHeight;
      const R = (e: Element) => e.getBoundingClientRect();
      const c = R(card);
      if (document.documentElement.scrollWidth > vw) out.push(`horizontal scroll ${document.documentElement.scrollWidth} > ${vw}`);
      if (c.left < 0 || c.right > vw + 1 || c.top < 0) out.push(`card outside the viewport: ${Math.round(c.left)},${Math.round(c.top)} → ${Math.round(c.right)},${Math.round(c.bottom)}`);
      if (kind === 'stage' && c.width > 360.5) out.push(`stage card is ${Math.round(c.width)} px wide (max 360)`);
      const bust = card.querySelector('span');
      if (bust && Math.round(R(bust).width) !== 40) out.push(`bust is ${Math.round(R(bust).width)} px (should be 40)`);
      const vis = (e: Element) => {
        const cs = getComputedStyle(e);
        const r = R(e);
        return cs.display !== 'none' && cs.visibility !== 'hidden' && +cs.opacity > 0 && r.width > 2 && r.height > 2;
      };
      // everything on the screen that has text or can be used
      const root = document.querySelector('main') as Element;
      const things = [...root.querySelectorAll('*')].filter((e) => {
        if (card.contains(e) || e.contains(card) || !vis(e)) return false;
        const own = [...e.childNodes].some((n) => n.nodeType === 3 && (n.textContent ?? '').trim());
        return own || e.matches('button, a, input, select, h1, canvas, [class*="_tag_"], [class*="_peek_"], [class*="_launch_"], [class*="_titleBlock_"], [class*="_cmpCard_"]');
      });
      for (const e of things) {
        if (e.tagName === 'CANVAS' || e.matches('[class*="_stage_"], [class*="_cmpPage_"], [class*="_titleBlock_"]')) continue; // full-bleed scene and containers: their children are checked
        const r = R(e);
        if (Math.min(c.right, r.right) - Math.max(c.left, r.left) > 1 && Math.min(c.bottom, r.bottom) - Math.max(c.top, r.top) > 1)
          out.push(`card overlaps ${e.tagName.toLowerCase()} "${(e.textContent ?? '').trim().slice(0, 24)}"`);
      }
      // the status bar (sticky) must not cover the card
      const foot = document.querySelector('footer');
      if (foot && c.bottom > R(foot).top + 1 && c.top < vh) out.push('card is covered by the status bar');
      // contrast
      const parse = (s: string) => {
        const m = s.match(/rgba?\(([^)]+)\)/);
        if (!m) return [0, 0, 0, 1];
        const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
        return [p[0], p[1], p[2], p[3] ?? 1];
      };
      const over = (top: number[], under: number[]) => [0, 1, 2].map((i) => top[i] * top[3] + under[i] * (1 - top[3])).concat(1);
      const lum = (x: number[]) => {
        const f = (v: number) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
        return 0.2126 * f(x[0]) + 0.7152 * f(x[1]) + 0.0722 * f(x[2]);
      };
      for (const e of card.querySelectorAll('*')) {
        if (![...e.childNodes].some((n) => n.nodeType === 3 && (n.textContent ?? '').trim()) || !vis(e)) continue;
        const layers: number[][] = [];
        for (let p: Element | null = e; p; p = p.parentElement) {
          const b = parse(getComputedStyle(p).backgroundColor);
          if (b[3] > 0) layers.push(b);
          if (b[3] === 1) break;
        }
        const bg = layers.reduceRight((u, l) => over(l, u), [0, 0, 0, 1]);
        const fg = parse(getComputedStyle(e).color);
        const txt = over(fg, bg);
        const ratio = (Math.max(lum(txt), lum(bg)) + 0.05) / (Math.min(lum(txt), lum(bg)) + 0.05);
        const need = parseFloat(getComputedStyle(e).fontSize) >= 24 ? 3 : 4.5;
        if (ratio < need) out.push(`contrast ${ratio.toFixed(2)} < ${need}: "${(e.textContent ?? '').trim().slice(0, 24)}"`);
      }
      return out;
    },
    { sel: CARD, kind },
  );
}
