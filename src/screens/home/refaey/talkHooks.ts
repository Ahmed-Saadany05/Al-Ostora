/**
 * Refaey's speech, opened only when you ask (Pink): which lines you have already heard (for the "new" badge), where his
 * balloon goes so it covers the least, and which corner he docks in on the step screens.
 */
import { useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { collectWeighted, dockCost, dockRect, edgeMargin, pickDock, pickSide, safeRect, type BalloonSide, type DockCorner, type Spot } from './balloonPlace';
import type { Rect } from './placement';

// ---------------------------------------------------------------- heard lines

/** The lines heard during this visit (by content key), so coming back to a step does not flag the same line as new. */
const heard = new Set<string>();
export const markHeard = (key: string) => heard.add(key);
export const wasHeard = (key: string) => heard.has(key);

// ---------------------------------------------------------------- the balloon

const rectOf = (r: DOMRect): Rect => ({ x: r.left, y: r.top, w: r.width, h: r.height });
const same = (a: Spot | null, b: Spot) => !!a && a.side === b.side && Math.abs(a.x - b.x) < 2 && Math.abs(a.y - b.y) < 2 && Math.abs(a.tail - b.tail) < 2;

/**
 * Where the open balloon goes: beside `anchor`, on the side (from `sides`, in order of preference) where it covers the
 * least. Placed before the first paint, then kept up to date while it is open (resize, scroll, content changes, a moving
 * figure). While it closes it keeps its last spot.
 */
export function useBalloonSpot(open: boolean, anchor: RefObject<HTMLElement | null>, balloon: RefObject<HTMLElement | null>, sides: BalloonSide[], contentKey: unknown) {
  const [spot, setSpot] = useState<Spot | null>(null);
  const sidesKey = sides.join(',');
  useLayoutEffect(() => {
    if (!open) return;
    const order = sidesKey.split(',') as BalloonSide[];
    const place = () => {
      const a = anchor.current;
      const b = balloon.current;
      if (!a || !b) return;
      const next = pickSide(rectOf(a.getBoundingClientRect()), { w: b.offsetWidth, h: b.offsetHeight }, safeRect(12), collectWeighted(), order);
      setSpot((prev) => (same(prev, next) ? prev : next));
    };
    place();
    let raf = 0;
    const soon = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(place);
    };
    window.addEventListener('resize', soon);
    window.addEventListener('scroll', soon, true);
    const t = window.setInterval(place, 600);
    return () => {
      cancelAnimationFrame(raf);
      window.clearInterval(t);
      window.removeEventListener('resize', soon);
      window.removeEventListener('scroll', soon, true);
    };
  }, [open, anchor, balloon, sidesKey, contentKey]);
  return spot;
}

// ---------------------------------------------------------------- the dock

/**
 * The corner of the screen (between the header and the status bar) where he covers the least, for a figure that floats
 * over a page. Checked on arrival, on resize, after scrolling stops and every 1.5 s as the page fills in; he only moves
 * when the new corner is clearly better, and never while his balloon is open or the pointer is on him (`hold`).
 */
export function useDock(enabled: boolean, root: RefObject<HTMLElement | null>, hold: boolean, order: DockCorner[]) {
  const [box, setBox] = useState<Rect | null>(null);
  const corner = useRef<DockCorner | null>(null);
  const held = useRef(hold);
  held.current = hold;
  const orderKey = order.join(',');
  useLayoutEffect(() => {
    if (!enabled) return;
    const corners = orderKey.split(',') as DockCorner[];
    const place = (force: boolean) => {
      const el = root.current;
      if (!el || (held.current && !force)) return;
      const size = { w: el.offsetWidth, h: el.offsetHeight };
      if (!size.w || !size.h) return;
      const safe = safeRect(edgeMargin());
      const keep = collectWeighted();
      const best = pickDock(size, safe, keep, corners);
      const now = corner.current;
      if (!force && now && now !== best.corner && best.cost > dockCost(now, size, safe, keep) * 0.7 - 1) {
        // not clearly better: stay, but follow a resized safe area
        best.corner = now;
      }
      corner.current = best.corner;
      const next = dockRect(best.corner, size, safe);
      setBox((prev) => (prev && Math.abs(prev.x - next.x) < 1 && Math.abs(prev.y - next.y) < 1 ? prev : next));
    };
    place(true);
    let scrollEnd = 0;
    const onScroll = () => {
      window.clearTimeout(scrollEnd);
      scrollEnd = window.setTimeout(() => place(false), 250);
    };
    const onResize = () => place(true);
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onScroll, true);
    const t = window.setInterval(() => place(false), 1500);
    return () => {
      window.clearTimeout(scrollEnd);
      window.clearInterval(t);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [enabled, root, orderKey]);
  return box;
}
