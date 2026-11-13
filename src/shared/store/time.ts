/**
 * GLOBAL TIME — one clock for the whole app (scenes, dashboards, countdowns).
 *
 *   const time = useTime((s) => s.time);            // ISO UTC string — the scrubbed moment
 *   const rangeStart = useTime((s) => s.rangeStart); // start of the lunar day being shown
 *
 * `rangeStart` is a STABLE anchor (UTC midnight). Scrubbing or playing inside the
 * range never moves it; it only jumps when `time` leaves the range. Timelines use it
 * so the strip doesn't slide under the cursor.
 *
 * Playback advances `speedHoursPerSec` simulated hours per real second.
 * <TimeTicker/> (mounted once in the app shell) drives playback.
 */
import { useEffect } from 'react';
import { create } from 'zustand';
import { LUNAR, type IsoTime } from '../types';

const RANGE_MS = LUNAR.synodicDays * 86_400_000;
/** Round to the minute so cache keys stay stable. */
const toIso = (ms: number) => new Date(Math.round(ms / 60_000) * 60_000).toISOString();
const midnight = (ms: number) => {
  const d = new Date(ms);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
};

/** Keep rangeStart unless `ms` falls outside [rangeStart, rangeStart + one lunar day]. */
const anchor = (rangeStart: IsoTime, ms: number) => {
  const r = Date.parse(rangeStart);
  return ms >= r && ms <= r + RANGE_MS ? rangeStart : midnight(ms);
};

interface TimeState {
  time: IsoTime;
  rangeStart: IsoTime;
  playing: boolean;
  speedHoursPerSec: number;
  setTime: (time: IsoTime | number) => void;
  shiftHours: (hours: number) => void;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  setSpeed: (hoursPerSec: number) => void;
  resetToNow: () => void;
}

export const useTime = create<TimeState>((set, get) => ({
  time: toIso(Date.now()),
  rangeStart: midnight(Date.now()),
  playing: false,
  speedHoursPerSec: 6,
  setTime: (t) => {
    const ms = typeof t === 'number' ? t : Date.parse(t);
    if (!Number.isFinite(ms)) return;
    set({ time: toIso(ms), rangeStart: anchor(get().rangeStart, ms) });
  },
  shiftHours: (h) => {
    let ms = Date.parse(get().time) + h * 3_600_000;
    const r = Date.parse(get().rangeStart);
    // While playing, loop within the lunar day shown instead of sliding the range.
    if (get().playing && ms > r + RANGE_MS) ms = r;
    set({ time: toIso(ms), rangeStart: anchor(get().rangeStart, ms) });
  },
  play: () => set({ playing: true }),
  pause: () => set({ playing: false }),
  toggle: () => set({ playing: !get().playing }),
  setSpeed: (speedHoursPerSec) => set({ speedHoursPerSec }),
  resetToNow: () => set({ time: toIso(Date.now()), rangeStart: midnight(Date.now()), playing: false }),
}));

/** Mount once (app shell). Advances time while playing. */
export function TimeTicker() {
  const playing = useTime((s) => s.playing);
  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    let acc = 0;
    let raf = 0;
    const loop = (now: number) => {
      acc += now - last;
      last = now;
      // Update ~10×/s: smooth enough, and avoids re-rendering every frame.
      if (acc >= 100) {
        const { speedHoursPerSec, shiftHours } = useTime.getState();
        shiftHours((acc / 1000) * speedHoursPerSec);
        acc = 0;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing]);
  return null;
}
