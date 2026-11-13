import { useEffect, useMemo, useState } from 'react';
import { useMetrics, useSky } from '@/shared/data';
import { LUNAR, type IsoTime, type Site, type SiteMetrics, type SkyState } from '@/shared/types';

/**
 * Home's one read of the sky: a single useSky and a single useMetrics call for "now". No retries, no probing
 * for other times. Call this ONCE (in HomePage) and pass the result down: the shared query cache drops failed
 * entries, so every extra component calling these hooks after a failure would send the request again.
 */
export type SkyView =
  | { status: 'loading' }
  | { status: 'unavailable' } // error, no data for this time, or the provider took too long
  | { status: 'ready'; sky: SkyState; metrics: SiteMetrics | null };

/** How long to wait before showing "no data" for a provider that never answers. UI only; sends nothing. */
const GIVE_UP_MS = 4000;

export function useSkyView(site: Site | undefined, now: IsoTime): SkyView {
  const to = useMemo(() => new Date(Date.parse(now) + LUNAR.synodicDays * 86_400_000).toISOString(), [now]);
  const sky = useSky(site, now);
  const metrics = useMetrics(site, now, to);

  const [gaveUp, setGaveUp] = useState(false);
  const waiting = !!site && (sky.loading || metrics.loading);
  useEffect(() => {
    if (!waiting) return;
    const t = setTimeout(() => setGaveUp(true), GIVE_UP_MS);
    return () => clearTimeout(t);
  }, [waiting]);

  if (sky.data) return { status: 'ready', sky: sky.data, metrics: metrics.data ?? null };
  if (sky.error || (waiting && gaveUp)) return { status: 'unavailable' };
  return { status: 'loading' };
}
