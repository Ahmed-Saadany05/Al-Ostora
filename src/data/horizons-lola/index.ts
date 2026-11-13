/**
 * Real terrain horizons computed from NASA LOLA (scripts/horizons/compute.mjs). Owner: Hagras.
 * One JSON per site; a site without a file falls back to the provider's own horizon.
 */
import type { HorizonProfile } from '@/shared/types';

type HorizonFile = HorizonProfile & {
  meta: { lat: number; lon: number; siteHeightM: number; generatedAt: string };
};

const files = import.meta.glob<HorizonFile>('./*.json', { eager: true, import: 'default' });

const bySite = new Map<string, HorizonFile>(Object.values(files).map((f) => [f.siteId, f]));

/** The LOLA horizon for a catalogue site, if one has been computed (and still matches its coordinates). */
export function lolaHorizon(siteId: string, lat: number, lon: number): HorizonProfile | undefined {
  const f = bySite.get(siteId);
  // Guard: if the catalogue point moved since the file was computed, don't use a stale horizon.
  if (!f || Math.abs(f.meta.lat - lat) > 1e-6 || Math.abs(f.meta.lon - lon) > 1e-6) return undefined;
  return f;
}

export const LOLA_HORIZON_SITES = [...bySite.keys()];
