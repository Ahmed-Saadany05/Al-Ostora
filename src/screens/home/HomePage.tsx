/** Home — owner: Hady. Cinematic hero: one headline, one line, one primary action, the Moon and Earth. */
import gsap from 'gsap';
import { lazy, Suspense, useCallback, useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSites } from '@/shared/data';
import { formatLatLon } from '@/shared/format';
import { missionUrl } from '@/shared/mission';
import { useApp } from '@/shared/store/app';
import { Button, DisplayHeading, Lead } from '@/shared/ui';
import type { CinemaGate, CinemaHandle } from './CinemaScene';
import { CREDITS, EARTH_LABEL, FEATURED_SITE_ID, HOME_COPY, SVS_CREDIT } from './content';
import { MoonBoundary } from './MoonBoundary';
import { MotionToggle } from './MotionToggle';
import { SitePin } from './SitePin';
import { StarLayers } from './StarLayers';
import { useSkyView } from './skyView';
import { setFinalGate, shouldPlayIntro, useCinemaIntro } from './useCinemaIntro';
import { DESCENT_S } from './cinemaMath';
import s from './HomePage.module.css';

/** The site pin is part of this layout (brief), so it is on. The earlier team decision to hide it is reversed here. */
const SHOW_SITE_PIN = true;

const CinemaScene = lazy(() => import('./CinemaScene').then((m) => ({ default: m.CinemaScene })));

/** One span per character so the intro can ease the tracking with transforms. The full text stays readable. */
function chars(text: string): ReactNode {
  return Array.from(text).map((c, i) => (
    <span key={i} data-char className={s.char} aria-hidden>
      {c === ' ' ? ' ' : c}
    </span>
  ));
}

export function HomePage() {
  const navigate = useNavigate();
  const motion = useApp((st) => st.motion);
  const { data: sites } = useSites();
  const site = sites?.find((x) => x.id === FEATURED_SITE_ID);
  // "Now" is local to Home: the shared clock may have been scrubbed in a mission step. Minute-rounded for stable cache keys.
  const [now] = useState(() => new Date(Math.round(Date.now() / 60_000) * 60_000).toISOString());
  // The page's only read of the sky (one useSky + one useMetrics for "now"); the pin and its card get it as a prop.
  const view = useSkyView(SHOW_SITE_PIN ? site : undefined, now);

  const gate = useRef<CinemaGate>({ first: 1, edge: 2 });
  const [play] = useState(() => {
    const p = shouldPlayIntro(motion);
    if (p) Object.assign(gate.current, { first: 0, edge: -1 });
    return p;
  });
  const [textured, setTextured] = useState(false);
  // Set when the Moon is as ready as it will ever be: texture on, or a known failure (so the intro never waits for nothing).
  const [moonSettled, setMoonSettled] = useState(false);
  const [visible, setVisible] = useState(() => typeof document === 'undefined' || !document.hidden);

  const stars = useRef<HTMLDivElement>(null);
  const headMask = useRef<HTMLDivElement>(null);
  const headInner = useRef<HTMLDivElement>(null);
  const line = useRef<HTMLDivElement>(null);
  const actions = useRef<HTMLDivElement>(null);
  const pins = useRef<HTMLDivElement>(null);
  const corners = useRef<HTMLDivElement>(null);
  const pinEl = useRef<HTMLDivElement>(null);
  const earthLabel = useRef<HTMLParagraphElement>(null);
  const scene = useRef<CinemaHandle>(null);
  const fade = useRef<HTMLDivElement>(null);
  const copy = useRef<HTMLDivElement>(null);
  const leaving = useRef(false);

  const { done: introDone, pinRevealed } = useCinemaIntro(play, textured || moonSettled, {
    stars,
    headMask,
    headInner,
    line,
    actions,
    pins,
    corners,
    gate,
  });

  // The render loop stops while the tab is hidden.
  useEffect(() => {
    const onVis = () => setVisible(!document.hidden);
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  // Begin: with motion on, a 1.2 s descent toward the pin, the dome flattens into a horizon, fade to black, then /mission.
  // Motion off or reduced motion: the link just navigates. Modified clicks (new tab etc.) are left alone.
  const onBeginCapture = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (!(e.target as HTMLElement).closest('a')) return;
      if (!motion || !scene.current || leaving.current) return;
      e.preventDefault();
      e.stopPropagation();
      leaving.current = true;
      setFinalGate(gate); // an intro still playing is over
      gsap.to(copy.current, { opacity: 0, duration: 0.4, ease: 'none' });
      gsap.to(pins.current, { opacity: 0, duration: 0.4, ease: 'none' });
      gsap.to(fade.current, { opacity: 1, duration: DESCENT_S * 0.55, delay: DESCENT_S * 0.45, ease: 'none' });
      scene.current.descend().then(() => navigate(missionUrl.chooseSite()));
    },
    [motion, navigate],
  );

  return (
    <section className={s.hero}>
      <div ref={stars} className={s.stars} data-home-stars>
        {/* Stars drift on their own; no twinkle, no cursor drift. */}
        <StarLayers parallax={false} />
      </div>

      <div className={s.scene}>
        <MoonBoundary label={HOME_COPY.moonLabel} onFail={() => setMoonSettled(true)}>
          <Suspense fallback={null}>
            <CinemaScene
              ref={scene}
              gate={gate}
              motion={motion}
              active={visible}
              pinEl={pinEl}
              earthLabelEl={earthLabel}
              onTextureReady={() => setTextured(true)}
              onTextureFailed={() => setMoonSettled(true)}
            />
          </Suspense>
        </MoonBoundary>
      </div>

      <div ref={copy} className={s.copy}>
        <div ref={headMask} className={s.mask}>
          <div ref={headInner} className={s.headline}>
            <span className="visually-hidden">
              {HOME_COPY.headlineLead} {HOME_COPY.headlineAccent}
            </span>
            <DisplayHeading size="display" align="left" accent={chars(HOME_COPY.headlineAccent)}>
              {chars(HOME_COPY.headlineLead)}
            </DisplayHeading>
          </div>
        </div>
        <div ref={line}>
          <Lead align="left">{HOME_COPY.line}</Lead>
        </div>
        <div ref={actions} className={s.actions} onClickCapture={onBeginCapture}>
          <Button variant="primary" size="md" icon="arrowRight" to={missionUrl.chooseSite()}>
            {HOME_COPY.begin}
          </Button>
          <Button variant="ghost" to="/about">
            {HOME_COPY.about}
          </Button>
        </div>
      </div>

      {/* After the copy in the DOM so Tab reaches Begin first. Inert (not focusable, not clickable) until revealed. */}
      <div ref={pins} className={s.pins} inert={!pinRevealed}>
        {SHOW_SITE_PIN && site && <SitePin ref={pinEl} site={site} time={now} view={view} />}
      </div>

      <p ref={earthLabel} className={s.earthLabel}>
        {motion ? EARTH_LABEL.moving : EARTH_LABEL.still}
      </p>

      <MotionToggle />

      <div ref={corners} className={s.corners}>
        {site && <p className={['num', s.coords].join(' ')}>{formatLatLon(site.lat, site.lon)}</p>}
        {introDone && (textured || (view.status === 'ready' && view.sky.source === 'horizons')) && (
          <p className={s.credit}>
            {textured && SVS_CREDIT.text}
            {/* Horizons is only credited when sky.source says so; demo values are not Horizons. */}
            {textured && view.status === 'ready' && view.sky.source === 'horizons' && ' · '}
            {view.status === 'ready' && view.sky.source === 'horizons' && CREDITS.positions}
          </p>
        )}
      </div>

      {/* Fade to black for the descent (opacity only). */}
      <div ref={fade} className={s.fade} aria-hidden />
    </section>
  );
}
