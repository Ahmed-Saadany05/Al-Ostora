/**
 * TIMELAPSE — move the global clock to a new moment smoothly instead of jumping (owner: Pink).
 *
 *   timelapseTo(iso)            // ~0.9 s eased sweep from the current time to `iso`
 *   cancelTimelapse()           // stop a running sweep where it is
 *
 * Short hops (under 3 h) still jump: a sweep would be too slow to notice. Playback is paused while
 * sweeping. Scenes that read `useTime` see every in-between moment, so the Sun and Earth travel.
 */
import type { IsoTime } from '../types';
import { useTime } from './time';

let raf = 0;
const MIN_SWEEP_MS = 3 * 3_600_000;

export function cancelTimelapse() {
  cancelAnimationFrame(raf);
  raf = 0;
}

export function timelapseTo(target: IsoTime | number, durationMs = 900) {
  cancelTimelapse();
  const state = useTime.getState();
  const from = Date.parse(state.time);
  const to = typeof target === 'number' ? target : Date.parse(target);
  if (!Number.isFinite(to)) return;
  if (state.playing) state.pause();
  if (!Number.isFinite(from) || Math.abs(to - from) < MIN_SWEEP_MS) {
    state.setTime(to);
    return;
  }
  // Longer jumps get a little more time, capped so it never drags.
  const days = Math.abs(to - from) / 86_400_000;
  const dur = Math.min(durationMs * 1.6, durationMs * (0.7 + days / 30));
  const t0 = performance.now();
  const step = (now: number) => {
    const k = Math.min(1, (now - t0) / dur);
    const e = k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2; // ease in-out
    useTime.getState().setTime(from + (to - from) * e);
    raf = k < 1 ? requestAnimationFrame(step) : 0;
  };
  raf = requestAnimationFrame(step);
}
