/**
 * Site catalogue + the helpers the site list uses (search, tags, status).
 * Owner: Hagras. Screens get sites through useSites(); these helpers are pure functions.
 */
import type { Mission, MissionOutcome, Program, Site } from '@/shared/types';
import { CATALOGUE } from './catalogue';

// Fail fast if a coordinate is ever entered in the wrong convention (e.g. 0–360° longitude).
for (const s of CATALOGUE) {
  if (!(s.lat >= -90 && s.lat <= 90 && s.lon >= -180 && s.lon <= 180)) {
    throw new Error(`Site ${s.id}: coordinates out of range (${s.lat}, ${s.lon}) — use N/E-positive, lon −180…180`);
  }
}

export const SITE_CATALOGUE: Site[] = CATALOGUE;

// ---------------------------------------------------------------- tags

export type SiteTag = 'all' | 'south-pole' | 'apollo' | 'artemis' | 'clps' | 'commercial' | 'international' | 'upcoming';

export const SITE_TAGS: { id: SiteTag; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'south-pole', label: 'South pole' },
  { id: 'apollo', label: 'Apollo' },
  { id: 'artemis', label: 'Artemis' },
  { id: 'clps', label: 'CLPS' },
  { id: 'commercial', label: 'Commercial' },
  { id: 'international', label: 'International' },
  { id: 'upcoming', label: 'Upcoming' },
];

const programs = (s: Site): Set<Program> => new Set(s.missions.map((m) => m.program));

export function hasTag(s: Site, tag: SiteTag): boolean {
  switch (tag) {
    case 'all':
      return true;
    case 'south-pole':
      return s.region === 'south-pole';
    case 'upcoming':
      return s.missions.some((m) => m.outcome === 'upcoming');
    case 'apollo':
      return programs(s).has('apollo');
    default:
      return programs(s).has(tag);
  }
}

// ---------------------------------------------------------------- status

export type SiteStatus = 'landed' | 'partial' | 'lost' | 'upcoming' | 'candidate' | 'custom';

/** One headline status per site (best outcome wins; upcoming only if nothing has landed). */
export function siteStatus(s: Site): SiteStatus {
  if (s.kind === 'custom') return 'custom';
  const o = new Set<MissionOutcome>(s.missions.map((m) => m.outcome));
  if (o.has('landed')) return 'landed';
  if (o.has('partial')) return 'partial';
  if (o.has('crashed')) return 'lost';
  if (o.has('upcoming')) return 'upcoming';
  return 'candidate';
}

export const STATUS_META: Record<SiteStatus, { label: string; icon: 'check' | 'alert' | 'close' | 'clock' | 'pin'; tone: 'good' | 'warn' | 'bad' | 'neutral' }> = {
  landed: { label: 'Landed', icon: 'check', tone: 'good' },
  partial: { label: 'Partial', icon: 'alert', tone: 'warn' },
  lost: { label: 'Lost', icon: 'close', tone: 'bad' },
  upcoming: { label: 'Upcoming', icon: 'clock', tone: 'neutral' },
  candidate: { label: 'Candidate', icon: 'pin', tone: 'neutral' },
  custom: { label: 'Your point', icon: 'pin', tone: 'neutral' },
};

/** Short second line for a list row, e.g. "Apollo 12, Surveyor 3 · 2 missions" or "Chang'e 4 · CNSA · 2019". */
export function siteSubtitle(s: Site): string {
  if (s.labels?.length) return s.labels[0];
  if (s.missions.length > 1) return `${s.missions.map((m) => m.name).join(', ')} · ${s.missions.length} missions`;
  const m: Mission | undefined = s.missions[0];
  if (!m) return s.region.replace('-', ' ');
  return [m.agency.split(' (')[0], m.date?.slice(0, 4) ?? m.dateNote].filter(Boolean).join(' · ');
}

// ---------------------------------------------------------------- search

const norm = (t: string) =>
  t
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['’]/g, '');

/** Matches site name, region, missions, agencies, countries, hardware. */
export function matchesQuery(s: Site, query: string): boolean {
  const q = norm(query.trim());
  if (!q) return true;
  const hay = norm(
    [
      s.name,
      s.region.replace('-', ' '),
      ...(s.labels ?? []),
      ...s.missions.flatMap((m) => [m.name, m.agency, m.country, m.program, ...m.hardware]),
    ].join(' '),
  );
  return q.split(/\s+/).every((word) => hay.includes(word));
}

/**
 * Coordinates typed into the search box, e.g. "-89.45, -137.3", "89.45S 137.3W", "-89.45 -137.3".
 * Returns null if the text isn't a coordinate pair.
 */
export function parseCoords(text: string): { lat: number; lon: number } | null {
  const m = /^\s*(-?\d+(?:\.\d+)?)\s*°?\s*([NS])?\s*[,;\s]\s*(-?\d+(?:\.\d+)?)\s*°?\s*([EW])?\s*$/i.exec(text);
  if (!m) return null;
  let lat = Number(m[1]);
  let lon = Number(m[3]);
  if (m[2]?.toUpperCase() === 'S') lat = -Math.abs(lat);
  if (m[4]?.toUpperCase() === 'W') lon = -Math.abs(lon);
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return { lat, lon };
}
