/**
 * Refaey's end-of-plan story (request from Hady, decided with Goda 2026-11-13):
 *  - firstLunarDayHours: hours with any part of the Sun / Earth in view, from landing to
 *    landing + one lunar day (29.53 d). Same definitions as the scores.
 *  - suggestAlternatives: compare the player's choice with up to 4 catalogue sites within
 *    ~15 km and the same site landing ±2, ±5, ±10 days. Return the option with the most
 *    extra sunlight that keeps Earth in view at least as long, passes the must-pass gates
 *    (Sun AND Earth at its own landing), and gains at least 1 h. Otherwise null.
 */
import { LUNAR, type IsoTime, type Site } from '@/shared/types';
import { haversineKm } from './geometry';
import type { EngineParams } from './types';

export const NEARBY_KM = 15;
export const MAX_NEARBY_SITES = 4;
export const DATE_SHIFTS_DAYS = [-2, 2, -5, 5, -10, 10] as const;
export const MIN_SUN_GAIN_H = 1;
const DAY_MS = 86_400_000;
const LUNAR_DAY_MS = LUNAR.synodicDays * DAY_MS;

export interface DayHours {
  sunHours: number;
  earthHours: number;
  /** Sun AND Earth in view at the landing time. */
  gatesOk: boolean;
  from: IsoTime;
  to: IsoTime;
}

export interface Alternative {
  kind: 'site' | 'date';
  siteId?: string;
  landingIso: IsoTime;
  /** Extra hours of sunlight in the first lunar day (≥ 1). */
  sunHoursGain: number;
  /** Change in Earth-in-view hours (≥ 0). */
  earthHoursDelta: number;
  baseline: { sunHours: number; earthHours: number };
  candidate: { sunHours: number; earthHours: number };
  /** Only for kind 'site': distance from the player's site, km. */
  distanceKm?: number;
  /** Only for kind 'date': days moved (negative = earlier). */
  shiftDays?: number;
}

/** Measures one site + landing time. Backed by the live provider; injectable for tests. */
export type Measure = (site: Site, landingMs: number, params?: Partial<EngineParams>) => Promise<DayHours>;

/** Measure via getMetrics over [landing, landing + 1 lunar day], gates at landing. */
export function measureWith(
  getMetrics: (site: Site, from: IsoTime, to: IsoTime, p?: Partial<EngineParams>) => Promise<{
    sunlitFraction: number;
    earthVisibleFraction: number;
    gates: { sunAtLanding: boolean; earthAtLanding: boolean };
    from: IsoTime;
    to: IsoTime;
  }>,
): Measure {
  return async (site, landingMs, params) => {
    const from = new Date(landingMs).toISOString();
    const to = new Date(landingMs + LUNAR_DAY_MS).toISOString();
    const { launchTime: _l, transitId: _t, ...rest } = params ?? {};
    const m = await getMetrics(site, from, to, { ...rest, landingTime: from });
    const hours = LUNAR_DAY_MS / 3_600_000;
    return {
      sunHours: m.sunlitFraction * hours,
      earthHours: m.earthVisibleFraction * hours,
      gatesOk: m.gates.sunAtLanding && m.gates.earthAtLanding,
      from: m.from,
      to: m.to,
    };
  };
}

export function nearbySites(site: Site, catalogue: Site[]): { site: Site; km: number }[] {
  return catalogue
    .filter((s) => s.id !== site.id && !(s.lat === site.lat && s.lon === site.lon))
    .map((s) => ({ site: s, km: haversineKm(site.lat, site.lon, s.lat, s.lon) }))
    .filter((x) => x.km <= NEARBY_KM)
    .sort((a, b) => a.km - b.km)
    .slice(0, MAX_NEARBY_SITES);
}

function parse(landingIso: IsoTime): number {
  const ms = Date.parse(landingIso);
  if (!Number.isFinite(ms)) throw new Error(`landingIso is not a valid ISO time: "${landingIso}"`);
  return ms;
}

export function makeAlternatives(measure: Measure, listSites: () => Promise<Site[]>) {
  async function firstLunarDayHours(site: Site, landingIso: IsoTime, params?: Partial<EngineParams>) {
    return measure(site, parse(landingIso), params);
  }

  async function suggestAlternatives(
    site: Site,
    landingIso: IsoTime,
    params?: Partial<EngineParams>,
  ): Promise<Alternative | null> {
    const landingMs = parse(landingIso);
    const base = await measure(site, landingMs, params); // errors here are real errors
    const baseline = { sunHours: base.sunHours, earthHours: base.earthHours };

    type Cand = Omit<Alternative, 'sunHoursGain' | 'earthHoursDelta' | 'baseline' | 'candidate'> & {
      site: Site;
      ms: number;
    };
    const cands: Cand[] = [
      ...nearbySites(site, await listSites()).map(({ site: s, km }) => ({
        kind: 'site' as const,
        siteId: s.id,
        site: s,
        ms: landingMs,
        landingIso: new Date(landingMs).toISOString(),
        distanceKm: km,
      })),
      ...DATE_SHIFTS_DAYS.map((d) => ({
        kind: 'date' as const,
        site,
        ms: landingMs + d * DAY_MS,
        landingIso: new Date(landingMs + d * DAY_MS).toISOString(),
        shiftDays: d,
      })),
    ];

    let best: Alternative | null = null;
    for (const c of cands) {
      let h: DayHours;
      try {
        h = await measure(c.site, c.ms, params);
      } catch {
        continue; // no data for this option (e.g. offline): skip it, don't guess
      }
      const gain = h.sunHours - base.sunHours;
      const earthDelta = h.earthHours - base.earthHours;
      if (!h.gatesOk || gain < MIN_SUN_GAIN_H || earthDelta < 0) continue;
      if (best && gain <= best.sunHoursGain) continue;
      const { site: _s, ms: _m, ...rest } = c;
      best = {
        ...rest,
        sunHoursGain: gain,
        earthHoursDelta: earthDelta,
        baseline,
        candidate: { sunHours: h.sunHours, earthHours: h.earthHours },
      };
    }
    return best;
  }

  return { firstLunarDayHours, suggestAlternatives };
}
