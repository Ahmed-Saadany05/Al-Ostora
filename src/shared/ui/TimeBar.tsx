import { formatUtc } from '../format';
import { useTime } from '../store/time';
import type { IsoTime, TimeWindow } from '../types';
import { IconButton } from './Button';
import { Icon } from './Icon';
import s from './TimeBar.module.css';

interface TimeBarProps {
  start: IsoTime;
  end: IsoTime;
  value: IsoTime;
  onChange: (time: IsoTime) => void;
  playing?: boolean;
  onTogglePlay?: () => void;
  /** Optional lanes showing when the Sun / Earth are visible. */
  sunWindows?: TimeWindow[];
  earthWindows?: TimeWindow[];
  /** Slider step, minutes. */
  stepMinutes?: number;
}

/** Scrubber over a time range, with optional Sun/Earth visibility lanes. */
export function TimeBar({
  start,
  end,
  value,
  onChange,
  playing,
  onTogglePlay,
  sunWindows,
  earthWindows,
  stepMinutes = 30,
}: TimeBarProps) {
  const t0 = Date.parse(start);
  const t1 = Date.parse(end);
  const span = Math.max(1, t1 - t0);
  const pct = (iso: IsoTime) => Math.min(100, Math.max(0, ((Date.parse(iso) - t0) / span) * 100));
  const v = Math.min(t1, Math.max(t0, Date.parse(value)));

  const lane = (label: string, icon: 'sun' | 'earth', windows: TimeWindow[] | undefined) =>
    windows && (
      <div className={s.lane}>
        <span className={[s.laneLabel, s[icon]].join(' ')}>
          <Icon name={icon} size={12} />
          {label}
        </span>
        <div className={s.laneTrack}>
          {windows.map((w) => (
            <span
              key={w.start}
              className={[s.band, s[icon]].join(' ')}
              style={{ left: `${pct(w.start)}%`, width: `${Math.max(0.4, pct(w.end) - pct(w.start))}%` }}
              title={`${label} visible ${formatUtc(w.start)} → ${formatUtc(w.end)}`}
            />
          ))}
        </div>
      </div>
    );

  return (
    <div className={s.bar}>
      {onTogglePlay && (
        <IconButton icon={playing ? 'pause' : 'play'} label={playing ? 'Pause' : 'Play'} onClick={onTogglePlay} active={playing} />
      )}
      <div className={s.main}>
        {lane('Sun', 'sun', sunWindows)}
        {lane('Earth', 'earth', earthWindows)}
        <div className={s.sliderWrap} style={{ ['--p' as string]: `${((v - t0) / span) * 100}%` }}>
          <input
            type="range"
            className={s.slider}
            min={t0}
            max={t1}
            step={stepMinutes * 60_000}
            value={v}
            onChange={(e) => onChange(new Date(Number(e.target.value)).toISOString())}
            aria-label="Time"
            aria-valuetext={formatUtc(new Date(v).toISOString())}
          />
        </div>
        <div className={s.ends}>
          <span className="num">{formatUtc(start, false)}</span>
          <span className={['num', s.current].join(' ')}>{formatUtc(new Date(v).toISOString())}</span>
          <span className="num">{formatUtc(end, false)}</span>
        </div>
      </div>
    </div>
  );
}

/** TimeBar wired to the global time store. */
export function GlobalTimeBar(props: Omit<TimeBarProps, 'value' | 'onChange' | 'playing' | 'onTogglePlay'>) {
  const time = useTime((st) => st.time);
  const playing = useTime((st) => st.playing);
  const setTime = useTime((st) => st.setTime);
  const toggle = useTime((st) => st.toggle);
  return <TimeBar {...props} value={time} onChange={setTime} playing={playing} onTogglePlay={toggle} />;
}
