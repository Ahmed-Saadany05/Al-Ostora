/** Home — owner: Hady. Cinematic hero: one headline, one line, one primary action. */
import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { preloadStep1 } from '@/scenes';
import { useSites } from '@/shared/data';
import { useApp } from '@/shared/store/app';
import { Button, DisplayHeading, Lead } from '@/shared/ui';
import { useNavigate } from 'react-router-dom';
import { parkedKeepOut, type ParkRect } from '@/scenes/parkMath';
import { missionUrl } from '@/shared/mission';
import { RefaeyBriefing, useRefaey, type BriefingDestination } from './refaey';
import { CREDITS, FEATURED_SITE_ID, HOME_COPY, IMAGERY_CREDIT } from './content';
import type { HeroMoonHandle } from './HeroMoon';
import { MoonBoundary } from './MoonBoundary';
import { MoonLoader } from './MoonLoader';
import { MotionToggle } from './MotionToggle';
import { SitePin } from './SitePin';
import { StarLayers } from './StarLayers';
import { useSkyView } from './skyView';
import { shouldPlayIntro, useIntro } from './useIntro';
import s from './HomePage.module.css';

/** The Shackleton pin on the crest (hover/focus card, Demo label). It stays inert until the intro reveals it. */
const SHOW_SITE_PIN = false;

/** Clear space between the buttons and the Moon's lit edge (the brief asks for at least 32 px; the pin label sits in it). */
const MOON_GAP_PX = 48;
/**
 * The scene reports the pole's position. The pole leans toward the viewer, so the lit rim is a little above it:
 * measured 15, 16 and 22 px at 1280, 1366 and 1920 wide, i.e. about 1.16% of the width.
 */
const RIM_ABOVE_POLE_PER_WIDTH = 0.0116;

/** The hero copy and the pin fade out over this long before the Moon flies (no flight under reduced motion). */
const LEAVE_MS = 250;

/** Longest the first loading screen waits for Step 1's preload before letting the intro play. */
const PRELOAD_CAP_MS = 20_000;

const HeroMoon = lazy(() => import('./HeroMoon').then((m) => ({ default: m.HeroMoon })));

export function HomePage() {
  const navigate = useNavigate();
  const markBriefed = useRefaey((st) => st.markBriefed);
  const motion = useApp((st) => st.motion);
  const { data: sites } = useSites();
  const site = sites?.find((x) => x.id === FEATURED_SITE_ID);
  // "Now" is local to Home: the shared clock may have been scrubbed in a mission step. Minute-rounded for stable cache keys.
  const [now] = useState(() => new Date(Math.round(Date.now() / 60_000) * 60_000).toISOString());
  // The page's only read of the sky (one useSky + one useMetrics for "now"); the pin and its card get it as a prop.
  // Skipped while the pin is hidden: nothing on Home would show the data.
  const view = useSkyView(SHOW_SITE_PIN ? site : undefined, now);

  const [textured, setTextured] = useState(false);
  // Set when the Moon is as ready as it will ever be: texture on, or a known failure (so the intro never waits for nothing).
  const [moonSettled, setMoonSettled] = useState(false);
  const [pinAt, setPinAt] = useState<{ x: number; y: number } | null>(null);
  const [play] = useState(() => shouldPlayIntro(motion));

  const stars = useRef<HTMLDivElement>(null);
  const moon = useRef<HTMLDivElement>(null);
  const copy = useRef<HTMLDivElement>(null);
  const under = useRef<HTMLDivElement>(null);
  const hero = useRef<HTMLElement>(null);
  const shiftBox = useRef<HTMLDivElement>(null);
  // How far the Moon is moved down so its lit edge clears the buttons; null until measured (the Moon stays hidden).
  const [shift, setShift] = useState<number | null>(null);
  const pins = useRef<HTMLDivElement>(null);
  const handle = useRef<HeroMoonHandle>(null);
  // Step 1's code and opening imagery load during the first loading screen too, so the flight into it
  // lands on a ready Moon (also on a cold deployed visit). Capped so a slow network never traps the page.
  const [step1Ready, setStep1Ready] = useState(false);
  useEffect(() => {
    let live = true;
    const cap = window.setTimeout(() => live && setStep1Ready(true), PRELOAD_CAP_MS);
    void preloadStep1().then(() => live && setStep1Ready(true));
    return () => {
      live = false;
      window.clearTimeout(cap);
    };
  }, []);
  const allReady = (textured || moonSettled) && step1Ready;
  const { done: introDone, pinRevealed } = useIntro(play, allReady, { stars, moon, copy, pins, handle });

  // While the Moon is parked (or travelling to/from the corner) its pole is somewhere else: the shift is frozen, not re-measured.
  const frozen = useRef(false);
  const measure = useCallback(() => {
    if (frozen.current || !pinAt || !under.current || !hero.current) return;
    const heroTop = hero.current.getBoundingClientRect().top;
    const buttonsBottom = under.current.getBoundingClientRect().bottom - heroTop; // .under is not animated; its children are
    const edge = pinAt.y - RIM_ABOVE_POLE_PER_WIDTH * hero.current.clientWidth; // where the Moon's lit rim is now, in the (unshifted) layer's own box
    setShift(Math.max(0, Math.round(buttonsBottom + MOON_GAP_PX - edge)));
  }, [pinAt]);
  useLayoutEffect(measure, [measure]);
  useEffect(() => {
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [measure]);

  // "Begin the journey": the hero copy fades, the Moon zooms out and parks in the bottom-right corner (floating), and Refaey's
  // briefing plays beside it. A choice sends him away, the Moon glides back to exactly its Home framing, and then the
  // flight / dive / navigation happens. Once the briefing has been seen this session, Begin plays the flight straight away.
  // Without a Moon (WebGL failed) the briefing appears at once and choices navigate directly.
  const briefed = useRefaey((st) => st.briefed);
  const [leaving, setLeaving] = useState(false);
  const [briefing, setBriefing] = useState(false);
  const [parked, setParked] = useState<ParkRect | null>(null);
  const copyFades = useRef<Animation[]>([]);
  const diveDone = useRef<(() => void) | null>(null);

  const fadeCopy = useCallback(() => {
    const els = [copy.current, pins.current].filter((el): el is HTMLDivElement => !!el);
    copyFades.current = els.map((el) => el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: LEAVE_MS, easing: 'ease-out', fill: 'forwards' }));
    return Promise.all(copyFades.current.map((a) => a.finished.catch(() => undefined)));
  }, []);

  const startJourney = useCallback(() => {
    if (leaving) return;
    setLeaving(true);
    const fade = fadeCopy();
    if (!briefed && handle.current) frozen.current = true;
    if (!handle.current) return void fade.then(() => setBriefing(true));
    if (briefed) {
      // seen already: the flight, as before (no flight under reduced motion: wait for the cross-fade first)
      if (motion) handle.current.enterStep1();
      else void fade.then(() => handle.current?.enterStep1());
      return;
    }
    void fade
      .then(() => handle.current?.park(shiftBox.current ? new DOMMatrixReadOnly(getComputedStyle(shiftBox.current).transform).m42 : 0))
      .then(() => {
        setParked(parkedKeepOut(window.innerWidth, window.innerHeight));
        setBriefing(true);
      });
  }, [leaving, fadeCopy, briefed, motion, shift]);

  // The parked Moon's keep-out follows the viewport.
  useEffect(() => {
    if (!parked) return;
    const onResize = () => setParked(parkedKeepOut(window.innerWidth, window.innerHeight));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [parked]);

  const endBriefing = useCallback(
    async (to: BriefingDestination) => {
      // Refaey has already left (the briefing fades out before calling this). Now the Moon comes home.
      setBriefing(false);
      if (handle.current) await handle.current.unpark();
      frozen.current = false;
      setParked(null);
      if (to === 'close') {
        // closed without choosing: Home as it was, Begin works again
        copyFades.current.forEach((a) => a.cancel());
        copyFades.current = [];
        const els = [copy.current, pins.current].filter((el): el is HTMLDivElement => !!el);
        els.forEach((el) => el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: motion ? LEAVE_MS : 0, easing: 'ease-in' }));
        setLeaving(false);
        return;
      }
      markBriefed();
      if (to === 'missions') {
        if (handle.current && motion) {
          // a short dive toward the pole, then the page
          await new Promise<void>((resolve) => {
            diveDone.current = resolve;
            handle.current?.diveToSouthPole();
            window.setTimeout(resolve, 2200); // never wait forever
          });
        }
        navigate('/missions');
      } else if (to === 'about') navigate('/about');
      else if (handle.current) handle.current.enterStep1();
      else navigate(missionUrl.chooseSite());
    },
    [markBriefed, motion, navigate],
  );

  const pin = site ? { id: site.id, lat: site.lat, lon: site.lon, label: HOME_COPY.pinLabel } : null;

  return (
    <section ref={hero} className={s.hero} style={{ '--moon-shift': `${shift ?? 0}px` } as CSSProperties}>
      <div ref={stars} className={s.stars} data-home-stars>
        {/* Stars drift on their own; they no longer follow the cursor. */}
        <StarLayers parallax={false} />
      </div>

      <div ref={shiftBox} className={s.moonShift} data-ready={shift !== null}>
        <div ref={moon} className={s.moon}>
          <MoonBoundary label={HOME_COPY.moonLabel} onFail={() => setMoonSettled(true)}>
            <Suspense fallback={null}>
              <HeroMoon
                ref={handle}
                autoRotate={motion}
                tiltTowardSouthPole
                highlightedPin={pin}
                startDark={play}
                onTextureReady={() => setTextured(true)}
                onTextureFailed={() => setMoonSettled(true)}
                onDiveComplete={() => diveDone.current?.()}
                onPinScreen={setPinAt}
                label={HOME_COPY.moonLabel}
              />
            </Suspense>
          </MoonBoundary>
        </div>
      </div>

      <div ref={copy} className={s.copy}>
        <div data-intro className={s.headline}>
          <DisplayHeading size="display" align="center" accent={HOME_COPY.headlineAccent}>
            {HOME_COPY.headlineLead}
          </DisplayHeading>
        </div>
        <div ref={under} className={s.under} inert={leaving}>
          <div data-intro>
            <Lead align="center">{HOME_COPY.line}</Lead>
          </div>
          <div data-intro className={s.actions}>
            <Button
              variant="primary"
              size="md"
              icon="arrowRight"
              onClick={startJourney}
            >
              {HOME_COPY.begin}
            </Button>
            <Button variant="ghost" to="/about">
              {HOME_COPY.about}
            </Button>
          </div>
        </div>
      </div>

      {/* After the copy in the DOM so Tab reaches Begin first. The pin only appears once the Moon has risen. */}
      <div ref={pins} className={s.pins} inert={!pinRevealed || leaving}>
        {SHOW_SITE_PIN && site && pinAt && (
          <div>
            <SitePin site={site} time={now} view={view} x={pinAt.x} y={pinAt.y} />
          </div>
        )}
      </div>

      {briefing && <RefaeyBriefing onDone={endBriefing} avoid={parked ?? undefined} />}

      <MotionToggle />

      {/* First visit: black loading screen until the Moon imagery is in, then the intro plays. */}
      <MoonLoader ready={allReady} />

      {introDone && (textured || (view.status === 'ready' && view.sky.source === 'horizons')) && (
        <p className={s.credit}>
          {textured && IMAGERY_CREDIT.text}
          {/* Horizons is only credited when sky.source says so; demo values are not Horizons. */}
          {textured && (view.status === 'ready' && view.sky.source === 'horizons') && ' · '}
          {(view.status === 'ready' && view.sky.source === 'horizons') && CREDITS.positions}
        </p>
      )}
    </section>
  );
}
