import { DEFAULT_PARAMS, LUNAR, type DayReport, type Params, type Site, type SkyState } from '../../types';
import type { DataProvider } from '../provider';
import { longestGapH, nextTransition, windowsFrom } from '../windows';
import {
  bodyPosition,
  demoHorizon,
  earthIllumination,
  subEarthPoint,
  subSolarPoint,
} from './demoModel';
import { SITE_CATALOGUE } from '@/data/sites';
import { horizonInfo } from '../../horizon';

const SUN_KM = 149_597_870;
const DEMO_TRANSIT_DAYS = 5;
const EARTH_RADIUS_KM = 6371;
const latency = <T,>(value: T, ms = 120) => new Promise<T>((r) => setTimeout(() => r(value), ms));
const p = (params?: Partial<Params>): Params => ({ ...DEFAULT_PARAMS, ...params });

function sky(site: Site, t: number, params: Params): SkyState {
  const horizon = demoHorizon(site, params.observerHeightM);
  const sun = bodyPosition(site, horizon, subSolarPoint(t), SUN_KM, LUNAR.sunDiameterDeg);
  const e = subEarthPoint(t);
  const earthDiameter = (2 * Math.atan(EARTH_RADIUS_KM / e.distanceKm) * 180) / Math.PI;
  const earth = bodyPosition(site, horizon, e, e.distanceKm, earthDiameter);
  return {
    source: 'demo',
    siteId: site.id,
    time: new Date(t).toISOString(),
    sun,
    earth: { ...earth, illumination: earthIllumination(t) },
    sunVisible: sun.visibleFraction > 0,
    earthVisible: earth.clearanceDeg >= params.commsMinClearanceDeg,
    horizon: horizonInfo('demo', site.lat),
  };
}

function report(site: Site, startMs: number, days: number, params: Params): DayReport {
  const stepMs = params.stepMinutes * 60_000;
  const n = Math.floor((days * 86_400_000) / stepMs) + 1;
  const samples = Array.from({ length: n }, (_, i) => sky(site, startMs + i * stepMs, params));
  return {
    source: 'demo',
    siteId: site.id,
    start: samples[0].time,
    end: samples[n - 1].time,
    stepMinutes: params.stepMinutes,
    samples,
    sunWindows: windowsFrom(samples, (s) => s.sunVisible, params.stepMinutes),
    earthWindows: windowsFrom(samples, (s) => s.earthVisible, params.stepMinutes),
  };
}

export const demoProvider: DataProvider = {
  id: 'demo',
  label: 'Demo data',

  // Sites are REAL (sourced catalogue); only the sky numbers are demo.
  listSites: () => latency(SITE_CATALOGUE),

  getHorizon: (site, params) => latency(demoHorizon(site, p(params).observerHeightM)),

  getSky: (site, time, params) => latency(sky(site, Date.parse(time), p(params))),

  getDayReport: (site, start, days = LUNAR.synodicDays, params) =>
    latency(report(site, Date.parse(start), days, p(params)), 200),

  async getMetrics(site, from, to, params) {
    const pp = p(params);
    const days = (Date.parse(to) - Date.parse(from)) / 86_400_000;
    const r = report(site, Date.parse(from), days, pp);
    const sun = (s: SkyState) => s.sunVisible;
    const earth = (s: SkyState) => s.earthVisible;
    const both = (s: SkyState) => s.sunVisible && s.earthVisible;
    const sunlitFraction = r.samples.filter(sun).length / r.samples.length;
    const earthVisibleFraction = r.samples.filter(earth).length / r.samples.length;
    const bothFraction = r.samples.filter(both).length / r.samples.length;
    const bothWindows = windowsFrom(r.samples, both, pp.stepMinutes);
    const bestWindow = bothWindows.reduce<(typeof bothWindows)[number] | null>(
      (best, w) => (!best || w.durationH > best.durationH ? w : best),
      null,
    );
    const longestNightH = longestGapH(r.samples, sun, pp.stepMinutes);
    return latency({
      source: 'demo' as const,
      siteId: site.id,
      from,
      to,
      sunlitFraction,
      earthVisibleFraction,
      maxSunElDeg: Math.max(...r.samples.map((s) => s.sun.elDeg)),
      longestNightH,
      longestCommsGapH: longestGapH(r.samples, earth, pp.stepMinutes),
      nextSunset: nextTransition(r.samples, sun, true),
      nextSunrise: nextTransition(r.samples, sun, false),
      nextEarthset: nextTransition(r.samples, earth, true),
      nextEarthrise: nextTransition(r.samples, earth, false),
      // Placeholder scores — the engine (Goda) defines the real formula.
      powerScore: Math.round(sunlitFraction * 100),
      commsScore: Math.round(earthVisibleFraction * 100),
      bothFraction,
      bestWindow,
      // Placeholder blend — the engine (Goda) defines and explains the real one.
      matchScore: Math.round(
        100 * (0.4 * sunlitFraction + 0.3 * earthVisibleFraction + 0.3 * Math.max(0, 1 - longestNightH / (days * 24))),
      ),
    }, 200);
  },

  planLaunch: (site, launchDate) =>
    latency({
      source: 'demo' as const,
      siteId: site.id,
      launchDate,
      landingDate: new Date(Date.parse(launchDate) + DEMO_TRANSIT_DAYS * 86_400_000).toISOString(),
      transitDays: DEMO_TRANSIT_DAYS,
      assumption: `Demo assumption: ${DEMO_TRANSIT_DAYS} days from launch to touchdown.`,
    }),
};
