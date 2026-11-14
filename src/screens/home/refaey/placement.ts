/**
 * Where Refaey goes on a screen: pure geometry, no DOM. A screen lists candidate slots in order of preference; the first
 * slot whose figure box and (worst-case) balloon box both stay clear of everything that matters, and inside the safe
 * viewport, wins. If none fits, the caller falls back to the compact card / the plain layout.
 */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export type Side = 'right' | 'left' | 'above';
export type Pose = 'stand' | 'float';

export interface PlaceCtx {
  viewport: { w: number; h: number };
  /** The part of the viewport Refaey may use: below the header, above the status bar. */
  safe: Rect;
  /** A page element's box by anchor name (data-refaey-anchor), or null if it is not there. */
  anchor: (name: string) => Rect | null;
}

export interface Slot {
  id: string;
  pose: Pose;
  sides: Side[];
  /** Candidate figure heights in CSS px, tried largest first (never above what the art can show at 1×). */
  heights: number[];
  /** The figure's box for a given size, or null if this slot does not apply on this layout. For a standing slot the box bottom IS the ground line. */
  figure: (ctx: PlaceCtx, size: { w: number; h: number }) => Rect | null;
  /** Standing slots: the ground line (y of the surface top) the feet must be on. */
  ground?: (ctx: PlaceCtx) => number | null;
}

export interface Chosen {
  slot: Slot;
  height: number;
  side: Side;
  figure: Rect;
  balloon: Rect;
}

export const KEEP_CLEAR = 16;
export const BALLOON = { w: 340, h: 300, gap: 20 };

/** The worst-case box of the balloon next to the figure on a given side (its anchor edge is fixed; it grows away from him). */
export function balloonBox(side: Side, fig: Rect, b = BALLOON): Rect {
  if (side === 'right') return { x: fig.x + fig.w + b.gap, y: fig.y, w: b.w, h: b.h };
  if (side === 'left') return { x: fig.x - b.gap - b.w, y: fig.y, w: b.w, h: b.h };
  return { x: fig.x + fig.w / 2 - b.w / 2, y: fig.y - b.gap - b.h, w: b.w, h: b.h };
}

const inside = (r: Rect, outer: Rect) => r.x >= outer.x && r.y >= outer.y && r.x + r.w <= outer.x + outer.w && r.y + r.h <= outer.y + outer.h;
/** True if the rects are closer than `gap` (or overlap). */
export const tooClose = (a: Rect, b: Rect, gap = KEEP_CLEAR) => a.x < b.x + b.w + gap && b.x < a.x + a.w + gap && a.y < b.y + b.h + gap && b.y < a.y + a.h + gap;
export const clear = (r: Rect, keepOuts: Rect[], gap = KEEP_CLEAR) => keepOuts.every((k) => !tooClose(r, k, gap));

export function chooseSlot(slots: Slot[], ctx: PlaceCtx, keepOuts: Rect[], figureAspect: number, b = BALLOON): Chosen | null {
  for (const slot of slots) {
    for (const height of slot.heights) {
      const figure = slot.figure(ctx, { w: height * figureAspect, h: height });
      if (!figure || !inside(figure, ctx.safe)) continue;
      // a standing figure touches the surface he stands on (its top edge is a keep-out too), so his box is checked 16 px short of the ground
      const checked = slot.ground ? { ...figure, h: figure.h - KEEP_CLEAR } : figure;
      if (!clear(checked, keepOuts)) continue;
      for (const side of slot.sides) {
        const balloon = balloonBox(side, figure, b);
        if (inside(balloon, ctx.safe) && clear(balloon, keepOuts)) return { slot, height, side, figure, balloon };
      }
    }
  }
  return null;
}
