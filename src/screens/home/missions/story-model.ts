/**
 * For the browser checks: walks the script data itself, so the tests follow the script when it changes.
 * (Pure; imports only the dialogue data and the recorded-facts JSON.)
 */
import { readFileSync } from 'node:fs';
import { DEFAULT_CALLSIGN, INTRO, MISSIONS, type DialogueNode, type Reply } from '../refaey/dialogues/dialogues';

const facts = JSON.parse(readFileSync(new URL('../refaey/facts/facts.json', import.meta.url), 'utf8')) as { facts: { key: string; value: string | number }[] };
export const ATHENA_SUNLIT = facts.facts.find((f) => f.key === 'athenaVerdict')?.value !== 'hidden';

/** A label as it reads on screen, with the default callsign. */
export const label = (r: Reply, live: boolean) => (!live && r.demoLabel ? r.demoLabel : r.label).replaceAll('{callsign}', DEFAULT_CALLSIGN);

const visible = (n: DialogueNode) => !n.when || (n.when === 'athenaSunlit' ? ATHENA_SUNLIT : n.when === 'athenaHidden' ? !ATHENA_SUNLIT : true);

export interface BeatPath {
  id: string;
  node: DialogueNode;
  /** Reply labels to click from the first beat to reach it. */
  clicks: string[];
}

/** Shortest click path to every reachable, visible beat (edges: replies with a `next`). */
export function pathsOf(nodes: DialogueNode[], start: string, live: boolean): BeatPath[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const out: BeatPath[] = [{ id: start, node: byId.get(start)!, clicks: [] }];
  const seen = new Set([start]);
  for (let i = 0; i < out.length; i++) {
    const cur = out[i];
    for (const r of cur.node.replies) {
      if (!r.next || r.next === 'missions-hub' || r.label === 'Back') continue;
      const n = byId.get(r.next);
      if (!n || !visible(n) || seen.has(n.id)) continue;
      seen.add(n.id);
      out.push({ id: n.id, node: n, clicks: [...cur.clicks, label(r, live)] });
    }
  }
  return out;
}

export const STORIES = MISSIONS.map((m) => ({ ...m, beats: (live: boolean) => pathsOf(m.story, m.story[0].id, live) }));
export const BRIEFING = (live: boolean) => pathsOf(INTRO, 'b1', live);
export const FACT_TOKEN = /\{(a11Sun|a12Sun|a16Sun|a17Sun|ce4Sun|ce4EarthBelow|ce4SinceSunrise|ce4DaylightLeft|athenaSun|athenaDemRes)\}/;
