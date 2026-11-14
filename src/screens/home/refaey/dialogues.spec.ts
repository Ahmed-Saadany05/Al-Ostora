// Run: npx vitest run src/screens/home
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { INTRO, MISSIONS, MISSIONS_HUB, MOMENTS, type DialogueNode } from './dialogues/dialogues';
import { athenaVerdict, recordedTokens } from './facts/display';
import { resolveNode, type ResolveContext } from './logic';

const facts = recordedTokens();
const demo: ResolveContext = {
  horizons: false,
  values: {},
  flags: { athenaSunlit: athenaVerdict() === 'sunlit', athenaHidden: athenaVerdict() === 'hidden' },
  facts,
  terminalLabel: 'OK',
  hasExplainer: () => true,
};
const here = new URL('.', import.meta.url).pathname;

const all = (m: (typeof MISSIONS)[number]) => new Map(m.story.map((n) => [n.id, n]));
const shown = (n: DialogueNode) => resolveNode(n, demo, () => n)?.lines ?? [];
const text = (n: DialogueNode) => shown(n).join(' ');

/** Every number a line may contain that is not a recorded-fact token: a date, or a sourced constant with the URL that backs it. */
const SOURCED: Record<string, string> = {
  '1.5': 'https://science.nasa.gov/resource/shadows-near-the-moons-south-pole/', // Sun never more than 1.5° above or below the horizon at the poles
  '1': 'https://science.nasa.gov/skywatching/faq/', // a little finger at arm's length is about 1°
  '5': 'https://www.nasa.gov/wp-content/uploads/static/history/SP-4029/Apollo_11a_Summary.htm', // Apollo sun-elevation window 5° to 14°
  '14': 'https://www.nasa.gov/wp-content/uploads/static/history/SP-4029/Apollo_11a_Summary.htm',
  '7': 'https://ntrs.nasa.gov/api/citations/20230006313/downloads/IAASS%202023%20Paper_Final_24apr23.pdf', // sun elevations never exceed 7° at the Artemis regions
  '2': 'https://ntrs.nasa.gov/api/citations/20230006313/downloads/IAASS%202023%20Paper_Final_24apr23.pdf', // most of the time at or around 2°
  '0.1': '/about#methods', // engine validation: Horizons Sun elevation vs Scotti & Fjeld (ALSJ), ±0.1° (src/engine/__tests__/horizons.validation.test.ts)
};
const DATES = new Set(['20', '1969', '3', '2019', '2018', '6', '2025', '1972', '4', '12', '16', '17']); // dates, and mission names (Chang'e 4, Apollo 12/16/17), sourced on the mission cards and facts.json

describe('the three stories', () => {
  it('exactly three, unique ids, each with at least one http source', () => {
    expect(MISSIONS.map((m) => m.id)).toEqual(['apollo', 'change-4', 'im-2-athena']);
    for (const m of MISSIONS) expect(m.sources.some((u) => u.startsWith('https://')), m.id).toBe(true);
    expect(MISSIONS_HUB.replies.map((r) => r.next)).toEqual(MISSIONS.map((m) => m.story[0].id));
  });

  for (const m of MISSIONS) {
    const map = all(m);
    it(`${m.id}: every reply target exists, every beat is reachable, none is a dead end`, () => {
      expect(map.size).toBe(m.story.length);
      const seen = new Set<string>();
      const walk = (id: string) => {
        if (seen.has(id)) return;
        seen.add(id);
        const n = map.get(id)!;
        expect(n.replies.length, `${id} replies`).toBeGreaterThanOrEqual(1);
        expect(n.replies.length, `${id} replies`).toBeLessThanOrEqual(3);
        for (const r of n.replies) if (r.next && r.next !== 'missions-hub') {
          expect(map.has(r.next), `${id} -> ${r.next}`).toBe(true);
          walk(r.next);
        }
      };
      walk(m.story[0].id);
      expect([...seen].sort()).toEqual([...map.keys()].sort());
    });

    it(`${m.id}: one final beat with exactly the hand-off, Another story, Plan my own landing; the beat before carries the explainer`, () => {
      const finals = m.story.filter((n) => n.replies.some((r) => r.action?.type === 'openPlanner'));
      expect(finals).toHaveLength(1);
      expect(finals[0].replies.map((r) => r.label)).toEqual(['See the sky at touchdown', 'Another story', 'Plan my own landing']);
      expect(finals[0].replies[0].demoLabel).toBe('Open this site in the planner');
      expect(finals[0].replies[0].action).toMatchObject({ type: 'openPlanner', siteId: m.siteId, at: m.landed });
      expect(finals[0].replies[1].next).toBe('missions-hub');
      const before = m.story.filter((n) => n.replies.some((r) => r.next === finals[0].id));
      expect(before.length).toBeGreaterThan(0);
      expect(before.some((n) => n.replies.some((r) => r.action?.type === 'openExplainer'))).toBe(true);
    });

    it(`${m.id}: every beat is at most 160 characters with its tokens filled, sentence case, no exclamation marks`, () => {
      for (const n of m.story) {
        if (n.when && !demo.flags[n.when]) continue;
        const t = text(n);
        expect(t.length, n.id).toBeGreaterThan(0);
        expect(t.length, `${n.id}: ${t.length}`).toBeLessThanOrEqual(160);
        expect(t).not.toMatch(/!/);
        expect(t).not.toBe(t.toUpperCase());
      }
    });

    it(`${m.id}: no unfilled {token} ever renders, on any provider state`, () => {
      for (const horizons of [false, true])
        for (const n of m.story) {
          const r = resolveNode(n, { ...demo, horizons, flags: { athenaSunlit: true, athenaHidden: true } }, () => n);
          for (const l of r?.lines ?? []) expect(l, n.id).not.toMatch(/[{}]/);
          for (const rep of r?.replies ?? []) expect(rep.label).not.toMatch(/[{}]/);
        }
    });
  }

  it('Athena shows exactly one of the two map beats, by the engine verdict', () => {
    const a = MISSIONS.find((m) => m.id === 'im-2-athena')!;
    const visible = a.story.filter((n) => n.id.startsWith('athena-6') && resolveNode(n, demo, () => n));
    expect(visible).toHaveLength(1);
    expect(visible[0].id).toBe(athenaVerdict() === 'sunlit' ? 'athena-6a' : 'athena-6b');
    const r = a.story.find((n) => n.id === 'athena-5')!;
    expect(resolveNode(r, demo, (id) => a.story.find((x) => x.id === id))!.replies).toHaveLength(1);
  });
});

describe('what Refaey may say', () => {
  const nodes = [...INTRO, ...MOMENTS, MISSIONS_HUB, ...MISSIONS.flatMap((m) => m.story)];
  const raw = (n: DialogueNode) => [...n.lines, ...n.replies.map((r) => r.label)].join(' ');

  it('every digit is a recorded-fact token, a date, or a sourced constant', () => {
    for (const n of nodes) {
      const noTokens = raw(n).replace(/\{\w+\}/g, '');
      for (const d of noTokens.match(/\d+(?:\.\d+)?/g) ?? []) expect(d in SOURCED || DATES.has(d), `"${d}" in ${n.id}`).toBe(true);
    }
    for (const [num, url] of Object.entries(SOURCED)) {
      const used = nodes.filter((n) => raw(n).replace(/\{\w+\}/g, '').match(new RegExp(`(^|[^\\d.])${num.replace('.', '\\.')}(?![\\d.])`)));
      const sources = [...MISSIONS.flatMap((m) => m.sources), ...INTRO_SOURCES];
      if (used.length) expect(sources, `${num} needs ${url}`).toContain(url);
    }
  });

  it('banned wording never appears', () => {
    const banned = [/radio contact/i, /just after (local )?sunrise/i, /early lunar morning/i, /would have saved/i, /as it is today/i, /real terrain shadows/i, /at the south pole/i, /chandrayaan/i, /\bSLIM\b/, /!/];
    for (const n of nodes) for (const b of banned) expect(raw(n), `${b} in ${n.id}`).not.toMatch(b);
    // "lunar day" is the full ~29.5-day cycle, never the sunlit part
    for (const n of nodes) expect(raw(n)).not.toMatch(/lunar day of (sun|day)light/i);
  });

  it('no leftovers of the old stories in my folders; the Chandrayaan-3 facts live in the explainer notes', () => {
    const files = [here + 'dialogues/dialogues.ts', ...readdirSync(here + '../missions').map((f) => here + '../missions/' + f)];
    for (const f of files) expect(readFileSync(f, 'utf8'), f).not.toMatch(/chandrayaan/i);
    const ex = readFileSync(here + '../explainers.ts', 'utf8');
    expect(ex).toMatch(/Chandrayaan-3/);
    expect(ex).toMatch(/near the south pole region/);
    expect(ex).not.toMatch(/lunar day of sunlight/i);
  });
});

/** Where the briefing's own sourced constants come from (1.5° and the little finger). */
const INTRO_SOURCES = ['https://science.nasa.gov/resource/shadows-near-the-moons-south-pole/', 'https://science.nasa.gov/skywatching/faq/'];
