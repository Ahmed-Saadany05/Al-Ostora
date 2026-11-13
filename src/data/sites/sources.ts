/** Citations used by the site catalogue (owner: Hagras). Every site lists the ones it relies on. */
import type { SourceRef } from '@/shared/types';

export const NSSDC: SourceRef = {
  label: 'NASA NSSDC — Lunar landing and impact sites (coordinates, dates)',
  url: 'https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_artifact_impacts.html',
};

/** NSSDC footnote "d": object imaged on the surface by the LRO Camera. */
export const LROC: SourceRef = {
  label: 'LROC — Anthropogenic features on the Moon (Wagner et al. 2017, Icarus 283; dataset updated 2025)',
  url: 'https://data.lroc.im-ldi.com/lroc/view_rdr/SHAPEFILE_ANTHROPOGENIC_OBJECTS',
};

export const DATA_BOOK: SourceRef = {
  label: 'NASA Lunar Surface Data Book, ACD-50044 (Oct 2022), §7.3.3 — landing point CR1',
  url: 'https://ntrs.nasa.gov/api/citations/20220015275/downloads/ACD-50044%20Lunar%20Surface%20Data%20Book_100622.pdf',
};

export const MOON_BASE_RELEASE: SourceRef = {
  label: 'NASA Release 26-046 (26 May 2026) — Moon Base I will land on the Shackleton Connecting Ridge',
  url: 'https://www.nasa.gov/news-release/nasa-provides-update-on-moon-base-rovers-landers-missions/',
};

export const ARTEMIS_REGIONS_2022: SourceRef = {
  label: 'NASA SVS — Artemis III landing region candidates (2022, 13 regions)',
  url: 'https://svs.gsfc.nasa.gov/5013',
};
