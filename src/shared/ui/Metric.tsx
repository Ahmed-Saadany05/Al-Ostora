import type { ReactNode } from 'react';
import { formatDuration, formatNumber, hoursBetween } from '../format';
import type { DataSource, IsoTime } from '../types';
import { Icon, type IconName } from './Icon';
import type { Tone } from './Pill';
import { SourceBadge } from './Pill';
import s from './Metric.module.css';

interface MetricProps {
  label: string;
  /** Raw number. null/undefined renders "—" (unknown), never a made-up value. */
  value: number | null | undefined;
  /** Always give a unit: '°', 'h', '%', 'km', 'W'… */
  unit: string;
  digits?: number;
  /** Pre-formatted override, e.g. "3d 04h". Still rendered in mono. */
  display?: string;
  icon?: IconName;
  tone?: Tone;
  source?: DataSource;
  hint?: ReactNode;
  size?: 'md' | 'lg';
}

/** Number tile: label, big mono value with unit, optional hint and source. */
export function Metric({ label, value, unit, digits = 1, display, icon, tone = 'neutral', source, hint, size = 'md' }: MetricProps) {
  const known = display !== undefined || (value !== null && value !== undefined && Number.isFinite(value));
  const text = display ?? (known ? formatNumber(value as number, digits) : '—');
  return (
    <div className={[s.metric, s[size]].join(' ')}>
      <div className={s.top}>
        <span className={[s.label, s[tone]].join(' ')}>
          {icon && <Icon name={icon} size={14} />}
          {label}
        </span>
        {source && <SourceBadge source={source} />}
      </div>
      <div className={s.value}>
        <span className="num">{text}</span>
        {known && display === undefined && <span className={s.unit}>{unit}</span>}
      </div>
      {hint && <p className={s.hint}>{hint}</p>}
    </div>
  );
}

type CountdownKind = 'sunset' | 'sunrise' | 'earthset' | 'earthrise';

const KIND: Record<CountdownKind, { label: string; icon: IconName; tone: Tone }> = {
  sunset: { label: 'Sunset', icon: 'sunset', tone: 'sun' },
  sunrise: { label: 'Sunrise', icon: 'sun', tone: 'sun' },
  earthset: { label: 'Earthset', icon: 'earth', tone: 'earth' },
  earthrise: { label: 'Earthrise', icon: 'earth', tone: 'earth' },
};

/**
 * "Sunset in 3d 04h" — counts from `now` (usually the global time store) to `target`.
 * target = null means it doesn't happen in the computed range.
 */
export function CountdownChip({ kind, target, now }: { kind: CountdownKind; target: IsoTime | null; now: IsoTime }) {
  const k = KIND[kind];
  const h = target ? hoursBetween(now, target) : null;
  const text = h === null ? 'not in range' : h <= 0 ? 'now' : formatDuration(h);
  return (
    <span className={[s.chip, s[k.tone]].join(' ')}>
      <Icon name={k.icon} size={14} />
      <span>{k.label}</span>
      <span className={s.chipSep} />
      <span className="num">{h !== null && h > 0 ? `in ${text}` : text}</span>
    </span>
  );
}
