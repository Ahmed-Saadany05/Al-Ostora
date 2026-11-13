import type { IsoTime, SkyState, TimeWindow } from '../types';

/**
 * Turn a sampled series into continuous windows where `isOn` holds.
 * Shared helper: the demo provider and the real engine both use it.
 */
export function windowsFrom(
  samples: SkyState[],
  isOn: (s: SkyState) => boolean,
  stepMinutes: number,
): TimeWindow[] {
  const out: TimeWindow[] = [];
  let startIdx = -1;
  const close = (endIdx: number) => {
    const start = samples[startIdx].time;
    const end = samples[endIdx].time;
    out.push({
      start,
      end,
      durationH: (Date.parse(end) - Date.parse(start)) / 3_600_000 + stepMinutes / 60,
      clipped: startIdx === 0 || endIdx === samples.length - 1,
    });
  };
  samples.forEach((s, i) => {
    if (isOn(s) && startIdx < 0) startIdx = i;
    if (!isOn(s) && startIdx >= 0) {
      close(i - 1);
      startIdx = -1;
    }
  });
  if (startIdx >= 0) close(samples.length - 1);
  return out;
}

/** Longest stretch where `isOn` is false, hours. */
export function longestGapH(samples: SkyState[], isOn: (s: SkyState) => boolean, stepMinutes: number) {
  let best = 0;
  let run = 0;
  for (const s of samples) {
    run = isOn(s) ? 0 : run + 1;
    best = Math.max(best, run);
  }
  return (best * stepMinutes) / 60;
}

/** First sample after index 0 where the state flips from `from` to `!from`. */
export function nextTransition(
  samples: SkyState[],
  isOn: (s: SkyState) => boolean,
  from: boolean,
): IsoTime | null {
  for (let i = 1; i < samples.length; i++) {
    if (isOn(samples[i - 1]) === from && isOn(samples[i]) !== from) return samples[i].time;
  }
  return null;
}
