/**
 * Turns a recorded touchdown (landingSky.json, JPL Horizons) into the SkyState the 3D view draws, so the Sun and Earth
 * stand exactly where they were whatever data provider the app runs on. Visibility uses the site's real horizon
 * profile when we have one (polar sites, LOLA), otherwise the flat horizon.
 */
import type { BodyPosition, HorizonProfile, SkyState } from '@/shared/types';
import type { LandingSky } from './missions';

function horizonAt(h: HorizonProfile | undefined, azDeg: number) {
  if (!h || h.source === 'demo' || !h.elevationsDeg.length) return 0;
  const n = h.elevationsDeg.length;
  const f = (((azDeg % 360) + 360) % 360) / h.azStepDeg;
  const i = Math.floor(f) % n;
  const t = f - Math.floor(f);
  return h.elevationsDeg[i] * (1 - t) + h.elevationsDeg[(i + 1) % n] * t;
}

function body(b: { azDeg: number; elDeg: number; distanceKm: number; angularDiameterDeg: number }, h?: HorizonProfile): BodyPosition {
  const horizonElDeg = horizonAt(h, b.azDeg);
  const clearanceDeg = b.elDeg - horizonElDeg;
  const r = b.angularDiameterDeg / 2;
  return {
    azDeg: b.azDeg,
    elDeg: b.elDeg,
    horizonElDeg,
    clearanceDeg,
    distanceKm: b.distanceKm,
    angularDiameterDeg: b.angularDiameterDeg,
    visibleFraction: Math.min(1, Math.max(0, (clearanceDeg + r) / (2 * r || 1))),
  };
}

export function landingSkyState(siteId: string, l: LandingSky, horizon?: HorizonProfile): SkyState {
  const sun = body(l.sun, horizon);
  const earth = body(l.earth, horizon);
  return {
    source: 'horizons',
    siteId,
    time: l.time,
    sun,
    earth: { ...earth, illumination: l.earth.illuminationPct === null ? 0.5 : l.earth.illuminationPct / 100 },
    sunVisible: sun.visibleFraction > 0,
    earthVisible: earth.clearanceDeg > 0,
  };
}

/** Where to stand a model: a bearing measured from the Sun (so it is lit from the side) and a distance. */
export function placeFromSun(sunAzDeg: number, fromSunDeg: number, distanceM: number) {
  const b = ((sunAzDeg + fromSunDeg) * Math.PI) / 180;
  return { x: distanceM * Math.sin(b), z: -distanceM * Math.cos(b) };
}
