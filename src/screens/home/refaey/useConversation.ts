import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { REFAEY_COPY } from './copy';
import type { DialogueAction, Reply } from './dialogues/dialogues';
import { resolveNode, type ResolveContext } from './logic';
import { askReplies, EXPLAIN_PREFIX, getNode, hasExplainer, type AskScreen, type RuntimeNode } from './registry';
import { useRefaey } from './store';
import type { PanelContent } from './DialogueText';

export interface ConversationOptions {
  screen: AskScreen;
  context: Omit<ResolveContext, 'terminalLabel' | 'hasExplainer'>;
  /** Handle an action yourself (return true); otherwise navigate, open explainers and collapse are handled here. */
  onAction?: (action: DialogueAction) => boolean | void;
  lookup?: (id: string, backTo?: string) => RuntimeNode | undefined;
}

/** What Refaey is saying right now and what each reply does. Shared by the Home stage and the dock on other screens. */
export function useConversation({ screen, context, onAction, lookup = getNode }: ConversationOptions) {
  const navigate = useNavigate();
  const { open, mode, nodeId, trail, goto, back, collapse } = useRefaey();
  const backTo = trail[trail.length - 1];
  const ctx: ResolveContext = useMemo(() => ({ ...context, terminalLabel: REFAEY_COPY.ok, hasExplainer }), [context]);

  const node = open && mode === 'node' && nodeId ? lookup(nodeId, backTo) : undefined;
  const resolved = useMemo(() => (node ? resolveNode(node, ctx, (id) => lookup(id, backTo)) : null), [node, ctx, lookup, backTo]);

  const content: PanelContent | null =
    open && mode === 'ask'
      ? {
          key: 'ask',
          title: REFAEY_COPY.askTitle,
          lines: [],
          replies: askReplies(screen)
            .filter((r) => !(r.action?.type === 'openExplainer' && !hasExplainer(r.action.id)))
            .slice(0, 3),
        }
      : resolved
        ? { key: resolved.id, title: resolved.title, lines: resolved.lines, replies: resolved.replies }
        : null;

  /** A node that may not show (a condition, or no line has its data) closes instead of showing nothing. */
  const shouldClose = open && mode === 'node' && !!nodeId && !resolved;

  const handle = (reply: Reply, close: () => void) => {
    if (reply.next) {
      // "Back" from an explainer steps back along the trail instead of growing it.
      if (reply.next === backTo && nodeId?.startsWith(EXPLAIN_PREFIX)) back();
      else goto(reply.next);
      return;
    }
    const a = reply.action;
    if (!a) return;
    if (onAction?.(a) === true) return;
    if (a.type === 'collapse') close();
    else if (a.type === 'openExplainer') goto(EXPLAIN_PREFIX + a.id);
    else if (a.type === 'navigate') {
      collapse();
      navigate(a.to);
    }
  };

  return { open, mode, content, mood: resolved?.mood ?? 'neutral', shouldClose, handle, collapse };
}
