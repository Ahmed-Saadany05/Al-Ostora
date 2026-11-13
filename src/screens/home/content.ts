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

export const PIN_COPY = {
  unavailable: 'No data for this time yet',
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

/** The Moon on Home is NASA's SVS CGI Moon Kit (LRO LROC colour + LOLA relief), loaded from public/moon. */
export const SVS_CREDIT = {
  text: 'Moon imagery: NASA’s Scientific Visualization Studio (LRO LROC + LOLA)',
  sourceIds: ['nasa-svs-moon-kit'],
} as const satisfies { sourceIds: SourceId[] } & Record<string, unknown>;

/** Earth's libration loop is sped up (one month → ~90 s): say so whenever Earth is shown moving. */
export const EARTH_LABEL = {
  moving: 'Time-lapse',
  still: 'Illustration',
} as const;
