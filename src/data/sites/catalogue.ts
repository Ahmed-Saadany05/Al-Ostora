/**
 * SITE CATALOGUE — owner: Hagras. Real, sourced data (not demo).
 *
 * Coordinates: NASA NSSDC "Lunar landing and impact sites" table, signed N/E-positive,
 * longitude −180…180. Rows with NSSDC footnote "d" (imaged by the LRO Camera) are
 * `measured`; others are `reported`. Hardware within ~1 km of a lander (its rover, a
 * neighbouring older lander) shares one site; landers further apart get their own site.
 * Excluded: spent rocket stages, ascent stages, orbiter/probe impacts (not landing sites).
 *
 * Artemis regions: NASA publishes the nine regions only as maps (Release 24-136). Each entry
 * uses a real landing site from Wueller et al. 2026 (open data, Zenodo 17084058): the published
 * site closest to the middle of that region's sites (rule applied by script, see data README).
 *
 * NOT YET INCLUDED (no verified coordinates):
 *  - Shackleton rim (awaiting the exact edition of the Data Book table A2.1-1).
 *  - Upcoming targets without a published point: IM-3, Blue Ghost 2, Griffin-1, Chang'e 7.
 */
import type { Mission, Site, SiteRegion, SourceRef } from '@/shared/types';
import {
  ARTEMIS_REGIONS_2022,
  ARTEMIS_REGIONS_2024,
  DATA_BOOK,
  LROC,
  MOON_BASE_RELEASE,
  NSSDC,
  WUELLER_2026,
} from './sources';

/** One of NASA's nine Artemis candidate regions (2024), placed at a published landing site. */
const region = (id: string, name: string, siteName: string, lat: number, lon: number, story: string): Site =>
  site({
    id,
    name,
    region: 'south-pole',
    lat,
    lon,
    coordQuality: 'region-site',
    labels: [`Artemis candidate region (NASA, 2024) · landing site ${siteName}`],
    programs: ['artemis'],
    story,
    missions: [],
    refs: [ARTEMIS_REGIONS_2024, WUELLER_2026],
  });

type Draft = Omit<Site, 'source' | 'kind' | 'refs'> & { refs?: SourceRef[] };

function site(d: Draft): Site {
  const outcomes = d.missions.map((m) => m.outcome);
  const kind: Site['kind'] = outcomes.some((o) => o === 'landed' || o === 'partial')
    ? 'landing-site'
    : outcomes.some((o) => o === 'crashed')
      ? 'crash-site'
      : 'candidate';
  const refs = d.refs ?? (d.coordQuality === 'measured' ? [NSSDC, LROC] : [NSSDC]);
  return { ...d, kind, refs, source: 'catalogue' };
}

const US = 'United States';
const USSR = 'Soviet Union';
const CN = 'China';

const apollo = (n: number, date: string, crew: string, note: string): Mission => ({
  name: `Apollo ${n}`,
  agency: 'NASA',
  country: US,
  program: 'apollo',
  date,
  crewed: true,
  hardware: ['lunar module' + (n >= 15 ? ', Lunar Roving Vehicle' : '')],
  outcome: 'landed',
  note: `${crew}. ${note}`,
});

const near = (_lat: number, lon: number, region?: SiteRegion): SiteRegion =>
  region ?? (Math.abs(lon) > 90 ? 'farside' : 'nearside');

export const CATALOGUE: Site[] = [
  // ------------------------------------------------------------------ Apollo
  site({
    id: 'apollo-11',
    name: 'Apollo 11 · Tranquility Base',
    region: near(0.67416, 23.47314),
    lat: 0.67416,
    lon: 23.47314,
    coordQuality: 'measured',
    story: 'Where people first walked on the Moon, on the flat lava plain of the Sea of Tranquility. Near the equator the Sun climbs high and Earth hangs almost overhead.',
    missions: [apollo(11, '1969-07-20', 'Neil Armstrong and Buzz Aldrin', 'First crewed landing.')],
  }),
  site({
    id: 'apollo-12',
    name: 'Apollo 12 · Ocean of Storms',
    region: near(-3.0128, -23.4219),
    lat: -3.0128,
    lon: -23.4219,
    coordQuality: 'measured',
    story: 'A pinpoint landing about 180 m from the robotic Surveyor 3, which had arrived two and a half years earlier. The astronauts walked over and brought pieces of it home.',
    missions: [
      {
        name: 'Surveyor 3',
        agency: 'NASA',
        country: US,
        program: 'nasa-robotic',
        date: '1967-04-20',
        crewed: false,
        hardware: ['lander'],
        outcome: 'landed',
        note: 'Robotic lander that dug into the soil with a scoop.',
      },
      apollo(12, '1969-11-19', 'Pete Conrad and Alan Bean', 'Landed next to Surveyor 3 and retrieved parts of it.'),
    ],
  }),
  site({
    id: 'apollo-14',
    name: 'Apollo 14 · Fra Mauro',
    region: near(-3.64589, -17.47194),
    lat: -3.64589,
    lon: -17.47194,
    coordQuality: 'measured',
    story: 'The hilly Fra Mauro highlands, the original target of Apollo 13. The crew collected rocks thrown out by the giant impact that formed the Imbrium basin.',
    missions: [apollo(14, '1971-02-05', 'Alan Shepard and Edgar Mitchell', 'Explored the Fra Mauro formation.')],
  }),
  site({
    id: 'apollo-15',
    name: 'Apollo 15 · Hadley–Apennine',
    region: near(26.13239, 3.6333),
    lat: 26.13239,
    lon: 3.6333,
    coordQuality: 'measured',
    story: 'Between the Apennine mountains and the winding Hadley Rille. The first mission to drive a Lunar Roving Vehicle.',
    missions: [apollo(15, '1971-07-30', 'David Scott and James Irwin', 'First crew to use a lunar rover.')],
  }),
  site({
    id: 'apollo-16',
    name: 'Apollo 16 · Descartes Highlands',
    region: near(-8.9734, 15.5011),
    lat: -8.9734,
    lon: 15.5011,
    coordQuality: 'measured',
    story: 'The only Apollo landing in the central highlands, the bright, old crust that covers most of the Moon.',
    missions: [apollo(16, '1972-04-21', 'John Young and Charles Duke', 'Sampled the lunar highlands.')],
  }),
  site({
    id: 'apollo-17',
    name: 'Apollo 17 · Taurus–Littrow',
    region: near(20.1911, 30.7723),
    lat: 20.1911,
    lon: 30.7723,
    coordQuality: 'measured',
    story: 'A deep valley at the edge of the Sea of Serenity. The last time people stood on the Moon, including the first scientist, geologist Harrison Schmitt.',
    missions: [apollo(17, '1972-12-11', 'Eugene Cernan and Harrison Schmitt', 'Last crewed landing to date.')],
  }),

  // ------------------------------------------------------------------ NASA robotic (Surveyor)
  site({
    id: 'surveyor-1',
    name: 'Surveyor 1 · Ocean of Storms',
    region: near(-2.4745, -43.3398),
    lat: -2.4745,
    lon: -43.3398,
    coordQuality: 'measured',
    story: "America's first soft landing on the Moon. It proved the surface could hold a spacecraft's weight, paving the way for Apollo.",
    missions: [{ name: 'Surveyor 1', agency: 'NASA', country: US, program: 'nasa-robotic', date: '1966-06-02', crewed: false, hardware: ['lander'], outcome: 'landed' }],
  }),
  site({
    id: 'surveyor-5',
    name: 'Surveyor 5 · Sea of Tranquility',
    region: near(1.4551, 23.1943),
    lat: 1.4551,
    lon: 23.1943,
    coordQuality: 'measured',
    story: 'Measured the chemistry of the lunar soil for the first time, about 25 km from where Apollo 11 would later land.',
    missions: [{ name: 'Surveyor 5', agency: 'NASA', country: US, program: 'nasa-robotic', date: '1967-09-11', crewed: false, hardware: ['lander'], outcome: 'landed' }],
  }),
  site({
    id: 'surveyor-6',
    name: 'Surveyor 6 · Sinus Medii',
    region: near(0.4742, -1.4275),
    lat: 0.4742,
    lon: -1.4275,
    coordQuality: 'measured',
    story: 'Near the centre of the Moon as seen from Earth. It briefly fired its engines and hopped a few metres: the first lift-off from the Moon.',
    missions: [{ name: 'Surveyor 6', agency: 'NASA', country: US, program: 'nasa-robotic', date: '1967-11-10', crewed: false, hardware: ['lander'], outcome: 'landed' }],
  }),
  site({
    id: 'surveyor-7',
    name: 'Surveyor 7 · Tycho',
    region: near(-40.9812, -11.5127),
    lat: -40.9812,
    lon: -11.5127,
    coordQuality: 'measured',
    story: 'On the rugged rim of the young, bright crater Tycho: the only Surveyor sent to the highlands.',
    missions: [{ name: 'Surveyor 7', agency: 'NASA', country: US, program: 'nasa-robotic', date: '1968-01-10', crewed: false, hardware: ['lander'], outcome: 'landed' }],
  }),

  // ------------------------------------------------------------------ Soviet Luna
  site({
    id: 'luna-9',
    name: 'Luna 9 · Ocean of Storms',
    region: near(7.13, -64.37),
    lat: 7.13,
    lon: -64.37,
    coordQuality: 'reported',
    story: 'The first spacecraft to soft-land on the Moon and send pictures from the surface. Its exact spot has never been confirmed from orbit.',
    missions: [{ name: 'Luna 9', agency: 'Soviet space programme', country: USSR, program: 'international', date: '1966-02-03', crewed: false, hardware: ['lander'], outcome: 'landed' }],
  }),
  site({
    id: 'luna-13',
    name: 'Luna 13 · Ocean of Storms',
    region: near(18.87, -62.05),
    lat: 18.87,
    lon: -62.05,
    coordQuality: 'reported',
    story: 'Tested how firm the lunar soil is with a small probe arm, the year after Luna 9.',
    missions: [{ name: 'Luna 13', agency: 'Soviet space programme', country: USSR, program: 'international', date: '1966-12-24', crewed: false, hardware: ['lander'], outcome: 'landed' }],
  }),
  site({
    id: 'luna-15',
    name: 'Luna 15 · Sea of Crises',
    region: near(17, 60),
    lat: 17,
    lon: 60,
    coordQuality: 'reported',
    story: 'A Soviet robot trying to bring back soil crashed here on 21 July 1969, while the Apollo 11 astronauts were still on the Moon.',
    missions: [{ name: 'Luna 15', agency: 'Soviet space programme', country: USSR, program: 'international', date: '1969-07-21', crewed: false, hardware: ['sample-return lander'], outcome: 'crashed', note: 'Crashed during its descent.' }],
  }),
  site({
    id: 'luna-16',
    name: 'Luna 16 · Sea of Fertility',
    region: near(-0.5137, 56.3638),
    lat: -0.5137,
    lon: 56.3638,
    coordQuality: 'measured',
    story: 'The first robot to scoop up lunar soil and fly it back to Earth.',
    missions: [{ name: 'Luna 16', agency: 'Soviet space programme', country: USSR, program: 'international', date: '1970-09-20', crewed: false, hardware: ['sample-return lander'], outcome: 'landed' }],
  }),
  site({
    id: 'luna-17',
    name: 'Luna 17 · Sea of Rains',
    region: near(38.23764, -35.00163),
    lat: 38.23764,
    lon: -35.00163,
    coordQuality: 'measured',
    story: 'Delivered Lunokhod 1, the first remote-controlled rover on another world, driven by a team on Earth for almost a year.',
    missions: [{ name: 'Luna 17', agency: 'Soviet space programme', country: USSR, program: 'international', date: '1970-11-17', crewed: false, hardware: ['lander', 'rover Lunokhod 1'], outcome: 'landed' }],
  }),
  site({
    id: 'luna-20',
    name: 'Luna 20 · Apollonius highlands',
    region: near(3.7863, 56.6242),
    lat: 3.7863,
    lon: 56.6242,
    coordQuality: 'measured',
    story: 'Brought back soil from the rugged highlands next to the Sea of Fertility, a few kilometres from where Luna 18 had crashed.',
    missions: [{ name: 'Luna 20', agency: 'Soviet space programme', country: USSR, program: 'international', date: '1972-02-21', crewed: false, hardware: ['sample-return lander'], outcome: 'landed' }],
  }),
  site({
    id: 'luna-21',
    name: 'Luna 21 · Le Monnier',
    region: near(25.9994, 30.4076),
    lat: 25.9994,
    lon: 30.4076,
    coordQuality: 'measured',
    story: 'Delivered Lunokhod 2, which drove tens of kilometres across this flooded crater at the edge of the Sea of Serenity.',
    missions: [{ name: 'Luna 21', agency: 'Soviet space programme', country: USSR, program: 'international', date: '1973-01-15', crewed: false, hardware: ['lander', 'rover Lunokhod 2'], outcome: 'landed' }],
  }),
  site({
    id: 'luna-23',
    name: 'Luna 23 · Sea of Crises',
    region: near(12.6667, 62.1511),
    lat: 12.6667,
    lon: 62.1511,
    coordQuality: 'measured',
    story: 'Landed but was damaged, so it could not drill for its sample. Luna 24 came back to the same area two years later.',
    missions: [{ name: 'Luna 23', agency: 'Soviet space programme', country: USSR, program: 'international', date: '1974-11-06', crewed: false, hardware: ['sample-return lander'], outcome: 'partial', note: 'Damaged on landing; the drill could not be used.' }],
  }),
  site({
    id: 'luna-24',
    name: 'Luna 24 · Sea of Crises',
    region: near(12.7142, 62.2129),
    lat: 12.7142,
    lon: 62.2129,
    coordQuality: 'measured',
    story: 'The last Soviet Moon landing. It drilled a core of soil and returned it to Earth, completing the job Luna 23 could not.',
    missions: [{ name: 'Luna 24', agency: 'Soviet space programme', country: USSR, program: 'international', date: '1976-08-18', crewed: false, hardware: ['sample-return lander'], outcome: 'landed' }],
  }),

  // ------------------------------------------------------------------ China
  site({
    id: 'change-3',
    name: "Chang'e 3 · Sea of Rains",
    region: near(44.1214, -19.5117),
    lat: 44.1214,
    lon: -19.5117,
    coordQuality: 'measured',
    story: "China's first Moon landing, with the Yutu rover. The first soft landing anywhere on the Moon since 1976.",
    missions: [{ name: "Chang'e 3", agency: 'CNSA', country: CN, program: 'international', date: '2013-12-14', crewed: false, hardware: ['lander', 'rover Yutu'], outcome: 'landed' }],
  }),
  site({
    id: 'change-4',
    name: "Chang'e 4 · Von Kármán crater",
    region: 'farside',
    lat: -45.4561,
    lon: 177.5885,
    coordQuality: 'measured',
    story: 'The first landing on the far side. Earth is never visible from here, so the lander and its Yutu-2 rover talk home through a relay satellite.',
    missions: [{ name: "Chang'e 4", agency: 'CNSA', country: CN, program: 'international', date: '2019-01-03', crewed: false, hardware: ['lander', 'rover Yutu-2'], outcome: 'landed' }],
  }),
  site({
    id: 'change-5',
    name: "Chang'e 5 · Mons Rümker area",
    region: near(43.0576, -51.9161),
    lat: 43.0576,
    lon: -51.9161,
    coordQuality: 'measured',
    story: 'Brought back the first new lunar samples in 44 years, from some of the youngest lava on the Moon.',
    missions: [{ name: "Chang'e 5", agency: 'CNSA', country: CN, program: 'international', date: '2020-12-01', crewed: false, hardware: ['sample-return lander'], outcome: 'landed' }],
  }),
  site({
    id: 'change-6',
    name: "Chang'e 6 · Apollo basin",
    region: 'farside',
    lat: -41.6385,
    lon: -153.9852,
    coordQuality: 'measured',
    story: 'The first samples ever returned from the far side, taken inside the huge South Pole–Aitken basin.',
    missions: [{ name: "Chang'e 6", agency: 'CNSA', country: CN, program: 'international', date: '2024-06-01', crewed: false, hardware: ['sample-return lander'], outcome: 'landed' }],
  }),

  // ------------------------------------------------------------------ India, Japan, Israel, Russia
  site({
    id: 'chandrayaan-2-vikram',
    name: 'Chandrayaan-2 · Vikram crash site',
    region: 'south-pole',
    lat: -70.881,
    lon: 22.784,
    coordQuality: 'measured',
    story: "India's first landing attempt lost control in the final minutes of descent. ISRO came back four years later with Chandrayaan-3.",
    missions: [{ name: 'Chandrayaan-2 (Vikram)', agency: 'ISRO', country: 'India', program: 'international', date: '2019-09-06', crewed: false, hardware: ['lander', 'rover Pragyan'], outcome: 'crashed', note: 'Lost control during the braking phase.' }],
  }),
  site({
    id: 'chandrayaan-3',
    name: 'Chandrayaan-3 · Shiv Shakti Point',
    region: 'south-pole',
    lat: -69.3741,
    lon: 32.32,
    coordQuality: 'measured',
    story: 'India landed the Vikram lander and the Pragyan rover in the southern high latitudes: at the time, the closest any mission had come to the south pole.',
    missions: [{ name: 'Chandrayaan-3', agency: 'ISRO', country: 'India', program: 'international', date: '2023-08-23', crewed: false, hardware: ['lander Vikram', 'rover Pragyan'], outcome: 'landed' }],
  }),
  site({
    id: 'slim',
    name: 'SLIM · near Shioli crater',
    region: near(-13.316, 25.251),
    lat: -13.316,
    lon: 25.251,
    coordQuality: 'measured',
    story: "Japan's first Moon landing proved a pinpoint landing within about 100 m of its target, even though it ended up on its nose after losing an engine.",
    missions: [{ name: 'SLIM', agency: 'JAXA', country: 'Japan', program: 'international', date: '2024-01-19', crewed: false, hardware: ['lander', 'two mini-rovers'], outcome: 'landed', note: 'Precise landing, but came to rest upside down.' }],
  }),
  site({
    id: 'beresheet',
    name: 'Beresheet crash site · Sea of Serenity',
    region: near(32.5956, 19.3496),
    lat: 32.5956,
    lon: 19.3496,
    coordQuality: 'measured',
    story: 'The first privately funded attempt to land on the Moon, by Israel’s SpaceIL. An engine problem during descent ended in a crash.',
    missions: [{ name: 'Beresheet', agency: 'SpaceIL / IAI', country: 'Israel', program: 'international', date: '2019-04-11', crewed: false, hardware: ['lander'], outcome: 'crashed', note: 'Main engine shut down during the final descent.' }],
  }),
  site({
    id: 'luna-25',
    name: 'Luna 25 crash site',
    region: near(-57.865, 61.36),
    lat: -57.865,
    lon: 61.36,
    coordQuality: 'measured',
    story: "Russia's first Moon mission in 47 years crashed before attempting its landing near the south pole.",
    missions: [{ name: 'Luna 25', agency: 'Roscosmos', country: 'Russia', program: 'international', date: '2023-08-19', crewed: false, hardware: ['lander'], outcome: 'crashed', note: 'An orbit-change engine burn ran too long.' }],
  }),

  // ------------------------------------------------------------------ Commercial (non-CLPS)
  site({
    id: 'hakuto-r-m1',
    name: 'Hakuto-R Mission 1 crash site',
    region: near(47.581, 44.094),
    lat: 47.581,
    lon: 44.094,
    coordQuality: 'measured',
    story: 'The first attempt by a private company (ispace, Japan). The lander misjudged its height above the surface and ran out of fuel.',
    missions: [{ name: 'Hakuto-R Mission 1', agency: 'ispace', country: 'Japan', program: 'commercial', date: '2023-04-25', crewed: false, hardware: ['lander'], outcome: 'crashed', note: 'Altitude estimate went wrong near a crater rim.' }],
  }),
  site({
    id: 'hakuto-r-m2',
    name: 'Resilience (Hakuto-R Mission 2) crash site',
    region: near(60.4445, -4.588),
    lat: 60.4445,
    lon: -4.588,
    coordQuality: 'measured',
    story: "ispace's second lander came down in Mare Frigoris in the far north. A landing-sensor problem ended this attempt too.",
    missions: [{ name: 'Resilience (Hakuto-R M2)', agency: 'ispace', country: 'Japan', program: 'commercial', date: '2025-06-05', crewed: false, hardware: ['lander', 'micro-rover'], outcome: 'crashed', note: 'Laser rangefinder problem during descent.' }],
  }),

  // ------------------------------------------------------------------ NASA CLPS
  site({
    id: 'im-1-odysseus',
    name: 'Odysseus (IM-1) · near Malapert A',
    region: 'south-pole',
    lat: -80.13,
    lon: 1.44,
    coordQuality: 'measured',
    story: 'The first US landing since 1972 and the first by a company. Odysseus tipped onto its side but kept sending data.',
    missions: [{ name: 'IM-1 Odysseus', agency: 'Intuitive Machines (NASA CLPS)', country: US, program: 'clps', date: '2024-02-22', crewed: false, hardware: ['lander'], outcome: 'partial', note: 'Landed tilted on its side.' }],
  }),
  site({
    id: 'blue-ghost-1',
    name: 'Blue Ghost Mission 1 · Mare Crisium',
    region: near(18.562, 61.81),
    lat: 18.562,
    lon: 61.81,
    coordQuality: 'measured',
    story: "Firefly's lander touched down upright and worked through a full lunar day: the first fully successful commercial Moon landing.",
    missions: [{ name: 'Blue Ghost Mission 1', agency: 'Firefly Aerospace (NASA CLPS)', country: US, program: 'clps', date: '2025-03-02', crewed: false, hardware: ['lander'], outcome: 'landed' }],
  }),
  site({
    id: 'im-2-athena',
    name: 'Athena (IM-2) · south polar region',
    region: 'south-pole',
    lat: -84.7906,
    lon: 29.1957,
    coordQuality: 'measured',
    story: 'Landed closer to the south pole than any mission before it, but tipped over inside a small crater and its mission ended early.',
    missions: [{ name: 'IM-2 Athena', agency: 'Intuitive Machines (NASA CLPS)', country: US, program: 'clps', date: '2025-03-06', crewed: false, hardware: ['lander', 'hopper Grace', 'rover'], outcome: 'partial', note: 'Came to rest on its side.' }],
  }),

  // ------------------------------------------------------------------ Artemis candidate regions (NASA, Oct 2024)
  // Like all nine, these lie within 6° of the south pole: picked for long sunlight and nearby
  // permanently shadowed craters that may hold water ice. Each region is about 15 × 15 km.
  region('peak-near-cabeus-b', 'Peak near Cabeus B', 'PCB03', -83.563, -68.2009,
    'A tall peak near the crater Cabeus B, on the far western side of the polar region. Its height lifts landers above much of the surrounding shadow.'),
  region('haworth', 'Haworth', 'HW02', -86.8076, -21.7194,
    'High ground beside Haworth crater, whose floor never sees the Sun and may trap ice.'),
  region('malapert-massif', 'Malapert Massif', 'MMA01', -85.9425, -0.9436,
    'A mountain massif facing Earth. High ground keeps the Sun in view over distant ridges, and its slopes look toward home for radio contact.'),
  region('mons-mouton-plateau', 'Mons Mouton Plateau', 'MMP06', -84.5961, 30.4525,
    'NASA calls it the widest and overall flattest of the candidate regions: a high tableland next to Mons Mouton.'),
  region('mons-mouton', 'Mons Mouton', 'MMO01', -85.416, 31.8506,
    'A broad, flat-topped mountain named after NASA mathematician Melba Roy Mouton.'),
  region('nobile-rim-1', 'Nobile Rim 1', 'NR107', -85.1978, 37.1774,
    "On the rim of Nobile crater, a large crater whose shadowed floor is one of the south pole's cold traps."),
  region('nobile-rim-2', 'Nobile Rim 2', 'NR208', -83.9064, 57.8114,
    'A second stretch of the Nobile crater rim, further from the pole.'),
  region('de-gerlache-rim-2', 'de Gerlache Rim 2', 'dGR203', -88.1408, -71.6955,
    'On the rim of de Gerlache crater, very close to the pole, where the Sun skims the horizon all year.'),
  region('slater-plain', 'Slater Plain', 'SP07', -87.1306, 127.857,
    'A comparatively smooth plain near Slater crater: gentle ground for a lander to set down on.'),

  // ------------------------------------------------------------------ Artemis / Moon Base
  site({
    id: 'connecting-ridge',
    name: 'Shackleton Connecting Ridge',
    region: 'south-pole',
    lat: -89.468,
    lon: -137.4,
    coordQuality: 'planned-target',
    labels: ['Moon Base I target (2026) · former Artemis landing candidate (2022)'],
    story: 'A long ridge between Shackleton and de Gerlache craters, almost on the south pole. It stays sunlit for long stretches while nearby crater floors stay frozen in shadow.',
    missions: [
      {
        name: 'Moon Base I',
        agency: 'NASA · Blue Origin (Blue Moon Mark 1 "Endurance")',
        country: US,
        program: 'artemis',
        dateNote: 'NASA: launch no earlier than fall 2026 (Release 26-046). Not launched as of 12 Nov 2026.',
        crewed: false,
        hardware: ['Blue Moon Mark 1 lander'],
        outcome: 'upcoming',
        note: 'Demonstrates capabilities that reduce risk for crewed Artemis landings in 2028.',
      },
    ],
    refs: [DATA_BOOK, MOON_BASE_RELEASE, ARTEMIS_REGIONS_2022],
  }),
];
