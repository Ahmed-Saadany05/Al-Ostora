import { useEffect, useId, useLayoutEffect, useRef, useState, type FocusEvent } from 'react';
import { Link } from 'react-router-dom';
import { missionUrl } from '@/shared/mission';
import type { IsoTime, Site } from '@/shared/types';
import { Icon, SourceBadge } from '@/shared/ui';
import { HOME_COPY, PIN_COPY } from './content';
import { getProvider } from '@/shared/data';
import type { SkyView } from './skyView';
import { SkyStatus } from './SkyStatus';
import s from './SitePin.module.css';

/**
 * The featured site's pin, drawn as real DOM at the crest. Hover or keyboard focus opens a small card with
 * Sun and Earth status. The Demo marker beside the label is the only demo label on Home, always visible.
 */
/** Space between the pin's label and the card, and the margin kept from the viewport edge. */
const CARD_GAP_PX = 16;
const EDGE_PX = 12;
/** The card starts a little above the pin's own height, so its first line is level with the label. */
const CARD_RISE_PX = 18;

export function SitePin({ site, time, view, x, y, suppressCard = false }: { site: Site; time: IsoTime; view: SkyView; x: number; y: number; suppressCard?: boolean }) {
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const cardId = useId();
  const pinRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  // Where the card sits, in px from the pin's own point; set after measuring (see place()).
  const [cardAt, setCardAt] = useState({ x: 0, y: 0 });
  // The Demo marker follows the data; if there is none, only the active provider id is known.
  const source = view.status === 'ready' ? view.sky.source : getProvider().id === 'demo' ? 'demo' : undefined;
  // The card stays closed while Refaey is talking (his bubble opens in the same corner).
  const open = (hover || focus) && !dismissed && !suppressCard;

  /*
   * The card opens to the right of the pin's label, so it never sits over the headline, the line or the buttons
   * (they are centred above and to the left of the pin). Only when it would run off the right edge does it open
   * to the left. Vertically it starts level with the pin and is kept inside the viewport.
   */
  const place = () => {
    const pin = pinRef.current?.getBoundingClientRect();
    const btn = btnRef.current?.getBoundingClientRect();
    const card = cardRef.current;
    if (!pin || !btn || !card) return;
    const w = card.offsetWidth;
    const h = card.offsetHeight;
    const fitsRight = btn.right + CARD_GAP_PX + w <= window.innerWidth - EDGE_PX;
    const x = fitsRight ? btn.right - pin.left + CARD_GAP_PX : btn.left - pin.left - CARD_GAP_PX - w;
    const wanted = pin.top - CARD_RISE_PX;
    const top = Math.min(Math.max(wanted, EDGE_PX), window.innerHeight - EDGE_PX - h);
    setCardAt({ x: Math.round(x), y: Math.round(top - pin.top) });
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
      <button ref={btnRef} type="button" className={s.button} aria-expanded={open} aria-controls={cardId}>
        <span className={s.marker} aria-hidden>
          <span className={s.ring} />
          <span className={s.pulse} data-pulse />
        </span>
        <span className={s.label}>
          {HOME_COPY.pinLabel}
          {source && <SourceBadge source={source} />}
        </span>
      </button>
      <div ref={cardRef} id={cardId} role="group" aria-label={PIN_COPY.cardTitle} className={s.card} style={{ left: cardAt.x, top: cardAt.y }}>
        <p className={s.title}>{PIN_COPY.cardTitle}</p>
        <SkyStatus site={site} view={view} now={time} />
        <Link to={missionUrl.stand(site.id)} className={s.next} tabIndex={open ? 0 : -1}>
          {PIN_COPY.next} <Icon name="arrowRight" size={14} />
        </Link>
      </div>
    </div>
  );
}
