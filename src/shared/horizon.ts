/**
 * The horizon reliability rule (see the comment on HorizonInfo in types.ts).
 * Engine and UI both call these so they can never disagree.
 */
import type { HorizonInfo, HorizonSource, Reliability } from './types';

export const POLAR_LIMIT_DEG = 80;

export function horizonReliability(source: HorizonSource, latDeg: number): Reliability | undefined {
  if (source === 'demo') return undefined;
  if (source === 'lola') return 'high';
  return Math.abs(latDeg) >= POLAR_LIMIT_DEG ? 'low' : 'medium';
}

export function horizonInfo(source: HorizonSource, latDeg: number, note?: string): HorizonInfo {
  return { source, reliability: horizonReliability(source, latDeg), note };
}

/** User-facing label, e.g. "Flat horizon · terrain not modelled · unreliable near the pole". */
export function horizonLabel(source: HorizonSource, latDeg: number): string {
  if (source === 'lola') return 'Real terrain (NASA LOLA)';
  if (source === 'demo') return 'Demo horizon';
  const base = 'Flat horizon · terrain not modelled';
  return Math.abs(latDeg) >= POLAR_LIMIT_DEG ? `${base} · unreliable near the pole` : base;
}
