/**
 * Data access for screens and scenes. Import hooks from here — never call
 * Horizons or the engine directly from a screen.
 *
 *   const { data: sites } = useSites();
 *   const { data: sky, loading } = useSky(site, time);
 *
 * Which provider is active: env VITE_DATA_PROVIDER = 'demo' (default) | 'live'.
 */
import { useEffect, useState } from 'react';
import type { IsoTime, Params, Site } from '../types';
import type { DataProvider } from './provider';
import { demoProvider } from './demo/demoProvider';

export type { DataProvider } from './provider';
export { windowsFrom, longestGapH, nextTransition } from './windows';

const providers: Partial<Record<DataProvider['id'], DataProvider>> = { demo: demoProvider };

/** The real provider (data pipeline + engine) registers itself here when ready. */
export function registerProvider(provider: DataProvider) {
  providers[provider.id] = provider;
}

export function getProvider(): DataProvider {
  const wanted = (import.meta.env.VITE_DATA_PROVIDER ?? 'demo') as DataProvider['id'];
  return providers[wanted] ?? demoProvider;
}

// ---------------------------------------------------------------- hooks

export interface Query<T> {
  data: T | undefined;
  loading: boolean;
  error: Error | undefined;
}

const cache = new Map<string, Promise<unknown>>();
const MAX_CACHE = 400;

/** Small cached async hook. `key` must uniquely describe the request (null = skip). */
export function useProviderQuery<T>(key: string | null, run: (p: DataProvider) => Promise<T>): Query<T> {
  const [state, setState] = useState<Query<T>>({ data: undefined, loading: key !== null, error: undefined });

  useEffect(() => {
    if (key === null) {
      setState({ data: undefined, loading: false, error: undefined });
      return;
    }
    let alive = true;
    const provider = getProvider();
    const fullKey = `${provider.id}:${key}`;
    if (!cache.has(fullKey)) {
      // Playback creates a new key every tick — keep the cache bounded (oldest out first).
      if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value!);
      // Promise wrapper: a provider that throws synchronously becomes an error state, not a crash.
      cache.set(fullKey, Promise.resolve().then(() => run(provider)));
    }
    setState((s) => ({ ...s, loading: true, error: undefined }));
    (cache.get(fullKey) as Promise<T>).then(
      (data) => alive && setState({ data, loading: false, error: undefined }),
      (error: unknown) => {
        cache.delete(fullKey);
        if (alive) setState({ data: undefined, loading: false, error: error as Error });
      },
    );
    return () => {
      alive = false;
    };
    // `run` is intentionally excluded: the key fully describes the request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return state;
}

const siteKey = (s: Site) => `${s.id}@${s.lat},${s.lon}`;
const paramKey = (p?: Partial<Params>) => (p ? JSON.stringify(p) : '');

export const useSites = () => useProviderQuery('sites', (p) => p.listSites());

export const useHorizon = (site: Site | undefined, params?: Partial<Params>) =>
  useProviderQuery(site ? `horizon:${siteKey(site)}:${paramKey(params)}` : null, (p) =>
    p.getHorizon(site!, params),
  );

export const useSky = (site: Site | undefined, time: IsoTime, params?: Partial<Params>) =>
  useProviderQuery(site ? `sky:${siteKey(site)}:${time}:${paramKey(params)}` : null, (p) =>
    p.getSky(site!, time, params),
  );

export const useDayReport = (site: Site | undefined, start: IsoTime, days?: number, params?: Partial<Params>) =>
  useProviderQuery(site ? `day:${siteKey(site)}:${start}:${days}:${paramKey(params)}` : null, (p) =>
    p.getDayReport(site!, start, days, params),
  );

export const usePlanLaunch = (site: Site | undefined, launchDate: IsoTime | undefined) =>
  useProviderQuery(site && launchDate ? `launch:${siteKey(site)}:${launchDate}` : null, (p) =>
    p.planLaunch(site!, launchDate!),
  );

export const useMetrics =(site: Site | undefined, from: IsoTime, to: IsoTime, params?: Partial<Params>) =>
  useProviderQuery(site ? `metrics:${siteKey(site)}:${from}:${to}:${paramKey(params)}` : null, (p) =>
    p.getMetrics(site!, from, to, params),
  );
