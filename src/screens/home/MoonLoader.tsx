/**
 * First-visit loading screen (owner: Pink, on Hady's Home). Black, a thin progress line and one
 * quiet label. It covers Home until the Moon's imagery has arrived, so the intro always plays over
 * a finished Moon instead of tiles popping in mid-animation.
 *
 * Only appears if loading actually takes a moment (warm cache: never shown). Progress is half Home's
 * own Moon (Moon Trek tiles as they land, about EXPECTED_TILES for a first view) and half Step 1's
 * preload (its 3D code and opening imagery). It never claims 100 % until everything is ready.
 */
import { useEffect, useState } from 'react';
import { onStep1Progress, type Step1Progress } from '@/scenes';
import { LOADER_SPRITE, SpriteAnimation } from '@/shared/ui';
import s from './MoonLoader.module.css';

const SHOW_AFTER_MS = 300;
const EXPECTED_TILES = 80;
const FADE_MS = 700;

export function MoonLoader({ ready }: { ready: boolean }) {
  const [visible, setVisible] = useState(false);
  const [gone, setGone] = useState(false);
  const [tiles, setTiles] = useState(0);
  const [step1, setStep1] = useState<Step1Progress>({ done: 0, total: 1 });
  useEffect(() => onStep1Progress(setStep1), []);

  // Show only if it takes a while.
  useEffect(() => {
    if (ready) return;
    const t = window.setTimeout(() => setVisible(true), SHOW_AFTER_MS);
    return () => window.clearTimeout(t);
  }, [ready]);

  // Count imagery tiles as they land.
  useEffect(() => {
    if (ready || typeof PerformanceObserver === 'undefined') return;
    const isTile = (e: PerformanceEntry) => e.name.includes('trek.nasa.gov/tiles');
    setTiles(performance.getEntriesByType('resource').filter(isTile).length);
    const obs = new PerformanceObserver((list) => {
      const n = list.getEntries().filter(isTile).length;
      if (n) setTiles((x) => x + n);
    });
    try {
      obs.observe({ type: 'resource', buffered: false });
    } catch {
      return;
    }
    return () => obs.disconnect();
  }, [ready]);

  // Once ready, fade out, then unmount.
  useEffect(() => {
    if (!ready) return;
    const t = window.setTimeout(() => setGone(true), FADE_MS);
    return () => window.clearTimeout(t);
  }, [ready]);

  if (!visible || gone) return null;
  const home = Math.min(1, tiles / EXPECTED_TILES);
  const pre = step1.total > 0 ? step1.done / step1.total : 1;
  const progress = ready ? 1 : Math.min(0.96, 0.04 + 0.92 * (0.5 * home + 0.5 * pre));
  return (
    <div className={[s.loader, ready && s.out].filter(Boolean).join(' ')} role="status" aria-live="polite">
      <div className={s.inner}>
        {/* The loading animation (when a sprite sheet is set) replaces the label and the percentage; the bar stays. */}
        {LOADER_SPRITE ? (
          <>
            <SpriteAnimation sheet={LOADER_SPRITE} size="96px" className={s.sprite} />
            <span className={s.srOnly}>{ready ? 'Ready' : 'Loading the Moon'}</span>
          </>
        ) : (
          <span className={s.label}>{ready ? 'Ready' : 'Loading the Moon'}</span>
        )}
        <span className={[s.track, LOADER_SPRITE && s.trackFull].filter(Boolean).join(' ')} aria-hidden>
          <span className={s.bar} style={{ transform: `scaleX(${progress})` }} />
        </span>
        {!LOADER_SPRITE && <span className={['num', s.pct].join(' ')}>{Math.round(progress * 100)}%</span>}
        <span className={s.source}>Imagery · NASA Moon Trek, LRO</span>
      </div>
    </div>
  );
}
