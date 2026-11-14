// Run: npx vitest run src/screens/home
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CALLSIGNS, DEFAULT_CALLSIGN, HUB, INTRO, MISSIONS, MOMENTS, OUTCOME, standNode, type DialogueNode } from './dialogues/dialogues';
import { SOURCE_CARDS } from './dialogues/sourceCards';
import { athenaVerdict, recordedTokens } from './facts/display';
import { resolveNode, type ResolveContext } from './logic';

const facts = recordedTokens();
const flagsFor = (sunlit: boolean) => ({ athenaSunlit: sunlit, athenaHidden: !sunlit });
const ctxFor = (o: { horizons?: boolean; callsign?: string; sunlit?: boolean } = {}): ResolveContext => ({
  horizons: o.horizons ?? false,
  values: o.horizons
    ? { siteName: 'Shackleton Connecting Ridge', landingDate: '27 Nov 2026', sunHours: '25 days', earthHours: '14 days', altSite: 'Other site', altDate: '1 Dec 2026', altGain: '3 hours', sunElev: '+1.5°', sunsetIn: '12d 01h', earthStatus: 'below the horizon' }
    : {},
  flags: { ...flagsFor(o.sunlit ?? athenaVerdict() === 'sunlit'), altBetter: true, horizonLola: true },
  facts,
  story: { callsign: o.callsign ?? DEFAULT_CALLSIGN },
  terminalLabel: 'OK',
  hasExplainer: () => true,
});
const here = new URL('.', import.meta.url).pathname;

type Graph = Map<string, DialogueNode>;
const graphOf = (nodes: DialogueNode[]): Graph => new Map(nodes.map((n) => [n.id, n]));
const resolved = (g: Graph, id: string, ctx: ResolveContext) => resolveNode(g.get(id)!, ctx, (x) => g.get(x));
const raw = (n: DialogueNode) => [...n.lines, ...n.replies.map((r) => r.label)].join(' ').replace(/\{\w+\}/g, '');
const text = (g: Graph, id: string, ctx: ResolveContext) => resolved(g, id, ctx)?.lines.join(' ') ?? '';

/** Every number a line may contain that is not a recorded-fact token: a date, a mission name, a callsign, a guess option, or a sourced constant with the URL that backs it. */
const SOURCED: Record<string, string> = {
  '1.5': 'https://science.nasa.gov/resource/shadows-near-the-moons-south-pole/', // Sun never more than 1.5° above or below the horizon at the poles
  '1': 'https://science.nasa.gov/skywatching/faq/', // a little finger at arm's length is about 1°
  '5': 'https://www.nasa.gov/wp-content/uploads/static/history/SP-4029/Apollo_11a_Summary.htm', // Apollo sun-elevation window 5° to 14°
  '14': 'https://www.nasa.gov/wp-content/uploads/static/history/SP-4029/Apollo_11a_Summary.htm',
  '7': 'https://ntrs.nasa.gov/api/citations/20230006313/downloads/IAASS%202023%20Paper_Final_24apr23.pdf', // sun elevations never exceed 7° at the Artemis regions
  '2': 'https://ntrs.nasa.gov/api/citations/20230006313/downloads/IAASS%202023%20Paper_Final_24apr23.pdf', // most of the time at or around 2°
  '0.1': '/about#methods', // engine validation: Horizons vs Scotti & Fjeld (ALSJ), ±0.1°
};
const NOT_CLAIMS = new Set(['20', '1969', '3', '2019', '2018', '6', '2025', '4', '12', '16', '17', '45']); // dates, mission names, and the guess options "About 20° / 45°"
const EXTRA_SOURCES = ['https://science.nasa.gov/resource/shadows-near-the-moons-south-pole/', 'https://science.nasa.gov/skywatching/faq/'];
const NUMBER = /\d[\d.]*\s?°|\{(a11Sun|a12Sun|a16Sun|a17Sun|ce4Sun|ce4EarthBelow|ce4SinceSunrise|ce4DaylightLeft|athenaSun|athenaDemRes)\}/;

const briefing = graphOf(INTRO);
const storyGraph = (m: (typeof MISSIONS)[number]) => graphOf(m.story);
const groups: { name: string; g: Graph; start: string; finals: string[] }[] = [
  { name: 'briefing', g: briefing, start: 'b1', finals: ['b7', 'b7r'] },
  ...MISSIONS.map((m) => ({ name: m.id, g: storyGraph(m), start: m.story[0].id, finals: m.story.filter((n) => n.learns).map((n) => n.id) })),
];

describe('the conversation graph', () => {
  for (const { name, g, start, finals } of groups) {
    describe(name, () => {
      for (const sunlit of [true, false]) {
        const ctx = ctxFor({ sunlit });
        it(`every reply target exists, every beat is reachable, every path ends at a final beat (Athena map ${sunlit ? 'sunlit' : 'hidden'})`, () => {
          const seen = new Set<string>();
          const walk = (id: string, path: string[]) => {
            const r = resolved(g, id, ctx);
            if (!r) return;
            if (seen.has(id)) return; // "Back" returns to a beat already visited
            seen.add(id);
            const next = r.replies.filter((x) => x.next && x.next !== 'missions-hub' && x.label !== 'Back').map((x) => x.next as string);
            for (const n of next) expect(g.has(n), `${id} -> ${n}`).toBe(true);
            const leaves = r.replies.some((x) => x.action || x.next === 'missions-hub');
            if (!next.length) expect(leaves || finals.includes(id), `${id} is a dead end`).toBe(true);
            for (const n of next) walk(n, [...path, id]);
          };
          walk(start, []);
          const visible = [...g.keys()].filter((id) => resolved(g, id, ctx) && !(name === 'briefing' && false));
          expect([...seen].sort(), 'orphan beats').toEqual(visible.sort());
        });

        it('every non-final beat has 2–3 replies, or is a marked transition (at most one transition on any path)', () => {
          const walk = (id: string, transitions: number) => {
            const r = resolved(g, id, ctx);
            if (!r) return;
            const isFinal = finals.includes(id);
            expect(r.replies.length, `${id}`).toBeLessThanOrEqual(3);
            if (!isFinal && r.replies.length === 1) {
              expect(g.get(id)!.transition, `${id} has one reply but is not a transition`).toBe(true);
            }
            const t = transitions + (g.get(id)!.transition ? 1 : 0);
            expect(t, `${id}: more than one transition on a path`).toBeLessThanOrEqual(1);
            for (const x of r.replies) if (x.next && x.next !== 'missions-hub' && x.label !== 'Back') walk(x.next, t);
          };
          walk(start, 0);
        });
      }

      it('beats are at most 160 characters with every token filled (all callsigns), sentence case, no exclamation marks', () => {
        for (const callsign of CALLSIGNS)
          for (const n of g.values()) {
            const ctx = ctxFor({ callsign, sunlit: n.when !== 'athenaHidden' });
            if (n.when && !ctx.flags[n.when]) continue;
            const t = text(g, n.id, ctx);
            expect(t.length, n.id).toBeGreaterThan(0);
            expect(t.length, `${n.id}: ${t.length}`).toBeLessThanOrEqual(160 + (n.lines.length - 1));
            expect(t).not.toMatch(/!/);
            expect(t).not.toBe(t.toUpperCase());
          }
      });

      it('no unfilled {token} ever renders, on the demo provider or the live one; live tokens skip on demo', () => {
        for (const horizons of [false, true])
          for (const n of g.values()) {
            const r = resolveNode(n, { ...ctxFor({ horizons }), flags: { athenaSunlit: true, athenaHidden: true, altBetter: true } }, (x) => g.get(x));
            for (const l of r?.lines ?? []) expect(l, n.id).not.toMatch(/[{}]/);
            for (const rep of r?.replies ?? []) expect(rep.label, n.id).not.toMatch(/[{}]/);
          }
      });

      it('every beat with a number offers "How do you know?" (a source card that exists)', () => {
        for (const n of g.values()) {
          const hasNumber = NUMBER.test([...n.lines].join(' '));
          const source = n.replies.find((r) => r.action?.type === 'showSource');
          if (hasNumber) expect(source, `${n.id} quotes a number`).toBeDefined();
          if (source && source.action?.type === 'showSource') expect(SOURCE_CARDS[source.action.id], source.action.id).toBeDefined();
        }
      });
    });
  }

  it('the final beat of each story: learns the lesson; exactly the hand-off, Another story and Plan {callsign}\'s landing', () => {
    for (const m of MISSIONS) {
      const finals = m.story.filter((n) => n.learns);
      expect(finals, m.id).toHaveLength(1);
      expect(finals[0].replies.map((r) => r.label)).toEqual(['See the sky at touchdown', 'Another story', "Plan {callsign}'s landing"]);
      expect(finals[0].replies[0].demoLabel).toBe('Open this site in the planner');
      // and all three survive resolving ("Another story" leads to the list, which is not a beat)
      expect(resolved(storyGraph(m), finals[0].id, ctxFor())!.replies.map((r) => r.label), `${m.id} resolved`).toEqual(['See the sky at touchdown', 'Another story', "Plan Ostora-1's landing"]);
      expect(finals[0].replies[0].action).toMatchObject({ type: 'openPlanner', siteId: m.siteId, at: m.landed });
    }
  });

  it('the briefing: a callsign pick with three choices, and the last beat offers missions, planning and "What\'s real here?"', () => {
    const b6 = INTRO.find((n) => n.id === 'b6')!;
    expect(b6.replies.map((r) => r.callsign)).toEqual(['Shams', 'Ostora-1', 'Horus']);
    expect(b6.replies.map((r) => r.next)).toEqual(['b6s', 'b6o', 'b6h']);
    const b7 = INTRO.find((n) => n.id === 'b7')!;
    expect(b7.replies.map((r) => r.label)).toEqual(['Show me the landings', 'Straight to planning', "What's real here?"]);
    expect(b7.replies[0].action).toEqual({ type: 'navigate', to: '/missions' });
    expect(b7.replies[1].action).toEqual({ type: 'navigate', to: '/mission' });
    expect(INTRO.find((n) => n.id === 'b7r')!.replies.map((r) => r.action ?? r.next)).toEqual(['b7', { type: 'navigate', to: '/about' }]);
  });

  it('the three guess beats lead to different reactions that rejoin', () => {
    const guess = (m: string, id: string) => MISSIONS.find((x) => x.id === m)!.story.find((n) => n.id === id)!;
    expect(new Set(guess('apollo', 'a1').replies.map((r) => r.next)).size).toBe(3);
    expect(new Set(guess('change-4', 'c1').replies.map((r) => r.next))).toEqual(new Set(['c2w', 'c2r']));
    expect(new Set(guess('im-2-athena', 't4').replies.map((r) => r.next))).toEqual(new Set(['t5r', 't5']));
    for (const [m, ids] of [['apollo', ['a2h', 'a2l', 'a2d']], ['change-4', ['c2w', 'c2r']], ['im-2-athena', ['t5r', 't5']]] as const) {
      const nexts = new Set(ids.flatMap((id) => guess(m, id).replies.map((r) => r.next)).filter(Boolean));
      expect(nexts.size, `${m}: reactions rejoin within a beat`).toBeLessThanOrEqual(2);
    }
  });
});

describe('moments and the touchdown card', () => {
  const stand = (o: Partial<Parameters<typeof standNode>[0]> = {}) => standNode({ fromCompare: false, lola: true, live: true, sunUp: true, earthUp: true, ...o });
  const all: DialogueNode[] = [
    ...MOMENTS,
    ...OUTCOME,
    stand(),
    stand({ fromCompare: true }),
    stand({ lola: false, live: false }),
    stand({ sunUp: false }),
    stand({ earthUp: false }),
  ];

  it('the stand card opens with the hatch line, with "My old window is gone." first when arriving from Compare dates', () => {
    expect(stand().lines[0]).toBe("This is the view from {callsign}'s hatch.");
    expect(stand({ fromCompare: true }).lines[0]).toBe("My old window is gone. This is the view from {callsign}'s hatch.");
    expect(stand({ lola: false }).lines.join(' ')).not.toMatch(/laser/);
    expect(stand({ live: false }).lines.join(' ')).not.toMatch(/Sun \{/);
    expect(stand({ sunUp: false }).lines.at(-1)).toBe("I'd be in the dark here. Try dragging the timeline.");
    expect(stand({ earthUp: false }).lines.at(-1)).toBe("Nice light, but I can't call home from here. Watch the Earth row.");
  });

  it('on the demo provider the stand card has no live numbers', () => {
    const g = graphOf([stand({ live: true })]);
    const r = resolved(g, 'moment-stand', ctxFor({ horizons: false, callsign: 'Shams' }));
    expect(r!.lines.join(' ')).not.toMatch(/\d/);
  });

  it('the touchdown card: the live story, the alternative only with a flag, a neutral close, and the quiet demo line', () => {
    const g = graphOf(OUTCOME);
    const live = ctxFor({ horizons: true });
    expect(text(g, 'outcome-play', live)).toMatch(/Ostora-1 is down at Shackleton Connecting Ridge, 27 Nov 2026\. First daytime: 25 days of sunlight, Earth in view for 14 days\./);
    expect(resolved(g, 'outcome-alt', live)).not.toBeNull();
    expect(resolved(g, 'outcome-alt', { ...live, flags: {} })).toBeNull();
    expect(resolved(g, 'outcome-play', { ...live, flags: {} })!.replies.map((r) => r.next)).toEqual(['outcome-close']);
    expect(resolved(g, 'outcome-play', ctxFor({ horizons: false }))).toBeNull();
    expect(text(g, 'outcome-demo', ctxFor())).toBe("Those numbers need live NASA data, so I'll keep quiet rather than guess.");
    expect(text(g, 'outcome-close', ctxFor())).toBe("That's my landing. Thank you for planning it with me.");
    expect(g.get('outcome-close')!.replies.map((r) => r.label)).toEqual(['Plan another landing', 'Back to the missions', "What's real here?"]);
  });

  it('no claim of "nothing nearby beats that", no digits in moment text', () => {
    for (const n of all) {
      expect(raw(n)).not.toMatch(/nothing nearby|nothing beats|nicely planned/i);
      expect(raw(n)).not.toMatch(/\d/);
    }
  });
});

describe('what Refaey may say', () => {
  const nodes = [...INTRO, ...MOMENTS, ...OUTCOME, ...MISSIONS.flatMap((m) => m.story)];

  it('every digit is a recorded-fact token, a date or name, or a sourced constant (and the source is listed)', () => {
    for (const n of nodes) {
      for (const d of raw(n).match(/\d+(?:\.\d+)?/g) ?? []) expect(d in SOURCED || NOT_CLAIMS.has(d), `"${d}" in ${n.id}`).toBe(true);
    }
    const listed = [...MISSIONS.flatMap((m) => m.sources), ...EXTRA_SOURCES, ...Object.values(SOURCE_CARDS).map((c) => c.href)];
    for (const [num, url] of Object.entries(SOURCED)) {
      const used = nodes.filter((n) => raw(n).match(new RegExp(`(^|[^\\d.])${num.replace('.', '\\.')}(?![\\d.])`)));
      if (used.length) expect(listed, `${num} needs ${url}`).toContain(url);
    }
  });

  it('banned wording never appears (cut claims, radio contact, "saved", Chandrayaan/SLIM, exclamation marks)', () => {
    const banned = [
      /radio contact/i, /just after (local )?sunrise/i, /early lunar morning/i, /would have saved/i, /as it is today/i, /real terrain shadows/i,
      /at the south pole/i, /chandrayaan/i, /\bSLIM\b/, /!/, /nothing nearby/i, /behind him/i, /swallow/i, /wrong way/i, /deep cold/i,
      /did not expect/i, /small crater/i, /every rock/i, /degrees up and down/i,
    ];
    const cards = Object.values(SOURCE_CARDS).map((c) => ({ id: c.title, lines: [c.says], replies: [] }) as unknown as DialogueNode);
    for (const n of [...nodes, ...cards]) for (const b of banned) expect([...n.lines, ...n.replies.map((r) => r.label)].join(' '), `${b} in ${n.id}`).not.toMatch(b);
    for (const n of nodes) expect(raw(n)).not.toMatch(/lunar day of (sun|day)light/i);
    expect(Object.values(HUB).join(' ')).not.toMatch(/!/);
  });

  it('every source card has a title, one line, and a link (https or /about#…)', () => {
    for (const [id, c] of Object.entries(SOURCE_CARDS)) {
      expect(c.title && c.says, id).toBeTruthy();
      expect(c.href.startsWith('https://') || c.href.startsWith('/about#'), id).toBe(true);
    }
  });

  it('no leftovers of the old stories in my folders; the Chandrayaan-3 facts live in the explainer notes', () => {
    const files = [here + 'dialogues/dialogues.ts', ...readdirSync(here + '../missions').filter((f) => /\.(tsx?|css)$/.test(f) && !/e2e/.test(f)).map((f) => here + '../missions/' + f)];
    for (const f of files) expect(readFileSync(f, 'utf8'), f).not.toMatch(/chandrayaan/i);
    const ex = readFileSync(here + '../explainers.ts', 'utf8');
    expect(ex).toMatch(/Chandrayaan-3/);
    expect(ex).toMatch(/near the south pole region/);
    expect(ex).not.toMatch(/lunar day of sunlight/i);
  });
});
