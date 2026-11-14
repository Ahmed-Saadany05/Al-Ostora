import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefaeyCard, type CardPlacement } from './RefaeyCard';
import { FactsBadge } from './FactsBadge';
import { REFAEY_COPY } from './copy';
import { advance, isSideNode } from './conversation';
import type { DialogueNode, Reply } from './dialogues/dialogues';
import { recordedTokens } from './facts/display';
import { resolveNode, type ResolveContext } from './logic';
import { getNode, hasExplainer } from './registry';
import { useRefaey } from './store';

/** What a screen knows about the sky. Leave it out and every line that needs a live number is skipped (never guessed). */
export type MomentContext = Pick<ResolveContext, 'horizons' | 'values' | 'flags'>;
const NO_DATA: MomentContext = { horizons: false, values: {}, flags: {} };
const FACTS = recordedTokens();
const INTRO_ID = 'moment-intro';

/**
 * One conversation on a mission screen, as a card. Once per session (or every time, for the touchdown card), dismissible.
 * Someone who skipped the briefing meets Refaey first: a one-line introduction, then the moment itself.
 * `node` replaces the data node with the same id (the stand card is assembled from what is true at that moment).
 */
export function MomentCard({
  id,
  placement,
  context = NO_DATA,
  onAction,
  once = true,
  node,
}: {
  id: string;
  placement: CardPlacement;
  context?: MomentContext;
  onAction?: (a: Reply['action']) => boolean;
  /** Shown once per session (moments), or every time it is mounted (the touchdown card: every landing is a new story). */
  once?: boolean;
  node?: DialogueNode;
}) {
  const navigate = useNavigate();
  const alreadySeen = useRefaey((st) => st.seen[id]);
  const markSeen = useRefaey((st) => st.markSeen);
  const callsign = useRefaey((st) => st.callsign);
  const briefed = useRefaey((st) => st.briefed);
  const introduced = useRefaey((st) => st.introduced);
  const markIntroduced = useRefaey((st) => st.markIntroduced);
  // Decided once on arrival, so the card stays while it is on screen and never returns after it has been shown.
  const [eligible] = useState(() => !once || !alreadySeen);
  const [trail, setTrail] = useState<string[]>(() => (!briefed && !introduced ? [INTRO_ID] : [id]));
  const [dismissed, setDismissed] = useState(false);
  const nodeId = trail[trail.length - 1];
  const backTo = trail[trail.length - 2];

  useEffect(() => {
    if (eligible && once) markSeen(id);
  }, [eligible, once, id, markSeen]);

  const ctx: ResolveContext = useMemo(
    () => ({ ...context, facts: FACTS, story: { callsign }, terminalLabel: REFAEY_COPY.ok, hasExplainer }),
    [context, callsign],
  );
  const resolved = useMemo(() => {
    const n = node && nodeId === id ? node : getNode(nodeId, backTo);
    return n ? resolveNode(n, ctx, (x) => getNode(x, backTo)) : null;
  }, [nodeId, backTo, ctx, node, id]);

  if (!eligible || dismissed || !resolved) return null;

  const act = (r: Reply) => () => {
    const intro = nodeId.startsWith(INTRO_ID);
    const step = advance(trail, r);
    if (step.ids !== trail) return setTrail(step.ids);
    const a = step.action;
    if (!intro && onAction?.(a)) return;
    if (a?.type === 'navigate') return navigate(a.to);
    if (intro) {
      // "Sure" / "Okay": the introduction is done; the moment itself comes next.
      markIntroduced();
      return setTrail([id]);
    }
    // "OK" on an explainer or source card goes back to the card; "OK" on the card closes it.
    if (isSideNode(nodeId)) return setTrail((t) => t.slice(0, -1));
    setDismissed(true);
  };

  return (
    <RefaeyCard
      id={`refaey-${id}`}
      placement={placement}
      mood={resolved.mood}
      title={resolved.title}
      lines={resolved.lines}
      link={resolved.link}
      badge={resolved.usesFacts ? <FactsBadge /> : undefined}
      actions={resolved.replies.map((r) => ({ label: r.label, onClick: act(r) }))}
    />
  );
}
