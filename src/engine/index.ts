/**
 * Engine entry point. Importing this module registers the live provider:
 *
 *   import '@/engine';            // once, e.g. in main.tsx
 *   VITE_DATA_PROVIDER=live npm run dev
 */
import { fetchHorizons } from '@/data/horizons/client';
import type { HorizonsResponse } from '@/data/horizons/types';
import { SITE_CATALOGUE } from '@/data/sites';
import { registerProvider } from '@/shared/data';
import type { HorizonProfile } from '@/shared/types';
import { createLiveProvider, recordedFrom } from './provider';

const lolaFiles = import.meta.glob<HorizonProfile>('/src/data/horizons-lola/*.json', { import: 'default' });
const fixtureFiles = import.meta.glob<HorizonsResponse>('/src/data/horizons/fixtures/*.json', { import: 'default' });

export const liveProvider = createLiveProvider({
  fetcher: (q) => fetchHorizons(q),
  loadProfile: async (siteId) => {
    const load = lolaFiles[`/src/data/horizons-lola/${siteId}.json`];
    return load ? load() : null;
  },
  loadRecorded: recordedFrom(fixtureFiles),
  listSites: async () => SITE_CATALOGUE,
});

registerProvider(liveProvider);

export { createLiveProvider } from './provider';
export { gradeSite, LESSONS } from './grading';
export { TRANSIT_PRESETS, DEFAULT_TRANSIT_ID, ENGINE_DEFAULTS } from './constants';
export type * from './types';
