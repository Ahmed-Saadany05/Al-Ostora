/**
 * Refaey in a screen, the simple way: Hady's animated figure (drifts in, idles, hops or quips when clicked) with one speech
 * balloon beside him that holds the current beat and its reply choices (Hady's DialogueText). It sits where the page puts it,
 * so it works over the 3D terrain too. Esc or ✕ folds the balloon; clicking Refaey opens it again.
 */
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import {
  RefaeyActor,
  useQuip,
  type ActorPose,
} from "@/screens/home/refaey/RefaeyActor";
import { RefaeyBust } from "@/screens/home/refaey/Refaey";
import { usePresence } from "@/screens/home/refaey/presence";
import {
  DialogueText,
  type PanelContent,
} from "@/screens/home/refaey/DialogueText";
import type { Reply } from "@/screens/home/refaey/dialogues/dialogues";
import rs from "@/screens/home/refaey/refaey.module.css";
import s from "./talk.module.css";

export function RefaeyTalk({
  content,
  onReply,
  height = '30vh',
  pose = 'float',
  entrance = 'drift',
  placement = 'bottom-left',
  footer,
  style,
  className,
  balloonWidth = 360,
  hidden = false,
  figure = true,
  stacked = false,
  reverse = false,
  closeOnReply = false,
  autoFoldMs,
}: {
  content: PanelContent | null;
  onReply: (r: Reply) => void;
  /** His height (any CSS length). */
  height?: string;
  pose?: ActorPose;
  entrance?: 'none' | 'walk' | 'drift';
  /** 'free': the page positions it through `style`. */
  placement?: 'bottom-left' | 'top-left' | 'inline' | 'free';
  footer?: ReactNode;
  style?: CSSProperties;
  className?: string;
  balloonWidth?: number;
  /** Start with the balloon folded (he stays; click him to hear him). */
  hidden?: boolean;
  /** false: he is already in the scene (the 3D stories), so the balloon only carries his face. */
  figure?: boolean;
  /** Balloon under him (a narrow column), instead of beside him. */
  stacked?: boolean;
  /** Balloon to his left (he floats on the right of something). */
  reverse?: boolean;
  /** Any reply folds the balloon (simple "Got it" notes). */
  closeOnReply?: boolean;
  /** Fold the balloon by itself after this long (busy screens). */
  autoFoldMs?: number;
}) {
  const [open, setOpen] = useState(!hidden);
  useEffect(() => setOpen(!hidden), [hidden]);
  const [entered, setEntered] = useState(entrance === 'none' || !figure);
  const quip = useQuip();
  // A new beat always opens the balloon again.
  useEffect(() => setOpen(true), [content?.key]);
  // The balloon animates in when it opens and out when it closes.
  const { mounted, leaving, motion } = usePresence(!!content && open && entered);
  useEffect(() => {
    if (!autoFoldMs) return;
    const t = window.setTimeout(() => setOpen(false), autoFoldMs);
    return () => window.clearTimeout(t);
  }, [autoFoldMs, content?.key]);

  return (
    <div
      className={[s.talk, s[placement.replace('-', '_')], stacked && s.stacked, reverse && s.reverse, className].filter(Boolean).join(' ')}
      style={{ ['--fig-h' as string]: height, ...style }}
      data-refaey-talk
    >
      {figure ? (
        <div className={s.figure}>
          <RefaeyActor
            height={height}
            pose={pose}
            entrance={entrance}
            clickable
            onEntered={() => setEntered(true)}
            onActivate={() => setOpen((o) => !o)}
            activateLabel={open ? 'Refaey: hide what he says' : 'Refaey: hear him'}
          />
        </div>
      ) : (
        <button type="button" className={s.face} onClick={() => setOpen((o) => !o)} aria-label={open ? 'Hide what Refaey says' : 'Hear Refaey'}>
          <RefaeyBust size="56px" />
        </button>
      )}
      {content && mounted && (
        <div
          className={[
            rs.balloon,
            s.balloon,
            motion && (leaving ? rs.popOut : rs.popIn),
          ]
            .filter(Boolean)
            .join(" ")}
          data-side={stacked ? 'above' : reverse ? 'left' : 'right'}
          style={{ maxWidth: balloonWidth }}
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
        </div>
      )}
    </div>
  );
}
