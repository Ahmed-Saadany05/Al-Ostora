/**
 * Owner: Hady — plain-language explainers shown inside the mission steps via <Explain id="…"/>.
 * Aser places the tags; Hady writes and edits the text here. Keep each to 2–3 short sentences.
 * (Drafts below — Hady, rewrite freely.)
 */
export const EXPLAINERS = {
  'low-sun': {
    title: 'Why is the Sun so low?',
    body: "The Moon's axis is tilted only about 1.5°, so at the south pole the Sun never climbs much higher than that. It circles the horizon instead of rising overhead, and a nearby ridge can hide it completely.",
  },
  libration: {
    title: 'Why does Earth move a little?',
    body: "Earth hangs almost still in the Moon's sky, but the Moon wobbles slightly (libration). Near the pole that wobble is enough to lift Earth above the horizon or drop it below.",
  },
  farside: {
    title: 'Why can’t the far side see Earth?',
    body: 'The Moon always shows the same face to Earth. From the far side Earth is always below the horizon, so landers there need a relay satellite to call home.',
  },
  'best-window': {
    title: 'What is the best window?',
    body: 'The longest stretch when the Sun shines on the solar panels AND Earth is in view for radio. That is the safest time to land and start working.',
  },
} as const;

export type ExplainerId = keyof typeof EXPLAINERS;
