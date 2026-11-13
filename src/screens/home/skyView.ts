import { getProvider, useProviderQuery, type DataProvider, type Query } from '@/shared/data';
import { LUNAR, type IsoTime, type Site, type SiteMetrics, type SkyState } from '@/shared/types';
import { nearestWorking } from './nearest';

export interface SkyView {
  /** The moment the numbers are for. Equals "now" unless `recorded`. */
  time: IsoTime;
  /** True when "now" had no data and `time` is the nearest moment that does. */
  recorded: boolean;
  sky: SkyState;
  /** null when no range could be computed from `time`; the UI then omits the countdowns. */
  metrics: SiteMetrics | null;
}

const PROBE_TIMEOUT_MS = 3000;
/** Hard cap for the whole lookup, so a status panel can never spin forever. */
const TOTAL_TIMEOUT_MS = 10_000;
/** A provider that quietly answers for a different time (clamping) counts as "recorded" past this gap. */
const CLAMP_TOLERANCE_MS = 3_600_000;
const METRIC_RANGES_DAYS = [LUNAR.synodicDays, 7, 1];

class TimedOut extends Error {}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new TimedOut()), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

const iso = (ms: number) => new Date(Math.round(ms / 60_000) * 60_000).toISOString();

async function metricsFor(provider: DataProvider, site: Site, from: IsoTime): Promise<SiteMetrics | null> {
  for (const days of METRIC_RANGES_DAYS) {
    try {
      const to = new Date(Date.parse(from) + days * 86_400_000).toISOString();
      return await withTimeout(provider.getMetrics(site, from, to), PROBE_TIMEOUT_MS);
    } catch {
      /* try a shorter range */
    }
  }
  return null;
}

/** Sky + metrics for `now`; if `now` has no data, the nearest time that does. null = nothing available at all. */
export async function loadSkyView(provider: DataProvider, site: Site, now: IsoTime): Promise<SkyView | null> {
  const work = async (): Promise<SkyView | null> => {
    const nowMs = Date.parse(now);
    let sky: SkyState | null = null;
    let hung = false;
    try {
      sky = await withTimeout(provider.getSky(site, now), PROBE_TIMEOUT_MS);
    } catch (e) {
      hung = e instanceof TimedOut; // a provider that hangs will hang on every probe: don't search
    }

    if (sky && Math.abs(Date.parse(sky.time) - nowMs) <= CLAMP_TOLERANCE_MS) {
      return { time: now, recorded: false, sky, metrics: await metricsFor(provider, site, now) };
    }
    if (hung) return null;

    // "now" is outside the data (error, or the provider clamped to another time): use the nearest time that has data.
    let found: SkyState | null = sky;
    if (!found) {
      const ms = await nearestWorking(nowMs, async (t) => {
        try {
          found = await withTimeout(provider.getSky(site, iso(t)), PROBE_TIMEOUT_MS);
          return true;
        } catch {
          return false;
        }
      });
      if (ms === null) return null;
      // The last probe that succeeded is not always the refined answer; ask for it explicitly.
      try {
        found = await withTimeout(provider.getSky(site, iso(ms)), PROBE_TIMEOUT_MS);
      } catch {
        if (!found) return null;
      }
    }
    const time = (found as SkyState).time;
    return { time, recorded: true, sky: found as SkyState, metrics: await metricsFor(provider, site, time) };
  };

  try {
    return await withTimeout(work(), TOTAL_TIMEOUT_MS);
  } catch {
    return null;
  }
}

/** Never throws and always settles (data, or null = unavailable), so the UI cannot show an endless spinner. */
export function useSkyView(site: Site | undefined, now: IsoTime): Query<SkyView | null> {
  return useProviderQuery(site ? `home-skyview:${site.id}@${site.lat},${site.lon}:${now}` : null, (p) => loadSkyView(p, site!, now));
}

/** For the Demo/source badge when the lookup came back empty: only the active provider id is known. */
export const activeProviderId = () => getProvider().id;
