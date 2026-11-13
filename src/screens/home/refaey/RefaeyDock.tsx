import { useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Refaey, portraitLabel } from './Refaey';
import { DialoguePanel, type PanelContent } from './DialoguePanel';
import { REFAEY_COPY } from './copy';
import type { DialogueAction, Reply } from './dialogues/dialogues';
import { resolveNode, type ResolveContext } from './logic';
import { askReplies, getNode, hasExplainer, EXPLAIN_PREFIX, type AskScreen, type RuntimeNode } from './registry';
import { useRefaey } from './store';
import s from './refaey.module.css';

export interface DockProps {
  /** Which screen's "Ask Refaey" questions to offer. */
  screen: AskScreen;
  /** Token values and conditions for this screen (see logic.ts). */
  context: Omit<ResolveContext, 'terminalLabel' | 'hasExplainer'>;
  /** Handle an action yourself (return true); otherwise navigate, open explainers and collapse are handled here. */
  onAction?: (action: DialogueAction) => boolean | void;
  /** Sit above the shared status bar (every screen except Home, which hides it). Default true. */
  aboveStatusBar?: boolean;
  /** Replace node lookup (the dev sandbox adds test nodes). */
  lookup?: (id: string, backTo?: string) => RuntimeNode | undefined;
}

/**
 * Refaey on a screen: a small portrait bottom-right; click it for "Ask Refaey" (2–3 scripted questions for the screen);
 * or a screen/moment opens a bubble above it. State (which node, what was seen) lives in the store.
 */
export function RefaeyDock({ screen, context, onAction, aboveStatusBar = true, lookup = getNode }: DockProps) {
  const navigate = useNavigate();
  const { open, mode, nodeId, trail, openAsk, goto, back, collapse } = useRefaey();
  const portrait = useRef<HTMLButtonElement>(null);
  const backTo = trail[trail.length - 1];

  const ctx: ResolveContext = useMemo(() => ({ ...context, terminalLabel: REFAEY_COPY.ok, hasExplainer }), [context]);

  const node = open && mode === 'node' && nodeId ? lookup(nodeId, backTo) : undefined;
  const resolved = useMemo(() => (node ? resolveNode(node, ctx, (id) => lookup(id, backTo)) : null), [node, ctx, lookup, backTo]);

  // A node that is not allowed to show (a condition, or no line has its data) closes instead of showing nothing.
  useEffect(() => {
    if (open && mode === 'node' && nodeId && !resolved) collapse();
  }, [open, mode, nodeId, resolved, collapse]);

  const collapseAndReturnFocus = () => {
    collapse();
    requestAnimationFrame(() => portrait.current?.focus());
  };

  const content: PanelContent | null =
    open && mode === 'ask'
      ? { key: 'ask', title: REFAEY_COPY.askTitle, lines: [], replies: askReplies(screen).filter((r) => !(r.action?.type === 'openExplainer' && !hasExplainer(r.action.id))).slice(0, 3) }
      : resolved
        ? { key: resolved.id, title: resolved.title, lines: resolved.lines, replies: resolved.replies }
        : null;

  const handle = (reply: Reply) => {
    if (reply.next) {
      // "Back" from an explainer steps back along the trail instead of growing it.
      if (reply.next === backTo && nodeId?.startsWith(EXPLAIN_PREFIX)) back();
      else goto(reply.next);
      return;
    }
    const a = reply.action;
    if (!a) return;
    if (onAction?.(a) === true) return;
    if (a.type === 'collapse') collapseAndReturnFocus();
    else if (a.type === 'openExplainer') goto(EXPLAIN_PREFIX + a.id);
    else if (a.type === 'navigate') {
      collapse();
      navigate(a.to);
    }
  };

  const mood = resolved?.mood ?? 'neutral';

  return (
    <aside className={[s.dock, aboveStatusBar ? s.aboveBar : ''].join(' ')} aria-label={REFAEY_COPY.name}>
      {content && <DialoguePanel content={content} onReply={handle} onCollapse={collapseAndReturnFocus} />}
      <button
        ref={portrait}
        type="button"
        className={s.portrait}
        aria-label={open ? REFAEY_COPY.collapse : REFAEY_COPY.askOpen}
        aria-expanded={open}
        onClick={() => (open ? collapseAndReturnFocus() : openAsk())}
      >
        <Refaey mood={mood} label={portraitLabel(mood)} />
      </button>
    </aside>
  );
}
