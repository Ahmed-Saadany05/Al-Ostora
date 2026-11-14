/**
 * Shape returned by our /api/horizons proxy (owner: Hagras).
 * Angles are topocentric for an observer standing on the Moon at (lat, lon).
 */
export type HorizonsTarget = 'sun' | 'earth';

export interface HorizonsQuery {
  target: HorizonsTarget;
  lat: number;
  lon: number;
  /** Height above the reference sphere, km (default 0). */
  altKm?: number;
  /** ISO UTC. */
  start: string;
  stop: string;
  /** e.g. '1h', '30m', '1d'. */
  step: string;
}

export interface HorizonsRow {
  time: string; // ISO UTC
  azDeg: number; // from north, clockwise
  elDeg: number; // above the flat (airless) horizon
  angularDiameterDeg: number;
  distanceKm: number;
  /** Earth only: illuminated fraction of the disk as seen from the site, percent (Horizons quantity 10). */
  illuminationPct?: number;
}

export interface HorizonsResponse {
  source: 'horizons';
  query: Required<HorizonsQuery>;
  rows: HorizonsRow[];
  /** The exact JPL request — link to it from the Verify screen. */
  horizonsUrl: string;
  fetchedAt: string;
  /** true when served from a recorded fixture (offline fallback). */
  fixture?: boolean;
}
