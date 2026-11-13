/** Home — owner: Hady. Cinematic hero: one headline, one line, one primary action. */
import { lazy, Suspense, useRef, useState } from 'react';
import { useSites } from '@/shared/data';
import { missionUrl } from '@/shared/mission';
import { useApp } from '@/shared/store/app';
import { Button, DisplayHeading, Lead } from '@/shared/ui';
import { CREDITS, FEATURED_SITE_ID, HOME_COPY, IMAGERY_CREDIT } from './content';
import type { HeroMoonHandle } from './HeroMoon';
import { MoonBoundary } from './MoonBoundary';
import { MotionToggle } from './MotionToggle';
import { SitePin } from './SitePin';
import { StarLayers } from './StarLayers';
import { useSkyView } from './skyView';
import { shouldPlayIntro, useIntro } from './useIntro';
import s from './HomePage.module.css';

/** The live site pin on the Moon is hidden for now (team decision); set true to bring it back. */
const SHOW_SITE_PIN = false;

const HeroMoon = lazy(() => import('./HeroMoon').then((m) => ({ default: m.HeroMoon })));

export function HomePage() {
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
  const pins = useRef<HTMLDivElement>(null);
  const handle = useRef<HeroMoonHandle>(null);
  const { done: introDone, pinRevealed } = useIntro(play, textured || moonSettled, { stars, moon, copy, pins, handle });

  const pin = site ? { id: site.id, lat: site.lat, lon: site.lon, label: HOME_COPY.pinLabel } : null;

  return (
    <section className={s.hero}>
      <div ref={stars} className={s.stars}>
        <StarLayers parallax={motion && introDone} />
      </div>

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

      <div ref={copy} className={s.copy}>
        <div data-intro className={s.headline}>
          <DisplayHeading size="display" align="left" accent={HOME_COPY.headlineAccent}>
            {HOME_COPY.headlineLead}
          </DisplayHeading>
        </div>
        <div data-intro>
          <Lead align="left">{HOME_COPY.line}</Lead>
        </div>
        <div data-intro className={s.actions}>
          {/* Until the camera dive exists, Begin goes straight into the mission flow. */}
          <Button variant="primary" size="md" icon="arrowRight" to={missionUrl.chooseSite()}>
            {HOME_COPY.begin}
          </Button>
          <Button variant="ghost" to="/about">
            {HOME_COPY.about}
          </Button>
        </div>
      </div>

      {/* After the copy in the DOM so Tab reaches Begin first. The pin only appears once the Moon has risen. */}
      <div ref={pins} className={s.pins} inert={!pinRevealed}>
        {SHOW_SITE_PIN && site && pinAt && <SitePin site={site} time={now} view={view} x={pinAt.x} y={pinAt.y} />}
      </div>

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
