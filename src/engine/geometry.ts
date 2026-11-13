/**
 * Small vector helpers. Local frame is ENU at the site: x = East, y = North, z = Up.
 * Azimuth is clockwise from north, elevation above the plane perpendicular to the local radial.
 */
import { MOON_RADIUS_KM } from './constants';

export const DEG = Math.PI / 180;
export type Vec3 = [number, number, number];

export const wrap360 = (a: number) => ((a % 360) + 360) % 360;
export const wrap180 = (a: number) => wrap360(a + 180) - 180;
export const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

export function azElToVec(azDeg: number, elDeg: number): Vec3 {
  const az = azDeg * DEG;
  const el = elDeg * DEG;
  const c = Math.cos(el);
  return [Math.sin(az) * c, Math.cos(az) * c, Math.sin(el)];
}

export function vecToAzEl(v: Vec3): { azDeg: number; elDeg: number } {
  const h = Math.hypot(v[0], v[1]);
  return { azDeg: wrap360(Math.atan2(v[0], v[1]) / DEG), elDeg: Math.atan2(v[2], h) / DEG };
}

export function normalize(v: Vec3): Vec3 {
  const n = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / n, v[1] / n, v[2] / n];
}

/** Angle between two directions, degrees (atan2 form: accurate for tiny angles). */
export function separationDeg(a: Vec3, b: Vec3): number {
  const cx = a[1] * b[2] - a[2] * b[1];
  const cy = a[2] * b[0] - a[0] * b[2];
  const cz = a[0] * b[1] - a[1] * b[0];
  const dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  return Math.atan2(Math.hypot(cx, cy, cz), dot) / DEG;
}

/** Great-circle distance on the 1737.4 km sphere (haversine), km. */
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const p1 = lat1 * DEG;
  const p2 = lat2 * DEG;
  const dp = p2 - p1;
  const dl = (lon2 - lon1) * DEG;
  const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * MOON_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}
