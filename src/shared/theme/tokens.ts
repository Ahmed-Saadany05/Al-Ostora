/**
 * TS mirror of tokens.css for places that can't read CSS variables
 * (three.js materials, canvas, GSAP). Keep in sync with tokens.css.
 */
export const color = {
  bg: '#000000',
  surface: '#0b0b0c',
  surfaceRaised: '#131315',
  text: '#f5f5f4',
  textMuted: '#a8a8a6',
  textFaint: '#6b6b69',
  line: 'rgba(255,255,255,0.12)',
  lineStrong: 'rgba(255,255,255,0.32)',
  sun: '#f4c26b',
  earth: '#7cb4ff',
  good: '#8fd6a5',
  warn: '#f0b35e',
  bad: '#f28b82',
  demo: '#c9a7ff',
} as const;

export const font = {
  sans: "'DM Sans Variable', 'DM Sans', system-ui, sans-serif",
  display: "'Instrument Serif', 'Times New Roman', serif",
  mono: "'DM Mono', ui-monospace, Consolas, monospace",
} as const;

export const motion = {
  /** GSAP equivalents of --ease-out / --ease-in-out. */
  easeOut: 'expo.out',
  easeInOut: 'power3.inOut',
  fast: 0.14,
  base: 0.24,
  slow: 0.6,
} as const;

export type ColorToken = keyof typeof color;
