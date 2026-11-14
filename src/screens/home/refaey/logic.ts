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
  | 'altDate'
  | 'altGain';

export type TokenValues = Partial<Record<Token, string>>;

export interface ResolveContext {
  /** True only when the numbers come from Horizons (not the demo provider). */
  horizons: boolean;
  values: TokenValues;
  flags: { horizonLola?: boolean; altBetter?: boolean; altBetterDate?: boolean; athenaSunlit?: boolean; athenaHidden?: boolean };
  /**
   * Recorded JPL Horizons facts (facts/facts.json), already formatted. Unlike `values` they are not live: they fill on every
   * provider, because they are history (a landing in 1969), not a prediction.
   */
  facts?: Partial<Record<string, string>>;
  /** Story tokens ({callsign}): not data, they fill on every provider. */
  story?: Partial<Record<string, string>>;
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
  /** True when a line shown uses a recorded Horizons fact. */
  usesFacts: boolean;
  transition?: true;
  learns?: true;
  /** A source card's link. */
  link?: { label: string; href: string };
}

const TOKEN = /\{([A-Za-z0-9]+)\}/g;

/** The text with its tokens filled, or null when it must be skipped. */
export function fill(
  text: string,
  ctx: Pick<ResolveContext, 'horizons' | 'values'> & { facts?: Partial<Record<string, string>>; story?: Partial<Record<string, string>> },
): string | null {
  const names = [...text.matchAll(TOKEN)].map((m) => m[1]);
  if (names.length === 0) return text;
  let out = text;
  for (const n of names) {
    const known = ctx.story?.[n] ?? ctx.facts?.[n];
    if (known !== undefined && known !== '') {
      out = out.replaceAll(`{${n}}`, known);
      continue;
    }
    if (!ctx.horizons) return null;
    const v = ctx.values[n as Token];
    if (v === undefined || v === '') return null;
    out = out.replaceAll(`{${n}}`, v);
  }
  return out;
}

/** Does this text use a recorded fact (so the "JPL Horizons · recorded" label belongs next to it)? */
export function usesFact(text: string, ctx: Pick<ResolveContext, 'facts'>): boolean {
  return [...text.matchAll(TOKEN)].some((m) => (ctx.facts?.[m[1]] ?? '') !== '');
}

export function hasConditionMet(node: Pick<DialogueNode, 'when'>, ctx: Pick<ResolveContext, 'flags'>): boolean {
  return !node.when || ctx.flags[node.when] === true;
}

/** Visible = condition met and at least one line survives. */
export function isVisible(node: DialogueNode, ctx: ResolveContext): boolean {
  return hasConditionMet(node, ctx) && node.lines.some((l) => fill(l, ctx) !== null);
}

export function resolveNode(
  node: DialogueNode & { title?: string; link?: { label: string; href: string } },
  ctx: ResolveContext,
  lookup: (id: string) => (DialogueNode & { title?: string }) | undefined,
): ResolvedNode | null {
  if (!isVisible(node, ctx)) return null;
  const lines = node.lines.map((l) => fill(l, ctx)).filter((l): l is string => l !== null);
  const replies: Reply[] = [];
  for (const r of node.replies) {
    const label = fill(r.label, ctx);
    if (label === null) continue;
    // 'missions-hub' is the list itself (the /missions page handles it), not a beat.
    if (r.next && r.next !== 'missions-hub') {
      const target = lookup(r.next);
      if (!target || !isVisible(target, ctx)) continue;
    }
    if (r.action?.type === 'openExplainer' && !ctx.hasExplainer(r.action.id)) continue;
    replies.push({ ...r, label });
  }
  if (replies.length === 0) replies.push({ label: ctx.terminalLabel, action: { type: 'collapse' } });
  return { id: node.id, mood: node.mood ?? 'neutral', title: node.title, lines, replies: replies.slice(0, 3), usesFacts: node.lines.some((l) => fill(l, ctx) !== null && usesFact(l, ctx)), transition: node.transition, learns: node.learns, link: node.link };
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
 * Adapts the hand-off replies of a story to what is true right now.
 *  - "See the sky at touchdown" opens the site AT the landing moment, on the live provider only. On the demo provider the
 *    reply uses its `demoLabel` and carries no `at`: nothing may claim to show the landing day with placeholder numbers.
 *  - If the site is not in the catalogue the reply becomes the panels explainer (same position); we never link to a missing site.
 */
export function adaptReplies(replies: Reply[], siteExists: (siteId: string) => boolean, live: boolean): Reply[] {
  return replies.map((r) => {
    if (r.action?.type !== 'openPlanner') return r;
    if (!siteExists(r.action.siteId)) return { label: 'How panels catch a low Sun', action: { type: 'openExplainer', id: 'upright-panels' } };
    if (live) return r;
    const { at: _at, ...action } = r.action;
    return { ...r, label: r.demoLabel ?? r.label, action };
  });
}
