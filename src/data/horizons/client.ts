/**
 * Browser client for the /api/horizons proxy. Used by the real provider and the
 * Verify screen. Falls back to recorded fixtures when offline (venue Wi-Fi!).
 */
import type { HorizonsQuery, HorizonsResponse } from './types';

export type { HorizonsQuery, HorizonsResponse, HorizonsRow, HorizonsTarget } from './types';

/** Recorded responses, keyed by fixtureKey(query). Add files under ./fixtures. */
const fixtures = import.meta.glob<HorizonsResponse>('./fixtures/*.json', { import: 'default' });

export const fixtureKey = (q: HorizonsQuery) =>
  `${q.target}_${q.lat}_${q.lon}_${q.start.slice(0, 10)}_${q.stop.slice(0, 10)}_${q.step}`;

export class HorizonsError extends Error {
  constructor(
    message: string,
    readonly horizonsUrl?: string,
  ) {
    super(message);
  }
}

export async function fetchHorizons(q: HorizonsQuery, signal?: AbortSignal): Promise<HorizonsResponse> {
  const params = new URLSearchParams({
    target: q.target,
    lat: String(q.lat),
    lon: String(q.lon),
    altKm: String(q.altKm ?? 0),
    start: q.start,
    stop: q.stop,
    step: q.step,
  });
  try {
    const res = await fetch(`/api/horizons?${params}`, { signal });
    const body = await res.json();
    if (!res.ok) throw new HorizonsError(body.error ?? `HTTP ${res.status}`, body.horizonsUrl);
    return body as HorizonsResponse;
  } catch (err) {
    if (signal?.aborted) throw err;
    const load = fixtures[`./fixtures/${fixtureKey(q)}.json`];
    if (load) return { ...(await load()), fixture: true };
    throw err instanceof HorizonsError ? err : new HorizonsError(`Horizons unavailable: ${(err as Error).message}`);
  }
}
