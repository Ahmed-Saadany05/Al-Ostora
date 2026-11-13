/**
 * Home → Step 1 hand-off (owner: Pink).
 *
 * The Home Moon flies on its own full-page canvas to exactly where Step 1's Moon will sit (left
 * column, opening view, same light), then puts a snapshot of its last frame on the page (outside
 * React, so it is there through the route change and while Step 1 is still loading) and navigates.
 * Step 1 fades the snapshot away once its own imagery has loaded — so the page change is invisible. If Step 1 has been opened before, its measured Moon rectangle is
 * reused for a pixel-exact landing; otherwise it is predicted from the page layout.
 */
import { OPENING_VIEW, openingDistance, PICKER_FOV } from './pickerTypes';

export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface MoonHandoff {
  /** PNG of Home's last flight frame (transparent sky). */
  snapshot: string | null;
  /** Where that snapshot sat on screen (Home's canvas box, viewport px). */
  rect: Rect;
}

const FRESH_MS = 4000;
const STAGE_KEY = 'refaey-picker-stage';
let pending: { at: number; data: MoonHandoff } | null = null;

let overlay: HTMLImageElement | null = null;
let overlayTimer = 0;

export function setMoonHandoff(data: MoonHandoff) {
  pending = { at: performance.now(), data };
  if (!data.snapshot) return;
  // Shown right now, above the page content (below the header), until Step 1 releases it.
  overlay?.remove();
  const img = document.createElement('img');
  img.src = data.snapshot;
  img.alt = '';
  img.setAttribute('aria-hidden', 'true');
  Object.assign(img.style, {
    position: 'fixed',
    left: `${data.rect.left}px`,
    top: `${data.rect.top}px`,
    width: `${data.rect.width}px`,
    height: `${data.rect.height}px`,
    zIndex: '11',
    pointerEvents: 'none',
    transition: 'opacity 0.45s ease-out',
  });
  document.body.appendChild(img);
  overlay = img;
  // Never leave it up for good if Step 1 is slow or never mounts a globe.
  window.clearTimeout(overlayTimer);
  overlayTimer = window.setTimeout(() => releaseMoonHandoff(0), 6000);
}

/** Fade the hand-off snapshot out (after `delayMs`) and remove it. */
export function releaseMoonHandoff(delayMs: number) {
  const img = overlay;
  if (!img) return;
  overlay = null;
  window.clearTimeout(overlayTimer);
  window.setTimeout(() => {
    img.style.opacity = '0';
    window.setTimeout(() => img.remove(), 500);
  }, delayMs);
}

/** The hand-off, once, if Home just flew here. */
export function takeMoonHandoff(): MoonHandoff | null {
  const p = pending;
  pending = null;
  return p && performance.now() - p.at < FRESH_MS ? p.data : null;
}

/** Start loading Step 1's 3D chunk early, so the page change has nothing to wait for. */
export const preloadPickerGlobe = () => import('./PickerGlobe3D');

// ---------------------------------------------------------------- where Step 1's Moon sits

/** Step 1 reports its real globe box so later flights land on it exactly. */
export function rememberPickerStage(r: Rect) {
  try {
    sessionStorage.setItem(STAGE_KEY, JSON.stringify({ vw: innerWidth, vh: innerHeight, r }));
  } catch {
    /* private mode: prediction is used instead */
  }
}

const cssPx = (expr: string, prop: 'width' | 'height' = 'width') => {
  const probe = document.createElement('div');
  probe.style.cssText = `position:absolute;visibility:hidden;${prop}:${expr}`;
  document.body.appendChild(probe);
  const v = prop === 'width' ? probe.offsetWidth : probe.offsetHeight;
  probe.remove();
  return v;
};

/** Step 1's globe box (viewport px): remembered from a previous visit, else predicted from the layout CSS. */
export function pickerStage(): Rect {
  try {
    const saved = JSON.parse(sessionStorage.getItem(STAGE_KEY) ?? 'null');
    if (saved && saved.vw === innerWidth && saved.vh === innerHeight) return saved.r as Rect;
  } catch {
    /* fall through to the prediction */
  }
  // Mirrors Page (wide) + globe.module.css .layout: page padding, a 380 px menu, 32 px gaps.
  const header = document.querySelector('header')?.getBoundingClientRect().bottom ?? cssPx('var(--header-height)', 'height');
  const gutter = cssPx('var(--gutter)');
  const contentMax = cssPx('var(--content-max)');
  const statusbar = cssPx('var(--statusbar-height)', 'height');
  const gap = cssPx('var(--space-6)');
  const vw = document.documentElement.clientWidth; // excludes a vertical scrollbar
  const pageWidth = Math.min(vw, contentMax + 2 * gutter);
  const left = (vw - pageWidth) / 2 + gutter;
  const innerWidthPx = pageWidth - 2 * gutter;
  const top = header + gap;
  const height = Math.max(520, innerHeight - header - statusbar - gap);
  return { left, top, width: innerWidthPx - 380 - gap, height };
}

/** The Moon's disc in Step 1's opening view: centre, radius in viewport px, and camera distance. */
export function pickerDisc(stage = pickerStage()) {
  // Perspective silhouette of a unit sphere seen from `distance` with a PICKER_FOV vertical view.
  const distance = openingDistance(stage.width, stage.height);
  const half = Math.tan(((PICKER_FOV / 2) * Math.PI) / 180);
  const radius = (stage.height / 2) * (1 / Math.sqrt(distance ** 2 - 1)) / half;
  return { x: stage.left + stage.width / 2, y: stage.top + stage.height / 2, radius, distance };
}

export { OPENING_VIEW };
