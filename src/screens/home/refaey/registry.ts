import { EXPLAINERS } from '../explainers';
import { INTRO, MISSIONS, MOMENTS, OUTCOME, type DialogueNode, type Reply } from './dialogues/dialogues';
import { isInternal, SOURCE_CARDS } from './dialogues/sourceCards';
import { REFAEY_COPY } from './copy';

export type RuntimeNode = DialogueNode & { title?: string; link?: { label: string; href: string } };

const all: DialogueNode[] = [...INTRO, ...MISSIONS.flatMap((m) => m.story), ...MOMENTS, ...OUTCOME];
const NODES: Record<string, RuntimeNode> = Object.fromEntries(all.map((n) => [n.id, n]));

export const EXPLAIN_PREFIX = 'explain:';
export const SOURCE_PREFIX = 'source:';

export const hasExplainer = (id: string) => id in EXPLAINERS;

/** An explainer shown as a node: its title and body (sources and notes are never shown). */
function explainerNode(id: string, backTo?: string): RuntimeNode | undefined {
  const e = (EXPLAINERS as Record<string, { title: string; body: string }>)[id];
  if (!e) return undefined;
  const replies: Reply[] = [];
  if (backTo) replies.push({ label: REFAEY_COPY.back, next: backTo });
  replies.push({ label: REFAEY_COPY.ok, action: { type: 'collapse' } });
  return { id: EXPLAIN_PREFIX + id, mood: 'pointing', title: e.title, lines: [e.body], replies };
}

/** A source card shown as a node ("How do you know?"): the source's title, one line on what it says, a link, and Back. */
function sourceNode(id: string, backTo?: string): RuntimeNode | undefined {
  const c = SOURCE_CARDS[id];
  if (!c) return undefined;
  const replies: Reply[] = [{ label: REFAEY_COPY.back, next: backTo ?? '' }];
  return {
    id: SOURCE_PREFIX + id,
    mood: 'neutral',
    title: c.title,
    lines: [c.says],
    replies,
    link: { label: isInternal(c.href) ? 'Open on About' : 'Open the source', href: c.href },
  };
}

/** Look a node up by id: dialogue nodes, `explain:<id>` for an explainer, `source:<id>` for a source card. */
export function getNode(id: string, backTo?: string): RuntimeNode | undefined {
  if (id.startsWith(EXPLAIN_PREFIX)) return explainerNode(id.slice(EXPLAIN_PREFIX.length), backTo);
  if (id.startsWith(SOURCE_PREFIX)) return sourceNode(id.slice(SOURCE_PREFIX.length), backTo);
  return NODES[id];
}
