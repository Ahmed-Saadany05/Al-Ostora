/**
 * Owner: Hady — all Home copy lives here (no strings in components).
 * `sourceIds` are provisional ids for Goda's /about credits; agree the final ids with Goda.
 */
import type { SourceId } from './sources';

export const FEATURED_SITE_ID = 'shackleton-rim';

export const HOME_COPY = {
  headlineLead: 'Refaey',
  headlineAccent: 'on the Moon',
  line: 'See where the Sun can power you and Earth can hear you.',
  begin: 'Begin the journey',
  about: 'About the data',
  pinLabel: 'Shackleton Crater Rim',
  moonLabel: 'The Moon, south pole at the crest',
} as const;

export const MOTION_COPY = {
  turnOff: 'Turn motion off',
  turnOn: 'Turn motion on',
} as const;

/** "no sunset in the next 29.5 days" — the number comes from LUNAR.synodicDays, passed in. */
export const noEventCopy = (event: string, days: string) => `no ${event} in the next ${days} days`;

/** "Showing 13 Nov 2026, 14:00 UTC (recorded)" — `when` comes from formatUtc, which already ends in "UTC". */
export const recordedCopy = (when: string) => `Showing ${when} (recorded)`;

export const PIN_COPY = {
  unavailable: 'Sun and Earth status is not available right now.',
  countdownsMissing: 'Next change not available for this time.',
  cardTitle: 'Sun and Earth now',
  next: 'Stand on this site',
  sunUp: 'Sun',
  sunUpSuffix: 'up',
  sunDown: 'Sun below the horizon',
  earthUp: 'Earth in view',
  earthDown: 'Earth below the horizon',
  sets: 'sets in',
  rises: 'rises in',
  loading: 'Reading the sky…',
  error: 'Live sky unavailable',
  horizonLola: 'LOLA terrain',
  horizonFlat: 'Flat horizon',
} as const;

/** Shown only while the NASA texture is actually rendering. */
export const IMAGERY_CREDIT = {
  text: 'Moon imagery: NASA Moon Trek / LRO WAC (NASA/GSFC/Arizona State University)',
  sourceIds: ['nasa-moon-trek'],
} as const satisfies { sourceIds: SourceId[] } & Record<string, unknown>;

/** Shown only when sky.source says the positions really are Horizons. */
export const CREDITS = {
  positions: 'Sun and Earth positions: NASA JPL Horizons',
  positionsSourceIds: ['nasa-jpl-horizons'],
} as const satisfies { positionsSourceIds: SourceId[] } & Record<string, unknown>;
