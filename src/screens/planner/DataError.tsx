/**
 * Owner: Aser. Shown when a data hook fails, e.g. the live engine has no JPL data for this time
 * (offline and no recorded answer — the engine refuses to guess). Without it the page would just
 * keep loading. Pass the `error` fields of the page's main queries; the first one is shown.
 */
import { ErrorState } from '@/shared/ui';

export function DataError({ errors }: { errors: (Error | undefined)[] }) {
  const e = errors.find(Boolean);
  if (!e) return null;
  return <ErrorState compact title="Live data (JPL Horizons) isn't available for this right now" message={`${e.message} Try again online, or pick another date.`} />;
}
