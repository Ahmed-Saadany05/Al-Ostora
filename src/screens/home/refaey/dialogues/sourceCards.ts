/**
 * "How do you know?": the small source card a reply can open inside a conversation. One per number Refaey quotes.
 * Each says in one line what the page says, and links to it. External links open in a new tab; internal ones go to /about#….
 * (Every claim, line and page is also in SOURCES.md.)
 */
import { FACTS } from '../facts/display';

export interface SourceCard {
  title: string;
  says: string;
  href: string;
}

const horizons = (key: string): string => (FACTS as { key: string; horizonsUrl?: string }[]).find((f) => f.key === key)?.horizonsUrl ?? '/about#methods';

export const SOURCE_CARDS: Record<string, SourceCard> = {
  'poles-1-5': {
    title: 'NASA Science: Shadows near the Moon’s South Pole',
    says: 'At the Moon’s North and South Poles, the Sun is never more than 1.5° above or below the horizon. (A little finger at arm’s length is about 1°: NASA Skywatching FAQ.)',
    href: 'https://science.nasa.gov/resource/shadows-near-the-moons-south-pole/',
  },
  'apollo-window': {
    title: 'NASA SP-4029: Apollo 11 summary',
    says: 'The range of Sun elevation angles was from 5° to 14°; Apollo 11 aimed for 10.8°. JPL Horizons gives the Sun’s elevation at touchdown.',
    href: 'https://www.nasa.gov/wp-content/uploads/static/history/SP-4029/Apollo_11a_Summary.htm',
  },
  'apollo-a16': {
    title: 'NASA: Apollo 16 mission details',
    says: 'The Apollo 16 landing was about five hours, 43 minutes late. The Sun angles come from JPL Horizons.',
    href: 'https://www.nasa.gov/missions/apollo/apollo-16-mission-details/',
  },
  'engine-validation': {
    title: 'Our engine’s validation test',
    says: 'JPL Horizons Sun elevations at the Apollo landings agree with the published angles (Scotti & Fjeld) within 0.1°.',
    href: '/about#methods',
  },
  'poles-7': {
    title: 'NASA NTRS 20230006313 (IAASS 2023)',
    says: 'The Sun elevations at the candidate south-pole regions never exceed 7°, and are more often only one or two degrees.',
    href: 'https://ntrs.nasa.gov/api/citations/20230006313/downloads/IAASS%202023%20Paper_Final_24apr23.pdf',
  },
  'ce4-earth': {
    title: 'JPL Horizons: Earth at the Chang’e 4 site',
    says: 'Hourly rows from 25 Dec 2018 to 16 Jan 2019: Earth’s elevation there never rises above the horizon.',
    href: horizons('ce4EarthMaxElevation'),
  },
  'ce4-sun': {
    title: 'JPL Horizons: the Sun at the Chang’e 4 site',
    says: 'Sun elevation at touchdown, and the hourly rows that give the time since sunrise and until sunset.',
    href: horizons('ce4Sun'),
  },
  'athena-sun': {
    title: 'JPL Horizons: the Sun at the Athena site',
    says: 'The Sun’s elevation at about 17:30 UTC on 6 March 2025, when the lander touched down.',
    href: horizons('athenaSun'),
  },
  'athena-res': {
    title: 'Our terrain map (NASA LOLA)',
    says: 'The skyline comes from NASA LOLA elevation maps; within 3 km of the lander the map has a 10 m resolution.',
    href: '/about#methods',
  },
};

export const isInternal = (href: string) => href.startsWith('/');
