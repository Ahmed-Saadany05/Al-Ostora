import { useId, useState, type FocusEvent } from 'react';
import { Link } from 'react-router-dom';
import { missionUrl } from '@/shared/mission';
import type { IsoTime, Site } from '@/shared/types';
import { Icon, SourceBadge } from '@/shared/ui';
import { HOME_COPY, PIN_COPY } from './content';
import { useSkyView, activeProviderId } from './skyView';
import { SkyStatus } from './SkyStatus';
import s from './SitePin.module.css';

/**
 * The featured site's pin, drawn as real DOM at the crest. Hover or keyboard focus opens a small card with
 * Sun and Earth status. The Demo marker beside the label is the only demo label on Home, always visible.
 */
export function SitePin({ site, time, x, y }: { site: Site; time: IsoTime; x: number; y: number }) {
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const cardId = useId();
  const view = useSkyView(site, time);
  // The lookup settles even when it finds nothing; the badge then falls back to the active provider.
  const source = view.data?.sky.source ?? (activeProviderId() === 'demo' ? 'demo' : undefined);
  const open = (hover || focus) && !dismissed;

  const onBlur = (e: FocusEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget)) setFocus(false);
  };

  return (
    <div
      className={s.pin}
      style={{ left: x, top: y }}
      data-open={open}
      onPointerEnter={() => {
        setHover(true);
        setDismissed(false);
      }}
      onPointerLeave={() => setHover(false)}
      onFocus={() => {
        setFocus(true);
        setDismissed(false);
      }}
      onBlur={onBlur}
      onKeyDown={(e) => e.key === 'Escape' && setDismissed(true)}
    >
      <button type="button" className={s.button} aria-expanded={open} aria-controls={cardId}>
        <span className={s.marker} aria-hidden>
          <span className={s.ring} />
          <span className={s.pulse} data-pulse />
        </span>
        <span className={s.label}>
          {HOME_COPY.pinLabel}
          {source && <SourceBadge source={source} />}
        </span>
      </button>
      <div id={cardId} role="group" aria-label={PIN_COPY.cardTitle} className={s.card}>
        <p className={s.title}>{PIN_COPY.cardTitle}</p>
        <SkyStatus site={site} time={time} />
        <Link to={missionUrl.stand(site.id)} className={s.next} tabIndex={open ? 0 : -1}>
          {PIN_COPY.next} <Icon name="arrowRight" size={14} />
        </Link>
      </div>
    </div>
  );
}
