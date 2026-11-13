/**
 * EARTH–MOON GEOMETRY for the launch scene (owner: Pink). Pure, unit-tested (orbit.test.mjs).
 *
 * PLACEHOLDER MODEL. Positions come from short textbook series (Meeus-style, ~0.5° for the Moon,
 * ~0.01° for the Sun), and the rocket's path is a smooth stand-in arc, not a computed transfer.
 * Everything goes through `OrbitProvider`, so the engine's real ephemeris and trajectory can replace
 * `placeholderOrbit` without touching the scene.
 *
 * Frame: geocentric ecliptic, km. +X toward the March equinox, +Z ecliptic north.
 */

export type Vec3 = [number, number, number];

export interface OrbitProvider {
  /** Moon centre at `iso`, km (geocentric ecliptic). */
  moonAt(iso: string): Vec3;
  /** Unit vector toward the Sun at `iso`. */
  sunDirAt(iso: string): Vec3;
  /** Rocket position at `k` ∈ [0, 1] of the trip from launch to arrival, km. */
  rocketAt(k: number, launchIso: string, arrivalIso: string): Vec3;
  /** Shown in the scene, e.g. "Approximate orbit · placeholder transfer". */
  label: string;
  placeholder: boolean;
}

const D2R = Math.PI / 180;
const J2000 = Date.UTC(2000, 0, 1, 12);
const days = (iso: string) => (Date.parse(iso) - J2000) / 86_400_000;
const sin = (deg: number) => Math.sin(deg * D2R);
const cos = (deg: number) => Math.cos(deg * D2R);
const norm360 = (deg: number) => ((deg % 360) + 360) % 360;

export const EARTH_RADIUS_KM = 6371;
export const MOON_RADIUS_KM = 1737.4;
/** Days per lap of the Moon against the stars. */
export const SIDEREAL_MONTH_D = 27.321661;

/** Sun's apparent ecliptic longitude, degrees. */
export function sunLongitude(iso: string): number {
  const d = days(iso);
  const L = 280.46 + 0.9856474 * d;
  const g = 357.528 + 0.9856003 * d;
  return norm360(L + 1.915 * sin(g) + 0.02 * sin(2 * g));
}

/** Moon's geocentric ecliptic longitude/latitude (degrees) and distance (km). */
export function moonEcliptic(iso: string): { lonDeg: number; latDeg: number; distanceKm: number } {
  const d = days(iso);
  const Lp = 218.316 + 13.176396 * d; // mean longitude
  const Mp = 134.963 + 13.064993 * d; // Moon's mean anomaly
  const M = 357.529 + 0.98560028 * d; // Sun's mean anomaly
  const D = 297.85 + 12.190749 * d; // mean elongation
  const F = 93.272 + 13.22935 * d; // argument of latitude
  const lon = Lp + 6.289 * sin(Mp) + 1.274 * sin(2 * D - Mp) + 0.658 * sin(2 * D) + 0.214 * sin(2 * Mp) - 0.186 * sin(M) - 0.114 * sin(2 * F);
  const lat = 5.128 * sin(F);
  const dist = 385001 - 20905 * cos(Mp) - 3699 * cos(2 * D - Mp) - 2956 * cos(2 * D) - 570 * cos(2 * Mp);
  return { lonDeg: norm360(lon), latDeg: lat, distanceKm: dist };
}

export function eclipticToVec(lonDeg: number, latDeg: number, r: number): Vec3 {
  return [r * cos(latDeg) * cos(lonDeg), r * cos(latDeg) * sin(lonDeg), r * sin(latDeg)];
}

const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
const len = (a: Vec3) => Math.hypot(a[0], a[1], a[2]);

/** Phase angle Sun–Earth–Moon seen from Earth, degrees (0 = new Moon, 180 = full). */
export function elongationDeg(iso: string): number {
  const m = moonEcliptic(iso);
  const s = sunLongitude(iso);
  const dl = Math.abs(((m.lonDeg - s + 540) % 360) - 180);
  return Math.acos(cos(m.latDeg) * cos(dl)) / D2R;
}

/**
 * Placeholder trip: leaves a parking orbit (≈ 330 km up) on the side of Earth opposite the Moon's
 * arrival point (where a real trans-lunar injection burn happens), swings out in a smooth arc in the
 * Moon's direction of travel, and meets the Moon where it will be on arrival. Fast near Earth, slow
 * near the Moon, as a coasting spacecraft is.
 */
function placeholderRocket(provider: Pick<OrbitProvider, 'moonAt'>, k: number, arrivalIso: string): Vec3 {
  const end = provider.moonAt(arrivalIso);
  const r = len(end);
  const u = scale(end, 1 / r);
  // Direction of the Moon's motion at arrival (prograde), from a small time step.
  const later = provider.moonAt(new Date(Date.parse(arrivalIso) + 3_600_000).toISOString());
  const v0: Vec3 = [later[0] - end[0], later[1] - end[1], later[2] - end[2]];
  const along = scale(u, v0[0] * u[0] + v0[1] * u[1] + v0[2] * u[2]);
  const t = [v0[0] - along[0], v0[1] - along[1], v0[2] - along[2]] as Vec3;
  const tn = scale(t, 1 / (len(t) || 1));
  const start = scale(u, -(EARTH_RADIUS_KM + 330));
  // Cubic Bézier: out from Earth sideways (prograde), round, and in to the Moon from behind it.
  const c1 = add(start, scale(tn, -r * 0.55));
  const c2 = add(end, add(scale(tn, -r * 0.6), scale(u, r * 0.15)));
  const s = 1 - (1 - Math.min(1, Math.max(0, k))) ** 1.8; // quick departure, slow coast in
  const a = (1 - s) ** 3;
  const b = 3 * (1 - s) ** 2 * s;
  const c = 3 * (1 - s) * s * s;
  const e = s ** 3;
  return [
    a * start[0] + b * c1[0] + c * c2[0] + e * end[0],
    a * start[1] + b * c1[1] + c * c2[1] + e * end[1],
    a * start[2] + b * c1[2] + c * c2[2] + e * end[2],
  ];
}

export const placeholderOrbit: OrbitProvider = {
  moonAt(iso) {
    const m = moonEcliptic(iso);
    return eclipticToVec(m.lonDeg, m.latDeg, m.distanceKm);
  },
  sunDirAt(iso) {
    return eclipticToVec(sunLongitude(iso), 0, 1);
  },
  rocketAt(k, _launchIso, arrivalIso) {
    return placeholderRocket(placeholderOrbit, k, arrivalIso); // the placeholder arc depends only on the arrival point
  },
  label: 'Approximate Moon orbit · placeholder trajectory',
  placeholder: true,
};

/** The Moon's path over one lap starting at `fromIso`, `n` points (closed loop when drawn). */
export function moonOrbitPath(provider: OrbitProvider, fromIso: string, n = 240): Vec3[] {
  const t0 = Date.parse(fromIso);
  return Array.from({ length: n + 1 }, (_, i) =>
    provider.moonAt(new Date(t0 + (i / n) * SIDEREAL_MONTH_D * 86_400_000).toISOString()),
  );
}

/** The rocket's whole path, `n` points. */
export function rocketPath(provider: OrbitProvider, launchIso: string, arrivalIso: string, n = 160): Vec3[] {
  return Array.from({ length: n + 1 }, (_, i) => provider.rocketAt(i / n, launchIso, arrivalIso));
}
