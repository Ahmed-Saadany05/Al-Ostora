import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefaeyCard, type CardPlacement } from './RefaeyCard';
import { FactsBadge } from './FactsBadge';
import { REFAEY_COPY } from './copy';
import type { Reply } from './dialogues/dialogues';
import { recordedTokens } from './facts/display';
import { resolveNode, type ResolveContext } from './logic';
import { EXPLAIN_PREFIX, getNode, hasExplainer } from './registry';
import { useRefaey } from './store';

/** What a screen knows about the sky. Leave it out and every line that needs a live number is skipped (never guessed). */
export type MomentContext = Pick<ResolveContext, 'horizons' | 'values' | 'flags'>;
const NO_DATA: MomentContext = { horizons: false, values: {}, flags: {} };
const FACTS = recordedTokens();

export function MomentCard({ id, placement, context = NO_DATA }: { id: string; placement: CardPlacement; context?: MomentContext }) {
  const navigate = useNavigate();
  const begun = useRefaey((st) => st.begun);
  const alreadySeen = useRefaey((st) => st.seen[id]);
  const markSeen = useRefaey((st) => st.markSeen);
  // Decided once on arrival, so the card stays while it is on screen and never returns after it has been shown.
  const [eligible] = useState(() => begun && !alreadySeen);
  const [trail, setTrail] = useState<string[]>([id]);
  const [dismissed, setDismissed] = useState(false);
  const nodeId = trail[trail.length - 1];
  const backTo = trail[trail.length - 2];

  useEffect(() => {
    if (eligible) markSeen(id);
  }, [eligible, id, markSeen]);

  const ctx: ResolveContext = useMemo(() => ({ ...context, facts: FACTS, terminalLabel: REFAEY_COPY.ok, hasExplainer }), [context]);
  const resolved = useMemo(() => {
    const node = getNode(nodeId, backTo);
    return node ? resolveNode(node, ctx, (n) => getNode(n, backTo)) : null;
  }, [nodeId, backTo, ctx]);

  if (!eligible || dismissed || !resolved) return null;

  const act = (r: Reply) => () => {
    if (r.next) return setTrail((t) => (r.next === backTo ? t.slice(0, -1) : [...t, r.next as string]));
    const a = r.action;
    if (a?.type === 'openExplainer') return setTrail((t) => [...t, EXPLAIN_PREFIX + a.id]);
    if (a?.type === 'navigate') return navigate(a.to);
    // "OK" on an explainer goes back to the card; "OK" on the card closes it.
    if (nodeId.startsWith(EXPLAIN_PREFIX)) return setTrail((t) => t.slice(0, -1));
    setDismissed(true);
  };

  return (
    <RefaeyCard
      id={`refaey-${id}`}
      placement={placement}
      mood={resolved.mood}
      title={resolved.title}
      lines={resolved.lines}
      badge={resolved.usesFacts ? <FactsBadge /> : undefined}
      actions={resolved.replies.map((r) => ({ label: r.label, onClick: act(r) }))}
    />
  );
}
