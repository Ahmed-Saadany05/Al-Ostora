import type { DataSource } from '../types';
import { Icon, type IconName } from './Icon';
import s from './Pill.module.css';

export type Tone = 'neutral' | 'sun' | 'earth' | 'good' | 'warn' | 'bad' | 'demo';

/**
 * Status pill. Icon AND label are both required — colour never carries meaning alone.
 *   <Pill tone="sun" icon="sun" label="In sunlight" />
 */
export function Pill({ tone = 'neutral', icon, label, title }: { tone?: Tone; icon: IconName; label: string; title?: string }) {
  return (
    <span className={[s.pill, s[tone]].join(' ')} title={title}>
      <Icon name={icon} size={14} />
      <span>{label}</span>
    </span>
  );
}

const SOURCE_META: Record<DataSource, { label: string; icon: IconName; tone: Tone; title: string }> = {
  demo: { label: 'Demo data', icon: 'beaker', tone: 'demo', title: 'Placeholder values for building the UI — not real' },
  horizons: { label: 'JPL Horizons', icon: 'orbit', tone: 'neutral', title: 'Positions from NASA JPL Horizons' },
  lola: { label: 'NASA LOLA', icon: 'layers', tone: 'neutral', title: 'Terrain from LRO LOLA' },
  computed: { label: 'Computed', icon: 'check', tone: 'neutral', title: 'Calculated from Horizons + LOLA inputs' },
};

/** Put next to any number so people know where it came from. */
export function SourceBadge({ source }: { source: DataSource }) {
  const m = SOURCE_META[source];
  return <Pill tone={m.tone} icon={m.icon} label={m.label} title={m.title} />;
}
