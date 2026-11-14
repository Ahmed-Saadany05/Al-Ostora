/**
 * The recorded JPL Horizons facts (facts.json, written by record.mjs) as display strings. Pure functions, no React.
 * These are history, not forecasts, so they fill Refaey's lines on every data provider; the stories show a small
 * "JPL Horizons · recorded <date>" label next to them.
 */
import { formatDeg, formatUtc } from '@/shared/format';
import raw from './facts.json';

export interface RecordedFact {
  key: string;
  value: number | string;
  unit: string;
  time: string;
  siteId: string;
  lat: number;
  lon: number;
  horizonsUrl?: string;
}

export const FACTS = raw.facts as RecordedFact[];
export const RETRIEVED: string = raw.retrieved;

const num = (key: string): number => {
  const f = FACTS.find((x) => x.key === key);
  if (!f || typeof f.value !== 'number') throw new Error(`recorded fact missing: ${key}`);
  return f.value;
};
const text = (key: string): string => String(FACTS.find((x) => x.key === key)?.value ?? '');

/** 96.1 → "4 days"; 259.4 → "10 days 19 hours"; 5 → "5 hours". */
export function daysAndHours(hours: number): string {
  let d = Math.floor(hours / 24);
  let h = Math.round(hours - d * 24);
  if (h === 24) {
    d += 1;
    h = 0;
  }
  const part = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;
  if (d === 0) return part(h, 'hour');
  return h === 0 ? part(d, 'day') : `${part(d, 'day')} ${part(h, 'hour')}`;
}

const deg1 = (v: number) => formatDeg(v, 1, false);

/** Every token the stories read from the recordings. */
export function recordedTokens(): Record<string, string> {
  return {
    a11Sun: deg1(num('a11Sun')),
    a12Sun: deg1(num('a12Sun')),
    a16Sun: deg1(num('a16Sun')),
    a17Sun: deg1(num('a17Sun')),
    ce4Sun: deg1(num('ce4Sun')),
    ce4EarthBelow: deg1(Math.abs(num('ce4Earth'))),
    ce4SinceSunrise: daysAndHours(num('ce4HoursSinceSunrise')),
    ce4DaylightLeft: daysAndHours(num('ce4HoursToSunset')),
    athenaSun: deg1(num('athenaSun')),
    athenaDemRes: String(num('athenaDemResM')),
  };
}

/** What the engine's own LOLA terrain says about the Sun at Athena's touchdown: the beat to show. */
export function athenaVerdict(): 'sunlit' | 'hidden' {
  return text('athenaVerdict') === 'hidden' ? 'hidden' : 'sunlit';
}

/** "JPL Horizons · recorded 14 Nov 2026" */
export function recordedLabel(): string {
  return `JPL Horizons · recorded ${formatUtc(`${RETRIEVED}T00:00:00Z`, false)}`;
}
