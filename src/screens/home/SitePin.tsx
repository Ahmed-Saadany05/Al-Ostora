import { forwardRef, useEffect, useId, useImperativeHandle, useLayoutEffect, useRef, useState, type FocusEvent } from 'react';
import { Link } from 'react-router-dom';
import { getProvider } from '@/shared/data';
import { missionUrl } from '@/shared/mission';
import type { IsoTime, Site } from '@/shared/types';
import { Icon, SourceBadge } from '@/shared/ui';
import { HOME_COPY, PIN_COPY } from './content';
import type { SkyView } from './skyView';
import { SkyStatus } from './SkyStatus';
import s from './SitePin.module.css';

/** Must match `top` of .card in SitePin.module.css (var(--space-5)) and leave a little room at the viewport edge. */
const CARD_OFFSET_PX = 24;
const EDGE_PX = 8;

/**
 * The featured site's pin, drawn as real DOM on the crest. The scene moves the outer element with `transform`
 * (through the forwarded ref); nothing here positions with left/top. The label is plain text; hover or keyboard
 * focus draws a thin leader line in and opens a small card with Sun and Earth status. The Demo marker beside the
 * label is the only demo label on Home, always visible.
 */
export const SitePin = forwardRef<HTMLDivElement, { site: Site; time: IsoTime; view: SkyView }>(function SitePin({ site, time, view }, ref) {
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const cardId = useId();
  const pinRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [flip, setFlip] = useState(false);
  useImperativeHandle(ref, () => pinRef.current as HTMLDivElement);
  const open = (hover || focus) && !dismissed;
  // The Demo marker follows the data; if there is none, only the active provider id is known.
  const source = view.status === 'ready' ? view.sky.source : getProvider().id === 'demo' ? 'demo' : undefined;

  // Open below the pin; if the card would run off the bottom of the viewport, open above it instead.
  const place = () => {
    const pin = pinRef.current?.getBoundingClientRect();
    const card = cardRef.current;
    if (!pin || !card) return;
    setFlip(pin.top + CARD_OFFSET_PX + card.offsetHeight > window.innerHeight - EDGE_PX);
  };
  useLayoutEffect(place, [open, view.status]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  const onBlur = (e: FocusEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget)) setFocus(false);
  };

  return (
    <div
      ref={pinRef}
      className={s.pin}
      data-open={open}
      data-flip={flip}
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
        <span className={s.leader} aria-hidden />
        <span className={s.label}>
          {HOME_COPY.pinLabel}
          {source && <SourceBadge source={source} />}
        </span>
      </button>
      <div ref={cardRef} id={cardId} role="group" aria-label={PIN_COPY.cardTitle} className={s.card}>
        <p className={s.title}>{PIN_COPY.cardTitle}</p>
        <SkyStatus site={site} view={view} now={time} />
        <Link to={missionUrl.stand(site.id)} className={s.next} tabIndex={open ? 0 : -1}>
          {PIN_COPY.next} <Icon name="arrowRight" size={14} />
        </Link>
      </div>
    </div>
  );
});
