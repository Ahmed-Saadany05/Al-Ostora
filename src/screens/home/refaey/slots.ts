import type { PlaceCtx, Slot } from './placement';

/**
 * The candidate slots of each screen, in order of preference. Heights are CSS px and never above 320: the art is drawn at
 * 328 px in the hop sheet (its pixels are 1.375× the source), so 320 is the most it can show at 1× or less.
 */
const HEIGHTS = [320, 260, 200];
const LIST_HEIGHTS = [...HEIGHTS, 160];
const floatBox = (x: number, y: number, size: { w: number; h: number }) => ({ x: Math.round(x), y: Math.round(y), w: size.w, h: size.h });

/** Briefing (a full-screen scene with nothing else on it): float in the left third, vertically centred; the balloon is to his right. */
export const BRIEFING_SLOTS: Slot[] = [
  {
    id: 'briefing-float',
    pose: 'float',
    sides: ['right'],
    heights: HEIGHTS,
    figure: (c, s) => floatBox(c.viewport.w / 6 - s.w / 2, c.safe.y + (c.safe.h - s.h) / 2, s),
  },
];

const cardsTop = (c: PlaceCtx) => c.anchor('cards')?.y ?? null;

/** /missions list: stand on the top edge of the cards row at whichever end has free space above it; else float in the free space at the top right; the balloon toward the cards/inward. */
export const MISSIONS_LIST_SLOTS: Slot[] = [
  {
    id: 'list-stand-right',
    pose: 'stand',
    sides: ['above', 'left'],
    heights: LIST_HEIGHTS,
    ground: cardsTop,
    figure: (c, s) => {
      const cards = c.anchor('cards');
      return cards ? { x: Math.round(cards.x + cards.w - s.w - 16), y: Math.round(cards.y - s.h), w: s.w, h: s.h } : null;
    },
  },
  {
    id: 'list-stand-left',
    pose: 'stand',
    sides: ['above', 'right'],
    heights: LIST_HEIGHTS,
    ground: cardsTop,
    figure: (c, s) => {
      const cards = c.anchor('cards');
      return cards ? { x: Math.round(cards.x + 16), y: Math.round(cards.y - s.h), w: s.w, h: s.h } : null;
    },
  },
  {
    id: 'list-float-right',
    pose: 'float',
    sides: ['left'],
    heights: LIST_HEIGHTS,
    figure: (c, s) => floatBox(c.safe.x + c.safe.w - s.w - 48, c.safe.y, s),
  },
];

/** /missions story: float in the left column (where the old figure stood), balloon to his right; text grows downward. */
export const MISSIONS_STORY_SLOTS: Slot[] = [
  {
    id: 'story-float',
    pose: 'float',
    sides: ['right'],
    heights: HEIGHTS,
    figure: (c, s) => {
      const back = c.anchor('back');
      return floatBox(back ? back.x : c.safe.x, c.safe.y + Math.max(0, (c.safe.h - s.h) / 2), s);
    },
  },
];
