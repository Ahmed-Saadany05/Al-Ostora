import { useMemo, useRef, useState } from 'react';
import { useApp } from '@/shared/store/app';
import { Icon } from '@/shared/ui';
import { RefaeyActor, useQuip } from './RefaeyActor';
import { RefaeyStage } from './RefaeyStage';
import { BRIEFING_SLOTS } from './slots';
import { DialogueText } from './DialogueText';
import { REFAEY_COPY } from './copy';
import { advance, isSideNode } from './conversation';
import type { Reply } from './dialogues/dialogues';
import { recordedTokens } from './facts/display';
import { resolveNode, type ResolveContext } from './logic';
import { getNode, hasExplainer } from './registry';
import { useRefaey } from './store';
import s from './refaey.module.css';

export type BriefingDestination = 'step1' | 'missions' | 'about' | 'close';

const FADE_MS = { motion: 400, still: 250 } as const;
const FACTS = recordedTokens();
const END = 'b7';
/** Beats after b7 (and b7 itself) have no Skip: there is nowhere further to skip to. */
const AT_END = new Set(['b7', 'b7r']);

/**
 * The briefing: a full-screen scene on a near-black background and nothing else (no Moon, no cards, no header, no
 * status bar). His half-body stands bottom-left, his words are large text to the right of his hand, the choices are
 * text links below them. No scrim and no box. Picking a path, or pressing Esc, dissolves it away and calls `onDone`.
 * He asks for a callsign for his lander (b6); "Skip" on any beat jumps to the last beat with the default callsign.
 */
export function RefaeyBriefing({
  onDone,
  firstId = 'b1',
  avoid,
}: {
  onDone: (to: BriefingDestination) => void;
  firstId?: string;
  /** A rectangle (viewport px) Refaey and his balloon must stay clear of: the Moon parked in the corner. */
  avoid?: { x: number; y: number; w: number; h: number };
}) {
  const motion = useApp((st) => st.motion);
  const callsign = useRefaey((st) => st.callsign);
  const setCallsign = useRefaey((st) => st.setCallsign);
  const root = useRef<HTMLDivElement>(null);
  const [trail, setTrail] = useState<string[]>([firstId]);
  const [leaving, setLeaving] = useState(false);
  const [plain, setPlain] = useState(false); // the large-text layout shows only if no slot fit
  const quip = useQuip();
  const nodeId = trail[trail.length - 1];
  const backTo = trail[trail.length - 2];

  const ctx: ResolveContext = useMemo(
    () => ({
      horizons: false,
      values: {},
      flags: {},
      facts: FACTS,
      story: { callsign },
      terminalLabel: REFAEY_COPY.ok,
      hasExplainer,
    }),
    [callsign],
  );
  const content = useMemo(() => {
    const node = getNode(nodeId, backTo);
    const r = node && resolveNode(node, ctx, (id) => getNode(id, backTo));
    return r
      ? {
          key: r.id,
          title: r.title,
          lines: r.lines,
          replies: r.replies,
          link: r.link,
        }
      : null;
  }, [nodeId, backTo, ctx]);

  const finish = (to: BriefingDestination) => {
    if (leaving) return;
    setLeaving(true);
    const el = root.current;
    const done = () => onDone(to);
    if (!el) return done();
    el.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: motion ? FADE_MS.motion : FADE_MS.still,
      easing: 'ease-in-out',
      fill: 'forwards',
    }).finished.then(done, done);
  };

  const onReply = (r: Reply) => {
    if (r.callsign) setCallsign(r.callsign);
    const step = advance(trail, r);
    if (step.ids !== trail) return setTrail(step.ids);
    const a = step.action;
    if (a?.type === 'navigate') return finish(a.to === '/missions' ? 'missions' : a.to === '/about' ? 'about' : 'step1');
    finish('step1');
  };

  if (!content) return null;
  const skip = AT_END.has(nodeId) || isSideNode(nodeId) ? undefined : { label: 'Skip', onClick: () => setTrail([END]) };
  return (
    <div ref={root} className={s.briefing} inert={leaving}>
      {avoid && <div aria-hidden data-refaey-avoid style={{ position: 'fixed', left: avoid.x, top: avoid.y, width: avoid.w, height: avoid.h, pointerEvents: 'none' }} />}
      {/* The two paths: big, centred, away from his balloon. Always there, whatever beat he is on. */}
      <div className={s.paths} data-refaey-avoid>
        <button type="button" className={s.path} onClick={() => finish('missions')}>
          <span className={s.pathIcon} aria-hidden>
            <Icon name="clock" size={26} />
          </span>
          <span className={s.pathText}>
            <strong>Explore past missions</strong>
            <small>Stand where six real landings touched down</small>
          </span>
          <Icon name="arrowRight" size={20} className={s.pathArrow} />
        </button>
        <button type="button" className={[s.path, s.pathPrimary].join(' ')} onClick={() => finish('step1')}>
          <span className={s.pathIcon} aria-hidden>
            <Icon name="pin" size={26} />
          </span>
          <span className={s.pathText}>
            <strong>Plan a future mission</strong>
            <small>Help Refaey pick his site and date</small>
          </span>
          <Icon name="arrowRight" size={20} className={s.pathArrow} />
        </button>
      </div>
      <RefaeyStage
        slots={BRIEFING_SLOTS}
        scope={root}
        chrome={false}
        content={content}
        onReply={onReply}
        skip={skip}
        onEscape={() => finish('close')}
        onPlaced={(ok) => setPlain(!ok)}
      />
      {plain && (
        <>
          <div className={s.briefingActor} data-refaey-fallback>
            <RefaeyActor height="var(--actor-h)" walkIn clickable />
          </div>
          <div className={[s.briefingText, s.quipHost].join(' ')} data-refaey-fallback data-quip={quip !== null}>
            <DialogueText className={s.talkFill} content={content} onReply={onReply} onCollapse={() => finish('close')} skip={skip} />
            {quip && (
              <p
                className={s.quipLine}
                role="status"
                style={
                  {
                    '--say': 'clamp(var(--text-lg), 1.875vw, var(--text-2xl))',
                  } as React.CSSProperties
                }
              >
                {quip}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
