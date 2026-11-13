import { useMemo, useRef, useState } from 'react';
import { useApp } from '@/shared/store/app';
import { RefaeyHalf } from './Refaey';
import { DialogueText } from './DialogueText';
import { REFAEY_COPY } from './copy';
import type { Reply } from './dialogues/dialogues';
import { resolveNode, type ResolveContext } from './logic';
import { getNode, hasExplainer } from './registry';
import s from './refaey.module.css';

export type BriefingDestination = 'step1' | 'missions';

/** The briefing has no data tokens and no conditions. */
const CONTEXT: ResolveContext = { horizons: false, values: {}, flags: {}, terminalLabel: REFAEY_COPY.ok, hasExplainer };

const FADE_MS = { motion: 600, still: 250 } as const;

/**
 * The briefing: a full-screen scene on a near-black background and nothing else (no Moon, no cards, no header, no
 * status bar). His half-body stands bottom-left, his words are large text to the right of his hand, the choices are
 * text links below them. No scrim and no box. Picking a path, or pressing Esc, dissolves it away and calls `onDone`.
 */
export function RefaeyBriefing({ onDone, firstId = 'intro-hello' }: { onDone: (to: BriefingDestination) => void; firstId?: string }) {
  const motion = useApp((st) => st.motion);
  const root = useRef<HTMLDivElement>(null);
  const [trail, setTrail] = useState<string[]>([firstId]);
  const [leaving, setLeaving] = useState(false);
  const nodeId = trail[trail.length - 1];

  const content = useMemo(() => {
    const node = getNode(nodeId);
    const r = node && resolveNode(node, CONTEXT, (id) => getNode(id));
    return r ? { key: r.id, title: r.title, lines: r.lines, replies: r.replies } : null;
  }, [nodeId]);

  const finish = (to: BriefingDestination) => {
    if (leaving) return;
    setLeaving(true);
    const el = root.current;
    const done = () => onDone(to);
    if (!el) return done();
    el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: motion ? FADE_MS.motion : FADE_MS.still, easing: 'ease-in-out', fill: 'forwards' }).finished.then(done, done);
  };

  const onReply = (r: Reply) => {
    if (r.next) return setTrail((t) => [...t, r.next as string]);
    const a = r.action;
    if (a?.type === 'navigate') return finish(a.to === '/missions' ? 'missions' : 'step1');
    finish('step1');
  };

  if (!content) return null;
  return (
    <div ref={root} className={s.briefing} inert={leaving}>
      <div className={s.briefingArt} aria-hidden>
        <RefaeyHalf />
      </div>
      <DialogueText className={s.briefingText} content={content} onReply={onReply} onCollapse={() => finish('step1')} />
    </div>
  );
}
