/**
 * TS mirror of tokens.css for places that can't read CSS variables
 * (three.js materials, canvas, GSAP). Keep in sync with tokens.css.
 */
export const color = {
  bg: '#000000',
  surface: '#0b0b0c',
  surfaceRaised: '#131315',
  text: '#ede9e3',
  textMuted: '#a39f98',
  textFaint: '#85827c',
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
  sans: "'Saira Variable', system-ui, sans-serif",
  display: "'Saira Variable', system-ui, sans-serif",
  mono: "'IBM Plex Mono', ui-monospace, Consolas, monospace",
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
