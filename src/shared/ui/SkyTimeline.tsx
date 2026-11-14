/**
 * SKY TIMELINE — when the Sun and Earth are up over a time range (owner: Pink).
 * Replaces the block strip: two thin continuous lanes (Sun, Earth), the best window as a soft band
 * with its length, a "now" needle and day labels.
 *
 *  size="compact"  thin bar; hovering thickens the lanes and shows day labels and a time readout
 *                  as an overlay (no layout shift, so it fits cards and tabs).
 *  size="full"     taller lanes, legend, day labels and the readout always on.
 *
 * Interaction (only when a handler is given):
 *  - click → onSelectTime(t). Callers usually pass `timelapseTo` so the sky sweeps there.
 *  - drag  → onScrub(t) continuously; without onScrub, onSelectTime(t) where it is let go.
 *  - keys  → ←/→ one hour, Shift+←/→ one day, Home/End.
 */
import { useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { formatDuration } from '../format';
import type { IsoTime, TimeWindow } from '../types';
import s from './SkyTimeline.module.css';

export interface SkyTimelineProps {
  start: IsoTime;
  end: IsoTime;
  sunWindows: TimeWindow[];
  earthWindows: TimeWindow[];
  /** Best landing window: drawn as a bracket with its length. */
  highlight?: TimeWindow | null;
  /** The needle (current sky time, or touchdown). */
  now?: IsoTime;
  onSelectTime?: (time: IsoTime) => void;
  onScrub?: (time: IsoTime) => void;
  size?: 'compact' | 'full';
  /** Black-and-white lanes (Sun bright, Earth dim) for quiet chrome such as the Moon view's tab. */
  mono?: boolean;
  /** Accessible name, e.g. "Timeline for Malapert Massif". */
  label?: string;
  className?: string;
}

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const dayLabel = (ms: number) => new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const timeLabel = (ms: number) =>
  `${dayLabel(ms)} · ${new Date(ms).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })} UTC`;
const inAny = (ws: TimeWindow[], t: number) => ws.some((w) => t >= Date.parse(w.start) && t <= Date.parse(w.end));

export function SkyTimeline({
  start,
  end,
  sunWindows,
  earthWindows,
  highlight,
  now,
  onSelectTime,
  onScrub,
  size = 'compact',
  mono,
  label = 'Timeline',
  className,
}: SkyTimelineProps) {
  const t0 = Date.parse(start);
  const span = Math.max(1, Date.parse(end) - t0);
  const pct = (ms: number) => Math.min(100, Math.max(0, ((ms - t0) / span) * 100));
  const interactive = Boolean(onSelectTime || onScrub);

  const track = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; moved: boolean } | null>(null);
  const [hover, setHover] = useState<number | null>(null); // ms under the pointer

  // Day labels: whole UTC days, thinned so there are at most ~6.
  const ticks = useMemo(() => {
    const first = Math.ceil(t0 / DAY) * DAY;
    const days = Math.floor((t0 + span - first) / DAY) + 1;
    const every = Math.max(1, Math.ceil(days / 6));
    const out: number[] = [];
    for (let i = 0; i < days; i += every) out.push(first + i * DAY);
    return out;
  }, [t0, span]);

  const timeAt = (clientX: number) => {
    const r = track.current!.getBoundingClientRect();
    const k = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    return Math.round((t0 + k * span) / (15 * 60_000)) * 15 * 60_000; // snap to 15 min
  };
  const iso = (ms: number) => new Date(ms).toISOString();

  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!interactive) return;
    drag.current = { x: e.clientX, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const t = timeAt(e.clientX);
    setHover(t);
    const d = drag.current;
    if (!d) return;
    if (!d.moved && Math.abs(e.clientX - d.x) < 4) return;
    d.moved = true;
    onScrub?.(iso(t));
  };
  const onUp = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    const t = iso(timeAt(e.clientX));
    // A click picks a moment; a drag has already scrubbed live (or picks where it was let go).
    if (!d.moved || !onScrub) onSelectTime?.(t);
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!onSelectTime) return;
    const base = now ? Date.parse(now) : t0;
    const step = e.shiftKey ? DAY : HOUR;
    const next =
      e.key === 'ArrowRight' ? base + step : e.key === 'ArrowLeft' ? base - step : e.key === 'Home' ? t0 : e.key === 'End' ? t0 + span : null;
    if (next === null) return;
    e.preventDefault();
    onSelectTime(iso(Math.min(t0 + span, Math.max(t0, next))));
  };

  const lane = (ws: TimeWindow[], kind: 'sun' | 'earth') => (
    <div className={[s.lane, s[kind]].join(' ')}>
      {ws.map((w) => {
        const a = pct(Date.parse(w.start));
        const b = pct(Date.parse(w.end));
        return b > a ? <span key={w.start} className={s.seg} style={{ left: `${a}%`, width: `${b - a}%` }} /> : null;
      })}
    </div>
  );

  const readout = hover ?? (now ? Date.parse(now) : null);
  const nowPct = now ? pct(Date.parse(now)) : null;
  const best = highlight ? { a: pct(Date.parse(highlight.start)), b: pct(Date.parse(highlight.end)) } : null;

  return (
    <div className={[s.root, s[size], mono && s.mono, interactive && s.interactive, className].filter(Boolean).join(' ')}>
      {size === 'full' && (
        <div className={s.legend} aria-hidden>
          <span>
            <i className={s.keySun} /> Sun up
          </span>
          <span>
            <i className={s.keyEarth} /> Earth up
          </span>
          {highlight && (
            <span>
              <i className={s.keyBest} /> Best window <b className="num">· {formatDuration(highlight.durationH)}</b>
            </span>
          )}
          <span className={s.grow} />
          {readout !== null && (
            <span className={['num', s.legendTime].join(' ')}>
              {timeLabel(readout)}
              {hover !== null && (
                <>
                  {' · '}
                  <b className={inAny(sunWindows, hover) ? s.onSun : s.off}>Sun {inAny(sunWindows, hover) ? 'up' : 'down'}</b>
                  {' · '}
                  <b className={inAny(earthWindows, hover) ? s.onEarth : s.off}>Earth {inAny(earthWindows, hover) ? 'up' : 'down'}</b>
                </>
              )}
            </span>
          )}
        </div>
      )}

      <div
        ref={track}
        className={s.track}
        role={onSelectTime ? 'slider' : 'img'}
        aria-label={label}
        aria-valuemin={onSelectTime ? t0 : undefined}
        aria-valuemax={onSelectTime ? t0 + span : undefined}
        aria-valuenow={onSelectTime && now ? Date.parse(now) : undefined}
        aria-valuetext={now ? timeLabel(Date.parse(now)) : undefined}
        tabIndex={onSelectTime ? 0 : undefined}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={() => (drag.current = null)}
        onPointerLeave={() => setHover(null)}
        onKeyDown={onKey}
      >
        {best && (
          <span
            className={s.best}
            style={{ left: `${best.a}%`, width: `${best.b - best.a}%` }}
            title={`Best window · ${formatDuration(highlight!.durationH)}`}
          />
        )}
        <div className={s.lanes}>
          {lane(sunWindows, 'sun')}
          {lane(earthWindows, 'earth')}
        </div>
        {ticks.map((t) => (
          <span key={t} className={s.tickMark} style={{ left: `${pct(t)}%` }} />
        ))}
        {nowPct !== null && <span className={s.needle} style={{ left: `${nowPct}%` }} />}
        {hover !== null && interactive && <span className={s.ghost} style={{ left: `${pct(hover)}%` }} />}
        {/* Compact: the readout floats above while hovering. */}
        {size === 'compact' && hover !== null && (
          <span className={['num', s.tip].join(' ')} style={{ left: `${Math.min(88, Math.max(12, pct(hover)))}%` }}>
            {timeLabel(hover)}
            <i className={inAny(sunWindows, hover) ? s.tipSun : s.tipOff} />
            <i className={inAny(earthWindows, hover) ? s.tipEarth : s.tipOff} />
          </span>
        )}
      </div>

      <div className={s.days} aria-hidden>
        {ticks.map((t) => (
          <span key={t} className="num" style={{ left: `${pct(t)}%` }}>
            {dayLabel(t)}
          </span>
        ))}
      </div>
    </div>
  );
}
