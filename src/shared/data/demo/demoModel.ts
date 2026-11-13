/**
 * DEMO MODEL — a simplified but physically plausible sky so screens can be built
 * before the real engine exists. NOT for real answers: every object it returns is
 * stamped `source: 'demo'` and the UI labels it.
 *
 * Simplifications (the real engine replaces all of these with JPL Horizons + LOLA):
 *  - Sub-solar point circles the Moon once per synodic month; latitude swings ±1.54°.
 *  - Sub-Earth point wobbles by mean libration (±7.9° lon, ±6.7° lat).
 *  - Horizon is a smooth synthetic skyline seeded by the site id.
 */
import { LUNAR, type BodyPosition, type HorizonProfile, type Site } from '../../types';

const DEG = Math.PI / 180;
const DAY_MS = 86_400_000;
/** Reference new moon (sub-solar longitude = 180°). */
const NEW_MOON_EPOCH = Date.UTC(2000, 0, 6, 18, 14);
/** Date when the Sun sits furthest south as seen from the Moon (approx., from Horizons check). */
const SOUTH_SUMMER_EPOCH = Date.UTC(2026, 10, 13);

const wrap360 = (a: number) => ((a % 360) + 360) % 360;
const wrap180 = (a: number) => wrap360(a + 180) - 180;

export function subSolarPoint(t: number) {
  const days = (t - NEW_MOON_EPOCH) / DAY_MS;
  const lon = wrap180(180 - (360 * days) / LUNAR.synodicDays);
  const season = (t - SOUTH_SUMMER_EPOCH) / DAY_MS;
  const lat = -LUNAR.axialTiltDeg * Math.cos((2 * Math.PI * season) / LUNAR.solarSeasonDays);
  return { lat, lon };
}

export function subEarthPoint(t: number) {
  const days = (t - NEW_MOON_EPOCH) / DAY_MS;
  return {
    lon: 7.9 * Math.sin((2 * Math.PI * days) / 27.5546),
    lat: 6.7 * Math.sin((2 * Math.PI * days) / 27.2122),
    distanceKm: 384_400 + 21_000 * Math.cos((2 * Math.PI * days) / 27.5546),
  };
}

/** Illuminated fraction of Earth seen from the Moon: full at new moon. */
export function earthIllumination(t: number) {
  const age = (t - NEW_MOON_EPOCH) / DAY_MS / LUNAR.synodicDays;
  return (1 + Math.cos(2 * Math.PI * age)) / 2;
}

/** Elevation + azimuth (from north, clockwise) of a body above a sub-point. */
export function altAz(lat: number, lon: number, subLat: number, subLon: number) {
  const φ = lat * DEG;
  const δ = subLat * DEG;
  const Δλ = (subLon - lon) * DEG;
  const sinEl = Math.sin(φ) * Math.sin(δ) + Math.cos(φ) * Math.cos(δ) * Math.cos(Δλ);
  const az = Math.atan2(
    Math.sin(Δλ) * Math.cos(δ),
    Math.cos(φ) * Math.sin(δ) - Math.sin(φ) * Math.cos(δ) * Math.cos(Δλ),
  );
  return { elDeg: Math.asin(sinEl) / DEG, azDeg: wrap360(az / DEG) };
}

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

export function demoHorizon(site: Site, observerHeightM: number): HorizonProfile {
  const rand = hash(site.id);
  const polar = Math.abs(site.lat) > 80;
  const amp = polar ? 1.4 : 0.6;
  const base = polar ? 0.4 : 0.2;
  const waves = Array.from({ length: 6 }, (_, k) => ({
    k: k + 1,
    a: (amp * rand()) / (k + 1) ** 0.6,
    p: rand() * 2 * Math.PI,
  }));
  // Dip of the horizon for an observer raised h metres above the surface.
  const dip = Math.sqrt((2 * observerHeightM) / (LUNAR.radiusKm * 1000)) / DEG;
  const elevationsDeg = Array.from({ length: 360 }, (_, az) => {
    const v = waves.reduce((s, w) => s + w.a * Math.sin(w.k * az * DEG + w.p), base);
    return Math.round((v - dip) * 1000) / 1000;
  });
  return {
    source: 'demo',
    siteId: site.id,
    azStepDeg: 1,
    elevationsDeg,
    maxRangeKm: 0,
    observerHeightM,
  };
}

export function horizonAt(h: HorizonProfile, azDeg: number) {
  const n = h.elevationsDeg.length;
  const x = wrap360(azDeg) / h.azStepDeg;
  const i = Math.floor(x) % n;
  const f = x - Math.floor(x);
  return h.elevationsDeg[i] * (1 - f) + h.elevationsDeg[(i + 1) % n] * f;
}

/** Share of a disk (diameter d) above a straight horizon line `clearance` below its centre. */
export function diskFractionAbove(clearanceDeg: number, diameterDeg: number) {
  const r = diameterDeg / 2;
  if (clearanceDeg >= r) return 1;
  if (clearanceDeg <= -r) return 0;
  const x = clearanceDeg / r;
  return 1 - (Math.acos(x) - x * Math.sqrt(1 - x * x)) / Math.PI;
}

export function bodyPosition(
  site: Site,
  horizon: HorizonProfile,
  sub: { lat: number; lon: number },
  distanceKm: number,
  angularDiameterDeg: number,
): BodyPosition {
  const { elDeg, azDeg } = altAz(site.lat, site.lon, sub.lat, sub.lon);
  const horizonElDeg = horizonAt(horizon, azDeg);
  const clearanceDeg = elDeg - horizonElDeg;
  return {
    azDeg,
    elDeg,
    horizonElDeg,
    clearanceDeg,
    distanceKm,
    angularDiameterDeg,
    visibleFraction: diskFractionAbove(clearanceDeg, angularDiameterDeg),
  };
}
