import { useEffect, useLayoutEffect, useState, type RefObject } from 'react';
import gsap from 'gsap';
import { GATE_DONE, type CinemaGate } from './CinemaScene';

const SEEN_KEY = 'refaey-home-intro-seen';
const readSeen = () => {
  try {
    return sessionStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return false;
  }
};
const markSeen = () => {
  try {
    sessionStorage.setItem(SEEN_KEY, '1');
  } catch {
    /* private mode: the intro may replay, which is harmless */
  }
};

/** Persisted app motion state AND the live OS setting — either one turns the intro off. */
export function shouldPlayIntro(appMotion: boolean) {
  const osReduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  return appMotion && !osReduced && !readSeen();
}

export interface IntroRefs {
  stars: RefObject<HTMLDivElement | null>;
  /** overflow:hidden box the headline is revealed through. */
  headMask: RefObject<HTMLDivElement | null>;
  /** The headline block inside the mask; its characters are `[data-char]`. */
  headInner: RefObject<HTMLDivElement | null>;
  line: RefObject<HTMLDivElement | null>;
  actions: RefObject<HTMLDivElement | null>;
  pins: RefObject<HTMLDivElement | null>;
  /** Small corner texts that arrive with the button. */
  corners: RefObject<HTMLDivElement | null>;
  gate: RefObject<CinemaGate>;
}

/** The light edge's speed, in viewport widths per second. The headline mask moves at the same speed. */
export const EDGE_SPEED = 1 / 1.6;
/** Intro length, seconds. */
export const INTRO_S = 4.5;
const T = { stars: 0, firstLight: 0.5, spread: 1.5, headline: 2.2, actions: 3.2, pulse: 3.6 } as const;
/** Longest we wait for the Moon before playing anyway. */
const READY_TIMEOUT_MS = 3000;
/** How far apart the letters start (px per character from the centre) before easing to normal tracking. */
const TRACK_SPREAD_PX = 4;

/** Everything lit and in place; used for reduced motion, skip and the end. */
export function setFinalGate(gate: RefObject<CinemaGate>) {
  if (gate.current) Object.assign(gate.current, GATE_DONE);
}

/**
 * About 4.5 s. Black → stars fade in (no twinkle) → first light on the highest relief → the light spreads →
 * the headline is revealed by a mask moving with the light edge (letters ease from wide to normal tracking) →
 * the promise → button, link and pin. Plays once per session, ends early on any click or key, and is skipped
 * entirely when `play` is false (reduced motion shows the final frame). Everything animates transform or opacity
 * (letter-spacing is done as per-letter transforms); the shader gate is plain JS state.
 */
export function useCinemaIntro(play: boolean, moonReady: boolean, refs: IntroRefs) {
  const [done, setDone] = useState(!play);
  const [pinRevealed, setPinRevealed] = useState(!play);
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    if (!play) return;
    const { stars, headMask, headInner, line, actions, pins, corners } = refs;
    gsap.set(stars.current, { opacity: 0 });
    gsap.set(headMask.current, { xPercent: -100 });
    gsap.set(headInner.current, { xPercent: 100 });
    gsap.set(line.current, { opacity: 0, y: 12 });
    gsap.set(actions.current, { opacity: 0, y: 12 });
    gsap.set(pins.current, { opacity: 0 });
    gsap.set(corners.current, { opacity: 0 });
    const chars = headInner.current?.querySelectorAll('[data-char]') ?? [];
    const mid = (chars.length - 1) / 2;
    chars.forEach((c, i) => gsap.set(c, { x: (i - mid) * TRACK_SPREAD_PX }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [play]);

  useEffect(() => {
    if (!play) return;
    if (moonReady) return setReady(true);
    const t = window.setTimeout(() => setReady(true), READY_TIMEOUT_MS);
    return () => window.clearTimeout(t);
  }, [play, moonReady]);

  useEffect(() => {
    if (!play || !ready) return;
    let cancelled = false;
    let cleanup = () => {};

    const start = () => {
      if (cancelled) return;
      const { stars, headMask, headInner, line, actions, pins, corners, gate } = refs;
      const g = gate.current;
      const inner = headInner.current;
      if (!g || !inner) return;
      let skipped = false;
      const finish = () => {
        markSeen();
        setFinalGate(gate);
        setDone(true);
        setPinRevealed(true);
      };

      // The headline's natural box (the mask and the inner block cancel out, so this is where it will rest).
      const r = inner.getBoundingClientRect();
      const width = r.width / window.innerWidth;
      const revealS = width / EDGE_SPEED; // same speed as the light edge
      // The light edge enters the screen at the spread time and crosses at EDGE_SPEED; the headline mask starts later
      // and moves at the very same speed and direction, so the text appears in the wake of the light.
      const edgeFrom = -0.03;
      const edgeTo = 1.12;
      const spreadEnd = T.spread + (edgeTo - edgeFrom) / EDGE_SPEED;
      const chars = inner.querySelectorAll('[data-char]');

      const ctx = gsap.context(() => {
        g.first = 0;
        g.edge = edgeFrom - 0.2;
        const tl = gsap.timeline({ onComplete: finish });
        tl.to(stars.current, { opacity: 1, duration: 0.8, ease: 'none' }, T.stars)
          .to(g, { first: 1, duration: T.spread - T.firstLight, ease: 'power1.inOut' }, T.firstLight)
          .fromTo(g, { edge: edgeFrom }, { edge: edgeTo, duration: spreadEnd - T.spread, ease: 'none' }, T.spread)
          // Same direction and speed as the light edge (see EDGE_SPEED), starting in its wake.
          .to(headMask.current, { xPercent: 0, duration: revealS, ease: 'none' }, T.headline)
          .to(headInner.current, { xPercent: 0, duration: revealS, ease: 'none' }, T.headline)
          .to(chars, { x: 0, duration: revealS, ease: 'power2.out' }, T.headline)
          .to(line.current, { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' }, T.headline + revealS - 0.15)
          .to(actions.current, { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' }, T.actions)
          .to(corners.current, { opacity: 1, duration: 0.5 }, T.actions)
          .add(() => setPinRevealed(true), T.actions)
          .to(pins.current, { opacity: 1, duration: 0.4 }, T.actions)
          .add(() => {
            const pulse = pins.current?.querySelector('[data-pulse]');
            if (pulse && !skipped) gsap.fromTo(pulse, { scale: 1, opacity: 0.9 }, { scale: 2.4, opacity: 0, duration: 0.65, ease: 'power2.out' });
          }, T.pulse)
          .to({}, { duration: 0.01 }, INTRO_S - 0.01);

        const skip = () => {
          skipped = true;
          setFinalGate(gate);
          tl.progress(1);
        };
        window.addEventListener('pointerdown', skip, { once: true });
        window.addEventListener('keydown', skip, { once: true });
        cleanup = () => {
          window.removeEventListener('pointerdown', skip);
          window.removeEventListener('keydown', skip);
        };
      });
      const prev = cleanup;
      cleanup = () => {
        prev();
        ctx.revert();
      };
    };

    // Measure after the webfont is in, or the headline's width (and so the mask speed) would be off.
    document.fonts.ready.then(start);
    return () => {
      cancelled = true;
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [play, ready]);

  return { done, pinRevealed };
}
