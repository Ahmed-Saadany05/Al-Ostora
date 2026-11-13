import type { ReactElement } from 'react';
import { REFAEY_COPY } from './copy';
import type { RefaeyMood } from './dialogues/dialogues';
import s from './refaey.module.css';

/*
 * PLACEHOLDER ART. Each mood is one small SVG drawn with the kit's colours (currentColor and tokens).
 * To swap in the real portraits, replace the entries of ART (an <img> or an <svg> per mood). Nothing else changes.
 */
const HEAD = <circle cx="32" cy="32" r="22" fill="var(--color-surface-raised)" stroke="currentColor" strokeWidth="1.5" />;
const VISOR = <ellipse cx="32" cy="31" rx="15" ry="11" fill="var(--color-bg)" stroke="currentColor" strokeWidth="1" />;
const EYES = (
  <>
    <circle cx="26.5" cy="30" r="1.8" fill="currentColor" />
    <circle cx="37.5" cy="30" r="1.8" fill="currentColor" />
  </>
);

export const ART: Record<RefaeyMood, ReactElement> = {
  neutral: (
    <>
      {HEAD}
      {VISOR}
      {EYES}
      <path d="M27 37h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
    </>
  ),
  smile: (
    <>
      {HEAD}
      {VISOR}
      {EYES}
      <path d="M26.5 36.5q5.5 5 11 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
    </>
  ),
  pointing: (
    <>
      {HEAD}
      {VISOR}
      {EYES}
      <path d="M26.5 36.5q5.5 5 11 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <path d="M50 44l8-9M58 35l-1.5 4.5M58 35l-4.5 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </>
  ),
};

/** Refaey's portrait. Decorative by default (the button or panel around it carries the name). */
export function Refaey({ mood = 'neutral', size = 64, label }: { mood?: RefaeyMood; size?: number; label?: string }) {
  return (
    <svg
      className={s.art}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      {ART[mood]}
    </svg>
  );
}

export const portraitLabel = (mood: RefaeyMood) => REFAEY_COPY.portrait[mood];
