import { formatUtc } from '../format';
import type { IsoTime, TimeWindow } from '../types';
import s from './TimelineStrip.module.css';

interface TimelineStripProps {
  start: IsoTime;
  end: IsoTime;
  sunWindows: TimeWindow[];
  earthWindows: TimeWindow[];
  /** Outlined range, e.g. the best landing window. */
  highlight?: TimeWindow | null;
  /** Vertical marker for the current time. */
  now?: IsoTime;
  /** Number of cells across (default 60 ≈ half-day cells over a lunar day). */
  cells?: number;
  /** Date labels under the strip. */
  ticks?: number;
  /** Click a cell to jump to that time. */
  onSelectTime?: (time: IsoTime) => void;
  size?: 'md' | 'sm';
}

/**
 * Two rows of cells — Sun up / Earth up — over a time range, as in the compare cards.
 * Legend words are rendered by the caller (or use <TimelineLegend/>).
 */
export function TimelineStrip({
  start,
  end,
  sunWindows,
  earthWindows,
  highlight,
  now,
  cells = 60,
  ticks = 5,
  onSelectTime,
  size = 'md',
}: TimelineStripProps) {
  const t0 = Date.parse(start);
  const span = Math.max(1, Date.parse(end) - t0);
  const cellMs = span / cells;
  const inAny = (ws: TimeWindow[], t: number) => ws.some((w) => t >= Date.parse(w.start) && t <= Date.parse(w.end));
  const pct = (iso: IsoTime) => Math.min(100, Math.max(0, ((Date.parse(iso) - t0) / span) * 100));
  const mids = Array.from({ length: cells }, (_, i) => t0 + (i + 0.5) * cellMs);

  const row = (ws: TimeWindow[], kind: 'sun' | 'earth') => (
    <div className={s.row} style={{ gridTemplateColumns: `repeat(${cells}, 1fr)` }}>
      {mids.map((t) => {
        const on = inAny(ws, t);
        const label = `${kind === 'sun' ? 'Sun' : 'Earth'} ${on ? 'up' : 'down'} · ${formatUtc(new Date(t).toISOString())}`;
        return onSelectTime ? (
          <button
            key={t}
            type="button"
            className={[s.cell, on && s[kind]].filter(Boolean).join(' ')}
            title={label}
            aria-label={label}
            onClick={() => onSelectTime(new Date(t).toISOString())}
          />
        ) : (
          <span key={t} className={[s.cell, on && s[kind]].filter(Boolean).join(' ')} title={label} />
        );
      })}
    </div>
  );

  return (
    <div className={[s.strip, s[size]].join(' ')}>
      <div className={s.rows}>
        {row(sunWindows, 'sun')}
        {row(earthWindows, 'earth')}
        {highlight && (
          <span
            className={s.highlight}
            style={{ left: `${pct(highlight.start)}%`, width: `${pct(highlight.end) - pct(highlight.start)}%` }}
            title={`Best window ${formatUtc(highlight.start)} → ${formatUtc(highlight.end)}`}
          />
        )}
        {now && <span className={s.now} style={{ left: `${pct(now)}%` }} />}
      </div>
      {ticks > 0 && (
        <div className={s.ticks}>
          {Array.from({ length: ticks }, (_, i) => (
            <span key={i} className="num">
              {formatUtc(new Date(t0 + (span * i) / (ticks - 1)).toISOString(), false).slice(0, 6)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** "▬ Sun up  ▬ Earth up  ▭ Best landing window" */
export function TimelineLegend({ best = true }: { best?: boolean }) {
  return (
    <div className={s.legend}>
      <span>
        <i className={[s.key, s.sun].join(' ')} /> Sun up
      </span>
      <span>
        <i className={[s.key, s.earth].join(' ')} /> Earth up
      </span>
      {best && (
        <span>
          <i className={[s.key, s.keyBest].join(' ')} /> Best landing window
        </span>
      )}
    </div>
  );
}
