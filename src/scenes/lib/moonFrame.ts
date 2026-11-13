/**
 * MOON-FIXED FRAME — the one coordinate convention every scene uses. Pure math, no three.js,
 * so it can be unit-tested with `node --test` (see moonFrame.test.mjs).
 *
 *   +Z = lunar north pole · +X = 0° longitude (mean near-side centre) · +Y = 90° E.
 *
 * This matches 3d-tiles-renderer's ellipsoid frame (lat/lon → x = r·cosφ·cosλ, y = r·cosφ·sinλ,
 * z = r·sinφ). The shared contract's conventions apply: degrees, longitude east-positive in
 * −180…180, azimuth clockwise from lunar north (N = 0°, E = 90°).
 */

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}
export interface LatLon {
  lat: number;
  lon: number;
}

/** Mean lunar radius in metres (LUNAR.radiusKm × 1000) — the reference sphere Moon Trek tiles are draped on. */
export const MOON_RADIUS_M = 1_737_400;

const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;
const clamp1 = (v: number) => Math.max(-1, Math.min(1, v));

/** Wrap any longitude into −180…180 (180 stays 180). */
export function normalizeLon(lon: number): number {
  const w = ((((lon + 180) % 360) + 360) % 360) - 180;
  return w === -180 && lon > 0 ? 180 : w;
}

/** Round to `dp` decimals (default 4 ≈ 3 m on the Moon) without "-0". */
export function roundCoord(n: number, dp = 4): number {
  const f = 10 ** dp;
  const r = Math.round(n * f) / f;
  return r === 0 ? 0 : r;
}

/** Point on a sphere of radius `r` (any unit) at latitude/longitude in degrees. */
export function latLonToVec(lat: number, lon: number, r = 1): Vec3 {
  const la = lat * D2R;
  const lo = lon * D2R;
  return { x: r * Math.cos(la) * Math.cos(lo), y: r * Math.cos(la) * Math.sin(lo), z: r * Math.sin(la) };
}

/** Latitude/longitude in degrees of the direction of `p` from the Moon's centre. */
export function vecToLatLon(p: Vec3): LatLon {
  const r = Math.hypot(p.x, p.y, p.z) || 1;
  return { lat: Math.asin(clamp1(p.z / r)) * R2D, lon: Math.atan2(p.y, p.x) * R2D };
}

/**
 * Nearest intersection of the ray `origin + t·dir` (t ≥ 0) with the sphere of radius `r`
 * centred on the origin. Null when the ray misses. `dir` need not be normalised.
 */
export function intersectSphere(origin: Vec3, dir: Vec3, r: number): Vec3 | null {
  const a = dir.x * dir.x + dir.y * dir.y + dir.z * dir.z;
  if (a === 0) return null;
  const b = 2 * (origin.x * dir.x + origin.y * dir.y + origin.z * dir.z);
  const c = origin.x * origin.x + origin.y * origin.y + origin.z * origin.z - r * r;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return null;
  const sq = Math.sqrt(disc);
  const t0 = (-b - sq) / (2 * a);
  const t1 = (-b + sq) / (2 * a);
  const t = t0 >= 0 ? t0 : t1 >= 0 ? t1 : null;
  if (t === null) return null;
  return { x: origin.x + t * dir.x, y: origin.y + t * dir.y, z: origin.z + t * dir.z };
}

/**
 * Exact surface pick: where a ray (in the Moon-fixed frame) first meets the reference sphere,
 * as lat/lon rounded to 4 decimals. Analytic, so it works before any terrain tile has loaded.
 */
export function pickLatLon(origin: Vec3, dir: Vec3, r: number): LatLon | null {
  const hit = intersectSphere(origin, dir, r);
  if (!hit) return null;
  const { lat, lon } = vecToLatLon(hit);
  return { lat: roundCoord(lat), lon: roundCoord(normalizeLon(lon)) };
}

/** Local east / north / up unit vectors at a surface point, in the Moon-fixed frame. */
export function enuAxes(lat: number, lon: number): { east: Vec3; north: Vec3; up: Vec3 } {
  const la = lat * D2R;
  const lo = lon * D2R;
  const sLa = Math.sin(la);
  const cLa = Math.cos(la);
  const sLo = Math.sin(lo);
  const cLo = Math.cos(lo);
  return {
    east: { x: -sLo, y: cLo, z: 0 },
    north: { x: -sLa * cLo, y: -sLa * sLo, z: cLa },
    up: { x: cLa * cLo, y: cLa * sLo, z: sLa },
  };
}

/**
 * Direction (unit vector, Moon-fixed) of a body seen from a site at azimuth/elevation —
 * exactly what `SkyState.sun` / `SkyState.earth` give. The Sun is so far away that this
 * direction is the same from anywhere on the Moon, so one site's sky lights the whole globe.
 */
export function azElToDirection(site: LatLon, azDeg: number, elDeg: number): Vec3 {
  const { east, north, up } = enuAxes(site.lat, site.lon);
  const az = azDeg * D2R;
  const el = elDeg * D2R;
  const e = Math.cos(el) * Math.sin(az);
  const n = Math.cos(el) * Math.cos(az);
  const u = Math.sin(el);
  return {
    x: e * east.x + n * north.x + u * up.x,
    y: e * east.y + n * north.y + u * up.y,
    z: e * east.z + n * north.z + u * up.z,
  };
}

// ---------------------------------------------------------------- regions

export type RegionId = 'south-pole' | 'nearside' | 'farside' | 'north-pole';

/** Polar caps start at this |latitude|. */
export const POLAR_CAP_DEG = 80;

/**
 * Which region a point belongs to. Mirrors the rule `customSite()` uses in `@/shared/mission`
 * (owner Hagras) so the globe overlay and `Site.region` always agree:
 * lat < −80 → south pole, lat > 80 → north pole, |lon| > 90 → far side, else near side.
 */
export function regionAt(lat: number, lon: number): RegionId {
  if (lat < -POLAR_CAP_DEG) return 'south-pole';
  if (lat > POLAR_CAP_DEG) return 'north-pole';
  return Math.abs(normalizeLon(lon)) > 90 ? 'farside' : 'nearside';
}

export const REGION_LABEL: Record<RegionId, string> = {
  'south-pole': 'South pole',
  'north-pole': 'North pole',
  nearside: 'Near side',
  farside: 'Far side',
};

const range = (from: number, to: number, step: number) => {
  const n = Math.max(1, Math.round(Math.abs(to - from) / step));
  return Array.from({ length: n + 1 }, (_, i) => from + ((to - from) * i) / n);
};

/** Closed outline(s) of a region as lat/lon polylines (2° sampling), for drawing on the globe. */
export function regionOutline(id: RegionId): LatLon[][] {
  const cap = POLAR_CAP_DEG;
  const parallel = (lat: number, from: number, to: number) => range(from, to, 2).map((lon) => ({ lat, lon }));
  const meridian = (lon: number, from: number, to: number) => range(from, to, 2).map((lat) => ({ lat, lon }));
  switch (id) {
    case 'south-pole':
      return [parallel(-cap, -180, 180)];
    case 'north-pole':
      return [parallel(cap, -180, 180)];
    case 'nearside':
      return [[...meridian(-90, -cap, cap), ...parallel(cap, -90, 90), ...meridian(90, cap, -cap), ...parallel(-cap, 90, -90)]];
    case 'farside':
      return [
        [...meridian(90, -cap, cap), ...parallel(cap, 90, 180)],
        [...parallel(cap, -180, -90), ...meridian(-90, cap, -cap), ...parallel(-cap, -90, -180)],
        [...parallel(-cap, 180, 90)],
      ];
  }
}

/** Menu order: the challenge focus first. */
export const REGION_ORDER: RegionId[] = ['south-pole', 'nearside', 'farside', 'north-pole'];

/**
 * Where the camera looks to show a whole region. Polar regions are viewed obliquely (±70°) so
 * the cap reads as a shape rather than a dot.
 */
export const REGION_VIEW: Record<RegionId, LatLon> = {
  'south-pole': { lat: -70, lon: 0 },
  nearside: { lat: 0, lon: 0 },
  farside: { lat: 0, lon: 180 },
  'north-pole': { lat: 70, lon: 0 },
};
