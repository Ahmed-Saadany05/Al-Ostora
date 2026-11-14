/**
 * Past missions — the stories Refaey tells while you stand on each landing site at its touchdown minute.
 *
 * Every story is about the website's one question: WHERE and WHEN do you land? Each has five short beats
 * (arrive, why here, why now, one guess, the lesson) and the hardware you can click on.
 *
 * Numbers: the Sun and Earth at touchdown come from landingSky.json (recorded from JPL Horizons by
 * scripts/journey/record-landings.mjs, touchdown times and their sources listed there). Lines use them as
 * {sun}, {earth} tokens, never typed in. Each claim below has a `source` so it can be checked.
 *
 * Hardware positions are illustrative, spread out so Refaey can walk between them, (placed around you so it is lit from the side), not surveyed spots.
 */
import landingSky from './landingSky.json';

export type ModelId =
  | 'apollo_lm_descent'
  | 'flag'
  | 'laser_retroreflector'
  | 'lunar_rover'
  | 'seismometer'
  | 'lunokhod1'
  | 'change4_lander'
  | 'yutu2_rover'
  | 'chandrayaan3_lander'
  | 'pragyan_rover'
  | 'athena_lander'
  | 'artemis_lander'
  | 'solar_mast'
  | 'antenna_dish';

export const modelUrl = (m: ModelId) => `/models/${m}.glb`;
export const previewUrl = (m: ModelId) => `/models/previews/${m}.png`;

export interface Hardware {
  id: string;
  model: ModelId;
  label: string;
  fact: string;
  source: string;
  /** Where it stands: bearing measured from the Sun's azimuth (so it is side-lit), and distance in metres. */
  fromSunDeg: number;
  distanceM: number;
  /** Turn the model about its vertical axis, degrees. */
  yawDeg?: number;
  /** Lay it on its side (Athena), degrees about its own forward axis. */
  rollDeg?: number;
}

export interface Question {
  ask: string;
  options: { label: string; correct?: boolean }[];
  right: string;
  wrong: string;
}

export interface PastMission {
  id: keyof typeof landingSky.landings;
  name: string;
  agency: string;
  year: number;
  outcome: 'landed' | 'partial';
  /** The one-line lesson on the hub card. */
  tagline: string;
  cover: ModelId;
  arrive: string;
  whyHere: string;
  whyNow: string;
  /** Refaey points at the Sun, then at Earth: why that moment worked (or what went wrong). Tokens {sun} {earth}. */
  sunLine: string;
  earthLine: string;
  /** The hardware Refaey walks to (2–3 at most); everything else stays clickable. */
  tour: string[];
  question: Question;
  lesson: string;
  hardware: Hardware[];
  sources: string[];
}

export const PAST_MISSIONS: PastMission[] = [
  {
    id: 'apollo-11',
    name: 'Apollo 11',
    agency: 'NASA',
    year: 1969,
    outcome: 'landed',
    tagline: 'Land early in the morning, with long shadows.',
    cover: 'apollo_lm_descent',
    arrive: '20 July 1969. Eagle has just touched down in the Sea of Tranquillity, and you are standing right next to it.',
    whyHere: 'For the first landing NASA wanted the safest ground it could find: a flat, smooth plain near the equator, on the side that always faces Earth.',
    whyNow: 'Turn to the Sun: it is only {sun} up, low in the east. Low light throws long shadows, so the crew could see every boulder on the way down. Earth is {earth} up, so the radio never dropped.',
    sunLine: 'Look at the Sun: only {sun} up, low in the east. NASA aimed for roughly 5° to 14° at touchdown: low enough for long shadows that show every rock, high enough to see by.',
    earthLine: 'Now look up: Earth is {earth} above the horizon. Landing on the near side kept Earth in the sky the whole time, so the radio never dropped.',
    tour: ['flag', 'lm', 'lrrr'],
    question: {
      ask: 'Why land when the Sun is this low?',
      options: [{ label: 'Long shadows show the rocks', correct: true }, { label: 'The ground is cooler at night' }, { label: 'To see the stars' }],
      right: 'Exactly. A high Sun flattens everything: no shadows, no depth, and a boulder looks like flat ground.',
      wrong: 'Not quite. It was about seeing: low light throws long shadows, and shadows show the shape of the ground.',
    },
    lesson: 'Where: flat ground with Earth in the sky. When: early morning, the Sun low behind you. Every landing picks both.',
    hardware: [
      { id: 'lm', model: 'apollo_lm_descent', label: 'Eagle (descent stage)', fact: 'The bottom half of the lunar module. The top half carried the crew back up; this part is still standing here.', source: 'NASA Apollo 11 mission overview', fromSunDeg: 80, distanceM: 26, yawDeg: 20 },
      { id: 'lrrr', model: 'laser_retroreflector', label: 'Laser mirror', fact: 'Still working: observatories on Earth bounce lasers off it to measure the distance to the Moon to a few centimetres.', source: 'NASA: Apollo 11 Laser Ranging Retroreflector', fromSunDeg: 108, distanceM: 16, yawDeg: -30 },
      { id: 'seis', model: 'seismometer', label: 'Seismometer', fact: 'It listened for moonquakes, powered by its two solar panels.', source: 'NASA: Apollo 11 Passive Seismic Experiment', fromSunDeg: 118, distanceM: 32, yawDeg: 40 },
      { id: 'flag', model: 'flag', label: 'Flag', fact: 'A bar along the top holds the flag out, because there is no air on the Moon to make it wave.', source: 'NASA Apollo 11 flag assembly', fromSunDeg: 50, distanceM: 14, yawDeg: 10 },
    ],
    sources: ['https://www.nasa.gov/mission/apollo-11/', 'https://nssdc.gsfc.nasa.gov/planetary/lunar/apollo11info.html'],
  },
  {
    id: 'apollo-15',
    name: 'Apollo 15',
    agency: 'NASA',
    year: 1971,
    outcome: 'landed',
    tagline: 'Go where the science is, then drive.',
    cover: 'lunar_rover',
    arrive: '30 July 1971. Falcon lands at Hadley–Apennine, between tall mountains and a winding valley called Hadley Rille.',
    whyHere: 'Geologists wanted ancient rock from the Apennine mountains and a look into the rille. This time the crew brought a car to reach them.',
    whyNow: 'The Sun is {sun} up, low again. Next to mountains that matters even more: steep slopes are hard to judge without shadows. Earth is {earth} up, high in the sky.',
    sunLine: 'The Sun is {sun} up, inside the same low window as Apollo 11. Between mountains long shadows matter even more: slopes are hard to judge without them.',
    earthLine: 'Earth is {earth} up, high over the near side: an open line home for the whole stay.',
    tour: ['lm', 'lrv'],
    question: {
      ask: 'What did the first car on the Moon add?',
      options: [{ label: 'Long drives to far-off rocks', correct: true }, { label: 'A faster trip home' }, { label: 'Shelter for the night' }],
      right: 'Yes. With the rover the crew could reach rocks kilometres away, not only what was near the lander.',
      wrong: 'Not that one. The rover was about distance: reaching rocks kilometres from the lander.',
    },
    lesson: 'A good site is not only safe, it is where the science is. Planners balance both.',
    hardware: [
      { id: 'lm', model: 'apollo_lm_descent', label: 'Falcon (descent stage)', fact: 'The rover travelled folded up against the side of this stage, and the crew unfolded it after landing.', source: 'NASA Apollo 15 mission overview', fromSunDeg: 80, distanceM: 27, yawDeg: -10 },
      { id: 'lrv', model: 'lunar_rover', label: 'Lunar Roving Vehicle', fact: 'The first car on the Moon. Battery powered, with wire-mesh wheels.', source: 'NASA: Lunar Roving Vehicle', fromSunDeg: 110, distanceM: 16, yawDeg: 60 },
      { id: 'flag', model: 'flag', label: 'Flag', fact: 'Planted near the lunar module, with a bar along the top to hold it out in the airless sky.', source: 'NASA Apollo 15 mission overview', fromSunDeg: 52, distanceM: 15, yawDeg: 0 },
    ],
    sources: ['https://www.nasa.gov/mission/apollo-15/', 'https://nssdc.gsfc.nasa.gov/planetary/lunar/apollo15info.html'],
  },
  {
    id: 'lunokhod-1',
    name: 'Lunokhod 1',
    agency: 'Soviet Union',
    year: 1970,
    outcome: 'landed',
    tagline: 'Drive from Earth: Earth must stay in the sky.',
    cover: 'lunokhod1',
    arrive: '17 November 1970. Luna 17 lands in the Sea of Rains, and Lunokhod 1 rolls off: the first robot rover on another world.',
    whyHere: 'Nobody was aboard, so a team on Earth drove it. That only works on the near side, where Earth is always in the sky.',
    whyNow: 'Earth is {earth} up: a direct line to the drivers. The Sun is {sun} up, and the rover opened its lid of solar cells to charge in daylight.',
    sunLine: 'The Sun is {sun} up. Lunokhod charged its batteries under a lid of solar cells, so it worked by day and slept through each lunar night.',
    earthLine: 'Earth is {earth} up. Drivers on Earth steered it from live pictures, so Earth had to stay in the sky: only the near side works for that.',
    tour: ['rover'],
    question: {
      ask: 'What did Lunokhod do during the two-week lunar night?',
      options: [{ label: 'Closed its lid and waited for sunrise', correct: true }, { label: 'Drove by headlights' }, { label: 'Flew back to Earth' }],
      right: 'Right. It shut down and a small radioactive heater kept it warm until the Sun came back.',
      wrong: 'No. Without sunlight there was no power to drive, so it closed up and waited, kept warm by a small radioactive heater.',
    },
    lesson: 'A rover needs Earth in the sky to be driven, and the Sun to be charged. Both "where" and "when" again.',
    hardware: [
      { id: 'rover', model: 'lunokhod1', label: 'Lunokhod 1', fact: 'Its laser reflector was found again by NASA’s Lunar Reconnaissance Orbiter in 2010, and observatories still use it.', source: 'LROC: Lunokhod 1 revisited (lroc.im-ldi.com/images/402)', fromSunDeg: 80, distanceM: 14, yawDeg: 30 },
    ],
    sources: ['https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=1970-095A', 'https://lroc.im-ldi.com/images/402'],
  },
  {
    id: 'change-4',
    name: "Chang'e 4",
    agency: 'CNSA (China)',
    year: 2019,
    outcome: 'landed',
    tagline: 'On the far side, Earth is never in the sky.',
    cover: 'change4_lander',
    arrive: "3 January 2019. Chang'e 4 makes the first soft landing on the far side of the Moon, in Von Kármán crater.",
    whyHere: 'The far side is older and rougher. Von Kármán lies inside the huge South Pole–Aitken basin, a window into the Moon’s deep past.',
    whyNow: 'Now look for Earth: it is {earth}, below the horizon. From the far side Earth never rises. The Sun is {sun} up: the Sun had risen about 4 days earlier, with about 11 days of sunlight still ahead.',
    sunLine: 'The Sun is {sun} up. It had risen about 4 days earlier, with about 11 days of daylight still ahead: plenty of time to work before the night.',
    earthLine: 'Now find Earth: {earth}, below the horizon. From the far side it never rises, so China first sent the Queqiao relay satellite beyond the Moon to pass every message on.',
    tour: ['lander', 'rover'],
    question: {
      ask: 'So how do you talk to Earth from here?',
      options: [{ label: 'Through a relay satellite', correct: true }, { label: 'With a bigger antenna' }, { label: 'Wait until Earth rises' }],
      right: 'Yes. China launched the Queqiao relay satellite first; it hangs beyond the Moon and passes every message on.',
      wrong: 'That would never work: Earth never rises here and no antenna sees through the Moon. China launched a relay satellite, Queqiao, first.',
    },
    lesson: 'On the far side, "where" takes Earth away. The fix had to be launched before the lander.',
    hardware: [
      { id: 'lander', model: 'change4_lander', label: "Chang'e 4 lander", fact: 'It carried a small sealed garden, where a cotton seed sprouted: the first plant to grow on the Moon.', source: 'CNSA / Chongqing University biosphere experiment', fromSunDeg: 70, distanceM: 24, yawDeg: 15 },
      { id: 'rover', model: 'yutu2_rover', label: 'Yutu-2 rover', fact: 'It kept driving for years, sleeping through each lunar night and waking at sunrise.', source: 'CNSA mission updates', fromSunDeg: 108, distanceM: 15, yawDeg: -40 },
    ],
    sources: ['https://www.cnsa.gov.cn/english/', 'src/screens/home/refaey/facts/facts.json (ce4HoursSinceSunrise 96.1 h, ce4HoursToSunset 259.4 h, JPL Horizons)'],
  },
  {
    id: 'chandrayaan-3',
    name: 'Chandrayaan-3',
    agency: 'ISRO (India)',
    year: 2023,
    outcome: 'landed',
    tagline: 'Land as the day begins, to get the most power.',
    cover: 'chandrayaan3_lander',
    arrive: '23 August 2023. Vikram lands near 69° south, closer to the south pole than anyone before.',
    whyHere: 'Near the pole, craters that never see the Sun may hold water ice. Four years earlier Chandrayaan-2’s lander crashed, so this one got a bigger landing zone, stronger legs and more fuel.',
    whyNow: 'The Sun is only {sun} up: the lunar day here had just begun. Vikram ran on solar power and was not built for the freezing night, so ISRO timed the landing for the start of the day, to use as much of it as possible. Earth is {earth} up.',
    sunLine: 'The Sun is only {sun} up: the lunar day here had just begun. Vikram ran on sunlight and was not built for the night, so landing early bought the most working time.',
    earthLine: 'Earth is {earth} up, above the horizon, so Vikram had a direct line home.',
    tour: ['lander', 'rover'],
    question: {
      ask: 'Why land as the lunar day begins?',
      options: [{ label: 'To get as much of the day’s power as possible', correct: true }, { label: 'Noon would be too dark' }, { label: 'To hide from Earth' }],
      right: 'Exactly. Every hour of daylight already gone is an hour of power lost before the long night.',
      wrong: 'Not that. It was about power: land early in the day and you get the most sunlight before the night.',
    },
    lesson: 'Solar landers stop when the Sun sets. Land early in the day and you buy the longest working time.',
    hardware: [
      { id: 'lander', model: 'chandrayaan3_lander', label: 'Vikram lander', fact: 'It even hopped: it fired its engines, rose about 40 cm and landed again a short way off.', source: 'ISRO, 4 September 2023', fromSunDeg: 70, distanceM: 24, yawDeg: 25 },
      { id: 'rover', model: 'pragyan_rover', label: 'Pragyan rover', fact: 'Its laser instrument confirmed sulfur in the soil near the south pole.', source: 'ISRO, 29 August 2023', fromSunDeg: 108, distanceM: 15, yawDeg: -20 },
    ],
    sources: ['https://www.isro.gov.in/Chandrayaan3_Details.html'],
  },
  {
    id: 'athena',
    name: 'Athena (IM-2)',
    agency: 'Intuitive Machines',
    year: 2025,
    outcome: 'partial',
    tagline: 'At the pole, a crater wall can steal the Sun.',
    cover: 'athena_lander',
    arrive: '6 March 2025. Athena comes down near Mons Mouton, almost 85° south: the farthest south any lander had reached.',
    whyHere: 'High ground near the south pole catches sunlight for long stretches, and ice may be waiting in the dark craters nearby.',
    whyNow: 'Here the Sun only skims the skyline: {sun} up. Athena came down in a small crater and tipped onto its side, and its panels could not catch that low light. The mission ended less than a day after landing.',
    sunLine: 'Here the Sun only skims the skyline: {sun} up. Our terrain map says the spot was sunlit, but the margin over the distant hills was only about 1.6°.',
    earthLine: 'Earth was {earth} up, so the radio link was fine. The light was the problem: in a small crater, tipped on its side, its panels missed that thin margin, and the mission ended less than a day later.',
    tour: ['lander'],
    question: {
      ask: 'At the pole the Sun is always low. What hurts most?',
      options: [{ label: 'Landing in a dip, where the rim hides the Sun', correct: true }, { label: 'Too much sunlight' }, { label: 'Earth being too high' }],
      right: 'Yes. With the Sun a few degrees up, a few metres of crater wall is enough to put you in shadow.',
      wrong: 'The opposite: at the pole sunlight is scarce. With the Sun this low, even a small crater wall puts you in shadow.',
    },
    lesson: 'At the pole, a few metres of height can decide whether you get sunlight. That is exactly what you will plan next.',
    hardware: [
      { id: 'lander', model: 'athena_lander', label: 'Athena, on its side', fact: 'Landed tipped over in a crater. With the Sun this low, its panels stayed mostly in the dark.', source: 'Intuitive Machines IM-2 mission updates, March 2025', fromSunDeg: 80, distanceM: 18, yawDeg: 0, rollDeg: 90 },
    ],
    sources: ['https://www.intuitivemachines.com/im-2', 'src/screens/home/refaey/SOURCES.md'],
  },
];

export type LandingSky = (typeof landingSky.landings)[keyof typeof landingSky.landings];
export const landingOf = (m: PastMission): LandingSky => landingSky.landings[m.id];
export const missionById = (id: string | undefined) => PAST_MISSIONS.find((m) => m.id === id);
export const LANDING_SKY_SOURCE = landingSky.source;
