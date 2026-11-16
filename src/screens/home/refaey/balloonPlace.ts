/**
 * Where Refaey's speech balloon (and, on the step screens, Refaey himself) goes so it covers as little as possible of what
 * matters: buttons and links most of all, then headings, then text and pictures. Pure geometry (`pickSide`, `pickDock`) plus
 * one DOM reader (`collectWeighted`). Used by RefaeyTalk and the touchdown card (Pink).
 */
import type { Rect } from './placement';

export type BalloonSide = 'right' | 'left' | 'above' | 'below';
export interface Weighted extends Rect {
  /** How much covering it costs: 10 for controls, 2 for headings, 1 for text and pictures. */
  weight: number;
}

export interface Spot {
  side: BalloonSide | 'sheet';
  x: number;
  y: number;
  /** Where the tail meets the balloon edge, measured along that edge (px from its top or left). */
  tail: number;
}

const GAP = 14;
const PAD = 8;
/** What one pixel of distance from him costs, in covered px² (600 px away ≈ one line of text covered). */
const NEAR = 10;
const distance = (a: Rect, b: Rect) => Math.hypot(Math.max(0, b.x - (a.x + a.w), a.x - (b.x + b.w)), Math.max(0, b.y - (a.y + a.h), a.y - (b.y + b.h)));

const overlap = (a: Rect, b: Rect) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi));
/** The cost of putting a box here: the area of everything it covers (with a little breathing room), times how much each matters. */
export const cost = (r: Rect, keepOuts: Weighted[]) => {
  const grown = { x: r.x - PAD, y: r.y - PAD, w: r.w + 2 * PAD, h: r.h + 2 * PAD };
  return keepOuts.reduce((sum, k) => sum + overlap(grown, k) * k.weight, 0);
};
const fits = (r: Rect, safe: Rect) => r.x >= safe.x - 0.5 && r.y >= safe.y - 0.5 && r.x + r.w <= safe.x + safe.w + 0.5 && r.y + r.h <= safe.y + safe.h + 0.5;

/**
 * The balloon's spot beside `anchor` (his figure or his face). Each side in `sides` is tried with a few alignments; the
 * spot that covers the least wins (ties go to the earlier side). A spot must stay inside `safe` and off his own figure.
 * When no side has room (a phone with him in a corner), the balloon goes across the bottom of the safe area ('sheet').
 */
export function pickSide(anchor: Rect, size: { w: number; h: number }, safe: Rect, keepOuts: Weighted[], sides: BalloonSide[]): Spot {
  return scoreSide(anchor, size, safe, keepOuts, sides).spot;
}

/** `pickSide` with the cost of the chosen spot (Infinity for the no-room 'sheet'). */
export function scoreSide(anchor: Rect, size: { w: number; h: number }, safe: Rect, keepOuts: Weighted[], sides: BalloonSide[]): { spot: Spot; cost: number } {
  const helmetY = anchor.y + Math.min(anchor.h * 0.18, 44);
  const cx = anchor.x + anchor.w / 2;
  const keep = [...keepOuts, { ...anchor, weight: 8 }];
  let best: { spot: Spot; cost: number } | null = null;
  for (const side of sides) {
    const options: Rect[] = [];
    if (side === 'right' || side === 'left') {
      const x = side === 'right' ? anchor.x + anchor.w + GAP : anchor.x - GAP - size.w;
      for (const y of [helmetY - 28, anchor.y + anchor.h - size.h, safe.y + safe.h - size.h])
        options.push({ x, y: clamp(y, safe.y, safe.y + safe.h - size.h), ...size });
    } else {
      const y = side === 'above' ? anchor.y - GAP - size.h : anchor.y + anchor.h + GAP;
      for (const x of [cx - size.w / 2, anchor.x, anchor.x + anchor.w - size.w])
        options.push({ x: clamp(x, safe.x, safe.x + safe.w - size.w), y, ...size });
    }
    for (const r of options) {
      if (!fits(r, safe)) continue;
      // covering less wins; among equals, closer to him (a balloon far from its speaker reads as someone else's)
      const covered = cost(r, keep);
      const away = distance(anchor, r);
      const c = covered + away * NEAR;
      if (best && c >= best.cost) continue;
      const tail = side === 'right' || side === 'left' ? clamp(helmetY - r.y, 14, size.h - 28) : clamp(cx - r.x, 18, size.w - 18);
      best = { spot: { side, x: Math.round(r.x), y: Math.round(r.y), tail: Math.round(tail) }, cost: c };
      if (covered === 0 && away <= GAP + 1) return best;
    }
  }
  if (best) return best;
  return { spot: { side: 'sheet', x: Math.round(safe.x + (safe.w - size.w) / 2), y: Math.round(safe.y + safe.h - size.h), tail: 0 }, cost: Infinity };
}

export type DockCorner = 'bottom-left' | 'bottom-right' | 'middle-left' | 'middle-right' | 'top-left' | 'top-right';
export const DOCK_ORDER: DockCorner[] = ['bottom-left', 'bottom-right', 'middle-left', 'middle-right', 'top-left', 'top-right'];

/** The figure box in one corner of the safe area. */
export function dockRect(corner: DockCorner, size: { w: number; h: number }, safe: Rect): Rect {
  const left = safe.x;
  const right = safe.x + safe.w - size.w;
  const top = safe.y;
  const bottom = safe.y + safe.h - size.h;
  const middle = safe.y + (safe.h - size.h) / 2;
  const x = corner.endsWith('left') ? left : right;
  const y = corner.startsWith('top') ? top : corner.startsWith('middle') ? middle : bottom;
  return { x: Math.round(x), y: Math.round(y), ...size };
}

/** A typical open balloon, for judging whether a corner leaves his words room. */
export const TYPICAL_BALLOON = { w: 340, h: 170 };
const ALL_SIDES: BalloonSide[] = ['right', 'left', 'above', 'below'];

/**
 * What docking in a corner costs: what his figure covers there, plus half of what his balloon would cover when opened
 * from there (a corner with no room for his words at all costs as much as covering a button with him).
 */
export function dockCost(corner: DockCorner, size: { w: number; h: number }, safe: Rect, keepOuts: Weighted[], balloon = TYPICAL_BALLOON): number {
  const fig = dockRect(corner, size, safe);
  const b = { w: Math.min(balloon.w, safe.w), h: balloon.h };
  const words = scoreSide(fig, b, safe, keepOuts, ALL_SIDES).cost;
  return cost(fig, keepOuts) + 0.5 * (Number.isFinite(words) ? words : b.w * b.h);
}

/** The corner that costs the least (ties go to the earlier corner in `order`). */
export function pickDock(size: { w: number; h: number }, safe: Rect, keepOuts: Weighted[], order: DockCorner[] = DOCK_ORDER): { corner: DockCorner; cost: number } {
  let best = { corner: order[0], cost: Infinity };
  for (const corner of order) {
    const c = dockCost(corner, size, safe, keepOuts);
    if (c < best.cost) best = { corner, cost: c };
    if (c === 0) break;
  }
  return best;
}

// ---------------------------------------------------------------- DOM

const SELECTOR = 'a,button,input,select,textarea,[role="button"],[role="tab"],[role="slider"],[role="switch"],[role="link"],[data-refaey-avoid],h1,h2,h3,h4,h5,h6,p,label,li,img,svg,canvas';
const CONTROL = 'a,button,input,select,textarea,[role="button"],[role="tab"],[role="slider"],[role="switch"],[role="link"],[data-refaey-avoid]';
const HEADING = /^H[1-6]$/;
const TEXT = /^(P|H[1-6]|LABEL|LI)$/;
/** Refaey's own pieces: never something he must avoid. */
const OWN = '[data-refaey-talk],[data-refaey-balloon],[data-refaey-peek]';

const rectOf = (r: { left: number; top: number; width: number; height: number }): Rect => ({ x: r.left, y: r.top, w: r.width, h: r.height });
function textRect(el: Element): Rect | null {
  const range = document.createRange();
  range.selectNodeContents(el);
  const r = range.getBoundingClientRect();
  return r.width > 0 && r.height > 0 ? rectOf(r) : null;
}

/**
 * Everything on screen he should not cover, weighted: controls 10, headings 2, text and pictures 1. A 3D canvas counts only
 * a little (0.05: he may float over the sky, but an empty spot is still better). Left out: his own figure and balloon,
 * hidden things, things off screen, and anything bigger than half the viewport other than a canvas (a backdrop is not content).
 */
export function collectWeighted(): Weighted[] {
  const out: Weighted[] = [];
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  document.querySelectorAll(SELECTOR).forEach((el) => {
    if (el.closest(OWN)) return;
    if (el.closest('[aria-hidden="true"]') && !el.hasAttribute('data-refaey-avoid')) return;
    const box = el.getBoundingClientRect();
    if (box.width === 0 || box.height === 0 || box.bottom < 0 || box.top > vh || box.right < 0 || box.left > vw) return;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.opacity === '0') return;
    const isCanvas = el.tagName === 'CANVAS';
    if (!isCanvas && box.width * box.height > vw * vh * 0.5) return;
    // inside a control, the control itself counts (not its icon and label again)
    if (!el.matches(CONTROL) && el.parentElement?.closest(CONTROL)) return;
    const r = TEXT.test(el.tagName) ? textRect(el) : rectOf(box);
    if (!r) return;
    const weight = isCanvas ? 0.05 : el.matches(CONTROL) ? 10 : HEADING.test(el.tagName) ? 2 : 1;
    out.push({ ...r, weight });
  });
  return out;
}

/** The side margin he keeps from the screen edge: the page gutter on wide screens, 12 px on phones. */
export const edgeMargin = () => {
  const vw = window.innerWidth;
  return vw < 600 ? 12 : Math.min(Math.max(24, vw * 0.04), 76);
};

/** The part of the viewport between the app header and the status bar, with a margin on every side. */
export function safeRect(margin: number, marginY = Math.min(margin, 16)): Rect {
  let top = 0;
  let bottom = window.innerHeight;
  // the app's own header and status bar (siblings of <main>), not a page's inner <header>/<footer>
  const h = document.querySelector(':has(> #main) > header');
  const f = document.querySelector('#main ~ footer');
  if (h) top = Math.max(0, h.getBoundingClientRect().bottom);
  if (f) bottom = Math.min(bottom, f.getBoundingClientRect().top);
  return { x: margin, y: top + marginY, w: window.innerWidth - 2 * margin, h: bottom - top - 2 * marginY };
}
