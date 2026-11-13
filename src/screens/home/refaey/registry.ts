import { EXPLAINERS } from '../explainers';
import { ASK, INTRO, MISSIONS, MISSIONS_HUB, MOMENTS, OUTCOME, type DialogueNode, type Reply } from './dialogues/dialogues';
import { REFAEY_COPY } from './copy';

export type RuntimeNode = DialogueNode & { title?: string };

const all: DialogueNode[] = [...INTRO, MISSIONS_HUB, ...MISSIONS.flatMap((m) => m.story), ...MOMENTS, ...OUTCOME];
const NODES: Record<string, RuntimeNode> = Object.fromEntries(all.map((n) => [n.id, n]));

export const EXPLAIN_PREFIX = 'explain:';

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

/** Look a node up by id: dialogue nodes, or `explain:<id>` for an explainer. */
export function getNode(id: string, backTo?: string): RuntimeNode | undefined {
  if (id.startsWith(EXPLAIN_PREFIX)) return explainerNode(id.slice(EXPLAIN_PREFIX.length), backTo);
  return NODES[id];
}

export type AskScreen = keyof typeof ASK;
export const askReplies = (screen: AskScreen): Reply[] => ASK[screen] ?? [];
