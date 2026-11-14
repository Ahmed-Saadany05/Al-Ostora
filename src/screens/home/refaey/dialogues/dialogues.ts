/**
 * Owner: Hady — Refaey's scripted conversations (choice replies, no AI, no grading).
 * Rules: one idea per beat, ≤ 160 characters per beat, ≤ 3 replies, sentence case, no exclamation marks.
 * Tokens like {sunsetIn} come ONLY from engine values (useSky / useMetrics): on the demo provider a line with one is skipped.
 * Tokens like {a11Sun} come from facts/facts.json: JPL Horizons values recorded once (history, not a forecast), shown on every
 * provider with a "JPL Horizons · recorded" label. Every sourced claim is listed in SOURCES.md.
 * `when` = optional condition the UI checks before showing a node.
 */

export type RefaeyMood = 'neutral' | 'smile' | 'pointing';

export type DialogueAction =
  | { type: 'navigate'; to: string }
  | { type: 'openExplainer'; id: string }
  | { type: 'openPlanner'; siteId: string; at?: string } // `at` = ISO UTC moment; only passed on the live provider
  | { type: 'compareAlternative' } // the touchdown card: open the compare step with the suggested alternative
  | { type: 'collapse' };

/** `demoLabel`: what the reply says on the demo provider, where it opens the site without `at` (it must not claim to show the landing day). */
export type Reply = { label: string; next?: string; action?: DialogueAction; demoLabel?: string };

export type DialogueNode = {
  id: string;
  mood?: RefaeyMood;
  lines: string[];
  replies: Reply[];
  when?: 'horizonLola' | 'altBetter' | 'altBetterDate' | 'athenaSunlit' | 'athenaHidden';
};

/* ------------------------------------------------------------------ */
/* 1. The briefing: plays once, after the flight to Step 1.             */
/* ------------------------------------------------------------------ */
export const INTRO: DialogueNode[] = [
  {
    id: 'intro-hello',
    mood: 'smile',
    lines: [
      "Hi, I'm Refaey. Welcome to the Moon's south pole.",
      'Two things keep a lander alive here: sunlight for power, and a clear line to Earth for radio.',
    ],
    replies: [
      { label: 'Go on', next: 'intro-sun' },
      { label: 'Skip', next: 'intro-choice' },
    ],
  },
  {
    id: 'intro-sun',
    mood: 'pointing',
    lines: ['At the pole the Sun never climbs more than about 1.5° above the horizon.', "Hold your little finger out at arm's length: that's about 1°."],
    replies: [{ label: 'And Earth?', next: 'intro-earth' }],
  },
  {
    id: 'intro-earth',
    mood: 'neutral',
    lines: ['Earth hangs just as low, and it shifts a little in the sky over each month.', 'One ridge in the wrong place hides either of them.'],
    replies: [{ label: 'So what do I do?', next: 'intro-choice' }],
  },
  {
    id: 'intro-choice',
    mood: 'smile',
    lines: ['So it all comes down to where you stand, and when.', 'See how three real landings learned that, or plan your own?'],
    replies: [
      { label: 'Three real landings', action: { type: 'navigate', to: '/missions' } },
      { label: 'Plan my own', action: { type: 'navigate', to: '/mission' } },
    ],
  },
];

/* ------------------------------------------------------------------ */
/* 2. Three landings, three lessons.                                    */
/* ------------------------------------------------------------------ */
export type Mission = {
  id: string;
  name: string; // card title
  agency: string;
  /** Shown after the agency on the card. Defaults to the year of `landed`. */
  years?: string;
  landed: string; // ISO UTC touchdown (a fact about the mission; passed as `at` on the live provider)
  lesson: 'power' | 'comms' | 'timing';
  outcome: string; // one short line for the mission card
  siteId: string; // must exist in the site catalogue (checked again when the page opens the planner)
  sources: string[];
  story: DialogueNode[];
};

/** The three replies every story ends with. "See it" passes the touchdown moment on the live provider only. */
const finale = (siteId: string, landed: string): Reply[] => [
  {
    label: 'See the sky at touchdown',
    demoLabel: 'Open this site in the planner',
    action: { type: 'openPlanner', siteId, at: landed },
  },
  { label: 'Another story', next: 'missions-hub' },
  { label: 'Plan my own landing', action: { type: 'navigate', to: '/mission' } },
];

export const MISSIONS_HUB: DialogueNode = {
  id: 'missions-hub',
  mood: 'smile',
  lines: ['Three landings, three lessons. Each one taught us something about timing, Earth in view or power.', 'Pick one.'],
  replies: [
    { label: 'Apollo landings (1969–1972)', next: 'apollo-1' },
    { label: "Chang'e 4 (2019)", next: 'ce4-1' },
    { label: 'Athena (2025)', next: 'athena-1' },
  ],
};

export const MISSIONS: Mission[] = [
  {
    id: 'apollo',
    name: 'Apollo landings',
    agency: 'NASA',
    years: '1969–1972',
    landed: '1969-07-20T20:17:40Z', // Apollo 11, the first of six
    lesson: 'timing',
    outcome: 'Why every crew landed with the Sun low in the sky.',
    siteId: 'apollo-11',
    sources: [
      'https://apollojournals.org/alsj/a11/a11.landing.html',
      'https://www.nasa.gov/wp-content/uploads/static/history/SP-4029/Apollo_11a_Summary.htm',
      'https://ntrs.nasa.gov/api/citations/20230006313/downloads/IAASS%202023%20Paper_Final_24apr23.pdf',
      '/about#methods',
    ],
    story: [
      {
        id: 'apollo-1',
        mood: 'smile',
        lines: ['20 July 1969. Eagle is on its way down, and its computer is steering toward a crater ringed with boulders.'],
        replies: [{ label: 'So what did Armstrong do?', next: 'apollo-2' }],
      },
      {
        id: 'apollo-2',
        mood: 'neutral',
        lines: ['Armstrong took over and flew past them.', 'NASA wanted visible shadows for moments like this: they help a crew recognise craters and rocks.'],
        replies: [{ label: 'Was the light planned?', next: 'apollo-3' }],
      },
      {
        id: 'apollo-3',
        mood: 'pointing',
        lines: ['Yes. The landing time was chosen for the light.', 'At touchdown the Sun stood only {a11Sun} above the horizon.'],
        replies: [{ label: 'What was the rule?', next: 'apollo-4' }],
      },
      {
        id: 'apollo-4',
        mood: 'neutral',
        lines: ['With the Sun too high, shadows wash out and the ground looks flat.', 'So the target window was roughly 5° to 14°.'],
        replies: [{ label: 'Did the numbers hold?', next: 'apollo-5' }],
      },
      {
        id: 'apollo-5',
        mood: 'smile',
        lines: ['JPL Horizons agrees: Apollo 12 landed at {a12Sun}, Apollo 17 at {a17Sun}, Apollo 16 at {a16Sun}.', 'Our engine matches the published angles within 0.1°.'],
        replies: [{ label: 'And at the pole?', next: 'apollo-6' }],
      },
      {
        id: 'apollo-6',
        mood: 'pointing',
        lines: ['Now the twist. At the south-pole sites NASA is studying, the Sun never gets above about 7°, and mostly sits at 1° or 2°.'],
        replies: [
          { label: 'So what changes?', next: 'apollo-7' },
          { label: 'Why is the Sun so low?', action: { type: 'openExplainer', id: 'low-sun' } },
        ],
      },
      {
        id: 'apollo-7',
        mood: 'smile',
        lines: ["So there you can't choose the Sun's height.", 'You choose the hours when it clears the ridge in front of you. Finding those hours is this tool’s job.'],
        replies: finale('apollo-11', '1969-07-20T20:17:40Z'),
      },
    ],
  },
  {
    id: 'change-4',
    name: "Chang'e 4",
    agency: 'CNSA (China)',
    landed: '2019-01-03T02:26:00Z',
    lesson: 'comms',
    outcome: 'First landing on the far side of the Moon.',
    siteId: 'change-4',
    sources: [
      'https://www.guinnessworldrecords.de/world-records/553714-first-landing-on-the-far-side-of-the-moon',
      'https://english.cas.cn/newsroom/news/201901/t20190107_203642.shtml',
      'https://science.nasa.gov/moon/viewing-tips/',
    ],
    story: [
      {
        id: 'ce4-1',
        mood: 'smile',
        lines: ["3 January 2019. Chang'e 4 touches down in Von Kármán crater, on the side of the Moon that never turns toward us."],
        replies: [{ label: 'So where is Earth?', next: 'ce4-2' }],
      },
      {
        id: 'ce4-2',
        mood: 'neutral',
        lines: ['Not in its sky. At touchdown Earth sat {ce4EarthBelow} below the horizon, and in three weeks of Horizons rows it never rose.'],
        replies: [{ label: 'So how did it phone home?', next: 'ce4-3' }],
      },
      {
        id: 'ce4-3',
        mood: 'pointing',
        lines: ['China sent the answer ahead. In May 2018 a relay satellite, Queqiao, flew to a spot beyond the Moon where it sees the far side and Earth at once.'],
        replies: [{ label: 'And the messages?', next: 'ce4-4' }],
      },
      {
        id: 'ce4-4',
        mood: 'neutral',
        lines: ['Every command and every photo took the long way round: lander to Queqiao, Queqiao to Earth.'],
        replies: [{ label: 'And the Sun?', next: 'ce4-5' }],
      },
      {
        id: 'ce4-5',
        mood: 'smile',
        lines: ['It had sunlight to spare. At touchdown the Sun stood {ce4Sun} up, {ce4SinceSunrise} after sunrise, with {ce4DaylightLeft} of daylight still to come.'],
        replies: [
          { label: 'What about the pole?', next: 'ce4-6' },
          { label: "Why can't the far side see Earth?", action: { type: 'openExplainer', id: 'farside' } },
        ],
      },
      {
        id: 'ce4-6',
        mood: 'pointing',
        lines: ['At the pole the puzzle flips. Earth is in your sky, but so low that one ridge can hide it for days.', 'The “Earth up” row on the timeline shows when it is in view.'],
        replies: finale('change-4', '2019-01-03T02:26:00Z'),
      },
    ],
  },
  {
    id: 'im-2-athena',
    name: 'Athena (IM-2)',
    agency: 'Intuitive Machines / NASA',
    landed: '2025-03-06T17:30:00Z', // about 12:30 pm EST (SpacePolicyOnline, Space Flight Now); NASA: about 11:30 a.m. CST
    lesson: 'power',
    outcome: 'Landed in a crater, on its side. Sunlight could not reach its panels.',
    siteId: 'im-2-athena',
    sources: [
      'https://www.nasa.gov/image-article/nasas-lunar-reconnaissance-orbiter-views-im-2-on-moons-surface/',
      'https://science.nasa.gov/lunar-science/clps-deliveries/prime-1-im/',
      'https://www.nasa.gov/news-release/nasa-receives-some-data-before-intuitive-machines-ends-lunar-mission/',
      'https://spacepolicyonline.com/news/im-2-mission-ends-one-day-after-lunar-landing/',
      'https://spaceflightnow.com/2025/03/07/intuitive-machines-lunar-lander-healthy-but-apparently-on-its-side/',
      '/about#methods',
    ],
    story: [
      {
        id: 'athena-1',
        mood: 'neutral',
        lines: ['6 March 2025. Athena comes down on Mons Mouton, closer to the south pole than any lander before it.'],
        replies: [{ label: 'What was it carrying?', next: 'athena-2' }],
      },
      {
        id: 'athena-2',
        mood: 'neutral',
        lines: ['A NASA drill to look for ice and other volatiles, a hopper and small rovers.', 'All of it ran on sunlight.'],
        replies: [{ label: 'How did it land?', next: 'athena-3' }],
      },
      {
        id: 'athena-3',
        mood: 'neutral',
        lines: ['It landed a few hundred metres from its target, in a crater, and ended up on its side.'],
        replies: [{ label: 'What was the Sun doing?', next: 'athena-4' }],
      },
      {
        id: 'athena-4',
        mood: 'pointing',
        lines: ['Look at the Sun that day: {athenaSun} above the horizon.', 'That low, a crater wall is enough to keep you in shade.'],
        replies: [{ label: 'What happened next?', next: 'athena-5' }],
      },
      {
        id: 'athena-5',
        mood: 'neutral',
        lines: ['Sunlight could not reach its solar cells, so the batteries could not recharge.', 'Intuitive Machines ended the mission less than a day after landing.'],
        replies: [
          { label: 'What does our map say?', next: 'athena-6a' },
          { label: 'What does our map say?', next: 'athena-6b' },
        ],
      },
      {
        id: 'athena-6a',
        mood: 'neutral',
        when: 'athenaSunlit',
        lines: ['One honest note: on our terrain map this spot looks sunlit.', 'Near the lander the map resolves only {athenaDemRes} metres, so smaller shadows can hide from it.'],
        replies: [
          { label: 'So what should I take from it?', next: 'athena-7' },
          { label: 'What is the best window?', action: { type: 'openExplainer', id: 'best-window' } },
        ],
      },
      {
        id: 'athena-6b',
        mood: 'neutral',
        when: 'athenaHidden',
        lines: ['Our terrain map agrees: at that hour the skyline toward the Sun stood higher than the Sun itself.'],
        replies: [
          { label: 'So what should I take from it?', next: 'athena-7' },
          { label: 'What is the best window?', action: { type: 'openExplainer', id: 'best-window' } },
        ],
      },
      {
        id: 'athena-7',
        mood: 'smile',
        lines: ['So read any sunlight forecast, ours included, as the best case for the area.', 'The last few metres still decide.'],
        replies: finale('im-2-athena', '2025-03-06T17:30:00Z'),
      },
    ],
  },
];

/* ------------------------------------------------------------------ */
/* 3. Plan moments: <RefaeyMoment id="…"/> placed by Aser per step.    */
/* ------------------------------------------------------------------ */
export const MOMENTS: DialogueNode[] = [
  {
    id: 'moment-compare',
    mood: 'smile',
    lines: ["Same place, different months. Watch the “Both” ring: that's power and Earth in view at the same time."],
    replies: [
      { label: 'What is the best window?', action: { type: 'openExplainer', id: 'best-window' } },
      { label: 'OK', action: { type: 'collapse' } },
    ],
  },
  {
    id: 'moment-stand',
    mood: 'neutral',
    when: 'horizonLola',
    lines: ["This skyline is real, traced from NASA's laser maps.", 'The Sun is {sunElev} up and sets in {sunsetIn}. Earth: {earthStatus}.'],
    replies: [
      { label: 'Why is the Sun so low?', action: { type: 'openExplainer', id: 'low-sun' } },
      { label: 'OK', action: { type: 'collapse' } },
    ],
  },
];

/* ------------------------------------------------------------------ */
/* 4. What would happen to your lander: the touchdown screen (live).    */
/* Tokens: {siteName} {landingDate} {sunHours} {earthHours} {altSite} {altGain} */
/* ------------------------------------------------------------------ */
export const OUTCOME: DialogueNode[] = [
  {
    id: 'outcome-play',
    mood: 'neutral',
    lines: ['Landing at {siteName} on {landingDate}. In its first lunar day the Sun is up for {sunHours} and Earth is in view for {earthHours}.'],
    replies: [
      { label: 'Could I do better?', next: 'outcome-alt' },
      { label: 'Could I do better?', next: 'outcome-alt-date' },
      { label: 'Got it', next: 'outcome-close' },
    ],
  },
  {
    id: 'outcome-alt',
    mood: 'pointing',
    when: 'altBetter',
    lines: ['Try {altSite}: it adds {altGain} of sunlight in that first lunar day, and Earth stays in view at least as long.'],
    replies: [
      { label: 'Compare them', action: { type: 'compareAlternative' } },
      { label: 'Got it', next: 'outcome-close' },
    ],
  },
  {
    id: 'outcome-alt-date',
    mood: 'pointing',
    when: 'altBetterDate',
    lines: ['Landing on {altDate} adds {altGain} of sunlight in that first lunar day, and Earth stays in view at least as long.'],
    replies: [
      { label: 'Compare the dates', action: { type: 'compareAlternative' } },
      { label: 'Got it', next: 'outcome-close' },
    ],
  },
  {
    id: 'outcome-close',
    mood: 'smile',
    lines: ['That is what the data says for this place and day. Change the site or the date to see how it moves.'],
    replies: [
      { label: 'Plan another', action: { type: 'navigate', to: '/mission' } },
      { label: 'Past missions', action: { type: 'navigate', to: '/missions' } },
    ],
  },
];
