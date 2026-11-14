import { useMemo } from 'react';
import { nextTransition, useDayReport, useSky } from '@/shared/data';
import { formatDeg, formatDuration, hoursBetween } from '@/shared/format';
import { useMission } from '@/shared/mission';
import { useTime } from '@/shared/store/time';
import { LUNAR } from '@/shared/types';
import type { CardPlacement } from './RefaeyCard';
import { useSearchParams } from 'react-router-dom';
import { standNode } from './dialogues/dialogues';
import { MomentCard, type MomentContext } from './MomentCard';

/**
 * The "stand on site" card. It reads the same values the screen itself shows (useSky + the lunar day's samples) and only
 * fills its live line when the numbers come from the live engine (not the demo provider); the skyline line shows only for the LOLA horizon.
 */
export function StandMoment({ placement }: { placement: CardPlacement }) {
  const { site } = useMission();
  const [params] = useSearchParams();
  // From Compare dates the link carries a moment in the plan's window (?at=…). "See the sky at touchdown" on /missions carries a past one.
  const at = Date.parse(params.get('at') ?? '');
  const fromCompare = Number.isFinite(at) && at >= Date.now() - 2 * 86_400_000;
  const time = useTime((s) => s.time);
  const from = useTime((s) => s.rangeStart);
  const { data: sky } = useSky(site, time);
  const { data: report } = useDayReport(site, from, LUNAR.synodicDays);

  const context: MomentContext = useMemo(() => {
    // The live engine labels its answers 'computed' (from Horizons positions + the LOLA skyline); the demo provider says 'demo'.
    const live = !!sky && sky.source !== 'demo';
    const ahead = report?.samples.filter((x) => x.time >= time) ?? [];
    const sunset = sky?.sunVisible ? nextTransition(ahead, (x) => x.sunVisible, true) : null;
    return {
      horizons: live,
      flags: { horizonLola: sky?.horizon?.source === 'lola' },
      values: live && sky
        ? {
            sunElev: formatDeg(sky.sun.elDeg, 1),
            ...(sunset ? { sunsetIn: formatDuration(hoursBetween(time, sunset)) } : {}),
            earthStatus: sky.earthVisible ? 'in view' : 'below the horizon',
          }
        : {},
    };
  }, [sky, report, time]);

  const live = context.horizons;
  const node = useMemo(
    () => standNode({ fromCompare, lola: !!context.flags.horizonLola, live, sunUp: !!sky?.sunVisible, earthUp: !!sky?.earthVisible }),
    [fromCompare, context.flags.horizonLola, live, sky?.sunVisible, sky?.earthVisible],
  );
  return <MomentCard id="moment-stand" placement={placement} context={context} node={node} />;
}
