import { describe, expect, it, vi } from 'vitest';
import type { HorizonsQuery, HorizonsResponse } from '@/data/horizons/types';
import { gradeSite } from '../grading';
import { createLiveProvider } from '../provider';
import { EARTH_ROWS, R01, SUN_ROWS } from './helpers';

const response = (q: HorizonsQuery): HorizonsResponse => ({
  source: 'horizons',
  query: { altKm: 0, ...q },
  rows: q.target === 'sun' ? SUN_ROWS : EARTH_ROWS,
  horizonsUrl: '',
  fetchedAt: '',
});

function make(opts: { online?: boolean; recorded?: boolean; failFirst?: number } = {}) {
  let failures = opts.failFirst ?? 0;
  let inFlight = 0;
  let maxInFlight = 0;
  const fetcher = vi.fn(async (q: HorizonsQuery) => {
    inFlight++;
    maxInFlight = Math.max(maxInFlight, inFlight);
    await new Promise((r) => setTimeout(r, 1));
    inFlight--;
    if (opts.online === false) throw new Error('offline');
    if (failures-- > 0) throw new Error('HTTP 502');
    return response(q);
  });
  const p = createLiveProvider({
    fetcher,
    loadProfile: async () => null,
    loadRecorded: async () =>
      opts.recorded
        ? (['sun', 'earth'] as const).map((target) =>
            response({ target, lat: R01.lat, lon: R01.lon, start: '', stop: '', step: '1m' }),
          )
        : [],
    listSites: async () => [R01],
    retryDelaysMs: [0, 0],
  });
  return { p, fetcher, maxInFlight: () => maxInFlight };
}

describe('live provider', () => {
  it('getSky: one request per body per chunk, however many calls', async () => {
    const { p, fetcher } = make();
    for (let m = 0; m < 50; m++) await p.getSky(R01, `2026-08-28T03:${String(m).padStart(2, '0')}:00Z`);
    expect(fetcher.mock.calls.filter(([q]) => q.start < '2026-08-28' && q.stop > '2026-08-28')).toHaveLength(2);
    const q = fetcher.mock.calls[0][0];
    expect(q.altKm).toBe(0.002); // site elevation unknown → 0 m + 2 m observer
  });

  it('Horizons requests go one at a time, and a temporary failure is retried', async () => {
    const { p, fetcher, maxInFlight } = make({ failFirst: 2 });
    const s = await p.getSky(R01, '2026-08-28T03:00:00Z');
    expect(s.fallback).toBeUndefined();
    expect(fetcher).toHaveBeenCalledTimes(4); // sun: 2 failures + success; earth: success
    expect(maxInFlight()).toBe(1);
  });

  it('getSky: flat horizon is labelled with low reliability near the pole', async () => {
    const { p } = make();
    const s = await p.getSky(R01, '2026-08-28T01:00:00Z');
    expect(s.horizon).toEqual({ source: 'flat', reliability: 'low', note: undefined });
    expect(s.source).toBe('computed');
  });

  it('getSky offline: nearest recorded state, flagged', async () => {
    const { p } = make({ online: false, recorded: true });
    const s = await p.getSky(R01, '2026-08-29T12:00:00Z');
    expect(s.fallback).toBe('nearest-recorded');
    expect(s.requestedTime).toBe('2026-08-29T12:00:00.000Z');
    expect(s.time).toBe(SUN_ROWS[SUN_ROWS.length - 1].time.replace('Z', '.000Z'));
  });

  it('getSky offline with nothing recorded: clear error', async () => {
    const { p } = make({ online: false });
    await expect(p.getSky(R01, '2026-08-28T03:00:00Z')).rejects.toThrow(/nothing recorded/);
  });

  it('getMetrics: eclipse window — windows, gates, ⅓ weights, breakdown', async () => {
    const { p } = make();
    const m = await p.getMetrics(R01, '2026-08-28T00:12:00Z', '2026-08-28T08:12:00Z');
    // Totality is ≈156 min; darkness is longer because the last uncovered sliver of Sun is
    // below the horizon for a few minutes on each side (see horizons.validation.test.ts).
    expect(m.longestNightH).toBeGreaterThan(2.55);
    expect(m.longestNightH).toBeLessThan(3.2);
    expect(m.sunlitFraction).toBeCloseTo(1 - m.longestNightH / 8, 3);
    expect(m.gates.sunAtLanding).toBe(true);
    const sum = m.scoreBreakdown.reduce((s, l) => s + l.points, 0);
    expect(m.matchScore).toBeCloseTo(sum, 9);
    expect(m.matchScore).toBeCloseTo((m.powerScore + m.commsScore + m.darknessScore) / 3, 9);
    expect(m.nextSunset).not.toBeNull();
    expect(m.nextSunrise).not.toBeNull();
    expect(m.panelType).toBe('vertical-rotating');
  });

  it('getMetrics: landing inside totality fails the Sun gate → match 0 with a reason', async () => {
    const { p } = make();
    const m = await p.getMetrics(R01, '2026-08-28T00:12:00Z', '2026-08-28T08:12:00Z', {
      landingTime: '2026-08-28T04:00:00Z',
    });
    expect(m.gates.sunAtLanding).toBe(false);
    expect(m.matchScore).toBe(0);
    expect(m.scoreBreakdown.some((l) => l.label === 'Sun at landing')).toBe(true);
  });

  it('getMetrics: gates judged at launch + transit (decided), IM-1 by default', async () => {
    const { p } = make();
    // Launch 7.72 d before 04:00 on 2026-08-28 → lands inside totality.
    const launch = new Date(Date.parse('2026-08-28T04:00:00Z') - 7.72 * 86_400_000).toISOString();
    const m = await p.getMetrics(R01, '2026-08-28T00:12:00Z', '2026-08-28T08:12:00Z', { launchTime: launch });
    expect(m.gates.basis).toBe('launch+transit');
    expect(m.gates.landingTime).toBe('2026-08-28T04:00:00.000Z');
    expect(m.gates.sunAtLanding).toBe(false);
    expect(m.matchScore).toBe(0);
    // Apollo 11 preset: same launch lands 3.44 d earlier → outside the data → clear error.
    await expect(
      p.getMetrics(R01, '2026-08-28T00:12:00Z', '2026-08-28T08:12:00Z', { launchTime: launch, transitId: 'apollo-11' }),
    ).rejects.toThrow(/No Sun\/Earth data/);
  });

  it('getMetrics without launch or landing time says the gates used the range start', async () => {
    const { p } = make();
    const m = await p.getMetrics(R01, '2026-08-28T00:12:00Z', '2026-08-28T08:12:00Z');
    expect(m.gates.basis).toBe('range-start');
  });

  it('getMetrics outside the data: clear error, not a silent guess', async () => {
    const { p } = make();
    await expect(p.getMetrics(R01, '2026-08-28T00:12:00Z', '2026-08-28T10:00:00Z')).rejects.toThrow(/No Sun\/Earth data/);
  });

  it('getDayReport: samples at the step, windows with refined (non-grid) edges', async () => {
    const { p } = make();
    const r = await p.getDayReport(R01, '2026-08-28T00:12:00Z', 8 / 24, { stepMinutes: 60 });
    expect(r.samples).toHaveLength(9);
    expect(r.sunWindows).toHaveLength(2);
    expect(r.sunWindows[0].clipped).toBe(true);
    const end = Date.parse(r.sunWindows[0].end);
    expect((end / 60_000) % 10).not.toBe(0); // refined, not on the 10-min scan grid
  });

  it('planLaunch: IM-1 7.72 d by default, presets by id', async () => {
    const { p } = make();
    const a = await p.planLaunch(R01, '2026-12-01T00:00:00Z');
    expect(a.transitDays).toBe(7.72);
    expect(Date.parse(a.landingDate) - Date.parse(a.launchDate)).toBe(7.72 * 86_400_000);
    expect(a.assumption).toMatch(/IM-1/);
    expect((await p.planLaunch(R01, '2026-12-01T00:00:00Z', 'apollo-11')).transitDays).toBe(4.28);
    await expect(p.planLaunch(R01, '2026-12-01T00:00:00Z', 'nope')).rejects.toThrow();
  });
});

describe('site grading (spec §7)', () => {
  const target = { lat: -89.4632, lon: -137.49, name: 'the ridge' };
  it('slope gate < 10° over 100 m', () => {
    expect(gradeSite({ site: target, target, slopeDeg100m: 9.9 }).passes).toBe(true);
    const steep = gradeSite({ site: target, target, slopeDeg100m: 10 });
    expect(steep.passes).toBe(false);
    expect(steep.lines[0].lesson).toMatch(/IM-1/);
  });
  it('missing slope does not fail the gate but says so', () => {
    const g = gradeSite({ site: target, target });
    expect(g.passes).toBe(true);
    expect(g.lines[0].ok).toBeNull();
  });
  it('distance: warning beyond 2 km, never a gate', () => {
    const far = gradeSite({ site: { lat: -89.3, lon: -137.49 }, target, slopeDeg100m: 3 });
    expect(far.distanceKm).toBeGreaterThan(2);
    expect(far.passes).toBe(true);
    const d = far.lines.find((l) => l.id === 'distance')!;
    expect(d.ok).toBe(false);
    expect(d.text).toMatch(/TBR/);
  });
});
