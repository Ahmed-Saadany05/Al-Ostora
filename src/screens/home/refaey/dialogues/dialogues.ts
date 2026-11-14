/**
 * Owner: Hady — Refaey's scripted conversations (choice replies, no AI, no grading).
 *
 * The story: Refaey is an astronaut whose launch slipped and whose landing window closed. The user becomes his mission
 * planner. He studies three real landings (Apollo, Chang'e 4, Athena); each teaches him what his own lander, {callsign},
 * must do differently. The planner screens are where the user picks the new site and date; the touchdown screen is his landing.
 * FICTION: Refaey, his lander, his delay and the callsign. REAL AND SOURCED: every mission, date and number (SOURCES.md).
 *
 * Rules: one idea per beat, ≤ 160 characters per beat, ≤ 3 replies, sentence case, no exclamation marks. A beat with a single
 * reply is a `transition` (at most one per path). Branches rejoin within one or two beats.
 * Tokens: {callsign} is story (fills on every provider). {a11Sun} … come from facts/facts.json (JPL Horizons, recorded; fill on every
 * provider, shown with a label). {sunElev} {sunsetIn} {earthStatus} {siteName} … are LIVE engine values: on the demo provider a
 * line with one is skipped.
 */

export type RefaeyMood = 'neutral' | 'smile' | 'pointing';
export type Lesson = 'apollo' | 'change4' | 'athena';

export type DialogueAction =
  | { type: 'navigate'; to: string }
  | { type: 'openExplainer'; id: string }
  | { type: 'showSource'; id: string } // "How do you know?": a small source card inside the conversation, then Back
  | { type: 'openPlanner'; siteId: string; at?: string } // `at` = ISO UTC moment; only passed on the live provider
  | { type: 'compareAlternative' } // the touchdown card: open the compare step with the suggested alternative
  | { type: 'collapse' };

/**
 * `demoLabel`: what the reply says on the demo provider, where it opens the site without `at` (it must not claim to show the landing day).
 * `callsign`: choosing this reply sets the lander's callsign.
 */
export type Reply = { label: string; next?: string; action?: DialogueAction; demoLabel?: string; callsign?: string };

export type DialogueNode = {
  id: string;
  mood?: RefaeyMood;
  lines: string[];
  replies: Reply[];
  when?: 'horizonLola' | 'altBetter' | 'altBetterDate' | 'athenaSunlit' | 'athenaHidden';
  /** A pure "go on" beat (one reply). At most one per path. */
  transition?: true;
  /** Reaching this beat finishes the story: the lesson goes in the notebook. */
  learns?: true;
};

/* ------------------------------------------------------------------ */
/* 1. The briefing: plays once, after the flight to Step 1.             */
/* Every beat but b7 also has a "Skip" (outside the three replies) that jumps to b7 with the default callsign. */
/* ------------------------------------------------------------------ */
export const DEFAULT_CALLSIGN = 'Ostora-1';
export const CALLSIGNS = ['Shams', 'Ostora-1', 'Horus'] as const;

export const INTRO: DialogueNode[] = [
  {
    id: 'b1',
    mood: 'smile',
    lines: ["Oh good, you're here. I'm Refaey. My launch slipped, my landing window closed, and I need a new plan."],
    replies: [
      { label: 'What decides a landing?', next: 'b5' },
      { label: 'Who are you, exactly?', next: 'b1a' },
    ],
  },
  {
    id: 'b1a',
    mood: 'smile',
    lines: ['Astronaut. Part-time optimist. Full-time survivor of Cairo traffic. Today, also a man without a landing date.'],
    replies: [{ label: 'So what decides a landing?', next: 'b5' }],
    transition: true,
  },
  {
    id: 'b5',
    mood: 'pointing',
    lines: [
      'The Sun powers my lander. Earth must be up in the sky so I can talk home.',
      'Both move, and hills hide them. Where and when I land decide everything.',
    ],
    replies: [
      { label: 'Got it.', next: 'b7' },
      { label: 'Why do they sit so low?', action: { type: 'openExplainer', id: 'low-sun' } },
    ],
  },
  {
    id: 'b7',
    mood: 'smile',
    lines: ['Want to see how real missions picked their place and time, or help me plan mine straight away?'],
    replies: [
      { label: 'Explore past missions', action: { type: 'navigate', to: '/missions' } },
      { label: 'Plan a future mission', action: { type: 'navigate', to: '/mission' } },
      { label: "What's real here?", next: 'b7r' },
    ],
  },
  {
    id: 'b7r',
    mood: 'neutral',
    lines: ["Good question. I'm made up. Every landing, date and number I quote is real, with sources on the About page."],
    replies: [
      { label: 'Back', next: 'b7' },
      { label: 'Open the sources', action: { type: 'navigate', to: '/about' } },
    ],
  },
];

/* ------------------------------------------------------------------ */
/* 2. Three landings, three lessons.                                    */
/* ------------------------------------------------------------------ */
export type Mission = {
  id: string;
  lessonKey: Lesson;
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

/** The /missions page copy. */
export const HUB = {
  title: 'Three landings, three lessons',
  subtitle: "Refaey's homework before {callsign} flies. Refaey is fiction; the missions and numbers are real.",
  idle: "I've studied these three a hundred times. Pick one, and I'll tell you what {callsign} does differently.",
  allLearned: 'Three lessons in the notebook. {callsign} is ready for a site. Are you?',
  plan: "Plan {callsign}'s landing",
  learned: 'Lesson learned',
} as const;

/** The three replies every story ends with. "See it" passes the touchdown moment on the live provider only. */
const finale = (siteId: string, landed: string): Reply[] => [
  {
    label: 'See the sky at touchdown',
    demoLabel: 'Open this site in the planner',
    action: { type: 'openPlanner', siteId, at: landed },
  },
  { label: 'Another story', next: 'missions-hub' },
  { label: "Plan {callsign}'s landing", action: { type: 'navigate', to: '/mission' } },
];

export const MISSIONS: Mission[] = [
  {
    id: 'apollo',
    lessonKey: 'apollo',
    name: 'Apollo landings',
    agency: 'NASA',
    years: '1969–1972',
    landed: '1969-07-20T20:17:40Z', // Apollo 11, the first of six
    lesson: 'timing',
    outcome: 'Why every crew landed with the Sun low in the sky.',
    siteId: 'apollo-11',
    sources: [
      'https://www.nasa.gov/wp-content/uploads/static/history/SP-4029/Apollo_11a_Summary.htm',
      'https://www.nasa.gov/missions/apollo/apollo-16-mission-details/',
      'https://www.nasa.gov/history/50-years-ago-apollo-16-on-the-moon-at-descartes/',
      'https://ntrs.nasa.gov/api/citations/20230006313/downloads/IAASS%202023%20Paper_Final_24apr23.pdf',
      '/about#methods',
    ],
    story: [
      {
        id: 'a1',
        mood: 'smile',
        lines: ['20 July 1969. Eagle is coming down over the Sea of Tranquillity. Guess where NASA wanted the Sun at touchdown.'],
        replies: [
          { label: 'High overhead', next: 'a2h' },
          { label: 'Low in the sky', next: 'a2l' },
          { label: 'Below the horizon', next: 'a2d' },
        ],
      },
      {
        id: 'a2h',
        mood: 'smile',
        lines: ['Logical, and wrong. With the Sun too high, shadows wash out and the ground looks flat.'],
        replies: [
          { label: 'So, low?', next: 'a3' },
          { label: 'Why does flat matter?', next: 'a3' },
        ],
      },
      {
        id: 'a2l',
        mood: 'smile',
        lines: ['Exactly. Long shadows help a crew recognise craters and rocks on the way down.'],
        replies: [
          { label: 'How low?', next: 'a3' },
          { label: 'Nice.', next: 'a3' },
        ],
      },
      {
        id: 'a2d',
        mood: 'smile',
        lines: ['Bold. But Eagle needed light, and its crew needed shadows to read the ground.'],
        replies: [
          { label: 'Fine. How low?', next: 'a3' },
          { label: 'Fair point.', next: 'a3' },
        ],
      },
      {
        id: 'a3',
        mood: 'pointing',
        lines: ['Low, but not too low. The target window was roughly 5° to 14°. At touchdown the Sun stood {a11Sun} above the horizon.'],
        replies: [
          { label: 'Did they always hit it?', next: 'a4' },
          { label: 'How do you know?', action: { type: 'showSource', id: 'apollo-window' } },
        ],
      },
      {
        id: 'a4',
        mood: 'smile',
        lines: ['We asked JPL Horizons: Apollo 12 landed at {a12Sun}, Apollo 17 at {a17Sun}.', 'Apollo 16, landing about six hours late, came down at {a16Sun}, right at the edge.'],
        replies: [
          { label: 'And our engine?', next: 'a4b' },
          { label: 'How do you know?', action: { type: 'showSource', id: 'apollo-a16' } },
        ],
      },
      {
        id: 'a4b',
        mood: 'neutral',
        lines: ['Our engine matches the published angles within 0.1°.'],
        replies: [
          { label: 'And at the pole?', next: 'a5' },
          { label: 'How do you know?', action: { type: 'showSource', id: 'engine-validation' } },
        ],
      },
      {
        id: 'a5',
        mood: 'pointing',
        lines: ["That's my problem. At the south-pole sites NASA is studying, the Sun never gets above about 7°, and mostly sits at 1° or 2°."],
        replies: [
          { label: "So you can't pick the angle.", next: 'a6' },
          { label: 'Why not land somewhere easier?', next: 'a5b' },
          { label: 'How do you know?', action: { type: 'showSource', id: 'poles-7' } },
        ],
      },
      {
        id: 'a5b',
        mood: 'smile',
        lines: ["Easier is boring. Also, I've already packed the warm socks."],
        replies: [
          { label: 'Fair.', next: 'a6' },
          { label: 'Why is the Sun so low?', action: { type: 'openExplainer', id: 'low-sun' } },
        ],
      },
      {
        id: 'a6',
        mood: 'smile',
        learns: true,
        lines: ["Apollo picked the Sun's height. {callsign} can't. I have to pick the hours when the Sun clears the ridge in front of me."],
        replies: finale('apollo-11', '1969-07-20T20:17:40Z'),
      },
    ],
  },
  {
    id: 'change-4',
    lessonKey: 'change4',
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
      'https://ntrs.nasa.gov/api/citations/20050232849/downloads/20050232849.pdf',
    ],
    story: [
      {
        id: 'c1',
        mood: 'smile',
        lines: ["3 January 2019. Chang'e 4 lands in Von Kármán crater, on the Moon's far side. Guess how often Earth rises there."],
        replies: [
          { label: 'Once a month', next: 'c2w' },
          { label: 'Never', next: 'c2r' },
          { label: 'Every morning', next: 'c2w' },
        ],
      },
      {
        id: 'c2r',
        mood: 'smile',
        lines: ['Correct, and slightly creepy. At touchdown Earth sat {ce4EarthBelow} below the horizon, and in three weeks of Horizons rows it never rose.'],
        replies: [
          { label: 'So how did it phone home?', next: 'c3' },
          { label: 'How do you know?', action: { type: 'showSource', id: 'ce4-earth' } },
        ],
      },
      {
        id: 'c2w',
        mood: 'smile',
        lines: ['Sadly, never. At touchdown Earth sat {ce4EarthBelow} below the horizon, and in three weeks of Horizons rows it never rose.'],
        replies: [
          { label: 'So how did it phone home?', next: 'c3' },
          { label: 'How do you know?', action: { type: 'showSource', id: 'ce4-earth' } },
        ],
      },
      {
        id: 'c3',
        mood: 'pointing',
        lines: ['China launched a relay first. In May 2018, Queqiao flew to the Earth–Moon L2 point, beyond the Moon, where it sees both sides.'],
        replies: [
          { label: 'Clever.', next: 'c4' },
          { label: "What's L2?", next: 'c3b' },
        ],
      },
      {
        id: 'c3b',
        mood: 'neutral',
        lines: ['A balance point beyond the Moon, seen from Earth. A satellite circling there can see the far side and Earth at once.'],
        replies: [
          { label: 'Got it.', next: 'c4' },
          { label: 'Neat.', next: 'c4' },
        ],
      },
      {
        id: 'c4',
        mood: 'neutral',
        lines: ['Every command and photo took the long way round: lander to Queqiao, Queqiao to Earth.'],
        replies: [
          { label: 'And power?', next: 'c5' },
          { label: 'Slow, but it works.', next: 'c5' },
        ],
      },
      {
        id: 'c5',
        mood: 'smile',
        lines: ['Power was easy. The Sun was {ce4Sun} up, {ce4SinceSunrise} after sunrise, with {ce4DaylightLeft} of daylight still ahead.'],
        replies: [
          { label: 'Lucky them.', next: 'c6' },
          { label: 'Why did that matter?', next: 'c5b' },
          { label: 'How do you know?', action: { type: 'showSource', id: 'ce4-sun' } },
        ],
      },
      {
        id: 'c5b',
        mood: 'neutral',
        lines: ['More daylight ahead means more time to work before the long lunar night.'],
        replies: [
          { label: 'Makes sense.', next: 'c6' },
          { label: 'Fair enough.', next: 'c6' },
        ],
      },
      {
        id: 'c6',
        mood: 'pointing',
        lines: ["{callsign} has no Queqiao. If Earth isn't in my sky, I'm talking to myself. Near the pole Earth skims the horizon, so one ridge can hide it."],
        replies: [
          { label: 'So what will you do?', next: 'c7' },
          { label: "Why can't the far side see Earth?", action: { type: 'openExplainer', id: 'farside' } },
        ],
      },
      {
        id: 'c7',
        mood: 'smile',
        learns: true,
        lines: ["I'll watch the “Earth up” row on the timeline as closely as the Sun. No Earth, no voice."],
        replies: finale('change-4', '2019-01-03T02:26:00Z'),
      },
    ],
  },
  {
    id: 'im-2-athena',
    lessonKey: 'athena',
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
        id: 't1',
        mood: 'neutral',
        lines: ['6 March 2025. Athena lands on Mons Mouton, closer to the south pole than any lander before it.'],
        replies: [
          { label: 'What was it there for?', next: 't2' },
          { label: 'Did it work?', next: 't3' },
        ],
      },
      {
        id: 't2',
        mood: 'neutral',
        lines: ['Ice hunting. It carried a NASA drill to look for ice and other volatiles, a hopper and small rovers.'],
        replies: [
          { label: 'And then?', next: 't3' },
          { label: 'Go on.', next: 't3' },
        ],
      },
      {
        id: 't3',
        mood: 'neutral',
        lines: ['It came down a few hundred metres from its target, in a crater, and ended up on its side.'],
        replies: [
          { label: 'Could it still get sunlight?', next: 't4' },
          { label: 'Ouch.', next: 't4' },
        ],
      },
      {
        id: 't4',
        mood: 'pointing',
        lines: ['Guess how high the Sun stood over Athena at touchdown.'],
        replies: [
          { label: 'About 2°', next: 't5r' },
          { label: 'About 20°', next: 't5' },
          { label: 'About 45°', next: 't5' },
        ],
      },
      {
        id: 't5r',
        mood: 'neutral',
        lines: ["You've been paying attention. {athenaSun}. That low, a crater wall can keep you in shade."],
        replies: [
          { label: 'What happened?', next: 't6' },
          { label: 'How do you know?', action: { type: 'showSource', id: 'athena-sun' } },
        ],
      },
      {
        id: 't5',
        mood: 'neutral',
        lines: ['Lower. Just {athenaSun}. That low, a crater wall can keep you in shade.'],
        replies: [
          { label: 'What happened?', next: 't6' },
          { label: 'How do you know?', action: { type: 'showSource', id: 'athena-sun' } },
        ],
      },
      {
        id: 't6',
        mood: 'neutral',
        lines: ['Sunlight could not reach its solar cells, so the batteries could not recharge. Intuitive Machines ended the mission less than a day after landing.'],
        replies: [
          { label: "That's harsh.", next: 't7a' },
          { label: "That's harsh.", next: 't7b' },
          { label: 'Would your map have seen it?', next: 't7a' },
          { label: 'Would your map have seen it?', next: 't7b' },
        ],
      },
      {
        id: 't7a',
        mood: 'neutral',
        when: 'athenaSunlit',
        lines: ['Honest answer: our terrain map says that spot was sunlit. Near the lander it only resolves {athenaDemRes} metres, so smaller shadows can hide.'],
        replies: [
          { label: 'So what will you do?', next: 't8' },
          { label: 'How do panels catch a low Sun?', action: { type: 'openExplainer', id: 'upright-panels' } },
          { label: 'How do you know?', action: { type: 'showSource', id: 'athena-res' } },
        ],
      },
      {
        id: 't7b',
        mood: 'neutral',
        when: 'athenaHidden',
        lines: ['Honest answer: yes. Our terrain map says that at that hour the skyline toward the Sun stood higher than the Sun itself.'],
        replies: [
          { label: 'So what will you do?', next: 't8' },
          { label: 'How do panels catch a low Sun?', action: { type: 'openExplainer', id: 'upright-panels' } },
          { label: 'How do you know?', action: { type: 'showSource', id: 'athena-res' } },
        ],
      },
      {
        id: 't8',
        mood: 'neutral',
        learns: true,
        lines: ['{callsign} lands on a ridge, not in a crater, and I read every forecast as the best case. The last few metres still decide.'],
        replies: finale('im-2-athena', '2025-03-06T17:30:00Z'),
      },
    ],
  },
];

/* ------------------------------------------------------------------ */
/* 3. Plan moments: <RefaeyMoment id="…"/> placed by Aser per step.    */
/* The first moment someone sees without the briefing gets a short introduction. */
/* ------------------------------------------------------------------ */
export const MOMENTS: DialogueNode[] = [
  {
    id: 'moment-intro',
    mood: 'smile',
    lines: ["I'm Refaey. My launch slipped, and I need a new landing. Help me pick one?"],
    replies: [
      { label: 'Sure', action: { type: 'collapse' } },
      { label: 'Who are you?', next: 'moment-intro-who' },
    ],
  },
  {
    id: 'moment-intro-who',
    mood: 'smile',
    lines: ['Astronaut, part-time optimist, full-time survivor of Cairo traffic. Made up, by the way. The Moon is real.'],
    replies: [
      { label: 'Okay, I will help.', action: { type: 'collapse' } },
      { label: 'Fair enough.', action: { type: 'collapse' } },
    ],
  },
];

/**
 * The stand card (stage placement). Lines are assembled from what is true at that moment:
 *  - always: where he is ("My old window is gone." first when the visitor arrives from Compare dates);
 *  - the LOLA horizon only: the skyline line;
 *  - live provider only: the live line, or one of two variants when the live sky says the Sun or Earth is down.
 */
export const STAND = {
  hatch: "This is the view from {callsign}'s hatch.",
  fromCompare: "My old window is gone. This is the view from {callsign}'s hatch.",
  skyline: "The skyline is traced from NASA's laser maps.",
  live: 'Sun {sunElev} up, sets in {sunsetIn}. Earth: {earthStatus}.',
  dark: "I'd be in the dark here. Try dragging the timeline.",
  noEarth: "Nice light, but I can't call home from here. Watch the Earth row.",
} as const;
export function standNode(o: { fromCompare: boolean; lola: boolean; live: boolean; sunUp: boolean; earthUp: boolean }): DialogueNode {
  const lines: string[] = [o.fromCompare ? STAND.fromCompare : STAND.hatch];
  if (o.lola) lines.push(STAND.skyline);
  if (o.live) lines.push(!o.sunUp ? STAND.dark : !o.earthUp ? STAND.noEarth : STAND.live);
  return {
    id: 'moment-stand',
    mood: 'neutral',
    lines,
    replies: [
      { label: 'Why is the Sun so low?', action: { type: 'openExplainer', id: 'low-sun' } },
      { label: 'Looks good', action: { type: 'collapse' } },
    ],
  };
}

/* ------------------------------------------------------------------ */
/* 4. Touchdown: the ending (the stage card on the touchdown screen).   */
/* Tokens: {siteName} {landingDate} {sunHours} {earthHours} {altSite} {altDate} {altGain} */
/* ------------------------------------------------------------------ */
const END_REPLIES: Reply[] = [
  { label: 'Plan another landing', action: { type: 'navigate', to: '/mission' } },
  { label: 'Back to the missions', action: { type: 'navigate', to: '/missions' } },
  { label: "What's real here?", next: 'end-real' },
];
export const OUTCOME: DialogueNode[] = [
  {
    id: 'outcome-play',
    mood: 'smile',
    lines: ['{callsign} is down at {siteName}, {landingDate}.', 'First daytime: {sunHours} of sunlight, Earth in view for {earthHours}.'],
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
    lines: ['One thing: {altSite} nearby would have given me {altGain} more. Want to look?'],
    replies: [
      { label: 'Show me', action: { type: 'compareAlternative' } },
      { label: "I'm happy here", next: 'outcome-close' },
    ],
  },
  {
    id: 'outcome-alt-date',
    mood: 'pointing',
    when: 'altBetterDate',
    lines: ['One thing: landing on {altDate} would have given me {altGain} more. Want to look?'],
    replies: [
      { label: 'Show me', action: { type: 'compareAlternative' } },
      { label: "I'm happy here", next: 'outcome-close' },
    ],
  },
  {
    id: 'outcome-close',
    mood: 'smile',
    lines: ["That's my landing. Thank you for planning it with me."],
    replies: END_REPLIES,
  },
  {
    id: 'outcome-demo',
    mood: 'neutral',
    lines: ["Those numbers need live NASA data, so I'll keep quiet rather than guess."],
    replies: END_REPLIES,
  },
  {
    id: 'end-real',
    mood: 'neutral',
    lines: ["I'm made up, and so is {callsign}. Every landing, date and number I quote is real, with sources on the About page."],
    replies: [
      { label: 'Back', next: 'outcome-close' },
      { label: 'Open the sources', action: { type: 'navigate', to: '/about' } },
    ],
  },
];
