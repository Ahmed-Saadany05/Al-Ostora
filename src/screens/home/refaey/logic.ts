/**
 * Pure rules for what Refaey may say. No React, no imports of values (so `node --test` can run it).
 *
 *  - A token ({sunsetIn} …) is filled only when the data source is Horizons. On the demo provider every line (and
 *    reply label) that contains a token is skipped, so Refaey never says a demo number.
 *  - A line with ANY unfilled token is skipped. A node with no lines left is not shown at all.
 *  - `when` conditions gate a node; replies that lead to a hidden node are dropped; a node left without replies
 *    gets a single "OK" that collapses.
 */
import type { DialogueNode, Reply } from './dialogues/dialogues';

export type Token =
  | 'sunElev'
  | 'sunsetIn'
  | 'earthStatus'
  | 'siteName'
  | 'landingDate'
  | 'sunHours'
  | 'earthHours'
  | 'altSite'
  | 'altGain';

export type TokenValues = Partial<Record<Token, string>>;

export interface ResolveContext {
  /** True only when the numbers come from Horizons (not the demo provider). */
  horizons: boolean;
  values: TokenValues;
  flags: { horizonLola?: boolean; altBetter?: boolean; altNone?: boolean };
  /** Label for the closing reply added to a node that would otherwise have none. */
  terminalLabel: string;
  /** Whether an explainer id exists (a reply to a missing explainer is dropped). */
  hasExplainer: (id: string) => boolean;
}

export interface ResolvedNode {
  id: string;
  mood: 'neutral' | 'smile' | 'pointing';
  title?: string;
  lines: string[];
  replies: Reply[];
}

const TOKEN = /\{([A-Za-z]+)\}/g;

/** The text with its tokens filled, or null when it must be skipped. */
export function fill(text: string, ctx: Pick<ResolveContext, 'horizons' | 'values'>): string | null {
  const names = [...text.matchAll(TOKEN)].map((m) => m[1]);
  if (names.length === 0) return text;
  if (!ctx.horizons) return null;
  let out = text;
  for (const n of names) {
    const v = ctx.values[n as Token];
    if (v === undefined || v === '') return null;
    out = out.replaceAll(`{${n}}`, v);
  }
  return out;
}

export function hasConditionMet(node: Pick<DialogueNode, 'when'>, ctx: Pick<ResolveContext, 'flags'>): boolean {
  return !node.when || ctx.flags[node.when] === true;
}

/** Visible = condition met and at least one line survives. */
export function isVisible(node: DialogueNode, ctx: ResolveContext): boolean {
  return hasConditionMet(node, ctx) && node.lines.some((l) => fill(l, ctx) !== null);
}

export function resolveNode(
  node: DialogueNode & { title?: string },
  ctx: ResolveContext,
  lookup: (id: string) => (DialogueNode & { title?: string }) | undefined,
): ResolvedNode | null {
  if (!isVisible(node, ctx)) return null;
  const lines = node.lines.map((l) => fill(l, ctx)).filter((l): l is string => l !== null);
  const replies: Reply[] = [];
  for (const r of node.replies) {
    const label = fill(r.label, ctx);
    if (label === null) continue;
    if (r.next) {
      const target = lookup(r.next);
      if (!target || !isVisible(target, ctx)) continue;
    }
    if (r.action?.type === 'openExplainer' && !ctx.hasExplainer(r.action.id)) continue;
    replies.push({ ...r, label });
  }
  if (replies.length === 0) replies.push({ label: ctx.terminalLabel, action: { type: 'collapse' } });
  return { id: node.id, mood: node.mood ?? 'neutral', title: node.title, lines, replies: replies.slice(0, 3) };
}

/** Group whole lines into beats of at most `maxLines` visual lines. A single line taller than that stays whole. */
export function packBeats(lineCounts: number[], maxLines: number): number[][] {
  const beats: number[][] = [];
  let cur: number[] = [];
  let used = 0;
  lineCounts.forEach((n, i) => {
    if (cur.length > 0 && used + n > maxLines) {
      beats.push(cur);
      cur = [];
      used = 0;
    }
    cur.push(i);
    used += n;
  });
  if (cur.length > 0) beats.push(cur);
  return beats;
}

/**
 * "See it yourself" must never link to a site that is not in the catalogue. If the site is missing, the reply becomes
 * the panels explainer instead (same position, no note).
 */
export function adaptReplies(replies: Reply[], siteExists: (siteId: string) => boolean): Reply[] {
  return replies.map((r) =>
    r.action?.type === 'openPlanner' && !siteExists(r.action.siteId)
      ? { label: 'How panels catch a low Sun', action: { type: 'openExplainer', id: 'upright-panels' } }
      : r,
  );
}
