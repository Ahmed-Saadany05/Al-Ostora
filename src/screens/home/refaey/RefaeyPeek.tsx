import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { RefaeyBust } from './Refaey';
import { usePresence } from './presence';
import { DOCK_ORDER } from './balloonPlace';
import { markHeard, useBalloonSpot, useDock, wasHeard } from './talkHooks';
import s from './refaey.module.css';

/**
 * A Refaey card that only opens when you ask (Pink): his face docks in the screen corner that covers the least (bottom-left
 * first, where the card used to be pinned), with a "new" badge while there is something you have not heard. Clicking his face opens the card
 * beside him, on whichever side covers the least; clicking again, or the card's own close, folds it back.
 */
export function RefaeyPeek({
  contentKey,
  open,
  onToggle,
  quiet = false,
  children,
}: {
  /** What the card says now (a new key shows the badge again until it is opened). */
  contentKey: string;
  open: boolean;
  onToggle: () => void;
  /** No badge (a stand-in line while he is still working something out). */
  quiet?: boolean;
  children: ReactNode;
}) {
  const root = useRef<HTMLDivElement>(null);
  const anchor = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState(false);
  const dock = useDock(true, root, open || hover, DOCK_ORDER);
  const card = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (open) markHeard(contentKey);
  }, [open, contentKey]);
  // Esc folds it, like his balloon.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onToggle();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onToggle]);
  const unread = !quiet && !open && !wasHeard(contentKey);
  const { mounted, leaving, motion } = usePresence(open);
  const spot = useBalloonSpot(open, anchor, card, ['right', 'above', 'below', 'left'], contentKey);
  const label = open ? 'Refaey: hide what he says' : unread ? 'Refaey has something new to tell you' : 'Refaey: hear what he says';

  return (
    <div ref={root} className={s.peek} style={dock ? { left: dock.x, top: dock.y } : { left: 0, top: 0, visibility: 'hidden' }} data-refaey-peek>
      <div ref={anchor} className={s.hint} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
        <button type="button" className={s.peekFace} onClick={onToggle} aria-label={label} aria-expanded={open}>
          <RefaeyBust size="56px" />
        </button>
        <span className={s.hintTip} aria-hidden>
          {open ? 'Click to close' : 'Click me'}
        </span>
        {unread && <span className={s.newBadge} aria-hidden />}
      </div>
      {mounted &&
        createPortal(
          <div
            ref={card}
            className={[s.peekCard, motion && (leaving ? s.popOut : s.popIn)].filter(Boolean).join(' ')}
            style={{ left: spot?.x ?? 0, top: spot?.y ?? 0, visibility: spot ? undefined : 'hidden' }}
            data-refaey-balloon
          >
            {children}
          </div>,
          document.body,
        )}
    </div>
  );
}
