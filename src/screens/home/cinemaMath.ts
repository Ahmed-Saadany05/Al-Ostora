/**
 * Numbers and helpers for the cinematic Home scene. Scene units: Moon radius = 1.
 * Scene axes: +Y is "up" on screen with the Moon's SOUTH POLE on top (the dome's crest); +Z points toward Earth.
 */
import { LUNAR } from '@/shared/types';

/** Real values (km): Earth's equatorial radius and the mean Earth–Moon distance. */
const EARTH_RADIUS_KM = 6371;
const EARTH_DISTANCE_KM = 384_400;

/** True scale, derived (not typed in): ≈ 3.667 Moon radii and ≈ 221.3 Moon radii. */
export const EARTH_RADIUS = EARTH_RADIUS_KM / LUNAR.radiusKm;
export const EARTH_DISTANCE = EARTH_DISTANCE_KM / LUNAR.radiusKm;

/**
 * Libration in latitude: the Moon's axis tilt to its orbit makes Earth swing ±6.7° north–south of the
 * lunar horizon over a month. The time-lapse compresses that month into one 90 s loop.
 */
export const LIBRATION_LAT_DEG = 6.7;
export const LIBRATION_LOOP_S = 90;

const DEG = Math.PI / 180;

/** Earth's elevation above the lunar horizon (degrees) `t` seconds into the loop, starting at `phase0` (0–1 of a loop). */
export function earthElevationDeg(t: number, phase0 = 0): number {
  return LIBRATION_LAT_DEG * Math.sin(2 * Math.PI * (t / LIBRATION_LOOP_S + phase0));
}

/** Apparent angular diameter of Earth from the Moon, degrees (≈ 1.9°). */
export const earthAngularDiameterDeg = () => 2 * Math.atan(EARTH_RADIUS / EARTH_DISTANCE) / DEG;

/** Earth's position in scene units for an elevation above the horizon (camera looks along +Z, up = +Y). */
export function earthPosition(elevDeg: number): [number, number, number] {
  const e = elevDeg * DEG;
  return [0, EARTH_DISTANCE * Math.sin(e), EARTH_DISTANCE * Math.cos(e)];
}

// ---------------------------------------------------------------- camera

/** Vertical field of view, degrees. */
export const FOV = 52;
/** The camera sits on the tangent line over the south pole, this far behind it (Moon radii). Smaller = bigger dome. */
export const CAMERA_BACK = 1.2;
/** Camera height above the pole's tangent plane (Moon radii): a hair above, so the pole sits just under the crest. */
export const CAMERA_LIFT = 0.012;
/** Where the crest sits on screen, as a fraction of the height from the top. */
export const CREST_FROM_TOP = 0.55;
/** Descent: how close to the pole the camera ends (Moon radii behind it), and how long it takes. */
export const DESCENT_BACK = 0.04;
export const DESCENT_S = 1.2;

/** Direction toward the Sun, shared by the Moon and Earth so both show a consistent phase (lit from screen-left, grazing). */
/** (Looking along +Z with +Y up, screen-left is +X.) */
export const SUN_DIRECTION: [number, number, number] = [1, 0.16, -0.2];

/** Camera pitch (radians, up is positive) that puts the horizon at CREST_FROM_TOP of the frame height. */
export function cameraPitch(): number {
  // The horizon is at elevation 0; the frame spans ±FOV/2 around the view axis.
  return ((CREST_FROM_TOP - 0.5) * FOV) * DEG;
}
