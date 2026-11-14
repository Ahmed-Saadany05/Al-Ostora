/**
 * Owner: Aser. The Stand page timeline: smooth Sun / Earth ribbons over the lunar day, drag or
 * arrow keys to scrub, hover preview, and the "Best time to land" callout. Used in the bottom
 * time dock of the 3D Stand page.
 */
import { useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { formatDuration, formatUtc, hoursBetween } from '@/shared/format';
import type { IsoTime, SkyState, TimeWindow } from '@/shared/types';
import { Icon } from '@/shared/ui';
import s from './flow.module.css';

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
  slim = false,
}: {
  from: IsoTime;
  to: IsoTime;
  samples: SkyState[];
  stepMinutes: number;
  now: IsoTime;
  best: TimeWindow | null;
  onSelect: (ms: number) => void;
  onScrubStart: () => void;
  /** Thinner ribbons and tighter spacing (the 3D Stand page's time dock). */
  slim?: boolean;
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
    <div className={cls(s.tlGrid, slim && s.tlSlim)}>
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

