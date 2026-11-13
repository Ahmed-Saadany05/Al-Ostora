import type { Site } from '@/shared/types';
import eclipse from './fixtures/r01_eclipse_2026-08-28.json';
import { Track } from '../track';
import type { EphemerisRow } from '../types';

/** Connecting Ridge, NASA Data Book point R01 — the site the eclipse fixture was recorded at. */
export const R01: Site = {
  source: 'catalogue',
  id: 'test-r01',
  name: 'Connecting Ridge R01 (test)',
  kind: 'candidate',
  region: 'south-pole',
  lat: -89.4632,
  lon: -137.49,
  coordQuality: 'region-site',
  story: '',
  missions: [],
  refs: [],
};

/**
 * Eclipse-day rows (Horizons, 1-min). The fixture has no range column, so distanceKm is a
 * PLACEHOLDER (1 AU for the Sun, 384 400 km for Earth): only power depends on it, and no
 * test here asserts a power value from these rows.
 */
export const SUN_ROWS: EphemerisRow[] = eclipse.sun.map((r) => ({ ...r, distanceKm: 149_597_870.7 }));
export const EARTH_ROWS: EphemerisRow[] = eclipse.earth.map((r) => ({ ...r, distanceKm: 384_400 }));
export const TOI = eclipse.sun.map((r) => r.toiDeg);

export const every = <T,>(a: T[], n: number) => a.filter((_, i) => i % n === 0);
export const track = (rows: EphemerisRow[]) => new Track(rows);
