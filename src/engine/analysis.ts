/**
 * Windows with refined edges, metrics, power and scores (pure functions over a sky function).
 * ENGINE_SPEC.md §3 (best window), §5 (power), §6 (scores).
 */
import type { IsoTime, TimeWindow } from '@/shared/types';
import {
  AU_KM,
  landingMsFromLaunch,
  PANEL_EFFICIENCY,
  REFINE_TOLERANCE_S,
  SCAN_STEP_MIN,
  SOLAR_CONSTANT_W_M2,
} from './constants';
import { clamp, DEG } from './geometry';
import type { EngineMetrics, EngineParams, EngineSkyState, PanelType, ScoreLine } from './types';

export type SkyAt = (ms: number) => EngineSkyState;
export type Pred = (s: EngineSkyState) => boolean;
type Interval = [number, number];

const iso = (ms: number) => new Date(ms).toISOString();
const H = 3_600_000;

export const isSun: Pred = (s) => s.sunVisible;
export const isEarth: Pred = (s) => s.earthVisible;
export const isBoth: Pred = (s) => s.sunVisible && s.earthVisible;

/** Grid of sky states from `fromMs` to `toMs` inclusive. */
export function scanGrid(skyAt: SkyAt, fromMs: number, toMs: number, stepMin = SCAN_STEP_MIN) {
  const step = stepMin * 60_000;
  const times: number[] = [];
  for (let t = fromMs; t < toMs; t += step) times.push(t);
  times.push(toMs);
  return { times, states: times.map(skyAt) };
}

/** Bisect a state change between a (pred = va) and b to REFINE_TOLERANCE_S. */
function refine(skyAt: SkyAt, pred: Pred, a: number, b: number, va: boolean): number {
  while (b - a > REFINE_TOLERANCE_S * 1000) {
    const m = (a + b) / 2;
    if (pred(skyAt(m)) === va) a = m;
    else b = m;
  }
  return Math.round((a + b) / 2 / 1000) * 1000;
}

/** Intervals where `pred` holds, edges refined between grid samples. */
export function intervals(
  skyAt: SkyAt,
  grid: { times: number[]; states: EngineSkyState[] },
  pred: Pred,
): Interval[] {
  const { times, states } = grid;
  const out: Interval[] = [];
  let start: number | null = pred(states[0]) ? times[0] : null;
  for (let k = 1; k < times.length; k++) {
    const prev = pred(states[k - 1]);
    const cur = pred(states[k]);
    if (prev === cur) continue;
    const edge = refine(skyAt, pred, times[k - 1], times[k], prev);
    if (cur) start = edge;
    else if (start !== null) {
      out.push([start, edge]);
      start = null;
    }
  }
  if (start !== null) out.push([start, times[times.length - 1]]);
  return out;
}

export function toWindows(iv: Interval[], fromMs: number, toMs: number): TimeWindow[] {
  return iv.map(([a, b]) => ({
    start: iso(a),
    end: iso(b),
    durationH: (b - a) / H,
    clipped: a <= fromMs || b >= toMs,
  }));
}

const total = (iv: Interval[]) => iv.reduce((s, [a, b]) => s + (b - a), 0);

/** Longest stretch NOT covered by `iv` inside [from, to], hours. */
export function longestGapH(iv: Interval[], fromMs: number, toMs: number): number {
  let best = 0;
  let cursor = fromMs;
  for (const [a, b] of iv) {
    best = Math.max(best, a - cursor);
    cursor = Math.max(cursor, b);
  }
  best = Math.max(best, toMs - cursor);
  return best / H;
}

const nextOn = (iv: Interval[], fromMs: number) => iv.find(([a]) => a > fromMs)?.[0] ?? null;
const nextOff = (iv: Interval[], toMs: number) => iv.find(([, b]) => b < toMs)?.[1] ?? null;

// ---------------------------------------------------------------- power

export function cosIncidence(panel: PanelType, elDeg: number, azDeg: number, panelAzDeg?: number) {
  const el = elDeg * DEG;
  switch (panel) {
    case 'tracking':
      return 1;
    case 'vertical-rotating':
      return Math.cos(el);
    case 'vertical-fixed':
      if (panelAzDeg === undefined)
        throw new Error("panelType 'vertical-fixed' needs panelAzimuthDeg (which way the panel faces)");
      return Math.cos(el) * Math.max(0, Math.cos((azDeg - panelAzDeg) * DEG));
    case 'flat':
      return Math.max(0, Math.sin(el));
  }
}

/** Electrical power per m² of panel, W/m² (spec §5). Dust and scattered light not modelled. */
export function powerWm2(s: EngineSkyState, panel: PanelType, panelAzDeg?: number): number {
  if (s.sun.visibleFraction <= 0) return 0;
  const inv = (AU_KM / s.sun.distanceKm) ** 2;
  return (
    SOLAR_CONSTANT_W_M2 * inv * PANEL_EFFICIENCY * s.sun.visibleFraction *
    cosIncidence(panel, s.sun.elDeg, s.sun.azDeg, panelAzDeg)
  );
}

/** Mean energy per day over the grid (trapezoid), Wh/m²/day. */
function energyPerDay(grid: { times: number[]; states: EngineSkyState[] }, f: (s: EngineSkyState) => number) {
  const { times, states } = grid;
  if (times.length < 2) return 0;
  let wh = 0;
  let prev = f(states[0]);
  for (let k = 1; k < times.length; k++) {
    const cur = f(states[k]);
    wh += ((prev + cur) / 2) * ((times[k] - times[k - 1]) / H);
    prev = cur;
  }
  const days = (times[times.length - 1] - times[0]) / (24 * H);
  return wh / days;
}

// ---------------------------------------------------------------- metrics + scores

export function computeMetrics(
  siteId: string,
  skyAt: SkyAt,
  fromMs: number,
  toMs: number,
  p: EngineParams,
): EngineMetrics {
  if (!(toMs > fromMs)) throw new Error('getMetrics: "to" must be after "from"');
  const grid = scanGrid(skyAt, fromMs, toMs);
  const span = toMs - fromMs;
  const sun = intervals(skyAt, grid, isSun);
  const earth = intervals(skyAt, grid, isEarth);
  const both = intervals(skyAt, grid, isBoth);

  const sunlitFraction = total(sun) / span;
  const earthVisibleFraction = total(earth) / span;
  const bothFraction = total(both) / span;
  const longestNightH = longestGapH(sun, fromMs, toMs);
  const longestCommsGapH = longestGapH(earth, fromMs, toMs);

  let best: Interval | null = null;
  for (const w of both) if (!best || w[1] - w[0] > best[1] - best[0]) best = w;
  const bestWindow = best ? toWindows([best], fromMs, toMs)[0] : null;

  const energyWhPerDay = energyPerDay(grid, (s) => powerWm2(s, p.panelType, p.panelAzimuthDeg));
  const trackingWhPerDay = energyPerDay(grid, (s) => powerWm2(s, 'tracking'));
  const relativeEnergyPct = trackingWhPerDay > 0 ? (100 * energyWhPerDay) / trackingWhPerDay : 0;

  // Sub-scores (decided: linear, any-part fractions).
  // Unrounded for the arithmetic; the returned scores are whole numbers like the demo provider's.
  const powerRaw = 100 * sunlitFraction;
  const commsRaw = 100 * earthVisibleFraction;
  const darknessRaw = 100 * clamp(1 - longestNightH / p.maxDarknessH, 0, 1);

  // Must-pass gates at landing.
  const { ms: landingMs, basis } = landingOf(p, fromMs);
  const atLanding = skyAt(landingMs);
  const gates = {
    sunAtLanding: atLanding.sunVisible,
    earthAtLanding: atLanding.earthVisible,
    landingTime: iso(landingMs),
    basis,
  };

  const w = p.scoreWeights;
  const wSum = w.power + w.comms + w.darkness;
  if (!(wSum > 0)) throw new Error('scoreWeights must add up to more than 0');
  const pct = (x: number) => `${(100 * x).toFixed(1)}%`;
  const pts = (weight: number, score: number) => (weight / wSum) * score;
  const breakdown: ScoreLine[] = [
    {
      label: 'Sunlight',
      points: pts(w.power, powerRaw),
      reason: `Sun in view ${pct(sunlitFraction)} of the time, for these dates`,
    },
    {
      label: 'Earth in view',
      points: pts(w.comms, commsRaw),
      reason: `Earth in view ${pct(earthVisibleFraction)} of the time, for these dates`,
    },
    {
      label: 'Darkness',
      points: pts(w.darkness, darknessRaw),
      reason: `Longest night ${longestNightH.toFixed(1)} h vs a ${p.maxDarknessH} h battery limit`,
    },
  ];
  const gateOk = gates.sunAtLanding && gates.earthAtLanding;
  if (!gates.sunAtLanding)
    breakdown.push({ label: 'Sun at landing', points: 0, reason: 'No sunlight at the landing time: the lander cannot charge' });
  if (!gates.earthAtLanding)
    breakdown.push({ label: 'Earth at landing', points: 0, reason: 'Earth is not in view at the landing time: no direct link home' });
  const matchScore = gateOk ? Math.round(breakdown.reduce((s, l) => s + l.points, 0)) : 0;
  for (const l of breakdown) l.points = Math.round(l.points * 10) / 10; // 1 decimal for display

  return {
    source: 'computed',
    siteId,
    from: iso(fromMs),
    to: iso(toMs),
    sunlitFraction,
    earthVisibleFraction,
    maxSunElDeg: grid.states.reduce((m, s) => Math.max(m, s.sun.elDeg), -90),
    longestNightH,
    longestCommsGapH,
    nextSunset: isoOrNull(nextOff(sun, toMs)),
    nextSunrise: isoOrNull(nextOn(sun, fromMs)),
    nextEarthset: isoOrNull(nextOff(earth, toMs)),
    nextEarthrise: isoOrNull(nextOn(earth, fromMs)),
    powerScore: Math.round(powerRaw),
    commsScore: Math.round(commsRaw),
    darknessScore: Math.round(darknessRaw),
    bothFraction,
    bestWindow,
    matchScore,
    energyWhPerDay,
    relativeEnergyPct,
    panelType: p.panelType,
    scoreBreakdown: breakdown,
    gates,
    notModelled: [
      'Dust on panels: not modelled',
      'Light scattered by the terrain: not modelled',
      'Ground stations on Earth: not modelled (Earth in view only)',
    ],
  };
}

/** When the gates are judged: launch + transit, else a given landing time, else range start. */
export function landingOf(p: EngineParams, fromMs: number): { ms: number; basis: EngineMetrics['gates']['basis'] } {
  const parse = (t: string, what: string) => {
    const ms = Date.parse(t);
    if (!Number.isFinite(ms)) throw new Error(`${what} is not a valid ISO time: "${t}"`);
    return ms;
  };
  if (p.launchTime) return { ms: landingMsFromLaunch(parse(p.launchTime, 'launchTime'), p.transitId), basis: 'launch+transit' };
  if (p.landingTime) return { ms: parse(p.landingTime, 'landingTime'), basis: 'landing-time' };
  return { ms: fromMs, basis: 'range-start' };
}

const isoOrNull =(ms: number | null): IsoTime | null => (ms === null ? null : iso(ms));
