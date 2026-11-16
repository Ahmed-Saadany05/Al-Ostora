/**
 * Refaey in a screen, the simple way: Hady's animated figure (or just his face, when he is already in the 3D scene) with
 * one speech balloon that holds the current beat and its reply choices (Hady's DialogueText).
 *
 * He only talks when you ask (Pink): the balloon is closed until you click him, and a small badge on him says he has
 * something new. The balloon opens on whichever side of him covers the least (buttons most of all); on the step screens
 * he docks in the screen corner that covers the least. Esc, ✕ or clicking him again folds the balloon.
 */
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  RefaeyActor,
  useQuip,
  type ActorPose,
} from '@/screens/home/refaey/RefaeyActor';
import { RefaeyBust } from '@/screens/home/refaey/Refaey';
import { usePresence } from '@/screens/home/refaey/presence';
import {
  DialogueText,
  type PanelContent,
} from '@/screens/home/refaey/DialogueText';
import type { Reply } from '@/screens/home/refaey/dialogues/dialogues';
import { DOCK_ORDER, type BalloonSide, type DockCorner } from '@/screens/home/refaey/balloonPlace';
import { markHeard, useBalloonSpot, useDock, wasHeard } from '@/screens/home/refaey/talkHooks';
import rs from '@/screens/home/refaey/refaey.module.css';
import s from './talk.module.css';

export function RefaeyTalk({
  content,
  onReply,
  height = '30vh',
  pose = 'float',
  entrance = 'drift',
  placement = 'dock',
  dockOrder,
  sides = ['right', 'above', 'left', 'below'],
  footer,
  style,
  className,
  balloonWidth = 360,
  figure = true,
  closeOnReply = false,
}: {
  content: PanelContent | null;
  onReply: (r: Reply) => void;
  /** His height (any CSS length). */
  height?: string;
  pose?: ActorPose;
  entrance?: 'none' | 'walk' | 'drift';
  /** 'dock': fixed in the screen corner that covers the least. 'inline': in the page flow. 'free': the page positions him through `style`. */
  placement?: 'dock' | 'inline' | 'free';
  /** The corners to try for 'dock', in order of preference. */
  dockOrder?: DockCorner[];
  /** The sides to try for the balloon, in order of preference. */
  sides?: BalloonSide[];
  footer?: ReactNode;
  style?: CSSProperties;
  className?: string;
  balloonWidth?: number;
  /** false: he is already in the scene (the 3D stories), so only his face is shown. */
  figure?: boolean;
  /** Any reply folds the balloon (simple "Got it" notes). */
  closeOnReply?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState(false);
  const [entered, setEntered] = useState(entrance === 'none' || !figure);
  const quip = useQuip();
  const root = useRef<HTMLDivElement>(null);
  const anchor = useRef<HTMLDivElement>(null);
  const balloon = useRef<HTMLDivElement>(null);

  const key = content?.key;
  const showing = !!content && open && entered;
  // A line counts as heard once its balloon has been open; until then the badge says he has something new.
  useEffect(() => {
    if (showing && key) markHeard(key);
  }, [showing, key]);
  const unread = !!content && !open && !wasHeard(content.key);

  // The balloon animates in when it opens and out when it closes.
  const { mounted, leaving, motion } = usePresence(showing);
  const spot = useBalloonSpot(showing, anchor, balloon, sides, key);
  const dock = useDock(placement === 'dock', root, open || hover, dockOrder ?? DOCK_ORDER);

  // He glides between corners, but not into his first one.
  const [glide, setGlide] = useState(false);
  useEffect(() => {
    if (!dock || glide) return;
    const r = requestAnimationFrame(() => setGlide(true));
    return () => cancelAnimationFrame(r);
  }, [dock, glide]);

  const toggle = () => setOpen((o) => !o);
  const label = open ? 'Refaey: hide what he says' : unread ? 'Refaey has something new to tell you' : 'Refaey: hear what he says';

  const rootStyle: CSSProperties = { ['--fig-h' as string]: height, ...style };
  if (placement === 'dock') Object.assign(rootStyle, dock ? { left: dock.x, top: dock.y } : { left: 0, top: 0, visibility: 'hidden' });

  return (
    <div
      ref={root}
      className={[s.talk, s[placement], className].filter(Boolean).join(' ')}
      style={rootStyle}
      data-refaey-talk
      data-glide={glide || undefined}
    >
      <div ref={anchor} className={rs.hint} data-unread={unread || undefined} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
        {figure ? (
          <RefaeyActor
            height={height}
            pose={pose}
            entrance={entrance}
            clickable
            onEntered={() => setEntered(true)}
            onActivate={toggle}
            activateLabel={label}
          />
        ) : (
          <button type="button" className={s.face} onClick={toggle} aria-label={label} aria-expanded={open}>
            <RefaeyBust size="56px" />
          </button>
        )}
        <span className={rs.hintTip} aria-hidden>
          {open ? 'Click to close' : 'Click me'}
        </span>
        {unread && <span className={rs.newBadge} aria-hidden />}
      </div>
      {content &&
        mounted &&
        createPortal(
          <div
            ref={balloon}
            className={[rs.balloon, s.balloon, motion && (leaving ? rs.popOut : rs.popIn)].filter(Boolean).join(' ')}
            data-side={spot?.side ?? 'right'}
            data-refaey-balloon
            style={{
              width: `min(${balloonWidth}px, calc(100vw - 24px))`,
              left: spot?.x ?? 0,
              top: spot?.y ?? 0,
              visibility: spot ? undefined : 'hidden',
              ['--tail-y' as string]: `${spot?.tail ?? 20}px`,
              ['--tail-x' as string]: `${spot?.tail ?? 20}px`,
            }}
            role="dialog"
            aria-label="Refaey"
          >
            <div className={rs.quipHost} data-quip={quip !== null}>
              <DialogueText
                className={rs.balloonTalk}
                bubble
                content={content}
                onReply={(r) => {
                  if (closeOnReply) setOpen(false);
                  onReply(r);
                }}
                onCollapse={() => setOpen(false)}
                footer={footer}
              />
              {quip !== null && (
                <p className={rs.quipLine} role="status">
                  {quip}
                </p>
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
