/**
 * Which part of the Moon a point is in. ONE rule for the whole app: the site catalogue,
 * custom coordinates (customSite) and Pink's globe sectors (scenes/lib/moonFrame regionAt)
 * all use it, so a site listed under "South pole" is always inside the south-pole cap.
 *   lat < −80 → south pole · lat > 80 → north pole · |lon| > 90 → far side · else near side
 */
import type { SiteRegion } from './types';

export const POLAR_CAP_DEG = 80;

export function regionOf(lat: number, lon: number): SiteRegion {
  if (lat < -POLAR_CAP_DEG) return 'south-pole';
  if (lat > POLAR_CAP_DEG) return 'north-pole';
  const l = ((((lon + 180) % 360) + 360) % 360) - 180;
  return Math.abs(l) > 90 ? 'farside' : 'nearside';
}
