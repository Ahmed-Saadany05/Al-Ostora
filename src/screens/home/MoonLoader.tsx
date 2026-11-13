/**
 * First-visit loading screen (owner: Pink, on Hady's Home). Black, a thin progress line and one
 * quiet label. It covers Home until the Moon's imagery has arrived, so the intro always plays over
 * a finished Moon instead of tiles popping in mid-animation.
 *
 * Only appears if loading actually takes a moment (warm cache: never shown). Progress counts the
 * Moon Trek tiles as they arrive (a typical first view needs about EXPECTED_TILES); it never claims
 * 100 % until the Moon reports ready.
 */
import { useEffect, useState } from 'react';
import s from './MoonLoader.module.css';

const SHOW_AFTER_MS = 300;
const EXPECTED_TILES = 80;
const FADE_MS = 700;

export function MoonLoader({ ready }: { ready: boolean }) {
  const [visible, setVisible] = useState(false);
  const [gone, setGone] = useState(false);
  const [tiles, setTiles] = useState(0);

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
  const progress = ready ? 1 : Math.min(0.94, 0.06 + (tiles / EXPECTED_TILES) * 0.88);
  return (
    <div className={[s.loader, ready && s.out].filter(Boolean).join(' ')} role="status" aria-live="polite">
      <div className={s.inner}>
        <span className={s.label}>{ready ? 'Ready' : 'Loading the Moon'}</span>
        <span className={s.track} aria-hidden>
          <span className={s.bar} style={{ transform: `scaleX(${progress})` }} />
        </span>
        <span className={['num', s.pct].join(' ')}>{Math.round(progress * 100)}%</span>
        <span className={s.source}>Imagery · NASA Moon Trek, LRO</span>
      </div>
    </div>
  );
}
