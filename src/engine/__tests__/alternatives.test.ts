import { describe, expect, it } from 'vitest';
import type { Site } from '@/shared/types';
import { makeAlternatives, measureWith, nearbySites, type DayHours } from '../alternatives';
import { R01 } from './helpers';

const at = (id: string, lat: number, lon: number): Site => ({ ...R01, id, name: id, lat, lon });
const DAY = 86_400_000;
const LANDING = '2026-12-01T00:00:00Z';
const L = Date.parse(LANDING);

/** Fake measurements keyed by site id and day shift. Missing → throws (no data). */
function fake(table: Record<string, DayHours | undefined>) {
  return async (site: Site, ms: number): Promise<DayHours> => {
    const k = `${site.id}${ms === L ? '' : `@${Math.round((ms - L) / DAY)}`}`;
    const v = table[k];
    if (!v) throw new Error(`no data for ${k}`);
    return v;
  };
}
const h = (sunHours: number, earthHours: number, gatesOk = true): DayHours => ({
  sunHours, earthHours, gatesOk, from: '', to: '',
});

describe('nearbySites', () => {
  it('keeps up to 4 sites within 15 km, nearest first, never the site itself', () => {
    const near = [1, 2, 3, 4, 5].map((k) => at(`n${k}`, -89.4632 + k * 0.01, -137.49)); // ~0.3 km steps
    const far = at('far', -88, 0);
    const out = nearbySites(R01, [R01, far, ...near.reverse()]);
    expect(out.map((x) => x.site.id)).toEqual(['n1', 'n2', 'n3', 'n4']);
    expect(out.every((x) => x.km <= 15)).toBe(true);
  });
});

describe('suggestAlternatives (decided rules)', () => {
  const near = at('near', -89.45, -137.49);
  const sites = async () => [R01, near];

  it('picks the option with the most extra sunlight that keeps Earth at least as long', async () => {
    const { suggestAlternatives } = makeAlternatives(
      fake({ 'test-r01': h(300, 400), near: h(320, 400), 'test-r01@5': h(350, 410), 'test-r01@-2': h(400, 390) }),
      sites,
    );
    const a = await suggestAlternatives(R01, LANDING);
    // @-2 has more sun but loses Earth hours → rejected; @5 wins over the nearby site.
    expect(a).toMatchObject({ kind: 'date', shiftDays: 5, sunHoursGain: 50, earthHoursDelta: 10 });
    expect(a!.landingIso).toBe(new Date(L + 5 * DAY).toISOString());
    expect(a!.baseline).toEqual({ sunHours: 300, earthHours: 400 });
    expect(a!.candidate).toEqual({ sunHours: 350, earthHours: 410 });
  });

  it('returns a site suggestion with siteId and distance', async () => {
    const { suggestAlternatives } = makeAlternatives(fake({ 'test-r01': h(300, 400), near: h(320, 400) }), sites);
    const a = await suggestAlternatives(R01, LANDING);
    expect(a).toMatchObject({ kind: 'site', siteId: 'near', sunHoursGain: 20, earthHoursDelta: 0 });
    expect(a!.distanceKm).toBeGreaterThan(0);
  });

  it('skips options that fail the must-pass gates', async () => {
    const { suggestAlternatives } = makeAlternatives(fake({ 'test-r01': h(300, 400), near: h(500, 500, false) }), sites);
    expect(await suggestAlternatives(R01, LANDING)).toBeNull();
  });

  it('needs at least 1 h more sunlight', async () => {
    const { suggestAlternatives } = makeAlternatives(fake({ 'test-r01': h(300, 400), near: h(300.9, 400) }), sites);
    expect(await suggestAlternatives(R01, LANDING)).toBeNull();
  });

  it('null when nothing beats the choice; error only if the choice itself has no data', async () => {
    const { suggestAlternatives } = makeAlternatives(fake({ 'test-r01': h(300, 400) }), sites);
    expect(await suggestAlternatives(R01, LANDING)).toBeNull();
    const none = makeAlternatives(fake({}), sites);
    await expect(none.suggestAlternatives(R01, LANDING)).rejects.toThrow(/no data/);
  });
});

describe('measureWith: one lunar day from landing, gates at landing', () => {
  it('turns fractions into hours over 29.53 d and passes landingTime', async () => {
    let seen: { from: string; to: string; landingTime?: string; launchTime?: string } | undefined;
    const measure = measureWith(async (_s, from, to, p) => {
      seen = { from, to, landingTime: p?.landingTime, launchTime: p?.launchTime };
      return { sunlitFraction: 0.5, earthVisibleFraction: 0.25, gates: { sunAtLanding: true, earthAtLanding: true }, from, to };
    });
    const r = await measure(R01, L, { launchTime: '2026-11-20T00:00:00Z' });
    const hours = 29.530589 * 24;
    expect(r.sunHours).toBeCloseTo(hours / 2, 9);
    expect(r.earthHours).toBeCloseTo(hours / 4, 9);
    expect(seen!.landingTime).toBe(new Date(L).toISOString());
    expect(seen!.launchTime).toBeUndefined(); // landing is given; launch must not override it
    expect(Date.parse(seen!.to) - Date.parse(seen!.from)).toBeCloseTo(29.530589 * DAY, -1);
  });
});
