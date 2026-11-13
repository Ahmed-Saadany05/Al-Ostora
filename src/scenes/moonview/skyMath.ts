/**
 * SKY MATH for the "stand on site" view (owner: Pink). Pure, unit-tested (skyMath.test.mjs).
 *
 * Local frame of a person standing on the site, in three.js axes:
 *   +X = east · +Y = up (zenith) · −Z = north   (so a camera with no rotation looks north).
 * Angles follow the shared contract: degrees, azimuth clockwise from north (N 0°, E 90°),
 * elevation above the flat (mathematical) horizon.
 */

export type Vec3Tuple = [number, number, number];

const D2R = Math.PI / 180;

/** Unit direction (or `r` long) to a body at azimuth/elevation. */
export function azElToLocal(azDeg: number, elDeg: number, r = 1): Vec3Tuple {
  const az = azDeg * D2R;
  const el = elDeg * D2R;
  return [r * Math.cos(el) * Math.sin(az), r * Math.sin(el), -r * Math.cos(el) * Math.cos(az)];
}

/** Azimuth/elevation (degrees, azimuth in 0…360) of a local direction. */
export function localToAzEl([x, y, z]: Vec3Tuple): { azDeg: number; elDeg: number } {
  const r = Math.hypot(x, y, z) || 1;
  const az = (Math.atan2(x, -z) / D2R + 360) % 360;
  return { azDeg: az, elDeg: Math.asin(Math.max(-1, Math.min(1, y / r))) / D2R };
}

export interface PathSample {
  azDeg: number;
  elDeg: number;
}

/**
 * A body's path across the sky as line segments on a sphere of radius `r`, from time-ordered
 * samples (e.g. DayReport.samples mapped to sky.sun / sky.earth). Parts below `minElDeg` are
 * dropped, so the dotted line never runs underground; each above-horizon stretch is one segment.
 */
export function skyPathSegments(samples: PathSample[], r: number, minElDeg = -2): Vec3Tuple[][] {
  const segments: Vec3Tuple[][] = [];
  let current: Vec3Tuple[] = [];
  for (const s of samples) {
    if (s.elDeg >= minElDeg) {
      current.push(azElToLocal(s.azDeg, s.elDeg, r));
    } else if (current.length) {
      if (current.length > 1) segments.push(current);
      current = [];
    }
  }
  if (current.length > 1) segments.push(current);
  return segments;
}

/** Light (or radio) travel time for a distance, in seconds. c = 299,792.458 km/s. */
export function lightSeconds(distanceKm: number): number {
  return distanceKm / 299_792.458;
}

// ---------------------------------------------------------------- smooth sky between samples

/** Minimal shapes so this stays pure (structurally compatible with SkyState / BodyPosition). */
interface BodyLike {
  azDeg: number;
  elDeg: number;
  horizonElDeg: number;
  clearanceDeg: number;
  distanceKm: number;
  angularDiameterDeg: number;
  visibleFraction: number;
}
interface SkyLike {
  time: string;
  sun: BodyLike;
  earth: BodyLike & { illumination: number };
  sunVisible: boolean;
  earthVisible: boolean;
}

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
/** Shortest way round the compass (350° → 10° goes through 0°). */
export function lerpAzDeg(a: number, b: number, k: number): number {
  const d = ((((b - a) % 360) + 540) % 360) - 180;
  return (((a + d * k) % 360) + 360) % 360;
}
function lerpBody<B extends BodyLike>(a: B, b: B, k: number): B {
  return {
    ...a,
    azDeg: lerpAzDeg(a.azDeg, b.azDeg, k),
    elDeg: lerp(a.elDeg, b.elDeg, k),
    horizonElDeg: lerp(a.horizonElDeg, b.horizonElDeg, k),
    clearanceDeg: lerp(a.clearanceDeg, b.clearanceDeg, k),
    distanceKm: lerp(a.distanceKm, b.distanceKm, k),
    angularDiameterDeg: lerp(a.angularDiameterDeg, b.angularDiameterDeg, k),
    visibleFraction: lerp(a.visibleFraction, b.visibleFraction, k),
  };
}

/**
 * The sky at `time`, blended from the two time-ordered samples around it (DayReport.samples), so
 * the view follows the clock instantly while scrubbing or in a timelapse instead of waiting for a
 * new data request per moment. Visibility flips at the nearer sample (the data layer's own answer,
 * never re-derived here). Null when `time` is outside the samples.
 */
export function interpolateSky<S extends SkyLike>(samples: S[] | undefined, time: string): S | null {
  if (!samples || samples.length === 0) return null;
  const t = Date.parse(time);
  if (!Number.isFinite(t)) return null;
  const first = Date.parse(samples[0].time);
  const last = Date.parse(samples[samples.length - 1].time);
  if (t < first || t > last) return null;
  // Binary search for the last sample at or before t.
  let lo = 0;
  let hi = samples.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (Date.parse(samples[mid].time) <= t) lo = mid;
    else hi = mid - 1;
  }
  const a = samples[lo];
  const b = samples[Math.min(lo + 1, samples.length - 1)];
  const ta = Date.parse(a.time);
  const tb = Date.parse(b.time);
  const k = tb > ta ? (t - ta) / (tb - ta) : 0;
  const near = k < 0.5 ? a : b;
  return {
    ...near,
    time,
    sun: lerpBody(a.sun, b.sun, k),
    earth: { ...lerpBody(a.earth, b.earth, k), illumination: lerp(a.earth.illumination, b.earth.illumination, k) },
  };
}
