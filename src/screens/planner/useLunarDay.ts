/**
 * Owner: Aser. The lunar-day range every step shows. Anchored to the time store's stable
 * `rangeStart`, so scrubbing / Play / "Jump to best" never slide the strip.
 */
import { useTime } from '@/shared/store/time';
import { LUNAR } from '@/shared/types';

export function useLunarDay() {
  const time = useTime((s) => s.time);
  const from = useTime((s) => s.rangeStart);
  const to = new Date(Date.parse(from) + LUNAR.synodicDays * 86_400_000).toISOString();
  return { time, from, to, days: LUNAR.synodicDays };
}
