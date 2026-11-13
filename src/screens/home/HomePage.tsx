/** Home — owner: Hady. Cinematic hero: one headline, one line, one primary action. */
import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { useSites } from '@/shared/data';
import { useApp } from '@/shared/store/app';
import { Button, DisplayHeading, Lead } from '@/shared/ui';
import { useBlocker, useNavigate } from 'react-router-dom';
import { releaseMoonHandoff } from '@/scenes/globe/moonHandoff';
import { missionUrl } from '@/shared/mission';
import { RefaeyBriefing, useRefaey, type BriefingDestination } from './refaey';
import { CREDITS, FEATURED_SITE_ID, HOME_COPY, IMAGERY_CREDIT } from './content';
import type { HeroMoonHandle } from './HeroMoon';
import { MoonBoundary } from './MoonBoundary';
import { MotionToggle } from './MotionToggle';
import { SitePin } from './SitePin';
import { StarLayers } from './StarLayers';
import { useSkyView } from './skyView';
import { shouldPlayIntro, useIntro } from './useIntro';
import s from './HomePage.module.css';

/** The Shackleton pin on the crest (hover/focus card, Demo label). It stays inert until the intro reveals it. */
const SHOW_SITE_PIN = true;

/** Clear space between the buttons and the Moon's lit edge (the brief asks for at least 32 px; the pin label sits in it). */
const MOON_GAP_PX = 48;
/**
 * The scene reports the pole's position. The pole leans toward the viewer, so the lit rim is a little above it:
 * measured 15, 16 and 22 px at 1280, 1366 and 1920 wide, i.e. about 1.16% of the width.
 */
const RIM_ABOVE_POLE_PER_WIDTH = 0.0116;

/** The hero copy and the pin fade out over this long before the Moon flies (no flight under reduced motion). */
const LEAVE_MS = 250;

const HeroMoon = lazy(() => import('./HeroMoon').then((m) => ({ default: m.HeroMoon })));

export function HomePage() {
  const navigate = useNavigate();
  const begin = useRefaey((st) => st.begin);
  const briefed = useRefaey((st) => st.briefed);
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
  // How far the Moon is moved down so its lit edge clears the buttons; null until measured (the Moon stays hidden).
  const [shift, setShift] = useState<number | null>(null);
  const pins = useRef<HTMLDivElement>(null);
  const handle = useRef<HeroMoonHandle>(null);
  const { done: introDone, pinRevealed } = useIntro(play, textured || moonSettled, { stars, moon, copy, pins, handle });

  const measure = useCallback(() => {
    if (!pinAt || !under.current || !hero.current) return;
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

  // "Begin the journey": the whole hero (title, line, buttons, pin) fades out, then Pink's flight takes the Moon toward Step 1.
  // When the flight ends it navigates to Step 1; that navigation is held here (it is the flight's completion signal) so the
  // briefing can play first. Once per session. Refaey is never on screen together with the hero.
  const [leaving, setLeaving] = useState(false);
  const journey = useRef(false);
  const blocker = useBlocker(({ nextLocation }) => journey.current && nextLocation.pathname === missionUrl.chooseSite());
  const [briefing, setBriefing] = useState(false);
  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    if (briefed) blocker.proceed();
    else {
      // The flight's last frame is still held up as an image; the briefing covers it, so let it go.
      releaseMoonHandoff(0);
      setBriefing(true);
    }
  }, [blocker, briefed]);

  const startJourney = useCallback(() => {
    if (leaving) return;
    setLeaving(true);
    journey.current = true;
    begin();
    const fade = [copy.current, pins.current].flatMap((el) =>
      el ? [el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: LEAVE_MS, easing: 'ease-out', fill: 'forwards' }).finished] : [],
    );
    // With motion the flight starts at once (it fades the hero itself); without it, wait for the cross-fade, then change view.
    if (motion) handle.current?.enterStep1();
    else void Promise.all(fade).then(() => handle.current?.enterStep1());
  }, [leaving, begin, motion]);

  const endBriefing = useCallback(
    (to: BriefingDestination) => {
      markBriefed();
      journey.current = false;
      if (to === 'missions') {
        if (blocker.state === 'blocked') blocker.reset();
        navigate('/missions');
      } else if (blocker.state === 'blocked') blocker.proceed();
      else navigate(missionUrl.chooseSite());
    },
    [blocker, markBriefed, navigate],
  );

  const pin = site ? { id: site.id, lat: site.lat, lon: site.lon, label: HOME_COPY.pinLabel } : null;

  return (
    <section ref={hero} className={s.hero} style={{ '--moon-shift': `${shift ?? 0}px` } as CSSProperties}>
      <div ref={stars} className={s.stars} data-home-stars>
        {/* Stars drift on their own; they no longer follow the cursor. */}
        <StarLayers parallax={false} />
      </div>

      <div className={s.moonShift} data-ready={shift !== null}>
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

      {briefing && <RefaeyBriefing onDone={endBriefing} />}

      <MotionToggle />

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
