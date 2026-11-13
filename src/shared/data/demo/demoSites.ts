import type { Site } from '../../types';

/**
 * DEMO site list — a handful of well-known places so screens have something to show.
 * Coordinates are approximate. The sourced catalogue (src/data/) replaces this.
 */
export const DEMO_SITES: Site[] = [
  {
    id: 'shackleton-rim',
    name: 'Shackleton Crater Rim',
    kind: 'artemis-candidate',
    region: 'south-pole',
    lat: -89.67,
    lon: 129.78,
    story:
      'A 21 km crater almost exactly on the south pole. Its rim catches sunlight most of the year while its floor has not seen the Sun for billions of years.',
    refs: [],
    source: 'demo',
  },
  {
    id: 'malapert-massif',
    name: 'Malapert Massif',
    kind: 'artemis-candidate',
    region: 'south-pole',
    lat: -86.0,
    lon: -2.9,
    story:
      'A 5 km high mountain near the pole. Tall peaks see the Sun over distant ridges and keep Earth in view longer.',
    refs: [],
    source: 'demo',
  },
  {
    id: 'im-1-odysseus',
    name: 'Odysseus (IM-1)',
    kind: 'historic-landing',
    region: 'south-pole',
    lat: -80.13,
    lon: 1.44,
    story:
      'The first commercial lander on the Moon, and the first US landing since 1972. It tipped onto its side but kept talking to Earth.',
    mission: { name: 'IM-1', agency: 'Intuitive Machines', date: '2024-02-22T23:23:00Z', outcome: 'partial' },
    refs: [],
    source: 'demo',
  },
  {
    id: 'chandrayaan-3',
    name: 'Chandrayaan-3 (Shiv Shakti Point)',
    kind: 'historic-landing',
    region: 'south-pole',
    lat: -69.37,
    lon: 32.32,
    story: 'India landed Vikram and the Pragyan rover closer to the south pole than anyone before it.',
    mission: { name: 'Chandrayaan-3', agency: 'ISRO', date: '2023-08-23T12:34:00Z', outcome: 'success' },
    refs: [],
    source: 'demo',
  },
  {
    id: 'apollo-11',
    name: 'Apollo 11 — Tranquility Base',
    kind: 'historic-landing',
    region: 'nearside',
    lat: 0.674,
    lon: 23.473,
    story: 'Where people first walked on the Moon. Near the equator, the Sun climbs high and Earth hangs almost overhead.',
    mission: { name: 'Apollo 11', agency: 'NASA', date: '1969-07-20T20:17:00Z', outcome: 'success' },
    refs: [],
    source: 'demo',
  },
  {
    id: 'change-4',
    name: "Chang'e 4 — Von Kármán Crater",
    kind: 'historic-landing',
    region: 'farside',
    lat: -45.44,
    lon: 177.6,
    story: 'The first landing on the far side. Earth is never visible here, so it talks home through a relay satellite.',
    mission: { name: "Chang'e 4", agency: 'CNSA', date: '2019-01-03T02:26:00Z', outcome: 'success' },
    refs: [],
    source: 'demo',
  },
];
