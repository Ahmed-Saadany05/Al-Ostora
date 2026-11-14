/** Refaey's interface copy (the dialogue itself lives in dialogues/dialogues.ts). All strings here, none in components. */
export const REFAEY_COPY = {
  name: 'Refaey',
  next: 'Next',
  back: 'Back',
  ok: 'OK',
  /** The label on the inline card. */
  explains: 'Refaey explains',
  /** The speaker label above his line. */
  speaker: 'Refaey',
} as const;

/** What he says when you poke him (the suit is thick; no numbers, no facts). One at a time, for two seconds. */
export const QUIPS = [
  "Low gravity. Everything's a trampoline.",
  'That tickles. Probably. The suit is thick.',
  'Still no launch date. Still optimistic.',
  'In Cairo, this hop would hit a balcony.',
] as const;
