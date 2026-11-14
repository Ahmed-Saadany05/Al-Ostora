import type { DialogueAction, Reply } from './dialogues/dialogues';
import { EXPLAIN_PREFIX, SOURCE_PREFIX } from './registry';

/**
 * Where a reply takes a conversation. The trail is the list of beat ids so far; explainers and source cards are pushed on it
 * as `explain:<id>` / `source:<id>`, and "Back" pops them. Anything that leaves the conversation (navigate, planner, collapse…)
 * is returned for the caller to handle.
 */
export function advance(ids: string[], reply: Reply): { ids: string[]; action?: DialogueAction } {
  const previous = ids[ids.length - 2];
  if (reply.next) return { ids: reply.next === previous ? ids.slice(0, -1) : [...ids, reply.next] };
  const a = reply.action;
  if (a?.type === 'openExplainer') return { ids: [...ids, EXPLAIN_PREFIX + a.id] };
  if (a?.type === 'showSource') return { ids: [...ids, SOURCE_PREFIX + a.id] };
  return { ids, action: a };
}

/** "OK" on an explainer or a source card goes back to the beat it was opened from. */
export const isSideNode = (id: string | undefined) => !!id && (id.startsWith(EXPLAIN_PREFIX) || id.startsWith(SOURCE_PREFIX));
