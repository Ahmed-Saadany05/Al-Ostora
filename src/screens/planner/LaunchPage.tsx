/**
 * STEP 5 — Mission summary. Owner: Aser (summary) + Pink (LaunchSequence plays first).
 *
 * No boxes: the page reads like a mission report.
 *  1. "Mission summary" title, the verdict in big gradient letters, and a large NASA Moon showing
 *     the landing site lit or dark, with a radio beam up to Earth when Earth is in sight.
 *  2. Four big numbers written straight on the page.
 *  3. The mission log: launch → touchdown → every sunset / sunrise / earthset / earthrise in the
 *     first lunar day, in plain sentences along a glowing line.
 * The numbers and moments come from missionStory() — the same function as Step 4 — so they match.
 * No score on this page.
 */
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { LaunchSequence } from '@/scenes';
import { useDayReport, usePlanLaunch, useSky } from '@/shared/data';
import { Explain } from '@/screens/home/Explain';
import { RefaeyMoment } from '@/screens/home/refaey';
import { formatLatLon } from '@/shared/format';
import { missionUrl, useMission } from '@/shared/mission';
import { LUNAR } from '@/shared/types';
import { Button, EmptyState, LoadingState, Page, SourceBadge, StepHeader } from '@/shared/ui';
import { IMAGE_CREDIT, dayTime, human, missionStory } from './DatePage';
import { VerifyDrawer } from './VerifyDrawer';
import { usePlannerParams } from './SettingsDrawer';
import { DataError } from './DataError';
import s from './flow.module.css';

const cls = (...c: (string | false | undefined | null)[]) => c.filter(Boolean).join(' ');

/**
 * Big Moon (NASA image, near side) with the landing site. Gold light + rim when the Sun is up at
 * touchdown, darkened when not. Earth hangs in the sky top-left; when it is in sight a dashed radio
 * beam runs from the site to Earth, otherwise Earth is faded.
 */
function SummaryMoon({ sunlit, contact, lat, lon, site }: { sunlit: boolean; contact: boolean; lat: number; lon: number; site: string }) {
  const id = useId().replace(/:/g, '');
  const C = { x: 250, y: 250, r: 150 };
  const E = { x: 70, y: 70, r: 26 };
  const la = (lat * Math.PI) / 180;
  const lo = (lon * Math.PI) / 180;
  const pin = { x: C.x + C.r * 0.9 * Math.cos(la) * Math.sin(lo), y: C.y - C.r * 0.9 * Math.sin(la) };
  return (
    <svg viewBox="0 0 460 440" className={s.sumMoon} role="img" aria-label={`The Moon with ${site} ${sunlit ? 'in sunlight' : 'in shadow'}, Earth ${contact ? 'in sight' : 'out of sight'}`}>
      <defs>
        <clipPath id={`m${id}`}>
          <circle cx={C.x} cy={C.y} r={C.r} />
        </clipPath>
        <clipPath id={`e${id}`}>
          <circle cx={E.x} cy={E.y} r={E.r} />
        </clipPath>
        <radialGradient id={`sh${id}`} cx="72%" cy="25%" r="85%">
          <stop offset="0%" stopColor="var(--color-surface)" stopOpacity="0" />
          <stop offset="55%" stopColor="var(--color-surface)" stopOpacity="0.2" />
          <stop offset="100%" stopColor="var(--color-surface)" stopOpacity="0.92" />
        </radialGradient>
        <radialGradient id={`gl${id}`}>
          <stop offset="55%" stopColor="var(--color-sun)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="var(--color-sun)" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`at${id}`}>
          <stop offset="62%" stopColor="var(--color-earth)" stopOpacity="0.5" />
          <stop offset="100%" stopColor="var(--color-earth)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx={C.x} cy={C.y} r={C.r + 70} fill={`url(#gl${id})`} className={cls(s.sumGlow, sunlit && s.sumGlowOn)} />
      <g clipPath={`url(#m${id})`}>
        <circle cx={C.x} cy={C.y} r={C.r} className={s.trajMoonBase} />
        <image href="/moon/lroc_color_poles_2k.webp" x={C.x - 2 * C.r} y={C.y - C.r} width={4 * C.r} height={2 * C.r} preserveAspectRatio="none" />
        <circle cx={C.x} cy={C.y} r={C.r} fill={`url(#sh${id})`} />
        <circle cx={C.x} cy={C.y} r={C.r} className={cls(s.trajNight, !sunlit && s.trajNightOn)} />
      </g>
      <circle cx={C.x} cy={C.y} r={C.r} className={cls(s.trajRim, sunlit && s.trajRimOn)} />

      {/* Earth in the sky, and the radio beam to it. */}
      {contact && <line x1={pin.x} y1={pin.y} x2={E.x} y2={E.y} className={s.trajBeam} />}
      <g className={cls(s.sumEarth, !contact && s.sumEarthOff)}>
        <circle cx={E.x} cy={E.y} r={E.r + 12} fill={`url(#at${id})`} />
        <g clipPath={`url(#e${id})`}>
          <image href="/earth/blue-marble-apollo17.jpg" x={E.x - E.r / 0.89} y={E.y - E.r / 0.89} width={(2 * E.r) / 0.89} height={(2 * E.r) / 0.89} />
        </g>
      </g>

      {/* Landing site */}
      <circle cx={pin.x} cy={pin.y} r="6" className={s.trajPinRing} />
      <circle cx={pin.x} cy={pin.y} r="4" className={s.trajPin} />
      <text x={pin.x} y={Math.min(430, pin.y + 26)} textAnchor="middle" className={s.sumPinLabel}>
        {site}
      </text>
    </svg>
  );
}

/** "18" + "days of sunlight" — hours shown as hours under a day. */
function Figure({ h, plus = false, label, warn = false, whole = false }: { h: number; plus?: boolean; label: string; warn?: boolean; whole?: boolean }) {
  const value = whole ? '29½' : h <= 0 ? '0' : h < 24 ? `${Math.round(h)}` : `${Math.round(h / 24)}`;
  const unit = !whole && h > 0 && h < 24 ? 'hours' : 'days';
  return (
    <div className={cls(s.sumFig, warn && s.sumFigWarn)}>
      <span className={s.sumFigValue}>
        {value}
        {plus && h > 0 ? '+' : ''}
        <span className={s.sumFigUnit}> {unit}</span>
      </span>
      <span className={s.sumFigLabel}>{label}</span>
    </div>
  );
}

/** One line in the lander's feed. */
type FeedItem =
  | { kind: 'msg'; at: number; text: string; sent: boolean }
  | { kind: 'lost'; h: number; ongoing: boolean }
  | { kind: 'restored'; at: number };

const stamp = (t: number) =>
  `${new Date(t).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' })} ${new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })}`;

/** Four signal bars: lit when the lander can reach Earth. */
function Signal({ on }: { on: boolean }) {
  return (
    <span className={cls(s.sig, on ? s.sigOn : s.sigOff)} aria-label={on ? 'Signal: Earth in sight' : 'No signal: Earth out of sight'}>
      {[1, 2, 3, 4].map((b) => (
        <i key={b} style={{ height: `${b * 3 + 2}px` }} />
      ))}
    </span>
  );
}

/**
 * "Messages from the lander": the lander radios mission control in the first person. It can only
 * send while Earth is in sight, so when Earth sets the feed shows SIGNAL LOST (static, sized by
 * how long it lasts); anything that happens meanwhile is "stored on board" until SIGNAL RESTORED.
 * Messages type themselves out once the feed scrolls into view (instantly with reduced motion).
 */
function LanderFeed({ items }: { items: FeedItem[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useMemo(() => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches, []);
  const [started, setStarted] = useState(reduced);
  const [step, setStep] = useState(reduced ? items.length : 0); // items fully shown
  const [chars, setChars] = useState(0); // characters typed of items[step]

  // Start when the feed is on screen.
  useEffect(() => {
    if (started || !ref.current) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setStarted(true), { threshold: 0.25 });
    io.observe(ref.current);
    return () => io.disconnect();
  }, [started]);

  // Typewriter: type the current message, pause, move on. Bands just pause.
  useEffect(() => {
    if (!started || step >= items.length) return;
    const it = items[step];
    if (it.kind === 'msg' && chars < it.text.length) {
      const t = setTimeout(() => setChars((c) => Math.min(it.text.length, c + 2)), 16);
      return () => clearTimeout(t);
    }
    const t = setTimeout(
      () => {
        setStep((n) => n + 1);
        setChars(0);
      },
      it.kind === 'msg' ? 380 : 900,
    );
    return () => clearTimeout(t);
  }, [started, step, chars, items]);

  const replay = () => {
    setStep(0);
    setChars(0);
  };
  const visible = items.slice(0, Math.min(items.length, step + 1));
  // Signal at the newest visible line.
  let signal = true;
  for (const it of visible) signal = it.kind === 'lost' ? false : it.kind === 'restored' ? true : signal;
  const done = step >= items.length;

  return (
    <div className={s.feed} ref={ref}>
      <div className={s.feedHead}>
        <span className={s.label}>Messages from the lander → mission control</span>
        <Signal on={signal} />
        <span className={s.grow} />
        {done && !reduced && (
          <button type="button" className={s.feedReplay} onClick={replay}>
            ↻ Replay
          </button>
        )}
      </div>
      <ol className={s.feedList} aria-live="polite">
        {visible.map((it, i) => {
          const typing = i === step && !done;
          if (it.kind === 'lost')
            return (
              <li key={i} className={s.feedLost} style={{ minHeight: `${Math.min(170, 56 + it.h / 3)}px` }}>
                <span className={s.feedStatic} aria-hidden />
                <span className={s.feedBandText}>
                  SIGNAL LOST · {human(it.h)}
                  {it.ongoing ? '+' : ''} of silence
                </span>
              </li>
            );
          if (it.kind === 'restored')
            return (
              <li key={i} className={s.feedRestored}>
                <span className={s.feedBandText}>SIGNAL RESTORED · {stamp(it.at)} UTC</span>
              </li>
            );
          const text = typing ? it.text.slice(0, chars) : it.text;
          return (
            <li key={i} className={cls(s.feedMsg, !it.sent && s.feedStored)}>
              <span className={cls(s.feedTime, 'num')}>{stamp(it.at)}</span>
              <span className={s.feedText}>
                {text}
                {typing && <i className={s.feedCaret} aria-hidden />}
                {!it.sent && !typing && <span className={s.feedTag}>stored on board · not sent yet</span>}
              </span>
            </li>
          );
        })}
      </ol>
      {!started && <p className={s.feedHint}>Incoming transmission…</p>}
    </div>
  );
}

export function LaunchPage() {
  const params = usePlannerParams();
  const { site, launchDate, loading } = useMission();
  const { data: plan, error: ePlan } = usePlanLaunch(site, launchDate);
  const landing = plan?.landingDate;
  const on = landing ? site : undefined;
  const { data: sky, error: eSky } = useSky(on, landing ?? '', params);
  const { data: afterReport, error: eAfter } = useDayReport(on, landing ?? '', LUNAR.synodicDays, params);

  const [landed, setLanded] = useState(false);
  const [verify, setVerify] = useState(false);
  const onDone = useCallback(() => setLanded(true), []);

  if (loading || (site && launchDate && !plan)) return <LoadingState title="Fuelling the rocket…" />;
  if (!site || !launchDate || !plan || !landing)
    return (
      <Page width="narrow">
        <EmptyState
          title="No mission planned"
          message="Choose a site and a launch date first."
          action={
            <Button variant="primary" to={missionUrl.chooseSite()}>
              Plan a mission
            </Button>
          }
        />
      </Page>
    );

  if (!landed) return <LaunchSequence site={site} plan={plan} onDone={onDone} />;

  const sun = sky?.sunVisible ?? false;
  const earth = sky?.earthVisible ?? false;
  const farside = site.region === 'farside';
  // Said from the surface: the lander has already touched down.
  const verdict = !sky
    ? 'Reading the sky…'
    : sun && earth
      ? 'Landed successfully'
      : sun
        ? 'Landed, but no signal home'
        : earth
          ? 'Landed, but too dark outside'
          : 'Landed in the dark, no signal home';
  const story = sky && afterReport ? missionStory(landing, afterReport.sunWindows, afterReport.earthWindows, sun, earth) : undefined;
  const sliver = sun && sky ? sky.sun.visibleFraction < 0.1 : false;

  // Messages from the lander, written from the surface (it has already landed). It can only
  // transmit while Earth is in sight; otherwise a message waits on board. Every fact (Sun, Earth,
  // durations) comes from the same sky / missionStory() data as the rest of the page.
  const L = Date.parse(landing);
  const feed: FeedItem[] = [];
  if (sky && story) {
    const dark = story.runFrom(0, 'sun');
    const quiet = story.runFrom(0, 'earth');
    const arrive = [
      `Landed successfully at ${site.name}. All systems OK.`,
      sun
        ? sliver
          ? `The Sun is only just peeking over the ridge: my panels catch about ${Math.max(1, Math.round(sky.sun.visibleFraction * 100))}% of it.`
          : 'Sunny outside. Panels open and charging.'
        : `It's too dark outside: the Sun is behind the ridge. Running on battery${dark.ongoing ? '.' : ` until sunrise in ${human(dark.h)}.`}`,
      earth
        ? 'I can see Earth in my sky. Hello, mission control!'
        : farside
          ? "I can't see Earth from here: I'm on the far side. Saving this on board."
          : `Earth is hidden below the horizon. Saving this on board${quiet.ongoing ? '.' : ` and calling home when it rises in ${human(quiet.h)}.`}`,
    ].join(' ');
    feed.push({ kind: 'msg', at: L, sent: earth, text: arrive });
    if (!earth) feed.push({ kind: 'lost', h: quiet.h, ongoing: quiet.ongoing });
    let stored = earth ? 0 : 1;
    story.rows.forEach((r, i) => {
      if (r.kind === 'touchdown') return;
      if (r.kind === 'earthset') {
        const run = story.runFrom(i, 'earth');
        const back = run.ongoing ? "It won't be back before this lunar day ends." : `Talk again in ${human(run.h)}.`;
        feed.push({ kind: 'msg', at: r.at, sent: true, text: `Earth is sinking behind the hills, going quiet. ${back}` });
        feed.push({ kind: 'lost', h: run.h, ongoing: run.ongoing });
      }
      if (r.kind === 'earthrise') {
        feed.push({ kind: 'restored', at: r.at });
        feed.push({
          kind: 'msg',
          at: r.at,
          sent: true,
          text: `Earth is back in my sky!${stored ? ` Sending ${stored} saved message${stored === 1 ? '' : 's'}.` : ''}${!r.sun ? ' Still dark outside.' : ' Everything is fine here.'}`,
        });
        stored = 0;
      }
      if (r.kind === 'sunset') {
        const run = story.runFrom(i, 'sun');
        feed.push({
          kind: 'msg',
          at: r.at,
          sent: r.earth,
          text: `The Sun just set and it's getting cold and dark outside. Switching to battery for a night of ${human(run.h)}${run.ongoing ? ' or more' : ''}.`,
        });
        if (!r.earth) stored++;
      }
      if (r.kind === 'sunrise') {
        feed.push({ kind: 'msg', at: r.at, sent: r.earth, text: 'Good morning! Sunlight is back on my panels, charging again.' });
        if (!r.earth) stored++;
      }
    });
  }

  return (
    <Page>
      <StepHeader
        step="launch"
        title="Mission"
        accent="summary."
        back={{ to: missionUrl.date(site.id), label: 'Change date' }}
        meta={<span className="num">{formatLatLon(site.lat, site.lon)}</span>}
      />
      <DataError errors={[ePlan, eSky, eAfter]} />

      {/* 1. Verdict + the Moon */}
      <section className={s.sumHero}>
        <div className={s.sumHeroText}>
          <p className={s.label}>Your mission to {site.name}</p>
          <h2 className={s.sumVerdict}>{verdict}</h2>
          <p className={s.sumLead}>
            Launch <b className="num">{dayTime(plan.launchDate)}</b>, land <b className="num">{dayTime(landing)}</b>, after <b>{plan.transitDays} days</b> in space.
          </p>
          <span className={s.sumTags}>
            {sky && <SourceBadge source={sky.source} />}
            {site.region === 'farside' ? <Explain id="farside" /> : site.region.endsWith('pole') ? <Explain id="low-sun" /> : <Explain id="libration" />}
          </span>
        </div>
        <SummaryMoon sunlit={sun} contact={earth} lat={site.lat} lon={site.lon} site={site.name} />
      </section>

      {/* 2. The four numbers that matter, for the first lunar day (29½ days) */}
      {story && (
        <section className={s.sumFigs} aria-label="Your first lunar day in numbers">
          <Figure h={story.sunlitH} whole={story.sunlitH >= story.dayH - 3} label="of sunlight for the solar panels" />
          <Figure h={story.earthH} whole={story.earthH >= story.dayH - 3} label="with Earth in sight" />
          <Figure h={story.silence.h} plus={story.silence.ongoing} warn={story.silence.h >= 24} label="longest time without contact" />
          <Figure h={story.night.h} plus={story.night.ongoing} warn={story.night.h >= 24} label="longest night" />
          <p className={s.sumFigsNote}>Your first lunar day on the Moon lasts 29½ Earth days. “+” means it is still going when that lunar day ends.</p>
        </section>
      )}

      {/* 3. Messages from the lander */}
      <section className={s.sumLog}>
        {sky && story ? <LanderFeed key={landing} items={feed} /> : <LoadingState compact />}
      </section>

      {/* Next steps */}
      <div className={s.sumActions}>
        <Button variant="ghost" icon={null} leadingIcon="orbit" className={s.verifyBtn} onClick={() => setVerify(true)}>
          Check against <span className={s.verifyBtnSub}>JPL Horizons</span>
        </Button>
        <span className={s.grow} />
        <Button variant="secondary" leadingIcon="clock" icon={null} to={missionUrl.date(site.id)}>
          Change the date
        </Button>
        <Button variant="primary" to={missionUrl.chooseSite()}>
          Plan another mission
        </Button>
      </div>
      <p className={s.trajCredit}>
        {plan.assumption} · {IMAGE_CREDIT}
      </p>

      <RefaeyMoment id="moment-outcome" placement="stage" />

      <VerifyDrawer site={site} time={landing} open={verify} onClose={() => setVerify(false)} />
    </Page>
  );
}
