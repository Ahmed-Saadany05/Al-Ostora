/**
 * Owner: Hady — plain-language explainers shown inside the mission steps via <Explain id="…"/>.
 * Aser places the tags; Hady writes and edits the text here. Keep each to 2–3 short sentences.
 * Existing ids are kept so Aser's tags keep working.
 * `sources` lists where each fact comes from (for Goda's /about page); `notes` holds extra detail
 * that is true but too long for the explainer itself.
 */
export const EXPLAINERS = {
  'low-sun': {
    title: 'Why is the Sun so low?',
    body: "The Moon's axis is tilted only about 1.5°, so near the south pole the Sun never climbs much higher than that. It circles the horizon instead of rising overhead, and a nearby ridge can hide it completely.",
    sources: ['/about#methods'],
    notes: 'The 1.5° figure comes from our own JPL Horizons data (1.54°). NASA SVS "The Moon\'s South Pole" says 1.6°; do not cite that page next to 1.5°.',
  },
  libration: {
    title: 'Why does Earth rise and set at the pole?',
    body: 'Earth stays in almost the same spot in the sky, but the Moon seems to rock slightly as it orbits (libration), by up to about 7°. Near the pole Earth sits right at the horizon, so that small rocking lifts it into view and drops it out again.',
    sources: ['https://svs.gsfc.nasa.gov/10836/'],
    notes: 'Libration amplitudes: about 6.7° in latitude, 7.9° in longitude. Latitude libration is what moves Earth up and down at the pole.',
  },
  farside: {
    title: 'Why can’t the far side see Earth?',
    body: "The Moon keeps nearly the same face toward Earth, so about 41% of its surface never sees Earth at all. Landers on most of the far side need a relay satellite to call home, like China's Queqiao for the Chang'e 4 lander.",
    sources: [
      'https://science.nasa.gov/moon/viewing-tips/',
      'https://english.cas.cn/newsroom/news/201901/t20190107_203642.shtml',
      'https://www.space.com/40646-china-queqiao-moon-relay-satellite-launch.html',
    ],
    notes: 'Over time about 59% of the surface is visible from Earth; the extra 9% lies near the edge and is seen at a steep slant. Queqiao launched 20 May 2018 to a halo orbit around Earth–Moon L2; its successor Queqiao-2 has been in orbit since March 2024.',
  },
  'best-window': {
    title: 'What is the best window?',
    body: 'The longest stretch, within the dates you picked, when the Sun reaches the solar panels and Earth is in view at the same time. It is the best time for power and communication, though a safe landing also depends on the terrain.',
    sources: ['/about#methods'],
    notes: 'Engine definition (Goda): longest continuous stretch where any part of the Sun’s disk and any part of Earth’s disk are both above the real terrain. Windows that run past the selected range are marked as cut off; edges are accurate to about an hour (hourly steps).',
  },
  'shadowed-craters': {
    title: 'Why do some craters stay dark forever?',
    body: "With the Sun always so low, the rims of some polar craters block it all year round. NASA's LRO spacecraft measured about −240 °C in these shadowed craters, cold enough to trap water ice for up to billions of years.",
    sources: [
      'https://www3.nasa.gov/home/hqnews/2009/sep/HQ_09-215_LRO_First_Light.html',
      'https://science.nasa.gov/solar-system/moon/10-cool-things-nasas-lunar-reconnaissance-orbiter-is-teaching-us-about-the-moon/',
    ],
    notes: 'Measured by LRO’s Diviner instrument (about 33 K at the south pole). The coldest spot found, about −248 °C, is in Hermite Crater near the north pole.',
  },
  'earth-still': {
    title: 'Why does Earth barely move?',
    body: 'The Moon turns once for every trip around Earth, so from the Moon, Earth hangs in nearly the same place in the sky. It does not cross the sky like the Sun, but it does show phases: the opposite of the Moon phase we see from Earth.',
    sources: ['https://science.nasa.gov/moon/tidal-locking/', '/about#methods'],
  },
  'power-vs-comms': {
    title: 'Why can a site have power but no radio?',
    body: 'Power needs the Sun above the horizon; radio needs Earth above it. At the pole the Sun circles the whole horizon over a month, but Earth stays in roughly one direction, so a single ridge on the Earth side can block radio for days while sunlight is fine.',
    sources: ['/about#methods'],
  },
  'lunar-day': {
    title: 'Why is a lunar day so long?',
    body: 'The Moon turns only once a month, so one lunar day lasts about 29.5 Earth days: roughly two weeks of sunlight, then two weeks of night at most places. Near the poles it is messier: some peaks are lit for most of the year while some crater floors never are.',
    sources: [
      'https://science.nasa.gov/moon/tidal-locking/',
      'https://spacepolicyonline.com/news/india-says-good-night-to-chandrayaan-3/',
      'https://www.deccanherald.com/science/space/no-signal-yet-from-vikram-pragyan-isro-2697635',
    ],
    notes: 'Example (moved here from the old /missions story): India\'s Chandrayaan-3 landed on 23 Aug 2023 at 69.37°S, 32.35°E, in the south polar region but about 600 km from the pole (say "near the south pole region", never "at the south pole"). It was built to work through one lunar daytime (about two weeks of sunlight), and after sunset it did not answer again.',
  },
  'upright-panels': {
    title: 'Why do polar solar panels stand upright?',
    body: 'With the Sun skimming the horizon, its light hits a flat panel almost edge-on and delivers only a few percent of its power. Standing the panel upright faces the Sun head-on, so polar landers mount panels vertically and turn them as the Sun circles the horizon.',
    sources: ['/about#methods'],
  },
  'flat-horizon': {
    title: 'What does “flat horizon” mean?',
    body: 'Where we have no detailed terrain data, we treat the ground as perfectly flat, so real hills and crater rims are not included. Near the poles that can be badly wrong, because the Sun and Earth sit so close to the horizon that a small ridge decides everything.',
    sources: ['/about#methods'],
  },
} as const;

export type ExplainerId = keyof typeof EXPLAINERS;
