/**
 * The live DataProvider: JPL Horizons (via our proxy, cached) + LOLA horizon profiles.
 * createLiveProvider() takes its inputs as arguments so tests can run without the network.
 */
import type { HorizonsResponse } from '@/data/horizons/types';
import type { DataProvider } from '@/shared/data/provider';
import {
  LUNAR,
  type DayReport,
  type HorizonProfile,
  type IsoTime,
  type LaunchPlan,
  type Params,
  type Site,
} from '@/shared/types';
import { computeMetrics, intervals, isEarth, isSun, landingOf, scanGrid, toWindows, type SkyAt } from './analysis';
import {
  DEFAULT_TRANSIT_ID,
  ENGINE_DEFAULTS,
  landingMsFromLaunch,
  OBSERVER_HEIGHT_M,
  TRANSIT_PRESETS,
  transitPreset,
} from './constants';
import { EphemerisStore, type Fetcher, type RecordedLoader } from './ephemeris';
import { makeHorizonCache, type ProfileLoader } from './horizon';
import { computeSky } from './sky';
import type { EngineMetrics, EngineParams, EngineSkyState } from './types';

export interface LiveDeps {
  fetcher: Fetcher;
  loadProfile: ProfileLoader;
  loadRecorded?: RecordedLoader;
  listSites: () => Promise<Site[]>;
  /** Delays between retries of a failed Horizons request (default 1 s, 3 s). */
  retryDelaysMs?: readonly number[];
}

export interface LiveProvider extends DataProvider {
  getSky(site: Site, time: IsoTime, params?: Partial<Params>): Promise<EngineSkyState>;
  getMetrics(site: Site, from: IsoTime, to: IsoTime, params?: Partial<EngineParams>): Promise<EngineMetrics>;
  planLaunch(site: Site, launchDate: IsoTime, transitId?: string): Promise<LaunchPlan>;
  /** Exposed for tests and the Verify screen. */
  readonly store: EphemerisStore;
}

/** Shared defaults + engine defaults. Observer height is fixed at 2 m (decided). */
export function resolveParams(p?: Partial<EngineParams>): EngineParams {
  const merged = { ...ENGINE_DEFAULTS, ...stripUndefined(p) } as EngineParams;
  merged.observerHeightM = OBSERVER_HEIGHT_M;
  return merged;
}

function stripUndefined<T extends object>(o?: T): Partial<T> {
  if (!o) return {};
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;
}

function parseTime(t: IsoTime, what: string): number {
  const ms = Date.parse(t);
  if (!Number.isFinite(ms)) throw new Error(`${what} is not a valid ISO time: "${t}"`);
  return ms;
}

export function createLiveProvider(deps: LiveDeps): LiveProvider {
  const store = new EphemerisStore(deps.fetcher, deps.loadRecorded, deps.retryDelaysMs);
  const horizonFor = makeHorizonCache(deps.loadProfile);

  /** Sky function over data already in the store (sync; throws if a time is not covered). */
  const skyFn = (site: Site, horizon: HorizonProfile, margin: number): SkyAt => (ms) => {
    const sun = store.sample(site, 'sun', ms);
    const earth = store.sample(site, 'earth', ms);
    if (!sun || !earth) throw new Error(`No ephemeris for ${site.id} at ${new Date(ms).toISOString()}`);
    return computeSky(site, ms, sun, earth, horizon, margin);
  };

  /** Load [from, to]; throw a clear error if any part has no data. */
  async function loadRange(site: Site, fromMs: number, toMs: number) {
    await store.ensure(site, fromMs, toMs);
    const step = 60 * 60_000;
    for (let t = fromMs; ; t = Math.min(toMs, t + step)) {
      if (!store.covered(site, t))
        throw new Error(
          `No Sun/Earth data for ${site.name} at ${new Date(t).toISOString()} ` +
            `(Horizons unreachable; recorded: ${store.coverage(site)})`,
        );
      if (t === toMs) break;
    }
  }

  return {
    id: 'live',
    label: 'Live NASA data',
    store,

    listSites: () => deps.listSites(),

    getHorizon: (site) => horizonFor(site),

    async getSky(site, time, params) {
      const p = resolveParams(params);
      const ms = parseTime(time, 'time');
      const horizon = await horizonFor(site);
      if (!store.covered(site, ms)) await store.ensure(site, ms, ms);
      store.prefetchAfter(site, ms);
      if (store.covered(site, ms)) return skyFn(site, horizon, p.commsMinClearanceDeg)(ms);
      const near = store.nearestCovered(site, ms);
      if (near === null)
        throw new Error(`No Sun/Earth data for ${site.name} near ${time}: Horizons unreachable and nothing recorded`);
      return {
        ...skyFn(site, horizon, p.commsMinClearanceDeg)(near),
        requestedTime: new Date(ms).toISOString(),
        fallback: 'nearest-recorded',
      };
    },

    async getDayReport(site, start, days = LUNAR.synodicDays, params): Promise<DayReport> {
      const p = resolveParams(params);
      if (!(days > 0)) throw new Error('getDayReport: days must be > 0');
      if (!(p.stepMinutes > 0)) throw new Error('getDayReport: stepMinutes must be > 0');
      const fromMs = parseTime(start, 'start');
      const toMs = fromMs + days * 86_400_000;
      const horizon = await horizonFor(site);
      await loadRange(site, fromMs, toMs);
      const sky = skyFn(site, horizon, p.commsMinClearanceDeg);
      const step = p.stepMinutes * 60_000;
      const samples: EngineSkyState[] = [];
      for (let t = fromMs; t <= toMs; t += step) samples.push(sky(t));
      const grid = scanGrid(sky, fromMs, toMs);
      return {
        source: 'computed',
        siteId: site.id,
        start: new Date(fromMs).toISOString(),
        end: new Date(toMs).toISOString(),
        stepMinutes: p.stepMinutes,
        samples,
        sunWindows: toWindows(intervals(sky, grid, isSun), fromMs, toMs),
        earthWindows: toWindows(intervals(sky, grid, isEarth), fromMs, toMs),
      };
    },

    async getMetrics(site, from, to, params) {
      const p = resolveParams(params);
      const fromMs = parseTime(from, 'from');
      const toMs = parseTime(to, 'to');
      const horizon = await horizonFor(site);
      const landingMs = landingOf(p, fromMs).ms;
      await loadRange(site, Math.min(fromMs, landingMs), Math.max(toMs, landingMs));
      return computeMetrics(site.id, skyFn(site, horizon, p.commsMinClearanceDeg), fromMs, toMs, p);
    },

    async planLaunch(site, launchDate, transitId = DEFAULT_TRANSIT_ID) {
      const preset = transitPreset(transitId);
      const launchMs = parseTime(launchDate, 'launchDate');
      return {
        source: 'computed',
        siteId: site.id,
        launchDate: new Date(launchMs).toISOString(),
        landingDate: new Date(landingMsFromLaunch(launchMs, transitId)).toISOString(),
        transitDays: preset.days,
        assumption: transitAssumption(preset.days, preset.label),
      };
    },
  };
}

/**
 * Trip time is a mission's design choice (route and fuel), not something the date or site
 * decides, so the note says so and gives the real range (decided 2026-11-14).
 */
export function transitAssumption(days: number, label: string): string {
  const fast = TRANSIT_PRESETS.find((t) => t.id === 'apollo-11')!;
  const slow = TRANSIT_PRESETS.find((t) => t.id === 'blue-ghost-1')!;
  const plain = (l: string) => l.replace(/ \((\d{4})\)$/, ', $1'); // "Apollo 11 (1969)" → "Apollo 11, 1969"
  return (
    `Trip time is chosen by each mission (its route and fuel), not set by the date or site: ` +
    `real landers took from ${fast.days} days (${plain(fast.label)}, fast route) to ${slow.days} days ` +
    `(${plain(slow.label)}, low-energy route). We assume ${days} days, like ${label}.`
  );
}

/** Recorded proxy responses → loader (used by index.ts with Vite's import.meta.glob). */
export function recordedFrom(mods: Record<string, () => Promise<HorizonsResponse>>): RecordedLoader {
  return () => Promise.all(Object.values(mods).map((load) => load()));
}
