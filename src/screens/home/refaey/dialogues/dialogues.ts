/**
 * Owner: Hady — Refaey's scripted conversations (choice buttons, no AI).
 * Rules: max 2 lines per bubble, max 3 replies per node, witty but accurate.
 * Tokens like {sunsetIn} are filled ONLY from engine values (useSky / useMetrics / outcome metrics).
 * If any token in a line has no value, that line is skipped (never guessed).
 * `when` = optional condition the UI checks before showing a node or line.
 * Mission facts: see `sources` on each mission; send them to Goda for /about.
 */

export type RefaeyMood = 'neutral' | 'smile' | 'pointing';

export type DialogueAction =
  | { type: 'navigate'; to: string }
  | { type: 'openExplainer'; id: string }
  | { type: 'openPlanner'; siteId: string } // opens the site as it is today (no time is set; we have no recording of the landing day)
  | { type: 'collapse' };

/** `note`: one small secondary line shown just before this reply (e.g. what "See it yourself" really opens). */
export type Reply = { label: string; next?: string; action?: DialogueAction; note?: string };

export type DialogueNode = {
  id: string;
  mood?: RefaeyMood;
  lines: string[];
  replies: Reply[];
  when?: 'horizonLola' | 'altBetter' | 'altNone' | 'athenaSunlit' | 'athenaHidden';
};

/* ------------------------------------------------------------------ */
/* 1. Intro: plays after "Begin the journey" and the descent.          */
/* ------------------------------------------------------------------ */
export const INTRO: DialogueNode[] = [
  {
    id: 'intro-hello',
    mood: 'smile',
    lines: [
      "Hi, I'm Refaey. Welcome to the Moon's south pole.",
      'Down here the Sun never climbs higher than your thumb, and Earth plays hide-and-seek.',
    ],
    replies: [
      { label: 'Wait, my thumb?', next: 'intro-thumb' },
      { label: 'Where do we start?', next: 'intro-choice' },
    ],
  },
  {
    id: 'intro-thumb',
    mood: 'pointing',
    lines: [
      "Hold your thumb out at arm's length. That's about 2° of sky.",
      'Here the Sun stays within about 1.5° of the horizon. Long shadows, every single day.',
    ],
    replies: [{ label: 'Got it. Where do we start?', next: 'intro-choice' }],
  },
  {
    id: 'intro-choice',
    mood: 'neutral',
    lines: [
      'Two ways to learn this place.',
      'See what happened to real landers, or plan a mission of your own.',
    ],
    replies: [
      { label: 'Explore past missions', action: { type: 'navigate', to: '/missions' } },
      { label: 'Plan a future mission', action: { type: 'navigate', to: '/mission' } },
    ],
  },
];

/* ------------------------------------------------------------------ */
/* 2. Past missions: three landings, three lessons.                     */
/* ------------------------------------------------------------------ */
export type Mission = {
  id: string;
  name: string; // card title
  agency: string;
  /** Shown after the agency on the card. Defaults to the year of `landed`. */
  years?: string;
  landed: string; // ISO UTC (a fact about the mission; not used to set the clock: we have no recording of that day)
  lesson: 'power' | 'comms' | 'timing';
  outcome: string; // one short line for the mission card
  siteId: string; // must exist in Hagras's site catalogue (checked again when the page opens the planner)
  sources: string[];
  story: DialogueNode[];
};

/** Shown just before "See it yourself": it opens the site today, never the historical day. */
export const SEE_IT_NOTE = 'This opens the site as it is today, not the original landing day.';

/** The three replies every story ends with. */
const finale = (siteId: string): Reply[] => [
  { label: 'See it yourself', action: { type: 'openPlanner', siteId }, note: SEE_IT_NOTE },
  { label: 'Tell me another story', next: 'missions-hub' },
  { label: 'Plan my own landing', action: { type: 'navigate', to: '/mission' } },
];

export const MISSIONS_HUB: DialogueNode = {
  id: 'missions-hub',
  mood: 'smile',
  lines: ['Three landings, three lessons. Each one taught us something about power, radio or timing.', 'Pick one.'],
  replies: [
    { label: 'Athena (2025)', next: 'athena-1' },
    { label: "Chang'e 4 (2019)", next: 'ce4-1' },
    { label: 'Apollo landings (1969–1972)', next: 'apollo-1' },
  ],
};

export const MISSIONS: Mission[] = [
  {
    id: 'im-2-athena',
    name: 'Athena (IM-2)',
    agency: 'Intuitive Machines / NASA',
    landed: '2025-03-06T17:30:00Z', // TODO(Hagras): confirm exact touchdown time from NASA/IM source
    lesson: 'power',
    outcome: 'Landed in a shaded crater, on its side. Could not recharge.',
    siteId: 'im-2-athena',
    sources: [
      'https://www.cbsnews.com/news/athena-moon-lander-tips-over-intuitive-machines-mission',
      'https://www.space.com/the-universe/moon/private-intuitive-machines-moon-lander-fell-over-inside-crater-at-lunar-south-pole-photo-reveals',
    ],
    story: [
      {
        id: 'athena-1',
        mood: 'neutral',
        lines: [
          'March 2025. A lander called Athena heads for a plateau near the south pole.',
          'Its job: drill for ice. Its power: solar panels.',
        ],
        replies: [{ label: 'What went wrong?', next: 'athena-2' }],
      },
      {
        id: 'athena-2',
        mood: 'neutral',
        lines: [
          'It came down a few hundred metres off target, inside a crater,',
          'and tipped over onto its side.',
        ],
        replies: [{ label: 'Why do a few hundred metres matter?', next: 'athena-3' }],
      },
      {
        id: 'athena-3',
        mood: 'pointing',
        lines: [
          'With the Sun this low, a crater wall can hide it for days.',
          "Lying in the cold shade, with its panels pointing the wrong way, Athena couldn't recharge.",
        ],
        replies: finale('im-2-athena'),
      },
    ],
  },
  {
    id: 'change-4',
    name: "Chang'e 4",
    agency: 'CNSA (China)',
    landed: '2019-01-03T02:26:00Z',
    lesson: 'comms',
    outcome: 'First landing on the far side, where Earth is never in the sky.',
    siteId: 'change-4',
    sources: [
      'https://www.guinnessworldrecords.de/world-records/553714-first-landing-on-the-far-side-of-the-moon',
      'https://english.cas.cn/newsroom/news/201901/t20190107_203642.shtml',
      'https://www.space.com/40646-china-queqiao-moon-relay-satellite-launch.html',
    ],
    story: [
      {
        id: 'ce4-1',
        mood: 'smile',
        lines: [
          "January 2019. China's Chang'e 4 becomes the first spacecraft to land on the Moon's far side.",
          'Small problem: from there, Earth is never in the sky.',
        ],
        replies: [{ label: 'So how did it phone home?', next: 'ce4-2' }],
      },
      {
        id: 'ce4-2',
        mood: 'pointing',
        lines: [
          'Months earlier, China parked a relay satellite called Queqiao beyond the Moon.',
          'It can see both the lander and Earth, and passes every message along.',
        ],
        replies: [{ label: 'Clever. Anything else?', next: 'ce4-3' }],
      },
      {
        id: 'ce4-3',
        mood: 'neutral',
        lines: [
          'It also landed just after sunrise there,',
          'so it had a full lunar day of sunlight ahead of it. Timing is half the plan.',
        ],
        replies: finale('change-4'),
      },
    ],
  },
  {
    id: 'apollo',
    name: 'Apollo landings',
    agency: 'NASA',
    years: '1969–1972',
    landed: '1969-07-20T20:17:40Z', // Apollo 11 (the first of six)
    lesson: 'timing',
    outcome: 'Why every crew landed just after sunrise.',
    siteId: 'apollo-11',
    sources: [
      'https://www.amnh.org/explore/videos/space/apollo-mission-landings-and-lunar-phases',
      'https://ntrs.nasa.gov/api/citations/20230006313/downloads/IAASS%202023%20Paper_Final_24apr23.pdf',
      'https://ntrs.nasa.gov/api/citations/20230006101/downloads/PowerPoint%20Presentation.pdf',
    ],
    story: [
      {
        id: 'apollo-1',
        mood: 'smile',
        lines: ['Quick quiz: best time to land on the Moon? Noon sounds right.', 'Apollo said: absolutely not.'],
        replies: [
          { label: 'Why not noon?', next: 'apollo-2' },
          { label: 'Skip to the lesson', next: 'apollo-5' },
        ],
      },
      {
        id: 'apollo-2',
        mood: 'neutral',
        lines: ['At noon there are almost no shadows.', "Rocks and craters melt into one bright grey, and a pilot can't tell a boulder from a bump."],
        replies: [{ label: 'So when, then?', next: 'apollo-3' }],
      },
      {
        id: 'apollo-3',
        mood: 'pointing',
        lines: ['So Apollo landed with the Sun just 5 to 14 degrees above the horizon, soon after local sunrise.', 'Long shadows, readable ground.'],
        replies: [{ label: 'Was that easy to hit?', next: 'apollo-4' }],
      },
      {
        id: 'apollo-4',
        mood: 'neutral',
        lines: ['That window lasted less than a day.', 'Miss it, and the site was out of reach for about a month. Launch dates were built around it.'],
        replies: [
          { label: 'Any Sun trouble anyway?', next: 'apollo-4b' },
          { label: 'Continue', next: 'apollo-5' },
        ],
      },
      {
        id: 'apollo-4b',
        mood: 'smile',
        lines: ['Oh yes. On Apollo 12 the colour TV camera got pointed at the Sun and was knocked out.', 'The Sun wins arguments.'],
        replies: [{ label: 'Continue', next: 'apollo-5' }],
      },
      {
        id: 'apollo-5',
        mood: 'pointing',
        lines: ["Here's the twist: at the south-pole sites NASA is studying,", 'the Sun never climbs past about 7°, and often sits at 1 or 2.'],
        replies: [{ label: 'So what does that mean?', next: 'apollo-6' }],
      },
      {
        id: 'apollo-6',
        mood: 'smile',
        lines: ["Apollo's careful low Sun is basically a polar noon.", "That's why we plan by the real horizon, hour by hour."],
        replies: finale('apollo-11'),
      },
    ],
  },
];

/* ------------------------------------------------------------------ */
/* 3. Plan moments: <RefaeyMoment id="…"/> placed by Aser per step.    */
/* ------------------------------------------------------------------ */
export const MOMENTS: DialogueNode[] = [
  {
    id: 'plan-intro',
    mood: 'smile',
    lines: [
      'Your turn. Pick a spot near the south pole and a time to land.',
      'You want sunlight for power and Earth in view for radio. Ideally both.',
    ],
    replies: [{ label: "Let's go", action: { type: 'collapse' } }],
  },
  {
    id: 'step-site',
    mood: 'pointing',
    lines: ['Ridges and rims usually catch more Sun. Crater floors can stay dark for good.', 'Pick one and we’ll stand on it.'],
    replies: [
      { label: 'Why do craters stay dark?', action: { type: 'openExplainer', id: 'shadowed-craters' } },
      { label: 'OK', action: { type: 'collapse' } },
    ],
  },
  {
    id: 'step-stand',
    mood: 'neutral',
    when: 'horizonLola',
    lines: [
      "This horizon is real, built from NASA's laser maps of the terrain.",
      'The Sun is {sunElev} up and sets in {sunsetIn}. Earth: {earthStatus}.',
    ],
    replies: [
      { label: 'Why is the Sun so low?', action: { type: 'openExplainer', id: 'low-sun' } },
      { label: 'Why does Earth move?', action: { type: 'openExplainer', id: 'libration' } },
      { label: 'OK', action: { type: 'collapse' } },
    ],
  },
  {
    id: 'step-dates',
    mood: 'smile',
    lines: ['Missions slip all the time. Try a few dates', 'and watch the sunlight and radio windows move.'],
    replies: [
      { label: 'What is the best window?', action: { type: 'openExplainer', id: 'best-window' } },
      { label: 'OK', action: { type: 'collapse' } },
    ],
  },
];

/* ------------------------------------------------------------------ */
/* 4. Outcome story: end of the plan. Built ONLY from engine metrics.   */
/* Tokens: {siteName} {landingDate} {sunHours} {earthHours} {sunsetIn}  */
/*         {altSite} {altGain}                                          */
/* ------------------------------------------------------------------ */
export const OUTCOME: DialogueNode[] = [
  {
    id: 'outcome-play',
    mood: 'neutral',
    lines: ['Landing at {siteName} on {landingDate}. Let’s play it forward.', 'Sunlight on your panels: {sunHours}. Earth in view: {earthHours}.'],
    replies: [{ label: 'And then?', next: 'outcome-night' }],
  },
  {
    id: 'outcome-night',
    mood: 'neutral',
    lines: ['Then the Sun slips behind the horizon, {sunsetIn} after landing.', 'Your lander goes quiet and waits.'],
    replies: [{ label: 'Could I do better?', next: 'outcome-alt' }],
  },
  {
    id: 'outcome-alt',
    mood: 'pointing',
    when: 'altBetter',
    lines: ['Try {altSite}: it keeps the Sun {altGain} longer.', 'Same pole, very different day.'],
    replies: [
      { label: 'Try {altSite}', action: { type: 'navigate', to: '/mission?alt=1' } }, // TODO(Aser): real missionUrl for the alternative
      { label: 'Try another date', action: { type: 'collapse' } },
    ],
  },
  {
    id: 'outcome-best',
    mood: 'smile',
    when: 'altNone',
    lines: ['Nothing nearby beats that window in these dates.', 'Nicely planned, mission control.'],
    replies: [
      { label: 'Plan another', action: { type: 'navigate', to: '/mission' } },
      { label: 'Explore past missions', action: { type: 'navigate', to: '/missions' } },
    ],
  },
];

/* ------------------------------------------------------------------ */
/* 5. Ask Refaey: 2–3 scripted questions per screen (collapsed portrait). */
/* ------------------------------------------------------------------ */
export const ASK: Record<string, Reply[]> = {
  home: [
    { label: 'What is this place?', next: 'intro-hello' },
    { label: 'Why is the Sun so low?', action: { type: 'openExplainer', id: 'low-sun' } },
  ],
  missions: [
    { label: 'Why these three?', next: 'missions-hub' },
    { label: 'Why can’t the far side see Earth?', action: { type: 'openExplainer', id: 'farside' } },
  ],
  mission: [
    { label: 'Why can a site have power but no radio?', action: { type: 'openExplainer', id: 'power-vs-comms' } },
    { label: 'Why do panels stand upright?', action: { type: 'openExplainer', id: 'upright-panels' } },
    { label: 'What does “flat horizon” mean?', action: { type: 'openExplainer', id: 'flat-horizon' } },
  ],
};
