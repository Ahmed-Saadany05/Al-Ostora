/**
 * MISSION FLOW STATE — lives in the URL so reload, back/forward and deep links work
 * (the demo video can jump straight to any step).
 *
 *   /mission                              Step 1  choose site(s)
 *   /mission/stand?site=ID[&at=ISO]       Step 2  stand on one site (optionally at a chosen moment)
 *   /mission/compare?sites=A,B,C&by=sites Step 3  compare 2–4 sites (or one site on several dates)
 *   /mission/date?site=ID                 Step 4  pick launch date
 *   /mission/launch?site=ID&launch=ISO    Step 5  launch → landing
 *
 * Custom coordinates are encoded in the id itself ("custom:-89.450_-137.300") so they
 * survive a reload without any storage.
 */
import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSites } from './data';
import { formatLatLon } from './format';
import { regionOf } from './geo';
import type { IsoTime, Site } from './types';

export const MAX_COMPARE = 4;

export const STEPS = [
  { n: 1, id: 'site', label: 'Choose your site', path: '/mission' },
  { n: 2, id: 'stand', label: 'Stand on site', path: '/mission/stand' },
  { n: 3, id: 'compare', label: 'Compare', path: '/mission/compare' },
  { n: 4, id: 'date', label: 'Pick a launch date', path: '/mission/date' },
  { n: 5, id: 'launch', label: 'Launch', path: '/mission/launch' },
] as const;

export type StepId = (typeof STEPS)[number]['id'];

// ---------------------------------------------------------------- custom sites

// No commas in the id — the `sites=` param is comma-separated.
const CUSTOM = /^custom:(-?\d+(?:\.\d+)?)_(-?\d+(?:\.\d+)?)$/;

export function customSiteId(lat: number, lon: number) {
  return `custom:${lat.toFixed(3)}_${lon.toFixed(3)}`;
}

export function customSite(lat: number, lon: number): Site {
  return {
    id: customSiteId(lat, lon),
    name: 'Custom site',
    kind: 'custom',
    region: regionOf(lat, lon),
    lat,
    lon,
    coordQuality: 'custom',
    story: `Your own point at ${formatLatLon(lat, lon)}.`,
    missions: [],
    refs: [],
    source: 'computed',
  };
}

/** Resolve an id from the URL against the catalogue (or decode a custom one). */
export function resolveSite(id: string, catalogue: Site[] | undefined): Site | undefined {
  const m = CUSTOM.exec(id);
  if (m) {
    const lat = Number(m[1]);
    const lon = Number(m[2]);
    if (Math.abs(lat) <= 90 && Math.abs(lon) <= 180) return customSite(lat, lon);
    return undefined;
  }
  return catalogue?.find((s) => s.id === id);
}

// ---------------------------------------------------------------- URLs

const q = (params: Record<string, string | undefined>) => {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => v && sp.set(k, v));
  const s = sp.toString();
  return s ? `?${s}` : '';
};

/** Build links between steps — use these instead of hand-writing URLs. */
export const missionUrl = {
  chooseSite: (selected: string[] = []) => `/mission${q({ sites: selected.join(',') || undefined })}`,
  stand: (siteId: string, at?: IsoTime) => `/mission/stand${q({ site: siteId, at })}`,
  compare: (siteIds: string[], by: 'sites' | 'dates' = 'sites') => `/mission/compare${q({ sites: siteIds.join(','), by })}`,
  /** One site over several lunar days: where the flow goes after a site is chosen. */
  dates: (siteId: string) => `/mission/compare${q({ sites: siteId, by: 'dates' })}`,
  date: (siteId: string) => `/mission/date${q({ site: siteId })}`,
  launch: (siteId: string, launch: IsoTime) => `/mission/launch${q({ site: siteId, launch })}`,
};

// ---------------------------------------------------------------- hook

/** Read the flow state from the URL and resolve the sites it names. */
export function useMission() {
  const [sp] = useSearchParams();
  const { data: catalogue, loading } = useSites();
  const siteIds = useMemo(() => {
    const raw = sp.get('sites') ?? sp.get('site') ?? '';
    return raw.split(',').filter(Boolean).slice(0, MAX_COMPARE);
  }, [sp]);
  const sites = useMemo(
    () => siteIds.map((id) => resolveSite(id, catalogue)).filter((s): s is Site => Boolean(s)),
    [siteIds, catalogue],
  );
  return {
    loading,
    catalogue,
    siteIds,
    sites,
    /** First (or only) site. */
    site: sites[0] as Site | undefined,
    compareBy: (sp.get('by') === 'dates' ? 'dates' : 'sites') as 'sites' | 'dates',
    /** Ignored unless it parses as a date. */
    launchDate: Number.isFinite(Date.parse(sp.get('launch') ?? '')) ? new Date(sp.get('launch')!).toISOString() : undefined,
  };
}
