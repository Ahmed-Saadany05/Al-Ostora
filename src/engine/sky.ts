/**
 * One instant: Sun and Earth vs the terrain horizon (pure function, no I/O).
 */
import { horizonInfo } from '@/shared/horizon';
import type { BodyPosition, HorizonProfile, Site } from '@/shared/types';
import { separationDeg } from './geometry';
import type { BodySample } from './track';
import type { EngineSkyState } from './types';
import {
  diskFractionAbove,
  earthIlluminationFromGeometry,
  eclipseState,
  horizonAt,
  sunFractionWithEarth,
} from './visibility';

function position(b: BodySample, horizon: HorizonProfile): BodyPosition {
  const horizonElDeg = horizonAt(horizon, b.azDeg);
  const clearanceDeg = b.elDeg - horizonElDeg;
  return {
    azDeg: b.azDeg,
    elDeg: b.elDeg,
    horizonElDeg,
    clearanceDeg,
    distanceKm: b.distanceKm,
    angularDiameterDeg: b.angularDiameterDeg,
    visibleFraction: diskFractionAbove(clearanceDeg, b.angularDiameterDeg / 2),
  };
}

export function computeSky(
  site: Site | null,
  ms: number,
  sunS: BodySample,
  earthS: BodySample,
  horizon: HorizonProfile,
  commsMinClearanceDeg: number,
): EngineSkyState {
  const sun = position(sunS, horizon);
  const earth = position(earthS, horizon);
  const rs = sun.angularDiameterDeg / 2;
  const re = earth.angularDiameterDeg / 2;

  // Terrain: any part of the disk above the skyline ⇔ top of disk above it.
  const sunTerrainFraction = sun.visibleFraction;
  const sunAboveTerrain = sun.clearanceDeg + rs > 0;

  // Eclipse (Earth in front of the Sun). Horizons' daylight flag ignores this.
  const sep = separationDeg(sunS.vec, earthS.vec);
  const eclipse = eclipseState(sep, rs, re);
  let sunFraction = sunTerrainFraction;
  if (eclipse === 'total') sunFraction = 0;
  else if (eclipse === 'partial' && sunAboveTerrain)
    sunFraction = sunFractionWithEarth(sunS, earthS, sun.clearanceDeg, sep);
  sun.visibleFraction = sunFraction;
  // Decided: totality ⇒ not visible. In a partial eclipse, visible if any sunlight is left.
  const sunVisible =
    sunAboveTerrain && eclipse !== 'total' && (eclipse === 'none' || sunFraction > 1e-6);

  // Earth: any part above the terrain; a margin applies to the top of the disk.
  const top = earth.clearanceDeg + re;
  const earthVisible = commsMinClearanceDeg > 0 ? top >= commsMinClearanceDeg : top > 0;

  const illumination =
    earthS.illuminationPct !== undefined
      ? earthS.illuminationPct / 100
      : earthIlluminationFromGeometry(sunS, earthS);

  const terrain = horizon.terrain ?? (horizon.source === 'lola' ? 'lola' : 'flat');
  const lat = site?.lat ?? 0;
  return {
    source: 'computed',
    siteId: site?.id ?? '',
    time: new Date(ms).toISOString(),
    sun,
    earth: { ...earth, illumination },
    sunVisible,
    earthVisible,
    horizon: horizonInfo(horizon.source === 'demo' ? 'demo' : terrain, lat),
    eclipse,
    sunTerrainFraction,
  };
}
