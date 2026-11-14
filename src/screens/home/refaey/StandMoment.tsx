import { useMemo } from 'react';
import { nextTransition, useDayReport, useSky } from '@/shared/data';
import { formatDeg, formatDuration, hoursBetween } from '@/shared/format';
import { useMission } from '@/shared/mission';
import { useTime } from '@/shared/store/time';
import { LUNAR } from '@/shared/types';
import type { CardPlacement } from './RefaeyCard';
import { MomentCard, type MomentContext } from './MomentCard';

/**
 * The "stand on site" card. It reads the same values the screen itself shows (useSky + the lunar day's samples) and only
 * fills its live line when the Sun and Earth positions are Horizons values; the skyline line shows only for the LOLA horizon.
 */
export function StandMoment({ placement }: { placement: CardPlacement }) {
  const { site } = useMission();
  const time = useTime((s) => s.time);
  const from = useTime((s) => s.rangeStart);
  const { data: sky } = useSky(site, time);
  const { data: report } = useDayReport(site, from, LUNAR.synodicDays);

  const context: MomentContext = useMemo(() => {
    const live = sky?.source === 'horizons';
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

  return <MomentCard id="moment-stand" placement={placement} context={context} />;
}
