/**
 * Terrain horizon lookup, disk-above-horizon fraction, and the Sun–Earth eclipse.
 * Formulas: ENGINE_SPEC.md §3–§4.
 */
import type { HorizonProfile } from '@/shared/types';
import { clamp, DEG, wrap180, wrap360 } from './geometry';
import type { EclipseState } from './types';
import type { BodySample } from './track';

/** Terrain horizon elevation at an azimuth, linear between the 0.5° profile samples. */
export function horizonAt(h: HorizonProfile, azDeg: number): number {
  const n = h.elevationsDeg.length;
  const x = wrap360(azDeg) / h.azStepDeg;
  const i = Math.floor(x) % n;
  const f = x - Math.floor(x);
  return h.elevationsDeg[i] * (1 - f) + h.elevationsDeg[(i + 1) % n] * f;
}

/**
 * Share of a uniform disk (angular radius r) above a horizontal line `c` below its centre:
 * x = clamp(c/r, −1, 1), f = 1 − [acos(x) − x·√(1−x²)]/π.
 */
export function diskFractionAbove(clearanceDeg: number, radiusDeg: number): number {
  const x = clamp(clearanceDeg / radiusDeg, -1, 1);
  return 1 - (Math.acos(x) - x * Math.sqrt(1 - x * x)) / Math.PI;
}

export function eclipseState(sepDeg: number, rSun: number, rEarth: number): EclipseState {
  if (sepDeg >= rEarth + rSun) return 'none';
  if (sepDeg <= rEarth - rSun) return 'total';
  return 'partial';
}

/**
 * Share of the solar disk that is above the terrain line AND not behind Earth.
 * Integrated in horizontal strips in a small-angle tangent plane centred on the Sun
 * (x along the horizon, y up). Earth's centre offset is rescaled so its length equals the
 * exact vector separation. Used only while an eclipse is under way (rare).
 */
export function sunFractionWithEarth(
  sun: BodySample,
  earth: BodySample,
  sunClearanceDeg: number,
  sepDeg: number,
  strips = 600,
): number {
  const rs = sun.angularDiameterDeg / 2;
  const re = earth.angularDiameterDeg / 2;
  let ex = wrap180(earth.azDeg - sun.azDeg) * Math.cos(sun.elDeg * DEG);
  let ey = earth.elDeg - sun.elDeg;
  const len = Math.hypot(ex, ey);
  if (len > 0) {
    ex = (ex / len) * sepDeg;
    ey = (ey / len) * sepDeg;
  }
  // Integrate over θ with y = rs·sin θ (removes the √ edge singularity), from the terrain
  // line (relative to the Sun's centre) up to the top of the disk.
  const th0 = Math.asin(clamp(-sunClearanceDeg / rs, -1, 1));
  const dth = (Math.PI / 2 - th0) / strips;
  let area = 0;
  for (let k = 0; k < strips; k++) {
    const th = th0 + (k + 0.5) * dth;
    const y = rs * Math.sin(th);
    const dy = rs * Math.cos(th) * dth;
    const a = rs * Math.cos(th);
    let visible = 2 * a;
    const q = re * re - (y - ey) ** 2;
    if (q > 0) {
      const b = Math.sqrt(q);
      const overlap = Math.min(a, ex + b) - Math.max(-a, ex - b);
      if (overlap > 0) visible -= overlap;
    }
    area += visible * dy;
  }
  return clamp(area / (Math.PI * rs * rs), 0, 1);
}

/**
 * Earth's illuminated fraction seen from the site, from the Sun–Earth–observer angle:
 * k = ½(1 + cos θ). Cross-check only; the proxy's quantity 10 is preferred (spec §4).
 */
export function earthIlluminationFromGeometry(sun: BodySample, earth: BodySample): number {
  const S = sun.vec.map((c) => c * sun.distanceKm);
  const E = earth.vec.map((c) => c * earth.distanceKm);
  const toObs = E.map((c) => -c);
  const toSun = S.map((c, k) => c - E[k]);
  const dot = toObs[0] * toSun[0] + toObs[1] * toSun[1] + toObs[2] * toSun[2];
  const cos = dot / (Math.hypot(...toObs) * Math.hypot(...toSun));
  return 0.5 * (1 + cos);
}
