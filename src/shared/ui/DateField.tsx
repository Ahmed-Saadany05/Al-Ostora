import { useId } from 'react';
import type { IsoTime } from '../types';
import s from './DateField.module.css';

/** Date + time input in UTC (the whole app works in UTC). Value is an ISO string. */
export function DateField({
  label,
  value,
  onChange,
  min,
  max,
  hint,
}: {
  label: string;
  value: IsoTime;
  onChange: (iso: IsoTime) => void;
  min?: IsoTime;
  max?: IsoTime;
  hint?: string;
}) {
  const id = useId();
  const local = (iso?: IsoTime) => iso?.slice(0, 16);
  return (
    <label className={s.field} htmlFor={id}>
      <span className={s.label}>{label}</span>
      <span className={s.box}>
        <input
          id={id}
          type="datetime-local"
          className={['num', s.input].join(' ')}
          value={local(value)}
          min={local(min)}
          max={local(max)}
          onChange={(e) => e.target.value && onChange(new Date(`${e.target.value}:00Z`).toISOString())}
        />
        <span className={s.tz}>UTC</span>
      </span>
      {hint && <span className={s.hint}>{hint}</span>}
    </label>
  );
}
