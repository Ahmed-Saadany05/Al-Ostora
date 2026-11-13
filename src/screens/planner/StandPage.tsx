/** STEP 2 — Stand on site. PLACEHOLDER — owner: Aser (HUD) + Pink (panorama). */
import { useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { SitePanorama } from '@/scenes';
import { Explain } from '@/screens/home/Explain';
import { nextTransition, useDayReport, useHorizon, useMetrics, useSky } from '@/shared/data';
import { compass, formatDeg, formatDuration, formatLatLon, formatPercent, formatUtc, hoursBetween } from '@/shared/format';
import { missionUrl, useMission } from '@/shared/mission';
import { useTime } from '@/shared/store/time';
import type { BodyPosition, DataSource, IsoTime, SkyState, TimeWindow } from '@/shared/types';
import {
  Button,
  CountdownChip,
  EmptyState,
  Eyebrow,
  Icon,
  IconButton,
  LoadingState,
  OwnerNote,
  Page,
  Pill,
  SourceBadge,
  StepHeader,
  Tabs,
  TimelineLegend,
} from '@/shared/ui';
import { useLunarDay } from './useLunarDay';
import { VerifyDrawer } from './VerifyDrawer';
import { SettingsButton, usePlannerParams } from './SettingsDrawer';
import { EarthPhase, SunOrb } from './skyIcons';
import s from './flow.module.css';

/**
 * One card per sky body (Sun = power, Earth = radio). Reads top to bottom, simple → expert:
 *   1. the answer ("Sunlit" / "In shadow") + countdown to the next change
 *   2. how much: % of the Sun's disk above the skyline, or Earth's phase
 *   3. worst case this lunar day: longest night / longest radio gap (from useMetrics)
 *   4. expert line: flat-horizon elevation (elDeg), terrain skyline (horizonElDeg), direction
 * Visible/not comes from the provider (sunVisible / earthVisible), never from elDeg: the
 * Sun can be "1.9° above flat horizon" and still dark behind a 2.3° ridge.
 */
export function BodyCard({
  kind,
  body,
  visible,
  next,
  now,
  worstH,
  noneAllDay,
  farside,
  source,
  hideWorst = false,
}: {
  kind: 'sun' | 'earth';
  body: BodyPosition & { illumination?: number };
  visible: boolean;
  next: IsoTime | null;
  now: IsoTime;
  /** Sun: longestNightH. Earth: longestCommsGapH. Undefined while metrics load. */
  worstH: number | undefined;
  /** True when metrics say this body is never in view for the whole lunar day (fraction = 0). */
  noneAllDay: boolean;
  /** Far-side site: Earth can never rise there. */
  farside: boolean;
  source: DataSource;
  /** Hide the "longest night / radio gap" line (Step 5 shows those in its own summary). */
  hideWorst?: boolean;
}) {
  const sun = kind === 'sun';
  const answer = sun ? (visible ? 'Sunlit' : 'In shadow') : visible ? 'In contact' : 'No radio link';
  const partial = body.visibleFraction > 0 && body.visibleFraction < 1;
  // When there is no next change before the lunar day ends, say so in words
  // instead of the countdown chip's "not in range".
  const noChange = sun
    ? visible
      ? 'No sunset before this lunar day ends'
      : 'No sunrise before this lunar day ends'
    : visible
      ? 'No earthset before this lunar day ends'
      : farside
        ? 'Earth never rises on the far side'
        : 'No earthrise before this lunar day ends';
  return (
    <section className={cls(s.bodyCard, visible ? (sun ? s.cardSunOn : s.cardEarthOn) : s.cardOff)}>
      {/* Light that comes from the body's direction (azimuth 0–360° → 0–100% across the card). */}
      <span className={cls(s.cardLight, sun ? s.cardLightSun : s.cardLightEarth)} style={{ left: `${(body.azDeg % 360) / 3.6}%` }} aria-hidden />
      {/* Soft flash whenever the answer changes (key = answer → re-mounts → animation replays). */}
      <span key={`flash-${answer}`} className={cls(s.cardFlash, sun ? s.cardFlashSun : s.cardFlashEarth)} aria-hidden />

      <div className={s.bodyHead}>
        <Pill tone={visible ? kind : 'neutral'} icon={sun ? 'sun' : 'antenna'} label={sun ? 'Sun · solar power' : 'Earth · radio link'} />
        <span className={s.grow} />
        <SourceBadge source={source} />
      </div>

      {/* 1. The answer (fades + slides in when it changes) with a live Sun orb / Earth phase. */}
      <div className={s.answerRow}>
        <p key={answer} className={cls(s.bigNum, s.answerIn)}>
          {answer}
        </p>
        {sun ? <SunOrb on={visible} /> : <EarthPhase illumination={body.illumination ?? 0} on={visible} />}
      </div>
      {next ? (
        <CountdownChip kind={sun ? (visible ? 'sunset' : 'sunrise') : visible ? 'earthset' : 'earthrise'} target={next} now={now} />
      ) : (
        <p className={s.bodyLine}>{noChange}</p>
      )}

      {/* 2. How much */}
      {sun && partial && (
        <p className={s.bodyLine}>
          <span className="num">{formatPercent(body.visibleFraction)}</span> of the Sun visible above the skyline
        </p>
      )}
      {!sun && body.illumination !== undefined && (
        <p className={s.bodyLine}>
          Earth <span className="num">{formatPercent(body.illumination)}</span> lit
        </p>
      )}

      {/* 3. Worst case this lunar day */}
      {hideWorst ? null : noneAllDay ? (
        <p className={s.bodyLine}>{sun ? 'No sunlight this lunar day' : 'No Earth contact this lunar day'}</p>
      ) : worstH === 0 ? (
        <p className={s.bodyLine}>{sun ? 'No night at all this lunar day' : 'No radio gap at all this lunar day'}</p>
      ) : (
        <p className={s.bodyLine}>
          {sun ? 'Longest night this lunar day' : 'Longest radio gap this lunar day'}{' '}
          <span className="num">{worstH === undefined ? '—' : formatDuration(worstH)}</span>
        </p>
      )}

      {/* 4. Side view: the body vs the ridge, then the exact numbers. */}
      <RidgeGauge kind={kind} body={body} />
      <div className={s.bodyFoot}>
        <span className={s.look}>
          <span className="num">{formatDeg(Math.abs(body.elDeg), 1, false)}</span> {body.elDeg >= 0 ? 'above' : 'below'} flat horizon ·
          skyline <span className="num">{formatDeg(body.horizonElDeg, 1)}</span>
        </span>
        <span className={s.look}>
          Look toward{' '}
          <span className="num">
            {compass(body.azDeg)} · {Math.round(body.azDeg)}°
          </span>
        </span>
      </div>
    </section>
  );
}

/**
 * Side view of the Sun/Earth against the ridge in its direction.
 * The ridge top is fixed; the dot sits `clearanceDeg` above (or below) it, scaled so small
 * differences are visible. The ridge is drawn AFTER the dot, so a body behind terrain really
 * disappears behind it (and a half-hidden one looks half-hidden). Dashed line = flat horizon.
 */
function RidgeGauge({ kind, body }: { kind: 'sun' | 'earth'; body: BodyPosition }) {
  const W = 240;
  const H = 58;
  const ridgeY = 36;
  const dotX = 150;
  const rangeDeg = Math.min(6, Math.max(1.5, Math.abs(body.clearanceDeg) * 1.6));
  const pxPerDeg = 24 / rangeDeg;
  const dy = Math.min(16, Math.max(-28, -body.clearanceDeg * pxPerDeg));
  const flatY = ridgeY + body.horizonElDeg * pxPerDeg;
  const ridge = `M0 ${H} L0 ${ridgeY + 9} C 30 ${ridgeY - 1}, 60 ${ridgeY + 12}, 95 ${ridgeY + 5} S ${dotX - 25} ${ridgeY - 2}, ${dotX} ${ridgeY} S 205 ${ridgeY + 13}, ${W} ${ridgeY + 6} L ${W} ${H} Z`;
  return (
    <svg className={s.gauge} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${kind === 'sun' ? 'Sun' : 'Earth'} ${formatDeg(body.clearanceDeg, 1)} relative to the ridge`}>
      <title>
        {`${formatDeg(body.elDeg, 1)} above flat horizon, ridge at ${formatDeg(body.horizonElDeg, 1)} → clearance ${formatDeg(body.clearanceDeg, 1)}`}
      </title>
      {flatY > 4 && flatY < H - 2 && (
        <>
          <line x1="0" x2={W} y1={flatY} y2={flatY} className={s.gaugeFlat} />
          <text x="4" y={flatY - 3} className={s.gaugeLabel}>
            flat horizon
          </text>
        </>
      )}
      <circle cx={dotX} cy={ridgeY} r="7" className={cls(s.gaugeDot, kind === 'sun' ? s.gaugeDotSun : s.gaugeDotEarth)} style={{ transform: `translateY(${dy}px)` }} />
      <path d={ridge} className={s.gaugeRidge} />
      <text x={W - 4} y={H - 6} textAnchor="end" className={s.gaugeLabel}>
        ridge
      </text>
    </svg>
  );
}

/**
 * Floating tag pinned above the best window on the timeline strip, with a bracket marking
 * its span. Best window = longest stretch with Sun AND Earth together (metrics.bestWindow).
 * The text follows the clock while the timeline plays:
 *   before → "opens in 3d 12h" · inside → "you're in it · 14h left" (glows) · after → "has passed".
 * Positions use the same maths as TimelineStrip: % of the way from `from` to `to`.
 * "+" = clipped: the window runs past the edge of this lunar day, so it is really longer.
 * Clicking the tag jumps the clock to the window's start.
 */
function BestWindowTag({ best, from, to, now, onJump }: { best: TimeWindow; from: IsoTime; to: IsoTime; now: IsoTime; onJump: () => void }) {
  const t0 = Date.parse(from);
  const span = Math.max(1, Date.parse(to) - t0);
  const pct = (iso: IsoTime) => Math.min(100, Math.max(0, ((Date.parse(iso) - t0) / span) * 100));
  const left = pct(best.start);
  const right = pct(best.end);
  const mid = (left + right) / 2;

  const t = Date.parse(now);
  const a = Date.parse(best.start);
  const b = Date.parse(best.end);
  const phase = t < a ? 'before' : t <= b ? 'inside' : 'after';
  const phaseClass = { before: undefined, inside: s.bwInside, after: s.bwAfter }[phase];
  const endsPastRange = best.clipped && b >= Date.parse(to);
  const length = `${formatDuration(best.durationH)}${best.clipped ? '+' : ''}`;
  // How much of the window is used up (fills the callout like a progress bar while inside).
  const elapsed = phase === 'inside' ? ((t - a) / Math.max(1, b - a)) * 100 : phase === 'after' ? 100 : 0;
  const nowPct = pct(now);

  return (
    <>
      <span className={cls(s.bwAura, phaseClass)} style={{ left: `${left}%`, width: `${right - left}%` }} aria-hidden />
      {phase === 'before' && <span className={s.bwWait} style={{ left: `${nowPct}%`, width: `${left - nowPct}%` }} aria-hidden />}
      <span className={cls(s.bwLine, phaseClass)} style={{ left: `${left}%`, width: `${right - left}%` }} aria-hidden />
      <button
        type="button"
        className={cls(s.bwTag, phaseClass)}
        // translateX(-mid%) keeps the callout inside the strip: centred in the middle, edge-aligned at the ends.
        style={{ left: `${mid}%`, transform: `translateX(-${mid}%)`, '--bw-elapsed': `${elapsed}%` } as CSSProperties}
        onClick={onJump}
        title={`${formatUtc(best.start)} → ${formatUtc(best.end)} · click to jump there`}
      >
        <span className={s.bwIcons} aria-hidden>
          <span className={s.bwSun}>
            <Icon name="sun" size={14} />
          </span>
          <span className={s.bwEarth}>
            <Icon name="earth" size={14} />
          </span>
        </span>
        <span className={s.bwName}>Best time to land</span>
        <span className="num">{length}</span>
        <span className={s.bwSep} aria-hidden />
        {phase === 'before' && (
          <span>
            opens in <span className="num">{formatDuration(hoursBetween(now, best.start))}</span>
          </span>
        )}
        {phase === 'inside' && (
          <span>
            you&apos;re in it ·{' '}
            <span className="num">
              {formatDuration(hoursBetween(now, best.end))}
              {endsPastRange ? '+' : ''}
            </span>{' '}
            left
          </span>
        )}
        {phase === 'after' && <span>has passed</span>}
        {/* The pointer sits at mid% of the callout, which lines up with mid% of the strip. */}
        <span className={s.bwPointer} style={{ left: `${mid}%` }} aria-hidden />
      </button>
    </>
  );
}

/**
 * Stand page's own timeline (replaces the shared TimelineStrip here only).
 * - Two smooth ribbons: Sun (gold) and Earth (blue). Ribbon strength = how much of the
 *   disk is above the skyline (visibleFraction), so a half-hidden Sun looks half as bright.
 * - Drag anywhere (or use ← → keys, Shift = 1 day) to move the clock; snaps to the data step.
 * - Hover shows a preview bubble: date · Sunlit/In shadow · In contact/No radio link.
 * - The best-window callout (BestWindowTag) floats on top.
 * Positions: % of the way from `from` to `to`, same maths as BestWindowTag.
 */
export function StandTimeline({
  from,
  to,
  samples,
  stepMinutes,
  now,
  best,
  onSelect,
  onScrubStart,
}: {
  from: IsoTime;
  to: IsoTime;
  samples: SkyState[];
  stepMinutes: number;
  now: IsoTime;
  best: TimeWindow | null;
  onSelect: (ms: number) => void;
  onScrubStart: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const [hoverMs, setHoverMs] = useState<number | null>(null);

  const t0 = Date.parse(from);
  const span = Math.max(1, Date.parse(to) - t0);
  const stepMs = Math.max(1, stepMinutes) * 60_000;
  const pctOf = (ms: number) => Math.min(100, Math.max(0, ((ms - t0) / span) * 100));
  const snap = (ms: number) => Math.min(t0 + span, Math.max(t0, Math.round((ms - t0) / stepMs) * stepMs + t0));
  const msAt = (clientX: number) => {
    const r = ref.current!.getBoundingClientRect();
    return t0 + Math.min(1, Math.max(0, (clientX - r.left) / r.width)) * span;
  };

  // One CSS gradient per ribbon, built from the samples (thinned to ~240 stops).
  const ribbons = useMemo(() => {
    const every = Math.max(1, Math.floor(samples.length / 240));
    const grad = (kind: 'sun' | 'earth') => {
      const stops: string[] = [];
      for (let i = 0; i < samples.length; i += every) {
        const x = samples[i];
        const on = kind === 'sun' ? x.sunVisible : x.earthVisible;
        // Keep partly hidden disks visible (min 35%) so short slivers don't vanish.
        const strength = on ? Math.max(0.35, x[kind].visibleFraction) : 0;
        const p = (((Date.parse(x.time) - t0) / span) * 100).toFixed(2);
        stops.push(`color-mix(in srgb, var(--color-${kind}) ${Math.round(strength * 100)}%, transparent) ${p}%`);
      }
      return stops.length > 1 ? `linear-gradient(90deg, ${stops.join(', ')})` : 'none';
    };
    return { sun: grad('sun'), earth: grad('earth') };
  }, [samples, t0, span]);

  const hovered =
    hoverMs === null || samples.length === 0
      ? undefined
      : samples[Math.min(samples.length - 1, Math.max(0, Math.round((hoverMs - t0) / stepMs)))];
  const hoverPct = hoverMs === null ? 0 : pctOf(hoverMs);
  const nowPct = pctOf(Date.parse(now));

  const onKeyDown = (e: KeyboardEvent) => {
    const big = e.shiftKey ? 24 * 3_600_000 : stepMs;
    const cur = Date.parse(now);
    const next =
      e.key === 'ArrowRight' ? cur + big : e.key === 'ArrowLeft' ? cur - big : e.key === 'Home' ? t0 : e.key === 'End' ? t0 + span : null;
    if (next === null) return;
    e.preventDefault();
    onScrubStart();
    onSelect(snap(next));
  };

  const ticks = 5;
  return (
    <div className={s.tlGrid}>
      <div className={s.tlIcons} aria-hidden>
        <span className={s.bwSun}>
          <Icon name="sun" size={14} />
        </span>
        <span className={s.tlEarthIcon}>
          <Icon name="earth" size={14} />
        </span>
      </div>
      <div className={s.stripWrap}>
        {best && <BestWindowTag best={best} from={from} to={to} now={now} onJump={() => onSelect(Date.parse(best.start))} />}
        <div
          ref={ref}
          className={s.tlTrack}
          role="slider"
          tabIndex={0}
          aria-label="Time in this lunar day"
          aria-valuemin={t0}
          aria-valuemax={t0 + span}
          aria-valuenow={Date.parse(now)}
          aria-valuetext={formatUtc(now)}
          onKeyDown={onKeyDown}
          onPointerDown={(e) => {
            dragging.current = true;
            ref.current?.setPointerCapture(e.pointerId);
            onScrubStart();
            onSelect(snap(msAt(e.clientX)));
          }}
          onPointerMove={(e) => {
            const ms = msAt(e.clientX);
            setHoverMs(ms);
            if (dragging.current) onSelect(snap(ms));
          }}
          onPointerUp={() => (dragging.current = false)}
          onPointerCancel={() => (dragging.current = false)}
          onPointerLeave={() => !dragging.current && setHoverMs(null)}
        >
          <span className={s.tlLane} style={{ backgroundImage: ribbons.sun }} />
          <span className={s.tlLane} style={{ backgroundImage: ribbons.earth }} />
          {hovered && <span className={s.tlHoverLine} style={{ left: `${hoverPct}%` }} />}
          <span className={s.tlHead} style={{ left: `${nowPct}%` }}>
            <span className={s.tlKnob} />
          </span>
          {hovered && (
            <span className={s.tlBubble} style={{ left: `${hoverPct}%`, transform: `translateX(-${hoverPct}%)` }}>
              <span className="num">{formatUtc(hovered.time)}</span>
              <span className={s.bwSep} />
              <i className={cls(s.tlDot, hovered.sunVisible && s.tlDotSun)} />
              {hovered.sunVisible ? 'Sunlit' : 'In shadow'}
              <i className={cls(s.tlDot, hovered.earthVisible && s.tlDotEarth)} />
              {hovered.earthVisible ? 'In contact' : 'No radio link'}
            </span>
          )}
        </div>
        <div className={s.tlTicks}>
          {Array.from({ length: ticks }, (_, i) => (
            <span key={i} className="num">
              {formatUtc(new Date(t0 + (span * i) / (ticks - 1)).toISOString(), false).slice(0, 6)}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

const cls = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(' ');

export function StandPage() {
  const params = usePlannerParams();
  const { site, loading } = useMission();
  const { from, to, days } = useLunarDay();
  const time = useTime((st) => st.time);
  const playing = useTime((st) => st.playing);
  const toggle = useTime((st) => st.toggle);
  const setTime = useTime((st) => st.setTime);
  const pause = useTime((st) => st.pause);
  const [mode, setMode] = useState<'stand' | 'above'>('stand');
  const [verify, setVerify] = useState(false);

  const { data: sky } = useSky(site, time, params);
  const { data: horizon } = useHorizon(site, params);
  const { data: report } = useDayReport(site, from, days, params);
  const { data: metrics } = useMetrics(site, from, to, params);

  if (loading) return <LoadingState title="Loading site…" />;
  if (!site)
    return (
      <Page width="narrow">
        <EmptyState
          title="No site chosen"
          message="Pick a landing site first."
          action={
            <Button variant="primary" to={missionUrl.chooseSite()}>
              Choose a site
            </Button>
          }
        />
      </Page>
    );

  const ahead = report?.samples.filter((x) => x.time >= time) ?? [];
  const sunUp = (x: SkyState) => x.sunVisible;
  const earthUp = (x: SkyState) => x.earthVisible;
  const status = sky
    ? sky.sunVisible && sky.earthVisible
      ? 'Sunlit and in contact with Earth'
      : sky.sunVisible
        ? 'Sunlit · no Earth link'
        : sky.earthVisible
          ? 'In shadow · Earth in view'
          : 'In shadow · no Earth link'
    : 'Reading the sky…';

  return (
    <Page>
      <StepHeader
        step="stand"
        title={site.name}
        back={{ to: missionUrl.chooseSite([site.id]), label: 'Back to sites' }}
        meta={<span className="num">{formatLatLon(site.lat, site.lon)}</span>}
        aside={
          <span className={s.headAside}>
          <SettingsButton />
          <Tabs
            label="View"
            variant="pill"
            value={mode}
            onChange={setMode}
            items={[
              { id: 'stand', label: 'Stand here' },
              { id: 'above', label: 'Fly above' },
            ]}
          />
          </span>
        }
      />

      <div className={s.statusRow}>
        <Pill tone={sky?.sunVisible ? 'sun' : 'neutral'} icon={sky?.sunVisible ? 'sun' : 'moon'} label={status} />
        {sky && <SourceBadge source={sky.source} />}
        <span className={s.grow} />
        {site.region === 'farside' ? <Explain id="farside" /> : site.region === 'south-pole' ? <Explain id="low-sun" /> : <Explain id="libration" />}
      </div>

      <div className={s.standGrid}>
        <div className={s.viewport}>
          <SitePanorama site={site} time={time} sky={sky} horizon={horizon} mode={mode} />
        </div>
        <div className={s.bodyCol}>
          {sky ? (
            <>
              <BodyCard
                kind="sun"
                body={sky.sun}
                visible={sky.sunVisible}
                now={time}
                next={nextTransition(ahead, sunUp, sky.sunVisible)}
                worstH={metrics?.longestNightH}
                noneAllDay={metrics?.sunlitFraction === 0}
                farside={site.region === 'farside'}
                source={sky.source}
              />
              <BodyCard
                kind="earth"
                body={sky.earth}
                visible={sky.earthVisible}
                now={time}
                next={nextTransition(ahead, earthUp, sky.earthVisible)}
                worstH={metrics?.longestCommsGapH}
                noneAllDay={metrics?.earthVisibleFraction === 0}
                farside={site.region === 'farside'}
                source={sky.source}
              />
            </>
          ) : (
            <LoadingState compact />
          )}
        </div>
      </div>

      <section className={s.timeline}>
        <div className={s.timelineHead}>
          <IconButton icon={playing ? 'pause' : 'play'} label={playing ? 'Pause' : 'Play'} onClick={toggle} active={playing} />
          <div>
            <Eyebrow>Sky at</Eyebrow>
            <span className="num">{formatUtc(time)}</span>
          </div>
          <span className={s.grow} />
          {/* best={false}: the best window is labelled by its own callout on the timeline. */}
          <TimelineLegend best={false} />
          {/* TODO (blocked on Hady): add <Explain id="power-vs-comms" /> here once that explainer id exists. */}
          {metrics &&
            (metrics.bestWindow ? (
              <>
                <Button variant="secondary" onClick={() => setTime(metrics.bestWindow!.start)}>
                  Jump to best
                </Button>
              </>
            ) : (
              <span className={s.bodyLine}>No time with both Sun and Earth this lunar day</span>
            ))}
        </div>
        {report ? (
          <StandTimeline
            from={from}
            to={to}
            samples={report.samples}
            stepMinutes={report.stepMinutes}
            now={time}
            best={metrics?.bestWindow ?? null}
            onSelect={setTime}
            onScrubStart={pause}
          />
        ) : (
          <LoadingState compact />
        )}
        <div className={s.timelineFoot}>
          <Button variant="ghost" icon={null} leadingIcon="orbit" className={s.verifyBtn} onClick={() => setVerify(true)}>
            Check against NASA <span className={s.verifyBtnSub}>· JPL Horizons</span>
          </Button>
          <span className={s.grow} />
          <Button variant="secondary" leadingIcon="plus" icon={null} to={missionUrl.chooseSite([site.id])}>
            Compare
          </Button>
          <Button variant="primary" to={missionUrl.date(site.id)}>
            Choose a launch date
          </Button>
        </div>
      </section>

      <VerifyDrawer site={site} time={time} open={verify} onClose={() => setVerify(false)} />
      <OwnerNote owner="Aser (cards, timeline) · Pink (panorama)">
        Step 2 placeholder. <Icon name="info" size={12} /> Panorama is a 2D stand-in for the 3D terrain view.
      </OwnerNote>
    </Page>
  );
}
