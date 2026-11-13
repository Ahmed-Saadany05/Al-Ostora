import { useHorizon } from '@/shared/data';
import { formatDeg, formatDuration, formatNumber, formatUtc, hoursBetween } from '@/shared/format';
import { LUNAR, type IsoTime, type Site } from '@/shared/types';
import { Icon, Pill, Skeleton } from '@/shared/ui';
import { noEventCopy, PIN_COPY, recordedCopy } from './content';
import { useSkyView } from './skyView';
import s from './SkyStatus.module.css';

/** "sets in 3d 04h" — or an honest note when nothing changes within the computed range. */
function Countdown({ lead, event, now, target }: { lead: string; event: string; now: IsoTime; target: IsoTime | null }) {
  if (target === null) return <span className={s.muted}>{noEventCopy(event, formatNumber(LUNAR.synodicDays, 1))}</span>;
  return (
    <span>
      {lead} <span className="num">{formatDuration(hoursBetween(now, target))}</span>
    </span>
  );
}

/**
 * Sun and Earth status for one site. Values come from the data provider. If "now" has no data, it shows the
 * nearest time that does and says so; it always settles on content or a message, never a blank or endless spinner.
 */
export function SkyStatus({ site, time }: { site: Site; time: IsoTime }) {
  const view = useSkyView(site, time);
  const horizon = useHorizon(site);

  if (view.loading) {
    return (
      <div className={s.status} role="status" aria-label={PIN_COPY.loading}>
        <Skeleton width={220} height={18} />
        <Skeleton width={240} height={18} />
      </div>
    );
  }
  if (!view.data) {
    return (
      <p className={s.row} role="status">
        <Icon name="alert" size={18} />
        <span>{PIN_COPY.unavailable}</span>
      </p>
    );
  }

  const { sky, metrics, recorded, time: at } = view.data;
  const { sun, sunVisible, earthVisible } = sky;
  const sunNext = metrics ? (sunVisible ? metrics.nextSunset : metrics.nextSunrise) : undefined;
  const earthNext = metrics ? (earthVisible ? metrics.nextEarthset : metrics.nextEarthrise) : undefined;

  return (
    <div className={s.status}>
      {recorded && (
        <p className={s.recorded}>
          <Icon name="clock" size={14} />
          <span>{recordedCopy(formatUtc(at))}</span>
        </p>
      )}
      <p className={[s.row, s.sun].join(' ')}>
        <Icon name={sunVisible ? 'sun' : 'sunset'} size={18} />
        {sunVisible ? (
          <span>
            {PIN_COPY.sunUp} <span className="num">{formatDeg(sun.elDeg, 1, false)}</span> {PIN_COPY.sunUpSuffix}
          </span>
        ) : (
          <span>{PIN_COPY.sunDown}</span>
        )}
        {sunNext !== undefined && (
          <Countdown lead={sunVisible ? PIN_COPY.sets : PIN_COPY.rises} event={sunVisible ? 'sunset' : 'sunrise'} now={at} target={sunNext} />
        )}
      </p>
      <p className={[s.row, s.earth].join(' ')}>
        <Icon name="earth" size={18} />
        <span>{earthVisible ? PIN_COPY.earthUp : PIN_COPY.earthDown}</span>
        {earthNext !== undefined && (
          <Countdown lead={earthVisible ? PIN_COPY.sets : PIN_COPY.rises} event={earthVisible ? 'earthset' : 'earthrise'} now={at} target={earthNext} />
        )}
      </p>
      {!metrics && <p className={s.muted}>{PIN_COPY.countdownsMissing}</p>}
      {horizon.data && horizon.data.source !== 'demo' && (
        <Pill icon="layers" label={horizon.data.source === 'lola' ? PIN_COPY.horizonLola : PIN_COPY.horizonFlat} />
      )}
    </div>
  );
}
