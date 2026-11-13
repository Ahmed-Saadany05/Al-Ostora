/**
 * Find the time closest to `target` that `works`. The shared DataProvider has no "coverage" call, so we probe:
 * a ladder of offsets (1 h … 1 yr) on both sides, nearest first (earlier side wins a tie, since recorded data
 * is usually in the past), then bisect between the last miss and the hit to tighten the answer.
 * Returns null if nothing on the ladder works. Pure, so it is easy to test.
 */
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
export const LADDER_MS = [1, 3, 6, 12].map((h) => h * HOUR).concat([1, 2, 4, 7, 14, 30, 60, 120, 240, 365].map((d) => d * DAY));
const REFINE_STEPS = 5;

export async function nearestWorking(target: number, works: (ms: number) => Promise<boolean>): Promise<number | null> {
  let missBefore = 0;
  let missAfter = 0;
  for (const d of LADDER_MS) {
    for (const side of [-1, 1] as const) {
      const t = target + side * d;
      if (await works(t)) return refine(target, side, side === -1 ? missBefore : missAfter, d, works);
      if (side === -1) missBefore = d;
      else missAfter = d;
    }
  }
  return null;
}

async function refine(target: number, side: -1 | 1, miss: number, hit: number, works: (ms: number) => Promise<boolean>) {
  let lo = miss; // offset known not to work (0 = target itself)
  let hi = hit; // offset known to work
  for (let i = 0; i < REFINE_STEPS && hi - lo > HOUR / 4; i++) {
    const mid = Math.round((lo + hi) / 2);
    if (await works(target + side * mid)) hi = mid;
    else lo = mid;
  }
  return target + side * hi;
}
