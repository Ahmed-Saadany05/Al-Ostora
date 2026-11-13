/**
 * Terrain horizon per site: the LOLA profile from src/data/horizons-lola/<site.id>.json
 * (Hagras's pipeline) or, when there is none, a flat sphere horizon dipped for the 2 m
 * observer, labelled "Flat horizon · terrain not modelled" by the shared rule.
 */
import type { HorizonProfile, Site } from '@/shared/types';
import { MOON_RADIUS_KM, OBSERVER_HEIGHT_M } from './constants';
import { DEG } from './geometry';

export type ProfileLoader = (siteId: string) => Promise<HorizonProfile | null>;

/** Dip of the geometric horizon for an observer h metres above a smooth sphere, degrees. */
export function horizonDipDeg(heightM = OBSERVER_HEIGHT_M): number {
  const R = MOON_RADIUS_KM * 1000;
  return Math.acos(R / (R + heightM)) / DEG;
}

export function flatProfile(site: Site): HorizonProfile {
  const STEP = 0.5;
  const dip = horizonDipDeg();
  const R = MOON_RADIUS_KM * 1000;
  return {
    source: 'computed',
    siteId: site.id,
    azStepDeg: STEP,
    elevationsDeg: new Array(360 / STEP).fill(-dip),
    maxRangeKm: Math.sqrt(2 * R * OBSERVER_HEIGHT_M + OBSERVER_HEIGHT_M ** 2) / 1000,
    observerHeightM: OBSERVER_HEIGHT_M,
    terrain: 'flat',
  };
}

export function validateProfile(p: HorizonProfile, siteId: string): HorizonProfile {
  const n = p.elevationsDeg?.length ?? 0;
  if (!(p.azStepDeg > 0) || Math.abs(n * p.azStepDeg - 360) > 1e-9)
    throw new Error(`Horizon file for ${siteId}: ${n} values × ${p.azStepDeg}° does not cover 360°`);
  if (p.elevationsDeg.some((e) => !Number.isFinite(e)))
    throw new Error(`Horizon file for ${siteId}: non-numeric elevation`);
  return { ...p, terrain: p.terrain ?? 'lola' };
}

export function makeHorizonCache(load: ProfileLoader) {
  const cache = new Map<string, Promise<HorizonProfile>>();
  return (site: Site): Promise<HorizonProfile> => {
    const k = `${site.id}@${site.lat},${site.lon}`;
    let p = cache.get(k);
    if (!p) {
      // Custom points never use a catalogue site's file, even if the id collides.
      p = (site.kind === 'custom' ? Promise.resolve(null) : load(site.id)).then((file) =>
        file ? validateProfile(file, site.id) : flatProfile(site),
      );
      p.catch(() => cache.delete(k));
      cache.set(k, p);
    }
    return p;
  };
}
