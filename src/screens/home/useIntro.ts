import { useEffect, useLayoutEffect, useState, type RefObject } from 'react';
import gsap from 'gsap';
import type { HeroMoonHandle } from './HeroMoon';

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

interface IntroRefs {
  stars: RefObject<HTMLDivElement | null>;
  moon: RefObject<HTMLDivElement | null>;
  copy: RefObject<HTMLDivElement | null>;
  pins: RefObject<HTMLDivElement | null>;
  handle: RefObject<HeroMoonHandle | null>;
}

/**
 * Longest we wait for the Moon (and Step 1's preload) before playing the intro anyway. Matches the
 * loading screen's cap in HomePage, so the intro never plays under the loader or over a half-loaded Moon.
 */
const READY_TIMEOUT_MS = 20_000;

/**
 * About 4.7 s: stars fade in → Moon rises → light sweep → headline → line → button → pin pulses once.
 * Plays once per session, ends early on any click or key, and is skipped entirely when `play` is false.
 * The seen flag is written on completion/skip (not on start), so React StrictMode's double effect still plays it.
 */
export function useIntro(play: boolean, moonReady: boolean, refs: IntroRefs) {
  const [done, setDone] = useState(!play);
  // The pin may be reached (focus, hover, click) only once the intro has started to reveal it.
  const [pinRevealed, setPinRevealed] = useState(!play);
  const [ready, setReady] = useState(false);

  // Hide everything before the first paint so there is no flash of the final state.
  useLayoutEffect(() => {
    if (!play) return;
    const { stars, moon, copy, pins } = refs;
    gsap.set(stars.current, { opacity: 0 });
    gsap.set(moon.current, { yPercent: 55 });
    gsap.set(pins.current, { opacity: 0 });
    gsap.set(copy.current?.querySelectorAll('[data-intro]') ?? [], { opacity: 0, y: 16 });
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
    const { stars, moon, copy, pins, handle } = refs;
    let skipped = false;
    const items = copy.current?.querySelectorAll<HTMLElement>('[data-intro]') ?? [];
    const finish = () => {
      markSeen();
      setDone(true);
      setPinRevealed(true);
    };

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ onComplete: finish });
      tl.to(stars.current, { opacity: 1, duration: 0.8, ease: 'none' }, 0)
        .to(moon.current, { yPercent: 0, duration: 1.7, ease: 'power3.out' }, 0.35)
        .call(() => handle.current?.playLightSweep(2.6), [], 1.1);
      items.forEach((el, i) => tl.to(el, { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out' }, 2.9 + i * 0.3));
      tl.add(() => setPinRevealed(true), 3.9).to(pins.current, { opacity: 1, duration: 0.4 }, 3.9).add(() => {
        const pulse = pins.current?.querySelector('[data-pulse]');
        if (pulse && !skipped) gsap.fromTo(pulse, { scale: 1, opacity: 0.9 }, { scale: 2.4, opacity: 0, duration: 0.65, ease: 'power2.out' });
      }, 4.0);
      tl.to({}, { duration: 0.65 }, 4.0); // keep the timeline open until the pulse has played (≈ 4.05 s)

      const skip = () => {
        skipped = true;
        handle.current?.playLightSweep(0);
        tl.progress(1);
      };
      window.addEventListener('pointerdown', skip, { once: true });
      window.addEventListener('keydown', skip, { once: true });
      return () => {
        window.removeEventListener('pointerdown', skip);
        window.removeEventListener('keydown', skip);
      };
    });
    return () => ctx.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [play, ready]);

  return { done, pinRevealed };
}
