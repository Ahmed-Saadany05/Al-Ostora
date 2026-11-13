/**
 * STEP 4 — Pick a launch date. Owner: Aser. Conditions are judged at TOUCHDOWN, not launch.
 *
 * Answers "When do you launch?" in three ways:
 *  1. The answer at the top: the chosen launch (recommended one pre-selected) + the next best
 *     launch chances (one per lunar day: its best window − transit).
 *  2. A launch calendar: every day is coloured by what you would LAND into if you launched then
 *     (Sun + Earth / Sun only / Earth only / dark), read from the hourly report at touchdown time.
 *  3. A live Earth → Moon flight drawing.
 *
 * Data (all from hooks, nothing computed here):
 *  - usePlanLaunch(site, launch) → landingDate, transitDays, assumption (engine's transit model).
 *  - useMetrics over the next three lunar days after the earliest possible touchdown → best windows.
 *  - useDayReport over the calendar's touchdown range → hourly Sun/Earth visibility.
 *  - The timeline shows the lunar day AROUND touchdown, so "inside the best window" is judged
 *    against the right lunar day. useMetrics(touchdown → +1 lunar day) → time left after landing.
 */
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useDayReport, useMetrics, usePlanLaunch, useSky } from '@/shared/data';
import { Explain } from '@/screens/home/Explain';
import { formatDuration, formatLatLon, hoursBetween } from '@/shared/format';
import { missionUrl, useMission } from '@/shared/mission';
import { LUNAR, type IsoTime, type SkyState, type TimeWindow } from '@/shared/types';
import { Button, EmptyState, Icon, LoadingState, Page, Pill, SourceBadge, StepHeader } from '@/shared/ui';
import { EarthPhase, SunOrb } from './skyIcons';
import { SettingsButton, usePlannerParams } from './SettingsDrawer';
import { DataError } from './DataError';
import s from './flow.module.css';

const HOUR = 3_600_000;
const DAY = 86_400_000;
const LUNAR_MS = LUNAR.synodicDays * DAY;
const iso = (ms: number) => new Date(ms).toISOString();
const midnight = (ms: number) => Math.floor(ms / DAY) * DAY;
const cls = (...c: (string | false | undefined | null)[]) => c.filter(Boolean).join(' ');

/** "Fri 13 Nov, 17:00 UTC" */
export const dayTime = (t: IsoTime | number) =>
  `${new Date(t).toLocaleString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })} UTC`;
/** "13 Nov" */
const dayShort = (t: IsoTime | number) => new Date(t).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' });

const MOON_IMG = '/moon/lroc_color_poles_2k.webp';
/** NASA Apollo 17 "Blue Marble" (AS17-148-22727, public domain), resized to 360 px. */
const EARTH_IMG = '/earth/blue-marble-apollo17.jpg';
/** Report both to Goda for the credits page. */
export const IMAGE_CREDIT = 'Earth: NASA Apollo 17 "Blue Marble" (AS17-148-22727) · Moon: NASA SVS CGI Moon Kit (LRO LROC)';

/** Fixed pseudo-random stars for the flight drawing (same every render). */
const STARS = Array.from({ length: 54 }, (_, i) => {
  const r = (n: number) => (((Math.sin(i * 12.9898 + n * 78.233) * 43758.5453) % 1) + 1) % 1;
  return { x: r(1) * 1000, y: r(2) * 260, r: 0.4 + r(3) * 1.1, o: 0.15 + r(4) * 0.55 };
});

function usePrefersReducedMotion() {
  return useMemo(() => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches, []);
}

/**
 * Earth → Moon flight. The path circles Earth once (parking orbit), then swings to the Moon,
 * and draws itself in whenever the launch changes. A craft with a glowing trail flies it.
 * Day marks split the trans-lunar part into transit days. At the Moon: lit from the Sun's side
 * with a gold rim if touchdown is sunlit, darkened if not; a pin marks the site; a blue radio
 * beam runs back to Earth if Earth is in view at touchdown.
 */
export function Trajectory({
  launch,
  landing,
  transitDays,
  sunlit,
  contact,
  lat,
  lon,
  caption,
}: {
  launch: IsoTime;
  landing: IsoTime;
  transitDays: number;
  sunlit: boolean;
  contact: boolean;
  lat: number;
  lon: number;
  /** Shown under the Moon when a later moment (not touchdown) is being shown. */
  caption?: string;
}) {
  const still = usePrefersReducedMotion();
  const uid = useId().replace(/:/g, '');
  const E = { x: 150, y: 150, r: 34 };
  const M = { x: 860, y: 140, r: 34 };
  const loopR = 56;
  // Parking orbit = two half-circles centred on Earth, then the trans-lunar arc.
  const path = `M ${E.x + loopR} ${E.y} A ${loopR} ${loopR} 0 0 1 ${E.x - loopR} ${E.y} A ${loopR} ${loopR} 0 0 1 ${E.x + loopR} ${E.y} C 430 -10, 690 0, ${M.x - 30} ${M.y - 14}`;
  const beam = `M ${M.x - 32} ${M.y + 16} Q 500 252 ${E.x + 34} ${E.y + 14}`;

  // Day marks along the trans-lunar part (after the parking loop), measured on the real path.
  const pathRef = useRef<SVGPathElement>(null);
  const [ticks, setTicks] = useState<{ x: number; y: number; n: number }[]>([]);
  useLayoutEffect(() => {
    const p = pathRef.current;
    if (!p || typeof p.getTotalLength !== 'function') return;
    const total = p.getTotalLength();
    const loop = 2 * Math.PI * loopR;
    const n = Math.max(1, Math.round(transitDays));
    setTicks(
      Array.from({ length: n - 1 }, (_, i) => {
        const pt = p.getPointAtLength(loop + ((total - loop) * (i + 1)) / n);
        return { x: pt.x, y: pt.y, n: i + 1 };
      }),
    );
  }, [transitDays, path]);

  // Site pin on the near-side disk (orthographic); polar sites sit on the bottom/top limb.
  const la = (lat * Math.PI) / 180;
  const lo = (lon * Math.PI) / 180;
  const pinVisible = Math.cos(la) * Math.cos(lo) >= -0.05 || Math.abs(lat) > 75;
  const pin = { x: M.x + M.r * 0.92 * Math.cos(la) * Math.sin(lo), y: M.y - M.r * 0.92 * Math.sin(la) };

  const craft = [0, 1, 2, 3, 4];
  return (
    <svg viewBox="0 0 1000 260" className={s.trajSvg} role="img" aria-label={`Launch ${dayTime(launch)}, touchdown ${dayTime(landing)}`}>
      <defs>
        <linearGradient id={`g${uid}`} x1="0" x2="1">
          <stop offset="0%" stopColor="var(--color-earth)" />
          <stop offset="60%" stopColor="var(--color-text)" />
          <stop offset="100%" stopColor="var(--color-sun)" />
        </linearGradient>
        <radialGradient id={`atmo${uid}`}>
          <stop offset="62%" stopColor="var(--color-earth)" stopOpacity="0.45" />
          <stop offset="100%" stopColor="var(--color-earth)" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`sunGlow${uid}`}>
          <stop offset="0%" stopColor="var(--color-sun)" stopOpacity="0.3" />
          <stop offset="100%" stopColor="var(--color-sun)" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`moonGlow${uid}`}>
          <stop offset="40%" stopColor="var(--color-sun)" stopOpacity="0.45" />
          <stop offset="100%" stopColor="var(--color-sun)" stopOpacity="0" />
        </radialGradient>
        {/* Sphere shading: light from the upper right (where the Sun is drawn). */}
        <radialGradient id={`shade${uid}`} cx="72%" cy="28%" r="85%">
          <stop offset="0%" stopColor="var(--color-surface)" stopOpacity="0" />
          <stop offset="55%" stopColor="var(--color-surface)" stopOpacity="0.25" />
          <stop offset="100%" stopColor="var(--color-surface)" stopOpacity="0.9" />
        </radialGradient>
        <clipPath id={`earthClip${uid}`}>
          <circle cx={E.x} cy={E.y} r={E.r} />
        </clipPath>
        <clipPath id={`moonClip${uid}`}>
          <circle cx={M.x} cy={M.y} r={M.r} />
        </clipPath>
      </defs>

      {STARS.map((st, i) => (
        <circle key={i} cx={st.x} cy={st.y} r={st.r} className={s.trajStar} style={{ opacity: st.o }} />
      ))}

      {/* The Sun, off to the upper right: the light source for the Moon's shading. */}
      <circle cx="988" cy="12" r="90" fill={`url(#sunGlow${uid})`} />
      <circle cx="988" cy="12" r="14" className={s.trajSun} />

      {/* Radio beam Moon → Earth (only when Earth is in view at touchdown). */}
      {contact && <path d={beam} className={s.trajBeam} />}

      {/* Path: faint dashed base + a gradient stroke that draws itself in (replays on change). */}
      <path ref={pathRef} d={path} className={s.trajArc} />
      <path key={`draw-${launch}`} d={path} pathLength={1} stroke={`url(#g${uid})`} className={s.trajDraw} />
      {ticks.map((t) => (
        <g key={t.n}>
          <circle cx={t.x} cy={t.y} r="2.5" className={s.trajTick} />
          <text x={t.x} y={t.y - 9} textAnchor="middle" className={s.trajTickLabel}>
            day {t.n}
          </text>
        </g>
      ))}

      {/* Earth: NASA Apollo 17 "Blue Marble" photo, with a night side away from the Sun and a thin atmosphere.
          In the photo the disk fills ~89% of the frame, so the image is drawn a bit larger than the circle. */}
      <circle cx={E.x} cy={E.y} r={E.r + 16} fill={`url(#atmo${uid})`} />
      <g clipPath={`url(#earthClip${uid})`}>
        <image href={EARTH_IMG} x={E.x - E.r / 0.89} y={E.y - E.r / 0.89} width={(2 * E.r) / 0.89} height={(2 * E.r) / 0.89} />
        <circle cx={E.x} cy={E.y} r={E.r} fill={`url(#shade${uid})`} />
      </g>
      <circle cx={E.x} cy={E.y} r={E.r} className={s.trajEarthRim} />

      {/* Moon: NASA image of the near side, shaded as a sphere; gold glow + rim when sunlit. */}
      <circle cx={M.x} cy={M.y} r={M.r + 26} fill={`url(#moonGlow${uid})`} className={cls(s.trajGlow, sunlit && s.trajGlowOn)} />
      <g clipPath={`url(#moonClip${uid})`}>
        <circle cx={M.x} cy={M.y} r={M.r} className={s.trajMoonBase} />
        {/* Equirectangular map: 360° wide → 2 × diameter, so the near side (−90°…+90°) fills the disk. */}
        <image href={MOON_IMG} x={M.x - 2 * M.r} y={M.y - M.r} width={4 * M.r} height={2 * M.r} preserveAspectRatio="none" />
        <circle cx={M.x} cy={M.y} r={M.r} fill={`url(#shade${uid})`} />
        <circle cx={M.x} cy={M.y} r={M.r} className={cls(s.trajNight, !sunlit && s.trajNightOn)} />
      </g>
      <circle cx={M.x} cy={M.y} r={M.r} className={cls(s.trajRim, sunlit && s.trajRimOn)} />
      {pinVisible && (
        <g>
          <circle cx={pin.x} cy={pin.y} r="4" className={s.trajPinRing} />
          <circle cx={pin.x} cy={pin.y} r="2.6" className={s.trajPin} />
        </g>
      )}

      {caption && (
        <text x={M.x} y={M.y + M.r + 30} textAnchor="middle" className={s.trajCaption}>
          {caption}
        </text>
      )}

      {/* Craft + trail (each dot starts a little later along the same path). */}
      {craft.map((i) => (
        <circle
          key={i}
          r={i === 0 ? 4.5 : 3.6 - i * 0.6}
          className={s.trajCraft}
          style={{ opacity: i === 0 ? 1 : 0.55 - i * 0.1 }}
          cx={still ? 500 : 0}
          cy={still ? 40 : 0}
        >
          {!still && <animateMotion dur="5s" repeatCount="indefinite" path={path} begin={`${-i * 0.06}s`} />}
        </circle>
      ))}

    </svg>
  );
}

/** One lunar month of launch days around the dial (≈ one Sun cycle at the site). */
const DIAL_DAYS = 30;

/** What you would land into if you launched on that day (at the chosen time of day). */
type DayState = { sun: boolean; earth: boolean; illumination: number } | undefined;
const stateWord = (st: DayState) =>
  !st ? 'loading' : st.sun && st.earth ? 'Sunlit and in contact' : st.sun ? 'Sunlit, no radio' : st.earth ? 'Dark, radio only' : 'Dark and silent';

/**
 * Lunar dial: 30 launch days around a ring. Outer gold band = Sun up at touchdown, inner blue
 * band = Earth in view at touchdown (read from the hourly report at each day's touchdown time).
 * Best launch days glow, carry a "★ BEST" flag, and pull the knob in while dragging (snap ±1 day).
 * Click or drag around the ring (or ← → keys) to pick a day. Hovering previews a day in the centre;
 * `highlightDay` (hovering a "best launch chance" button) does the same from outside.
 */
function LunarDial({
  start,
  earliestLaunch,
  launchMs,
  transitMs,
  samples,
  sampleStart,
  stepMs,
  bestDays,
  highlightDay,
  onPick,
}: {
  start: number;
  earliestLaunch: number;
  launchMs: number;
  transitMs: number;
  samples: SkyState[] | undefined;
  sampleStart: number;
  stepMs: number;
  bestDays: number[];
  highlightDay: number | null;
  onPick: (ms: number) => void;
}) {
  const C = 180;
  const SUN = [132, 154];
  const EARTH = [106, 128];
  const KNOB = 130;
  const step = 360 / DIAL_DAYS;
  const ref = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);
  const [hover, setHover] = useState<number | null>(null);

  const timeOfDay = launchMs - midnight(launchMs);
  const days = Array.from({ length: DIAL_DAYS }, (_, i) => {
    const day = start + i * DAY;
    const at = day + timeOfDay;
    const touch = at + transitMs;
    const x = samples?.[Math.round((touch - sampleStart) / stepMs)];
    const state: DayState = x ? { sun: x.sunVisible, earth: x.earthVisible, illumination: x.earth.illumination } : undefined;
    return { i, day, at, touch, state, off: at < earliestLaunch, best: bestDays.includes(day) && at >= earliestLaunch };
  });
  const sel = Math.round((midnight(launchMs) - start) / DAY);
  const selIn = sel >= 0 && sel < DIAL_DAYS;
  const outside = highlightDay !== null ? Math.round((highlightDay - start) / DAY) : null;
  const preview = hover ?? (outside !== null && outside >= 0 && outside < DIAL_DAYS ? outside : null);
  const shown = days[preview ?? (selIn ? sel : 0)];

  const xy = (r: number, deg: number) => {
    const a = (deg * Math.PI) / 180;
    return { x: C + r * Math.cos(a), y: C + r * Math.sin(a) };
  };
  const pt = (r: number, deg: number) => {
    const p = xy(r, deg);
    return `${p.x.toFixed(2)} ${p.y.toFixed(2)}`;
  };
  const seg = (ri: number, ro: number, i: number, pad = 0.7) => {
    const a1 = -90 + i * step + pad;
    const a2 = -90 + (i + 1) * step - pad;
    return `M ${pt(ro, a1)} A ${ro} ${ro} 0 0 1 ${pt(ro, a2)} L ${pt(ri, a2)} A ${ri} ${ri} 0 0 0 ${pt(ri, a1)} Z`;
  };
  const mid = (i: number) => -90 + (i + 0.5) * step;
  const indexAt = (clientX: number, clientY: number) => {
    const r = ref.current!.getBoundingClientRect();
    // viewBox is −40…400 (440 wide) around the 360 dial.
    const x = ((clientX - r.left) / r.width) * 440 - 40 - C;
    const y = ((clientY - r.top) / r.height) * 440 - 40 - C;
    const deg = ((Math.atan2(y, x) * 180) / Math.PI + 90 + 360) % 360;
    return Math.min(DIAL_DAYS - 1, Math.floor(deg / step));
  };
  // While dragging, a best day within one day "pulls" the knob onto it.
  const snap = (i: number) => {
    for (const d of [0, -1, 1]) if (days[i + d]?.best) return i + d;
    return i;
  };
  const choose = (i: number) => !days[i].off && onPick(days[i].at);

  return (
    <div
      className={s.dial}
      role="slider"
      tabIndex={0}
      aria-label="Launch day"
      aria-valuemin={0}
      aria-valuemax={DIAL_DAYS - 1}
      aria-valuenow={selIn ? sel : 0}
      aria-valuetext={`Launch ${dayTime(launchMs)}${days[sel]?.best ? ', best launch day' : ''}`}
      onKeyDown={(e) => {
        const d = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : 0;
        if (!d) return;
        e.preventDefault();
        onPick(launchMs + d * DAY);
      }}
    >
      <svg
        ref={ref}
        viewBox="-40 -40 440 440"
        className={s.dialSvg}
        onPointerDown={(e) => {
          dragging.current = true;
          ref.current?.setPointerCapture(e.pointerId);
          choose(indexAt(e.clientX, e.clientY));
        }}
        onPointerMove={(e) => {
          const i = indexAt(e.clientX, e.clientY);
          setHover(i);
          if (dragging.current) choose(snap(i));
        }}
        onPointerUp={() => (dragging.current = false)}
        onPointerCancel={() => (dragging.current = false)}
        onPointerLeave={() => !dragging.current && setHover(null)}
      >
        <defs>
          <linearGradient id="dialBestGrad" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--color-sun)" />
            <stop offset="100%" stopColor="var(--color-earth)" />
          </linearGradient>
        </defs>

        {/* Glowing halo behind best days (stronger when hovered from a "best chance" button). */}
        {days
          .filter((d) => d.best)
          .map((d) => (
            <path key={`halo-${d.day}`} d={seg(EARTH[0] - 6, SUN[1] + 6, d.i, 0)} fill="url(#dialBestGrad)" className={cls(s.dialHalo, outside === d.i && s.dialHaloStrong)} />
          ))}

        {days.map((d) => {
          const label = xy(173, mid(d.i));
          return (
            <g key={d.day} className={cls(s.dialDay, d.off && s.dialOff, preview === d.i && s.dialHover)}>
              <path d={seg(SUN[0], SUN[1], d.i)} className={cls(s.dialSeg, d.state?.sun && s.dialSun)} />
              <path d={seg(EARTH[0], EARTH[1], d.i)} className={cls(s.dialSeg, d.state?.earth && s.dialEarth)} />
              {!d.best && (d.i % 3 === 0 || new Date(d.day).getUTCDate() === 1) && (
                <text x={label.x} y={label.y} textAnchor="middle" dominantBaseline="middle" className={s.dialLabel}>
                  {new Date(d.day).getUTCDate() === 1 || d.i === 0 ? dayShort(d.day) : new Date(d.day).getUTCDate()}
                </text>
              )}
            </g>
          );
        })}

        {/* "★ BEST" flags outside the ring. */}
        {days
          .filter((d) => d.best)
          .map((d) => {
            const p = xy(184, mid(d.i));
            const tip = xy(158, mid(d.i));
            return (
              <g key={`flag-${d.day}`} className={s.dialFlag}>
                <line x1={tip.x} y1={tip.y} x2={p.x} y2={p.y} className={s.dialFlagLine} />
                <rect x={p.x - 34} y={p.y - 10} width="68" height="20" rx="10" className={s.dialFlagBox} />
                <text x={p.x} y={p.y + 1} textAnchor="middle" dominantBaseline="middle" className={s.dialFlagText}>
                  ★ {dayShort(d.day)}
                </text>
              </g>
            );
          })}

        {/* Knob: rotates to the chosen day. */}
        {selIn && (
          <g className={s.dialKnob} style={{ transform: `rotate(${(sel + 0.5) * step}deg)` }}>
            <line x1={C} y1={C - 92} x2={C} y2={C - KNOB + 8} className={s.dialHand} />
            <circle cx={C} cy={C - KNOB} r="9" className={cls(s.dialKnobDot, days[sel]?.best && s.dialKnobBest)} />
          </g>
        )}
      </svg>

      {/* Centre: the previewed day, or the chosen launch. */}
      <div className={s.dialCenter} aria-live="polite">
        {shown.best ? <span className={s.dialBestBadge}>★ Best day</span> : <span className={s.label}>{preview !== null && preview !== sel ? 'If you launch' : 'Launch'}</span>}
        <span key={shown.day} className={cls(s.dialDate, s.answerIn)}>
          {new Date(shown.at).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', timeZone: 'UTC' })}
        </span>
        <span className={s.dialSub}>
          land <span className="num">{dayShort(shown.touch)}</span>
        </span>
        {shown.state && (
          <span className={s.orbPair}>
            <SunOrb on={shown.state.sun} />
            <EarthPhase illumination={shown.state.illumination} on={shown.state.earth} />
          </span>
        )}
        <span className={s.dialSub}>{shown.off ? 'Too soon to launch' : stateWord(shown.state)}</span>
      </div>
    </div>
  );
}

type Milestone = { at: number; kind: 'sunrise' | 'sunset' | 'earthrise' | 'earthset' };
type Focus = { at: number; sun: boolean; earth: boolean } | null;

/** Hours → plain words: "17 hours", "1 day", "14 days". */
const human = (h: number) => {
  if (h < 24) return `${Math.max(1, Math.round(h))} hour${Math.round(h) === 1 ? '' : 's'}`;
  const d = Math.round(h / 24);
  return `${d} day${d === 1 ? '' : 's'}`;
};

/**
 * The mission after touchdown, as ordered moments (rows) + totals. Shared by Step 4's
 * "Your first days on the Moon" and Step 5's mission log, so both always show the same numbers.
 * Built from the provider's Sun / Earth windows for the lunar day (29.5 days) after touchdown.
 */
export function missionStory(landing: IsoTime, sunWindows: TimeWindow[], earthWindows: TimeWindow[], sun: boolean, earth: boolean) {
  const L = Date.parse(landing);
  const end = L + LUNAR_MS;
  const dayH = LUNAR.synodicDays * 24;
  // Window edges within 2 h of the data's start/end are where the data was CUT, not real
  // rises/sets (a window "ending" at the last sample is just clipped), so they are skipped.
  const EDGE = 2 * HOUR;
  const real = (t: number) => t > L + EDGE && t < end - EDGE;
  const raw: Milestone[] = [];
  for (const w of sunWindows) {
    if (real(Date.parse(w.start))) raw.push({ at: Date.parse(w.start), kind: 'sunrise' });
    if (real(Date.parse(w.end))) raw.push({ at: Date.parse(w.end), kind: 'sunset' });
  }
  for (const w of earthWindows) {
    if (real(Date.parse(w.start))) raw.push({ at: Date.parse(w.start), kind: 'earthrise' });
    if (real(Date.parse(w.end))) raw.push({ at: Date.parse(w.end), kind: 'earthset' });
  }
  raw.sort((a, b) => a.at - b.at);

  // Each moment + the state after it + how long that state lasts.
  let st = { sun, earth };
  const points: { at: number; kind: Milestone['kind'] | 'touchdown'; sun: boolean; earth: boolean }[] = [{ at: L, kind: 'touchdown', ...st }];
  for (const e of raw) {
    st = { sun: e.kind === 'sunrise' ? true : e.kind === 'sunset' ? false : st.sun, earth: e.kind === 'earthrise' ? true : e.kind === 'earthset' ? false : st.earth };
    points.push({ ...e, ...st });
  }
  const rows = points.map((p, i) => {
    const to = i + 1 < points.length ? points[i + 1].at : end;
    return { ...p, h: (to - p.at) / HOUR, last: i + 1 >= points.length };
  });

  // A "run" = consecutive stretches without the Sun (a night) or without Earth (out of contact),
  // e.g. Earth sets, then the Sun sets, then Earth rises: one 3-stretch out-of-contact run.
  const runFrom = (i: number, key: 'sun' | 'earth') => {
    let h = 0;
    let j = i;
    while (j < rows.length && !rows[j][key]) h += rows[j++].h;
    return { h, ongoing: j >= rows.length };
  };
  const longest = (key: 'sun' | 'earth') => {
    let best = { h: 0, ongoing: false };
    for (let i = 0; i < rows.length; i++) {
      if (rows[i][key] || (i > 0 && !rows[i - 1][key])) continue; // only start at the beginning of a run
      const r = runFrom(i, key);
      if (r.h > best.h) best = r;
    }
    return best;
  };
  const sunlitH = rows.filter((r) => r.sun).reduce((t, r) => t + r.h, 0);
  const earthH = rows.filter((r) => r.earth).reduce((t, r) => t + r.h, 0);
  const night = longest('sun');
  const silence = longest('earth');
  return { L, end, dayH, rows, runFrom, sunlitH, earthH, night, silence };
}
export type MissionStory = ReturnType<typeof missionStory>;
export { human };

/**
 * "Your first days on the Moon": what happens after you land, told as a short story.
 * Built from the provider's Sun / Earth windows for the lunar day (29.5 days) after touchdown.
 * The numbers at the top are added up from the SAME stretches as the story, so they always agree;
 * a stretch still going when the lunar day ends is marked "+" (its real length is longer). Each moment is a dot with its date and one or two
 * plain sentences; the coloured line under it lasts as long as that stretch (gold = Sun up,
 * blue = Earth in sight, both = gold→blue, grey = neither). Clicking a moment shows it on the
 * flight drawing above (onFocus).
 */
export function FirstDays({
  landing,
  sunWindows,
  earthWindows,
  sun,
  earth,
  focus,
  onFocus,
}: {
  landing: IsoTime;
  sunWindows: TimeWindow[];
  earthWindows: TimeWindow[];
  sun: boolean;
  earth: boolean;
  focus: Focus;
  /** Omit to make the moments read-only (no flight drawing to show them on). */
  onFocus?: (f: Focus) => void;
}) {
  const { L, dayH, rows, runFrom, sunlitH, earthH, night, silence } = missionStory(landing, sunWindows, earthWindows, sun, earth);
  const plus = (x: { ongoing: boolean }) => (x.ongoing ? '+' : '');

  const story = (r: (typeof rows)[number], i: number) => {
    const run = r.kind === 'sunset' ? runFrom(i, 'sun') : r.kind === 'earthset' ? runFrom(i, 'earth') : { h: r.h, ongoing: r.last };
    const lasts = `${human(run.h)}${run.ongoing ? ' or more' : ''}`;
    switch (r.kind) {
      case 'touchdown':
        return {
          title: 'You land',
          text:
            r.sun && r.earth
              ? 'The Sun is up and Earth is in sight: the solar panels work and you can talk to mission control.'
              : r.sun
                ? "The Sun is up, but Earth is out of sight: the solar panels work, but you can't talk to mission control yet."
                : r.earth
                  ? "It's dark, but Earth is in sight: you can talk to mission control, but the solar panels make no power."
                  : "It's dark and Earth is out of sight: no solar power and no contact with mission control.",
          warn: undefined,
          long: false,
        };
      case 'sunset':
        return {
          title: 'The Sun sets',
          text: 'The solar panels stop making power.',
          warn: `Night lasts ${lasts}: the battery must keep the lander alive until sunrise.`,
          long: run.h >= 24,
        };
      case 'sunrise':
        return { title: 'The Sun rises', text: 'The solar panels start making power again.', warn: undefined, long: false };
      case 'earthset':
        return { title: 'Earth goes below the horizon', text: 'There is no direct line to Earth any more.', warn: `You can't talk to mission control for ${lasts}.`, long: run.h >= 24 };
      case 'earthrise':
        return { title: 'Earth comes back into sight', text: 'You can talk to mission control again.', warn: undefined, long: false };
    }
  };
  const icon = { touchdown: 'pin', sunrise: 'sun', sunset: 'moon', earthrise: 'earth', earthset: 'earth' } as const;
  const dotTone = { touchdown: s.fdNodeStart, sunrise: s.fdSun, sunset: s.fdDark, earthrise: s.fdEarth, earthset: s.fdDark } as const;
  const lineTone = (x: { sun: boolean; earth: boolean }) => (x.sun && x.earth ? s.fdLineBoth : x.sun ? s.fdBarSun : x.earth ? s.fdBarEarth : s.fdBarDark);

  // Numbers at the top, in plain words. A lunar day is 29.5 Earth days.
  const whole = (h: number) => h >= dayH - 3;
  const ofDays = (h: number) => `about ${Math.round(h / 24)} of 29½ days`;

  return (
    <div className={s.fdWrap}>
      <div className={s.fdStats}>
        <div className={s.fdStat}>
          <span className={s.fdStatLabel}>
            <Icon name="sun" size={14} /> Sunlight
          </span>
          <span className={s.fdStatValue}>{whole(sunlitH) ? 'All the time' : sunlitH <= 0 ? 'None' : ofDays(sunlitH)}</span>
          <span className={s.fdStatHint}>{whole(sunlitH) ? 'The Sun never sets this lunar day' : 'Time the solar panels can work'}</span>
        </div>
        <div className={s.fdStat}>
          <span className={s.fdStatLabel}>
            <Icon name="earth" size={14} /> Earth in sight
          </span>
          <span className={s.fdStatValue}>{whole(earthH) ? 'All the time' : earthH <= 0 ? 'Never' : ofDays(earthH)}</span>
          <span className={s.fdStatHint}>Time you can talk to mission control</span>
        </div>
        <div className={cls(s.fdStat, silence.h >= 24 && s.fdStatWarn)}>
          <span className={s.fdStatLabel}>Longest time out of contact</span>
          <span className={s.fdStatValue}>{silence.h > 0 ? `${human(silence.h)}${plus(silence)}` : 'None'}</span>
          <span className={s.fdStatHint}>
            {silence.h <= 0 ? 'Earth stays in sight' : silence.ongoing ? 'Still going when this lunar day ends' : 'Earth below the horizon in one go'}
          </span>
        </div>
        <div className={cls(s.fdStat, night.h >= 24 && s.fdStatWarn)}>
          <span className={s.fdStatLabel}>Longest night</span>
          <span className={s.fdStatValue}>{night.h > 0 ? `${human(night.h)}${plus(night)}` : 'None'}</span>
          <span className={s.fdStatHint}>{night.h <= 0 ? 'The Sun stays up' : night.ongoing ? 'Still going when this lunar day ends' : 'The battery must last this long'}</span>
        </div>
      </div>

      <ol className={s.fdStory} key={landing}>
        {rows.map((r, i) => {
          const t = story(r, i);
          const on = focus ? focus.at === r.at : r.kind === 'touchdown';
          return (
            <li key={`${r.kind}-${r.at}`} className={s.fdRow} style={{ animationDelay: `${i * 90}ms` }}>
              <button
                type="button"
                className={cls(s.fdMoment, on && onFocus && s.fdMomentOn, !onFocus && s.fdMomentStatic)}
                aria-pressed={onFocus ? on : undefined}
                disabled={!onFocus}
                onClick={() => onFocus?.(r.kind === 'touchdown' ? null : { at: r.at, sun: r.sun, earth: r.earth })}
                title={onFocus ? 'Show this moment on the flight drawing' : undefined}
              >
                <span className={cls(s.fdIcon, dotTone[r.kind])}>
                  <Icon name={icon[r.kind]} size={16} />
                </span>
                <span className={s.fdBody}>
                  <span className={s.fdWhen}>
                    <span className="num">{dayShort(r.at)}</span>
                    {r.kind !== 'touchdown' && <> · {human((r.at - L) / HOUR)} after landing</>}
                  </span>
                  <span className={s.fdTitle}>{t.title}</span>
                  <span className={s.fdText}>{t.text}</span>
                  {t.warn && (
                    <span className={cls(s.fdWarnLine, t.long && s.fdWarnStrong)}>
                      {t.long && <Icon name="alert" size={13} />} {t.warn}
                    </span>
                  )}
                </span>
              </button>
              {/* The stretch that follows: its line grows with how long it lasts. */}
              <span className={s.fdGap} style={{ height: `${Math.min(110, 26 + r.h / 4)}px` }}>
                <i className={cls(s.fdLine, lineTone(r))} />
                <span className={s.fdGapText}>
                  {r.last ? `${human(r.h)}+ until the end of this lunar day` : `${human(r.h)} later…`}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function DatePage() {
  const params = usePlannerParams();
  const { site, loading } = useMission();

  // Earliest launch = next full hour from now (fixed for this visit so cache keys stay stable).
  const [earliestLaunch] = useState(() => Math.ceil(Date.now() / HOUR) * HOUR);
  const { data: probe, error: eProbe } = usePlanLaunch(site, iso(earliestLaunch));
  const transitMs = probe ? probe.transitDays * DAY : undefined;
  const eL = probe ? Date.parse(probe.landingDate) : undefined; // earliest possible touchdown

  // Best windows of the next three lunar days after the earliest touchdown → launch chances.
  // ?lunar=ISO (from Compare → Dates → "Choose"): plan inside that lunar day instead of the soonest.
  const [sp] = useSearchParams();
  const lunar = Date.parse(sp.get('lunar') ?? '');
  const base = eL === undefined ? undefined : Number.isFinite(lunar) ? Math.max(eL, lunar) : eL;
  const range = (k: number) => (base === undefined ? ['', ''] : [iso(base + k * LUNAR_MS), iso(base + (k + 1) * LUNAR_MS)]);
  const live = base !== undefined ? site : undefined;
  const { data: c0, error: eC0 } = useMetrics(live, range(0)[0], range(0)[1], params);
  const { data: c1 } = useMetrics(live, range(1)[0], range(1)[1], params);
  const { data: c2 } = useMetrics(live, range(2)[0], range(2)[1], params);
  const toLaunch = (w: TimeWindow | null | undefined) =>
    w && transitMs !== undefined ? Math.max(earliestLaunch, Math.round((Date.parse(w.start) - transitMs) / HOUR) * HOUR) : undefined;
  const chances = [c0, c1, c2]
    .map((m) => (m?.bestWindow ? { launch: toLaunch(m.bestWindow)!, window: m.bestWindow } : undefined))
    .filter((c): c is { launch: number; window: TimeWindow } => !!c);
  const suggested = c0 && transitMs !== undefined ? iso(toLaunch(c0.bestWindow) ?? earliestLaunch) : undefined;

  const [launch, setLaunch] = useState<IsoTime>();
  // Hovering a "best launch chance" lights it up on the dial.
  const [chanceHover, setChanceHover] = useState<number | null>(null);
  // A later moment picked in "Your first days" (null = touchdown).
  const [focus, setFocus] = useState<Focus>(null);
  useEffect(() => {
    if (!launch && suggested) setLaunch(suggested);
  }, [launch, suggested]);
  const pick = (ms: number) => setLaunch(iso(Math.max(earliestLaunch, ms)));

  const { data: plan } = usePlanLaunch(site, launch);
  const landing = plan?.landingDate;
  const landingMs = landing ? Date.parse(landing) : undefined;

  // Lunar dial: 30 launch days per turn, starting today; arrows move a whole turn. It follows
  // the chosen launch (slip buttons / chances jump it to the right turn).
  const [turn, setTurn] = useState(0);
  const launchDay = launch ? midnight(Date.parse(launch)) : undefined;
  useEffect(() => {
    if (launchDay !== undefined) setTurn(Math.max(0, Math.floor((launchDay - midnight(earliestLaunch)) / (DIAL_DAYS * DAY))));
  }, [launchDay, earliestLaunch]);
  const dialStart = midnight(earliestLaunch) + turn * DIAL_DAYS * DAY;
  const dialFrom = transitMs !== undefined ? iso(dialStart + transitMs) : '';
  const { data: dialReport } = useDayReport(transitMs !== undefined ? site : undefined, dialFrom, DIAL_DAYS + 1, params);

  // Touchdown: its sky, the lunar day around it, and what comes after.
  const { data: sky, error: eSky } = useSky(landing ? site : undefined, landing ?? '', params);
  const viewFrom = landingMs !== undefined ? iso(midnight(landingMs - 7 * DAY)) : '';
  const viewTo = landingMs !== undefined ? iso(midnight(landingMs - 7 * DAY) + LUNAR_MS) : '';
  useEffect(() => setFocus(null), [landing]);
  const { data: afterReport, error: eAfter } = useDayReport(landing ? site : undefined, landing ?? '', LUNAR.synodicDays, params);
  const { data: viewMetrics } = useMetrics(landing ? site : undefined, viewFrom, viewTo, params);
  const { data: after } = useMetrics(landing ? site : undefined, landing ?? '', landingMs !== undefined ? iso(landingMs + LUNAR_MS) : '', params);

  if (loading) return <LoadingState title="Loading site…" />;
  if (!site)
    return (
      <Page width="narrow">
        <EmptyState
          title="No site chosen"
          action={
            <Button variant="primary" to={missionUrl.chooseSite()}>
              Choose a site
            </Button>
          }
        />
      </Page>
    );

  const launchMs = launch ? Date.parse(launch) : undefined;
  const best = viewMetrics?.bestWindow ?? null;
  const inBest = !!(best && landing && landing >= best.start && landing <= best.end);
  const isSuggested = launch !== undefined && launch === suggested;
  const slipDays = launch && suggested ? Math.round((Date.parse(launch) - Date.parse(suggested)) / DAY) : 0;

  const sun = sky?.sunVisible ?? false;
  const earth = sky?.earthVisible ?? false;
  const verdict = !sky ? 'Checking touchdown…' : sun && earth ? 'Good to land' : sun ? 'Power, but no radio' : earth ? 'Lands in the dark' : 'Dark and out of contact';
  const since = (target: IsoTime | null | undefined) => (target && landing ? formatDuration(hoursBetween(landing, target)) : null);
  const sunLine = !after ? null : sun ? (
    since(after.nextSunset) ? (
      <>
        Sunlight lasts <span className="num">{since(after.nextSunset)}</span> after touchdown
      </>
    ) : (
      'Sunlight lasts the whole lunar day'
    )
  ) : since(after.nextSunrise) ? (
    <>
      Sunrise <span className="num">{since(after.nextSunrise)}</span> after touchdown
    </>
  ) : (
    'No sunrise this lunar day'
  );
  const earthLine = !after ? null : earth ? (
    since(after.nextEarthset) ? (
      <>
        Radio contact lasts <span className="num">{since(after.nextEarthset)}</span>
      </>
    ) : (
      'Radio contact for the whole lunar day'
    )
  ) : site.region === 'farside' ? (
    'Earth never rises on the far side'
  ) : since(after.nextEarthrise) ? (
    <>
      Earth rises <span className="num">{since(after.nextEarthrise)}</span> after touchdown
    </>
  ) : (
    'No Earth contact this lunar day'
  );

  return (
    <Page>
      <StepHeader
        step="date"
        title="When do you"
        accent="launch?"
        back={{ to: missionUrl.stand(site.id), label: site.name }}
        meta={<span className="num">{formatLatLon(site.lat, site.lon)}</span>}
        aside={<SettingsButton />}
      />
      <DataError errors={[eProbe, eC0, eSky, eAfter]} />

      {/* 1. The answer + the flight */}
      <section className={s.traj}>
        <div className={s.trajHead}>
          <div className={s.trajAnswerBox}>
            <p className={s.label}>{isSuggested ? 'Recommended launch' : 'Your launch'}</p>
            {launch ? (
              <p key={launch} className={cls(s.trajAnswer, s.answerIn)}>
                {dayTime(launch)}
              </p>
            ) : (
              <p className={s.trajAnswer}>Finding the best launch…</p>
            )}
            {landing && (
              <p className={s.bodyLine}>
                Lands <span className="num">{dayTime(landing)}</span> · {verdict}
                {inBest && ' · inside the best window'}
              </p>
            )}
          </div>
          {chances.length > 0 && (
            <div className={s.chances}>
              <p className={s.chancesHead}>
                <span className={s.label}>Best launch chances</span>
                <span className={s.explainEnd}>
                  <Explain id="best-window" />
                </span>
              </p>
              <div className={s.chanceRow}>
                {chances.map((c, i) => (
                  <button
                    key={c.launch}
                    type="button"
                    className={cls(s.chance, launchMs === c.launch && s.chanceOn)}
                    onClick={() => pick(c.launch)}
                    onMouseEnter={() => setChanceHover(midnight(c.launch))}
                    onMouseLeave={() => setChanceHover(null)}
                    onFocus={() => setChanceHover(midnight(c.launch))}
                    onBlur={() => setChanceHover(null)}
                  >
                    <span className={s.chanceStar}>★</span>
                    <span className="num">{dayShort(c.launch)}</span>
                    <span>{i === 0 ? 'soonest' : i === 1 ? 'next lunar day' : 'one after'}</span>
                    <span className={s.chanceLen}>
                      <span className="num">{formatDuration(c.window.durationH)}</span> window
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        {launch && landing && plan ? (
          <>
            <Trajectory
              launch={launch}
              landing={landing}
              transitDays={plan.transitDays}
              sunlit={focus ? focus.sun : sun}
              contact={focus ? focus.earth : earth}
              lat={site.lat}
              lon={site.lon}
              caption={focus && landingMs !== undefined ? `Showing ${dayShort(focus.at)} · touchdown +${formatDuration((focus.at - landingMs) / HOUR)}` : undefined}
            />
            <div className={s.trajLabels}>
              <span key={`l-${launch}`} className={s.answerIn}>
                <span className={s.label}>Launch · Earth</span>
                <span className="num">{dayTime(launch)}</span>
              </span>
              <span className={s.trajMid}>
                <span className={s.label}>In transit</span>
                <span className="num">{plan.transitDays} days</span>
              </span>
              <span key={`t-${landing}`} className={cls(s.answerIn, s.trajRight)}>
                <span className={s.label}>Touchdown · {site.name}</span>
                <span className="num">{dayTime(landing)}</span>
              </span>
            </div>
            <p className={s.trajCredit}>{IMAGE_CREDIT}</p>
          </>
        ) : (
          <LoadingState compact title="Planning the flight…" />
        )}
      </section>

      <div className={s.dateCols}>
        {/* 2. Lunar dial: pick the launch day */}
        <section className={s.bodyCard}>
          <div className={s.bodyHead}>
            <Pill tone="neutral" icon="orbit" label="Pick a launch day" />
            <span className={s.grow} />
            {slipDays !== 0 && <Pill tone="warn" icon="clock" label={`Slipped ${slipDays > 0 ? '+' : '−'}${Math.abs(slipDays)} day${Math.abs(slipDays) === 1 ? '' : 's'}`} />}
          </div>
          <div className={s.dialWrap}>
            {launchMs !== undefined && transitMs !== undefined ? (
              <LunarDial
                start={dialStart}
                earliestLaunch={earliestLaunch}
                launchMs={launchMs}
                transitMs={transitMs}
                samples={dialReport?.samples}
                sampleStart={Date.parse(dialFrom)}
                stepMs={(dialReport?.stepMinutes ?? 60) * 60_000}
                bestDays={chances.map((c) => midnight(c.launch))}
                highlightDay={chanceHover}
                onPick={pick}
              />
            ) : (
              <LoadingState compact />
            )}
            <div className={s.dialSide}>
              <p className={s.bodyLine}>Each slice of the ring is one launch day. It shows what you would land into:</p>
              <div className={s.dialLegend}>
                <span>
                  <i className={cls(s.dialSw, s.dialSwSun)} /> Outer ring: sunlight at landing
                </span>
                <span>
                  <i className={cls(s.dialSw, s.dialSwEarth)} /> Inner ring: radio at landing
                </span>
                <span>
                  <i className={s.dialBestSw} /> ★ Best launch day (glows, the knob snaps to it)
                </span>
              </div>
              <p className={s.bodyLine}>Click or drag around the ring, or use the arrow keys.</p>
              <div className={s.calTime}>
                <button type="button" className={s.stepBtn} aria-label="Previous 30 days" disabled={turn === 0} onClick={() => setTurn((t) => Math.max(0, t - 1))}>
                  ‹
                </button>
                <span className="num">
                  {dayShort(dialStart)} – {dayShort(dialStart + (DIAL_DAYS - 1) * DAY)}
                </span>
                <button type="button" className={s.stepBtn} aria-label="Next 30 days" disabled={turn >= 3} onClick={() => setTurn((t) => Math.min(3, t + 1))}>
                  ›
                </button>
              </div>
              {launchMs !== undefined && (
                <div className={s.calTime}>
                  <span className={s.label}>Launch time</span>
                  <button type="button" className={s.stepBtn} aria-label="One hour earlier" onClick={() => pick(launchMs - HOUR)} disabled={launchMs - HOUR < earliestLaunch}>
                    −
                  </button>
                  <span className="num">
                    {new Date(launchMs).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })} UTC
                  </span>
                  <button type="button" className={s.stepBtn} aria-label="One hour later" onClick={() => pick(launchMs + HOUR)}>
                    +
                  </button>
                </div>
              )}
            </div>
          </div>
          {launchMs !== undefined && (
            <div className={s.slipRow}>
              <span className={s.label}>Mission slipped?</span>
              {[1, 3, 7].map((d) => (
                <button key={d} type="button" className={s.slipBtn} onClick={() => pick(launchMs + d * DAY)}>
                  +{d} {d === 1 ? 'day' : 'days'}
                </button>
              ))}
              {slipDays !== 0 && suggested && (
                <button type="button" className={cls(s.slipBtn, s.slipReset)} onClick={() => setLaunch(suggested)}>
                  Back to recommended
                </button>
              )}
            </div>
          )}
          {plan && <p className={s.bodyLine}>{plan.assumption}</p>}
        </section>

        {/* Verdict at touchdown */}
        {/* No box: same content, sitting straight on the page (no border, background or glow). */}
        <section className={cls(s.bodyCard, s.noBox)}>
          <div className={s.bodyHead}>
            <Pill tone={inBest ? 'good' : 'neutral'} icon={inBest ? 'check' : 'pin'} label={inBest ? 'Inside the best window' : 'At touchdown'} />
            <span className={s.grow} />
            {sky && <SourceBadge source={sky.source} />}
          </div>
          <div className={s.answerRow}>
            <p key={verdict} className={cls(s.bigNum, s.answerIn)}>
              {verdict}
            </p>
            {sky && (
              <span className={s.orbPair}>
                <SunOrb on={sun} />
                <EarthPhase illumination={sky.earth.illumination} on={earth} />
              </span>
            )}
          </div>
          {sunLine && (
            <p className={s.bodyLine}>
              <i className={cls(s.tlDot, sun && s.tlDotSun)} /> {sunLine}
            </p>
          )}
          {earthLine && (
            <p className={s.bodyLine}>
              <i className={cls(s.tlDot, earth && s.tlDotEarth)} /> {earthLine}
            </p>
          )}
          {sky && !inBest && suggested && !isSuggested && (
            <Button variant="secondary" leadingIcon="sun" icon={null} onClick={() => setLaunch(suggested)}>
              Use the recommended launch
            </Button>
          )}
          {site.region === 'farside' ? <Explain id="farside" /> : site.region.endsWith('pole') ? <Explain id="low-sun" /> : <Explain id="libration" />}
        </section>
      </div>

      {/* 3. What happens after you land */}
      <section className={s.timeline}>
        <div className={s.timelineHead}>
          <div>
            <p className={s.label}>Your first days on the Moon</p>
            <p className={s.bodyLine}>What happens after you land, in order. Click a moment to see it on the flight drawing above.</p>

          </div>
        </div>
        {afterReport && landing && sky ? (
          <FirstDays
            landing={landing}
            sunWindows={afterReport.sunWindows}
            earthWindows={afterReport.earthWindows}
            sun={sun}
            earth={earth}
            focus={focus}
            onFocus={setFocus}
          />
        ) : (
          <LoadingState compact />
        )}
        <div className={s.timelineFoot}>
          <Button variant="secondary" leadingIcon="compare" icon={null} to={missionUrl.compare([site.id], 'dates')}>
            Compare dates
          </Button>
          <span className={s.grow} />
          {launch && (
            <Button variant="primary" to={missionUrl.launch(site.id, launch)}>
              Launch
            </Button>
          )}
        </div>
      </section>
    </Page>
  );
}
