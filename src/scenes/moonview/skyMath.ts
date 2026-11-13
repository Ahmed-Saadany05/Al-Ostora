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
