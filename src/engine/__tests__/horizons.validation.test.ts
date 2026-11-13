/**
 * Validation against recorded JPL Horizons output (spec §11): the Validity proof.
 * Data: research cache, converted to JSON fixtures (see fixtures/*.json `source`).
 */
import { describe, expect, it } from 'vitest';
import { intervals, isSun, scanGrid } from '../analysis';
import { azElToVec, separationDeg } from '../geometry';
import { flatProfile } from '../horizon';
import { computeSky } from '../sky';
import { Track } from '../track';
import apollo from './fixtures/apollo_landings.json';
import octNov from './fixtures/r01_sun_2027OctNov_1h.json';
import { EARTH_ROWS, every, R01, SUN_ROWS, TOI } from './helpers';

type V = [number, number, number];
const cross = (a: V, b: V): V => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: V): V => {
  const n = Math.hypot(...a);
  return [a[0] / n, a[1] / n, a[2] / n];
};

const sepToRow =(s: { azDeg: number; elDeg: number }, r: { azDeg: number; elDeg: number }) =>
  separationDeg(azElToVec(s.azDeg, s.elDeg), azElToVec(r.azDeg, r.elDeg));

function maxInterpError(rows: { time: string; azDeg: number; elDeg: number }[], keepEvery: number) {
  const full = rows.map((r) => ({ ...r, angularDiameterDeg: 0.5, distanceKm: 1 }));
  const tr = new Track(every(full, keepEvery));
  let worst = 0;
  for (const r of full) {
    const ms = Date.parse(r.time);
    if (!tr.covers(ms)) continue;
    worst = Math.max(worst, sepToRow(tr.at(ms), r));
  }
  return worst;
}

describe('interpolation vs Horizons (≤ 0.01° on-sky)', () => {
  it('Sun, hourly rows → every minute (R01, 2026-08-28)', () => {
    expect(maxInterpError(SUN_ROWS, 60)).toBeLessThan(0.01);
  });
  it('Earth, hourly rows → every minute (R01, 2026-08-28)', () => {
    expect(maxInterpError(EARTH_ROWS, 60)).toBeLessThan(0.01);
  });
  it('Sun, 2-hourly rows → the hours in between (R01, Oct–Nov 2027): conservative bound for 1 h', () => {
    expect(maxInterpError(octNov.rows, 2)).toBeLessThan(0.01);
  });
});

describe('eclipse 2026-08-28 at Connecting Ridge R01 (spec §11)', () => {
  const sun = new Track(every(SUN_ROWS, 60));
  const earth = new Track(every(EARTH_ROWS, 60));
  const flat = flatProfile(R01);
  const sky = (ms: number) => computeSky(R01, ms, sun.at(ms), earth.at(ms), flat, 0);
  const t0 = Date.parse(SUN_ROWS[0].time);
  const t1 = Date.parse(SUN_ROWS[SUN_ROWS.length - 1].time);

  it('Sun–Earth separation matches Horizons T-O-I (≤ 0.001°) at every minute', () => {
    const fine = { s: new Track(SUN_ROWS), e: new Track(EARTH_ROWS) };
    SUN_ROWS.forEach((r, i) => {
      const ms = Date.parse(r.time);
      const sep = separationDeg(fine.s.at(ms).vec, fine.e.at(ms).vec);
      expect(Math.abs(sep - Math.abs(TOI[i]))).toBeLessThan(0.001);
    });
  });

  // Reference: research_notes/.../sun_earth_geometry.md (geometric, 1-min, ±1 min):
  // partial 01:53–06:40, total 02:59–05:34 (156 min). Engine uses HOURLY rows here.
  const within = (ms: number, hhmm: string, tolMin: number) =>
    expect(Math.abs(ms - Date.parse(`2026-08-28T${hhmm}:00Z`)) / 60_000).toBeLessThanOrEqual(tolMin);

  it('totality 02:59–05:34 (±2 min)', () => {
    const grid = scanGrid(sky, t0, t1, 1);
    const tot = intervals(sky, grid, (s) => s.eclipse === 'total');
    expect(tot).toHaveLength(1);
    within(tot[0][0], '02:59', 2);
    within(tot[0][1], '05:34', 2);
  });

  it('darkness covers totality, plus the minutes when the only uncovered sliver is below the terrain', () => {
    const grid = scanGrid(sky, t0, t1, 1);
    const lit = intervals(sky, grid, isSun);
    expect(lit).toHaveLength(2);
    expect(lit[0][1]).toBeLessThanOrEqual(Date.parse('2026-08-28T03:01:00Z'));
    expect(lit[1][0]).toBeGreaterThanOrEqual(Date.parse('2026-08-28T05:32:00Z'));
  });

  it('visible Sun fraction agrees with an independent brute-force count on the sphere (≤ 0.002)', () => {
    // Sample the solar disk as directions in 3-D; count those above the flat horizon AND
    // farther than R_E from Earth's centre. No small-angle approximations.
    const fine = { s: new Track(SUN_ROWS), e: new Track(EARTH_ROWS) };
    const hz = flat.elevationsDeg[0];
    for (const hhmm of ['02:10', '02:40', '02:50', '02:55', '05:38', '05:45', '06:20']) {
      const ms = Date.parse(`2026-08-28T${hhmm}:00Z`);
      const S = fine.s.at(ms);
      const E = fine.e.at(ms);
      const rs = (S.angularDiameterDeg / 2) * (Math.PI / 180);
      const re = E.angularDiameterDeg / 2;
      // Orthonormal basis around the Sun direction.
      const up: [number, number, number] = [0, 0, 1];
      const c = S.vec;
      const u1 = norm(cross(up, c));
      const u2 = cross(c, u1);
      let inDisk = 0;
      let lit = 0;
      const N = 300;
      for (let i = 0; i < N; i++)
        for (let j = 0; j < N; j++) {
          const x = ((i + 0.5) / N) * 2 - 1;
          const y = ((j + 0.5) / N) * 2 - 1;
          if (x * x + y * y > 1) continue;
          inDisk++;
          const d = norm([0, 1, 2].map((k) => c[k] + rs * (x * u1[k] + y * u2[k])) as [number, number, number]);
          const el = (Math.asin(d[2]) * 180) / Math.PI;
          if (el > hz && separationDeg(d, E.vec) > re) lit++;
        }
      const engine = computeSky(R01, ms, S, E, flat, 0).sun.visibleFraction;
      expect(Math.abs(engine - lit / inDisk)).toBeLessThan(0.002);
    }
  });

  it('partial phase 01:53–06:40 (±2 min)', () => {
    const grid = scanGrid(sky, t0, t1, 1);
    const ecl = intervals(sky, grid, (s) => s.eclipse !== 'none');
    expect(ecl).toHaveLength(1);
    within(ecl[0][0], '01:53', 2);
    within(ecl[0][1], '06:40', 2);
  });

  it('upper limb is above the flat horizon during totality (so terrain alone would say "Sun up")', () => {
    const s = sky(Date.parse('2026-08-28T04:16:00Z'));
    expect(s.eclipse).toBe('total');
    expect(s.sunTerrainFraction).toBeGreaterThan(0);
    expect(s.sunVisible).toBe(false);
    expect(s.sun.visibleFraction).toBe(0);
  });

  it('partial eclipse lowers the visible fraction below the terrain-only value', () => {
    const s = sky(Date.parse('2026-08-28T02:30:00Z'));
    expect(s.eclipse).toBe('partial');
    expect(s.sun.visibleFraction).toBeLessThan(s.sunTerrainFraction);
  });

  it('Earth illumination comes from Horizons quantity 10 when present ("new Earth" ≈ 0)', () => {
    expect(sky(Date.parse('2026-08-28T04:16:00Z')).earth.illumination).toBeLessThan(0.001);
  });
});

describe('Apollo landings: Horizons Sun elevation vs Scotti & Fjeld (ALSJ), ±0.1° (spec §8)', () => {
  const scotti: Record<string, number> = { Apollo11: 10.65, Apollo12: 5.19, Apollo16: 14.76, Apollo17: 13.33 };
  const flat = flatProfile(R01);
  for (const [mission, expected] of Object.entries(scotti)) {
    it(mission, () => {
      const row = (target: string) => apollo.rows.find((r) => r.mission === mission && r.target === target)!;
      const s = row('sun');
      const e = row('earth');
      // Single rows at the landing time; diameter/distance are not asserted here.
      const mk = (r: typeof s, d: number) => new Track([{ ...r, angularDiameterDeg: d, distanceKm: 1 }]);
      const ms = Date.parse(s.time);
      const sky = computeSky(R01, ms, mk(s, 0.53).at(ms), mk(e, 1.9).at(ms), flat, 0);
      expect(Math.abs(sky.sun.elDeg - expected)).toBeLessThanOrEqual(0.1);
      expect(sky.sunVisible).toBe(true);
    });
  }
});
