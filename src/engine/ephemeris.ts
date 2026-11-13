/**
 * Horizons cache. Sun and Earth rows are fetched once per site in CHUNK_DAYS blocks
 * (padded by one step so neighbouring chunks overlap) and interpolated from memory, so
 * getSky (~10×/s) never makes a request per call. Offline, recorded fixtures are used.
 */
import type { HorizonsQuery, HorizonsResponse, HorizonsTarget } from '@/data/horizons/types';
import type { Site } from '@/shared/types';
import { CHUNK_DAYS, CHUNK_STEP, CHUNK_STEP_MIN, OBSERVER_HEIGHT_M } from './constants';
import { wrap180 } from './geometry';
import { Track, type BodySample } from './track';
import type { EphemerisRow } from './types';

export type Fetcher = (q: HorizonsQuery) => Promise<HorizonsResponse>;
export type RecordedLoader = () => Promise<HorizonsResponse[]>;

const CHUNK_MS = CHUNK_DAYS * 86_400_000;
const PAD_MS = CHUNK_STEP_MIN * 60_000;
const RETRY_MS = 60_000;
/** Retries before a chunk counts as failed (then offline fallback, and a new try after RETRY_MS). */
export const RETRY_DELAYS_MS = [1_000, 3_000];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const TARGETS: HorizonsTarget[] = ['sun', 'earth'];

const sameCoord = (a: number, b: number) => Math.abs(a - b) < 1e-6;
const key = (t: HorizonsTarget, lat: number, lon: number) => `${t}:${lat}:${wrap180(lon)}`;

export class EphemerisStore {
  private tracks = new Map<string, Track[]>();
  private chunks = new Map<string, Promise<boolean>>();
  private failedAt = new Map<string, number>();
  private recorded: Promise<HorizonsResponse[]> | null = null;
  private recordedAdded = new Set<string>();

  constructor(
    private readonly fetcher: Fetcher,
    private readonly loadRecorded: RecordedLoader = async () => [],
    private readonly retryDelaysMs: readonly number[] = RETRY_DELAYS_MS,
  ) {}

  /** Add rows directly (tests, or data already in hand). */
  add(target: HorizonsTarget, lat: number, lon: number, rows: readonly EphemerisRow[]) {
    if (rows.length === 0) return;
    const k = key(target, lat, lon);
    const list = this.tracks.get(k) ?? [];
    list.push(new Track(rows));
    this.tracks.set(k, list);
  }

  /** Make sure [fromMs, toMs] is loaded for both bodies. Resolves false if any part is missing. */
  async ensure(site: Site, fromMs: number, toMs: number): Promise<boolean> {
    if (fromMs === toMs && this.covered(site, fromMs)) return true;
    const first = Math.floor(fromMs / CHUNK_MS);
    const last = Math.floor(toMs / CHUNK_MS);
    const jobs: Promise<boolean>[] = [];
    for (const target of TARGETS)
      for (let c = first; c <= last; c++) jobs.push(this.chunk(site, target, c));
    const ok = (await Promise.all(jobs)).every(Boolean);
    if (!ok) await this.addRecorded(site);
    return ok;
  }

  /** Fire-and-forget load of the chunk after `ms` (smooth playback across chunk edges). */
  prefetchAfter(site: Site, ms: number) {
    const c = Math.floor(ms / CHUNK_MS) + 1;
    if ((c * CHUNK_MS - ms) < 2 * 86_400_000)
      for (const target of TARGETS) void this.chunk(site, target, c);
  }

  private chunk(site: Site, target: HorizonsTarget, c: number): Promise<boolean> {
    const k = `${key(target, site.lat, site.lon)}#${c}`;
    const failed = this.failedAt.get(k);
    if (failed !== undefined && Date.now() - failed < RETRY_MS) return Promise.resolve(false);
    let job = this.chunks.get(k);
    if (!job) {
      const start = new Date(c * CHUNK_MS - PAD_MS).toISOString();
      const stop = new Date((c + 1) * CHUNK_MS + PAD_MS).toISOString();
      const altKm = Math.round((site.elevationM ?? 0) + OBSERVER_HEIGHT_M) / 1000;
      const q = { target, lat: site.lat, lon: site.lon, altKm, start, stop, step: CHUNK_STEP };
      job = this.queued(() => this.withRetry(() => this.fetcher(q)))
        .then((res) => {
          this.add(target, site.lat, site.lon, res.rows);
          this.failedAt.delete(k);
          return true;
        })
        .catch(() => {
          this.chunks.delete(k);
          this.failedAt.set(k, Date.now());
          return false;
        });
      this.chunks.set(k, job);
    }
    return job;
  }

  /**
   * One Horizons request at a time. Seen live on 2026-11-13: parallel requests got
   * intermittent 502s from the proxy, while the same request alone succeeded.
   */
  private queue: Promise<unknown> = Promise.resolve();
  private queued<T>(run: () => Promise<T>): Promise<T> {
    const next = this.queue.then(run, run);
    this.queue = next.catch(() => undefined);
    return next;
  }

  private async withRetry<T>(run: () => Promise<T>): Promise<T> {
    let last: unknown;
    for (let attempt = 0; attempt <= this.retryDelaysMs.length; attempt++) {
      try {
        return await run();
      } catch (err) {
        last = err;
        if (attempt < this.retryDelaysMs.length) await sleep(this.retryDelaysMs[attempt]);
      }
    }
    throw last;
  }

  private async addRecorded(site: Site) {
    this.recorded ??= this.loadRecorded().catch(() => []);
    const all = await this.recorded;
    for (const r of all) {
      const q = r.query;
      if (!sameCoord(q.lat, site.lat) || !sameCoord(wrap180(q.lon), wrap180(site.lon))) continue;
      const id = `${q.target}:${q.lat}:${q.lon}:${q.start}:${q.stop}:${q.step}`;
      if (this.recordedAdded.has(id)) continue;
      this.recordedAdded.add(id);
      this.add(q.target, site.lat, site.lon, r.rows);
    }
  }

  sample(site: Site, target: HorizonsTarget, ms: number): BodySample | null {
    const list = this.tracks.get(key(target, site.lat, site.lon));
    const tr = list?.find((t) => t.covers(ms));
    return tr ? tr.at(ms) : null;
  }

  covered(site: Site, ms: number): boolean {
    return TARGETS.every((t) => this.tracks.get(key(t, site.lat, site.lon))?.some((tr) => tr.covers(ms)));
  }

  /** Closest time to `ms` where both bodies are recorded, or null. */
  nearestCovered(site: Site, ms: number): number | null {
    const sun = this.tracks.get(key('sun', site.lat, site.lon)) ?? [];
    const earth = this.tracks.get(key('earth', site.lat, site.lon)) ?? [];
    let best: number | null = null;
    for (const a of sun)
      for (const b of earth) {
        const lo = Math.max(a.startMs, b.startMs);
        const hi = Math.min(a.endMs, b.endMs);
        if (lo > hi) continue;
        const t = Math.min(hi, Math.max(lo, ms));
        if (best === null || Math.abs(t - ms) < Math.abs(best - ms)) best = t;
      }
    return best;
  }

  /** Recorded spans for an error message. */
  coverage(site: Site): string {
    const sun = this.tracks.get(key('sun', site.lat, site.lon)) ?? [];
    if (sun.length === 0) return 'nothing recorded for this site';
    return sun
      .map((t) => `${new Date(t.startMs).toISOString()} → ${new Date(t.endMs).toISOString()}`)
      .join(', ');
  }
}
