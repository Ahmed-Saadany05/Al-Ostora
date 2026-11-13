import { formatNumber } from '../format';
import type { Tone } from './Pill';
import s from './ProgressRing.module.css';

/**
 * Percentage ring with a word under it (colour + label, never colour alone).
 *   <ProgressRing value={0.91} label="Sunlight" tone="sun" />
 */
export function ProgressRing({
  value,
  label,
  tone = 'neutral',
  size = 64,
}: {
  /** 0–1. null = unknown (renders "—"). */
  value: number | null | undefined;
  label: string;
  tone?: Tone;
  size?: number;
}) {
  const known = value !== null && value !== undefined && Number.isFinite(value);
  const v = known ? Math.min(1, Math.max(0, value as number)) : 0;
  const r = 15.5;
  const c = 2 * Math.PI * r;
  return (
    <figure className={s.ring} style={{ width: size }}>
      <div className={s.circle} style={{ width: size, height: size }}>
        <svg viewBox="0 0 36 36" width={size} height={size} aria-hidden>
          <circle cx="18" cy="18" r={r} className={s.track} />
          <circle
            cx="18"
            cy="18"
            r={r}
            className={[s.bar, s[tone]].join(' ')}
            strokeDasharray={`${v * c} ${c}`}
            transform="rotate(-90 18 18)"
          />
        </svg>
        <span className={['num', s.value].join(' ')}>{known ? `${formatNumber(v * 100, 0)}%` : '—'}</span>
      </div>
      <figcaption className={s.label}>{label}</figcaption>
    </figure>
  );
}
