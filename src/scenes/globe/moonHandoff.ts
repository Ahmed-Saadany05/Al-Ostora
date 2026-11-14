/**
 * Home → Step 1 hand-off (owner: Pink).
 *
 * The Home Moon flies on its own full-page canvas to exactly where Step 1's Moon will sit (left
 * column, opening view, same light), then puts a snapshot of its last frame on the page (outside
 * React, so it is there through the route change and while Step 1 is still loading) and navigates.
 * Step 1 fades the snapshot away once its own imagery has loaded — so the page change is invisible.
 * Where Step 1's Moon sits is measured, never guessed: its box from a previous visit, or an invisible
 * copy of Step 1's own layout (same CSS classes) mounted for a moment.
 *
 * `preloadStep1()` fetches Step 1's 3D code and its opening imagery during Home's loading screen, so
 * the hand-off has nothing left to wait for, even on a cold deployed visit.
 */
import { MOON_TREK_LAYERS, tileGrid, tileUrl } from '../lib/moonTrek';
import { OPENING_VIEW, openingDistance, PICKER_FOV } from './pickerTypes';
import g from './globe.module.css';

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
  overlayTimer = window.setTimeout(() => releaseMoonHandoff(0), 12_000);
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

// ---------------------------------------------------------------- preload Step 1 (code + imagery)

const D2R = Math.PI / 180;
/** All tiles of levels 0–2, plus level 3 on the side of the Moon Step 1 opens on. */
function step1TileUrls(): string[] {
  const layer = MOON_TREK_LAYERS.mosaic;
  const la0 = OPENING_VIEW.lat * D2R;
  const lo0 = OPENING_VIEW.lon * D2R;
  const urls: string[] = [];
  for (let level = 0; level <= 3; level++) {
    const { cols, rows } = tileGrid(level);
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        if (level === 3) {
          // Tile centre; keep it if it faces the opening view (within ~100° of it).
          const lat = (90 - ((row + 0.5) * 180) / rows) * D2R;
          const lon = (-180 + ((col + 0.5) * 360) / cols) * D2R;
          const cos = Math.sin(la0) * Math.sin(lat) + Math.cos(la0) * Math.cos(lat) * Math.cos(lon - lo0);
          if (cos < Math.cos(100 * D2R)) continue;
        }
        urls.push(tileUrl(layer, level, row, col));
      }
    }
  }
  return urls;
}

export interface Step1Progress {
  done: number;
  total: number;
}
let step1Preload: Promise<void> | null = null;
let step1Progress: Step1Progress = { done: 0, total: 1 };
const listeners = new Set<(p: Step1Progress) => void>();

/** Progress of preloadStep1 (code counts as one item); subscribe for updates. Returns unsubscribe. */
export function onStep1Progress(fn: (p: Step1Progress) => void): () => void {
  listeners.add(fn);
  fn(step1Progress);
  return () => listeners.delete(fn);
}

/**
 * Fetch Step 1's 3D code and opening imagery into the browser cache (once per page load). A few
 * requests at a time, each with a timeout; failures are skipped (this only warms the cache).
 */
export function preloadStep1(): Promise<void> {
  if (step1Preload) return step1Preload;
  const urls = step1TileUrls();
  step1Progress = { done: 0, total: urls.length + 1 };
  const tick = () => {
    step1Progress = { ...step1Progress, done: step1Progress.done + 1 };
    listeners.forEach((fn) => fn(step1Progress));
  };
  const code = preloadPickerGlobe()
    .catch(() => undefined)
    .then(tick);
  const fetchOne = async (url: string) => {
    const ctl = new AbortController();
    const t = window.setTimeout(() => ctl.abort(), 10_000);
    try {
      const res = await fetch(url, { mode: 'cors', signal: ctl.signal });
      if (res.ok) await res.blob(); // read it fully so it is cached
    } catch {
      /* skipped: Step 1 will just fetch it itself */
    } finally {
      window.clearTimeout(t);
      tick();
    }
  };
  const queue = [...urls];
  const worker = async () => {
    while (queue.length) await fetchOne(queue.shift()!);
  };
  step1Preload = Promise.all([code, ...Array.from({ length: 6 }, worker)]).then(() => undefined);
  return step1Preload;
}

// ---------------------------------------------------------------- where Step 1's Moon sits

/** Step 1 reports its real globe box so later flights land on it exactly. */
export function rememberPickerStage(r: Rect) {
  try {
    sessionStorage.setItem(STAGE_KEY, JSON.stringify({ vw: innerWidth, vh: innerHeight, r }));
  } catch {
    /* private mode: prediction is used instead */
  }
}

/**
 * Step 1's globe box, measured: an invisible copy of its layout (frame → layout → left column + menu,
 * the same CSS classes) is placed under the header for a moment and the left column is read.
 */
/** Height of the app header (the --header-height token): Home hides its header, Step 1 shows it. */
function headerHeight(): number {
  const probe = document.createElement('div');
  probe.style.cssText = 'position:absolute;visibility:hidden;height:var(--header-height);';
  document.body.appendChild(probe);
  const h = probe.offsetHeight;
  probe.remove();
  return h;
}

function measureStage(): Rect | null {
  // Step 1 sits under the header. On Home (minimal chrome, no header) use the header's height instead.
  const header = document.querySelector('header')?.getBoundingClientRect().bottom ?? headerHeight();
  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText = `position:fixed;left:0;width:${document.documentElement.clientWidth}px;top:${header}px;visibility:hidden;pointer-events:none;z-index:-1;`;
  const frame = host.appendChild(document.createElement('div'));
  frame.className = g.frame;
  const layout = frame.appendChild(document.createElement('div'));
  layout.className = g.layout;
  const left = layout.appendChild(document.createElement('div'));
  left.className = g.left;
  layout.appendChild(document.createElement('nav')).className = g.menu;
  document.body.appendChild(host);
  const r = left.getBoundingClientRect();
  host.remove();
  return r.width > 0 && r.height > 0 ? { left: r.left, top: r.top, width: r.width, height: r.height } : null;
}

/** Step 1's globe box (viewport px): remembered from a previous visit at this window size, else measured. */
export function pickerStage(): Rect {
  try {
    const saved = JSON.parse(sessionStorage.getItem(STAGE_KEY) ?? 'null');
    if (saved && saved.vw === innerWidth && saved.vh === innerHeight) return saved.r as Rect;
  } catch {
    /* fall through to measuring */
  }
  return measureStage() ?? { left: 0, top: 0, width: innerWidth * 0.6, height: innerHeight * 0.7 };
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
