/**
 * The Home Moon "parked" in the bottom-right corner while Refaey talks: where it sits (pure maths, shared by the scene
 * and by the page that keeps Refaey clear of it).
 */
/** The parked disc is this share of the viewport height across. */
export const PARK_DIAMETER_PER_HEIGHT = 0.24;
/** Gap from the right and bottom edges of the viewport, px. */
export const PARK_EDGE_PX = 48;
/** How far it bobs up and down while floating, px. */
export const PARK_BOB_PX = 6;
/** Spin while parked, radians per second (2° per second). */
export const PARK_SPIN = (2 * Math.PI) / 180;
export const PARK_SECONDS = 1.4;
export const UNPARK_SECONDS = 1.2;

export interface ParkRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The parked Moon's disc on screen (viewport px), and its centre and radius. */
export function parkedDisc(w: number, h: number) {
  const r = (PARK_DIAMETER_PER_HEIGHT * h) / 2;
  return { r, cx: w - PARK_EDGE_PX - r, cy: h - PARK_EDGE_PX - r };
}

/** The rectangle Refaey keeps clear of: the disc plus its bob room and 16 px. */
export function parkedKeepOut(w: number, h: number): ParkRect {
  const { r, cx, cy } = parkedDisc(w, h);
  const pad = PARK_BOB_PX + 16;
  return { x: cx - r - pad, y: cy - r - pad, w: 2 * r + 2 * pad, h: 2 * r + 2 * pad };
}
