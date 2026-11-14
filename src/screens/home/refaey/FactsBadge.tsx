import { Pill } from '@/shared/ui';
import { RETRIEVED, recordedLabel } from './facts/display';

/** Sits next to a line that uses a recorded Horizons fact: where the number comes from, and when it was recorded. */
export function FactsBadge() {
  return <Pill tone="neutral" icon="orbit" label={recordedLabel()} title={`Positions from NASA JPL Horizons, recorded ${RETRIEVED}`} />;
}
