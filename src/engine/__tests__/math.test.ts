import { describe, expect, it } from 'vitest';
import { cosIncidence, longestGapH, powerWm2 } from '../analysis';
import { azElToVec, haversineKm, separationDeg, vecToAzEl } from '../geometry';
import { flatProfile, horizonDipDeg } from '../horizon';
import { diskFractionAbove, eclipseState, horizonAt, sunFractionWithEarth } from '../visibility';
import { R01 } from './helpers';
import type { BodySample } from '../track';
import type { EngineSkyState } from '../types';

const body = (azDeg: number, elDeg: number, diam: number): BodySample => ({
  azDeg, elDeg, vec: azElToVec(azDeg, elDeg), distanceKm: 1, angularDiameterDeg: diam,
});

describe('disk fraction above a horizontal line (spec §4)', () => {
  it('gives 1, 0.5, 0 at x = 1, 0, −1', () => {
    expect(diskFractionAbove(0.25, 0.25)).toBe(1);
    expect(diskFractionAbove(0, 0.25)).toBeCloseTo(0.5, 12);
    expect(diskFractionAbove(-0.25, 0.25)).toBe(0);
  });
  it('is symmetric: f(c) + f(−c) = 1', () => {
    for (const c of [0.03, 0.1, 0.2]) expect(diskFractionAbove(c, 0.26) + diskFractionAbove(-c, 0.26)).toBeCloseTo(1, 12);
  });
});

describe('horizon lookup', () => {
  const h = { ...flatProfile(R01), elevationsDeg: Array.from({ length: 720 }, (_, i) => i / 100) };
  it('is linear in azimuth between 0.5° samples', () => expect(horizonAt(h, 10.25)).toBeCloseTo(0.205, 12));
  it('wraps 359.75° between the last and first sample', () => expect(horizonAt(h, 359.75)).toBeCloseTo(7.19 / 2, 12));
  it('accepts negative azimuths', () => expect(horizonAt(h, -0.5)).toBeCloseTo(7.19, 12));
});

describe('flat horizon for the 2 m observer', () => {
  it('dips by acos(R/(R+h)) ≈ 0.0869°', () => {
    expect(horizonDipDeg(2)).toBeCloseTo((Math.sqrt((2 * 2) / 1_737_400) * 180) / Math.PI, 6);
    expect(horizonDipDeg(2)).toBeCloseTo(0.0869, 4);
  });
  it('is labelled flat with 720 samples', () => {
    const f = flatProfile(R01);
    expect(f.terrain).toBe('flat');
    expect(f.elevationsDeg).toHaveLength(720);
  });
});

describe('vectors', () => {
  it('round-trips az/el, including near the 0/360 wrap', () => {
    for (const [az, el] of [[0.001, 1], [359.999, -0.3], [123.4, 45]]) {
      const r = vecToAzEl(azElToVec(az, el));
      expect(separationDeg(azElToVec(r.azDeg, r.elDeg), azElToVec(az, el))).toBeLessThan(1e-9);
    }
  });
  it('separation across the north wrap is small', () => {
    expect(separationDeg(azElToVec(359.9, 0), azElToVec(0.1, 0))).toBeCloseTo(0.2, 9);
  });
  it('haversine: 1° of latitude on the 1737.4 km sphere', () => {
    expect(haversineKm(-89, 0, -90, 0)).toBeCloseTo((1737.4 * Math.PI) / 180, 9);
  });
});

describe('eclipse (spec §4)', () => {
  it('classifies none / partial / total', () => {
    expect(eclipseState(1.3, 0.26, 0.95)).toBe('none');
    expect(eclipseState(1.0, 0.26, 0.95)).toBe('partial');
    expect(eclipseState(0.5, 0.26, 0.95)).toBe('total');
  });
  it('strip integration matches the analytic circle–circle overlap (no terrain cut)', () => {
    const rs = 0.264, re = 0.94;
    for (const d of [0.75, 0.9, 1.1]) {
      // Lens area of two circles, radii rs and re, centre distance d.
      const a1 = rs * rs * Math.acos((d * d + rs * rs - re * re) / (2 * d * rs));
      const a2 = re * re * Math.acos((d * d + re * re - rs * rs) / (2 * d * re));
      const a3 = 0.5 * Math.sqrt((-d + rs + re) * (d + rs - re) * (d - rs + re) * (d + rs + re));
      const expected = 1 - (a1 + a2 - a3) / (Math.PI * rs * rs);
      const sun = body(90, 10, 2 * rs);
      const earth = body(90, 10 + d, 2 * re);
      const got = sunFractionWithEarth(sun, earth, 10, separationDeg(sun.vec, earth.vec), 4000);
      expect(Math.abs(got - expected)).toBeLessThan(2e-4);
    }
  });
  it('without Earth overlap it equals the terrain-only disk fraction', () => {
    const sun = body(90, 0, 0.53);
    const earth = body(270, 0, 1.9);
    expect(sunFractionWithEarth(sun, earth, 0.1, 180, 4000)).toBeCloseTo(diskFractionAbove(0.1, 0.265), 4);
  });
});

describe('power (spec §5)', () => {
  it('cos(incidence) by panel type', () => {
    expect(cosIncidence('tracking', 30, 0)).toBe(1);
    expect(cosIncidence('vertical-rotating', 60, 0)).toBeCloseTo(0.5, 12);
    expect(cosIncidence('vertical-fixed', 60, 90, 30)).toBeCloseTo(0.25, 12);
    expect(cosIncidence('vertical-fixed', 0, 270, 90)).toBe(0);
    expect(cosIncidence('flat', 30, 0)).toBeCloseTo(0.5, 12);
    expect(cosIncidence('flat', -1, 0)).toBe(0);
    expect(() => cosIncidence('vertical-fixed', 0, 0)).toThrow(/panelAzimuthDeg/);
  });
  it('full Sun at 1 AU on a tracking panel = 1360.8 × 0.307 W/m²', () => {
    const s = { sun: { visibleFraction: 1, distanceKm: 149_597_870.7, elDeg: 1, azDeg: 0 } } as EngineSkyState;
    expect(powerWm2(s, 'tracking')).toBeCloseTo(1360.8 * 0.307, 9);
  });
});

describe('longest gap', () => {
  const H = 3_600_000;
  it('counts gaps at both range edges', () => {
    expect(longestGapH([[2 * H, 3 * H]], 0, 10 * H)).toBe(7);
    expect(longestGapH([], 0, 5 * H)).toBe(5);
    expect(longestGapH([[0, 4 * H], [6 * H, 10 * H]], 0, 10 * H)).toBe(2);
  });
});
