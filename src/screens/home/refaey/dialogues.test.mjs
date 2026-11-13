// Run: node --test src/screens/home/refaey/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { MISSIONS, MISSIONS_HUB, SEE_IT_NOTE } from './dialogues/dialogues.ts';
import { resolveNode, adaptReplies } from './logic.ts';

const demo = { horizons: false, values: {}, flags: {}, terminalLabel: 'OK', hasExplainer: () => true };
const beatText = (n) => n.lines.join(' ');
const nodes = (m) => new Map(m.story.map((n) => [n.id, n]));

test('exactly three missions with unique ids and at least one source URL each', () => {
  assert.equal(MISSIONS.length, 3);
  assert.deepEqual(MISSIONS.map((m) => m.id), ['im-2-athena', 'change-4', 'apollo']);
  assert.equal(new Set(MISSIONS.map((m) => m.id)).size, 3);
  for (const m of MISSIONS) assert.ok(m.sources.length >= 1 && m.sources.every((u) => /^https?:\/\//.test(u)), m.id);
  assert.deepEqual(MISSIONS.map((m) => m.lesson), ['power', 'comms', 'timing']);
});

test('the hub lists exactly these three stories and every target exists', () => {
  const firsts = MISSIONS.map((m) => m.story[0].id);
  assert.deepEqual(MISSIONS_HUB.replies.map((r) => r.next), firsts);
});

for (const m of MISSIONS) {
  test(`${m.id}: ids unique, every reply target resolves, every beat reachable from beat 1`, () => {
    const map = nodes(m);
    assert.equal(map.size, m.story.length, 'duplicate beat ids');
    const seen = new Set();
    const walk = (id) => {
      if (seen.has(id)) return;
      seen.add(id);
      for (const r of map.get(id).replies) if (r.next && r.next !== 'missions-hub') {
        assert.ok(map.has(r.next), `${id} -> ${r.next} does not exist`);
        walk(r.next);
      }
    };
    walk(m.story[0].id);
    assert.deepEqual([...seen].sort(), [...map.keys()].sort(), 'orphan beats');
  });

  test(`${m.id}: no dead ends; every path ends at the three final replies`, () => {
    const map = nodes(m);
    const finals = m.story.filter((n) => n.replies.some((r) => r.label === 'See it yourself'));
    assert.equal(finals.length, 1, 'one final beat');
    assert.deepEqual(finals[0].replies.map((r) => r.label), ['See it yourself', 'Tell me another story', 'Plan my own landing']);
    assert.equal(finals[0].replies[0].action.siteId, m.siteId);
    assert.equal(finals[0].replies[0].note, SEE_IT_NOTE);
    assert.ok(SEE_IT_NOTE.length < 160);
    assert.equal(finals[0].replies[1].next, 'missions-hub');
    assert.deepEqual(finals[0].replies[2].action, { type: 'navigate', to: '/mission' });
    for (const n of m.story) {
      assert.ok(n.replies.length >= 1 && n.replies.length <= 3, `${n.id}: 1–3 replies`);
      if (n !== finals[0]) assert.ok(n.replies.every((r) => r.next && map.has(r.next)), `${n.id}: only story replies`);
    }
  });

  test(`${m.id}: beats are ≤ 160 characters and sentence case`, () => {
    for (const n of m.story) {
      assert.ok(beatText(n).length <= 160, `${n.id} is ${beatText(n).length} characters`);
      for (const l of n.lines) assert.notEqual(l, l.toUpperCase(), `${n.id}: no all-caps lines`);
      for (const r of n.replies) assert.ok(r.label.length <= 40, `${n.id}: reply too long: ${r.label}`);
    }
  });

  test(`${m.id}: on demo data no rendered line has an unfilled {token}`, () => {
    for (const n of m.story) {
      const r = resolveNode(n, demo, (id) => nodes(m).get(id));
      assert.ok(r, `${n.id} should still show on demo data`);
      assert.deepEqual(r.lines, n.lines);
      assert.ok(r.lines.every((l) => !/[{}]/.test(l)), n.id);
    }
  });
}

test('no beat of a non-polar mission says "at the south pole"', () => {
  for (const m of MISSIONS.filter((x) => x.id !== 'im-2-athena'))
    for (const n of m.story) assert.ok(!/at the south pole/i.test(beatText(n)), n.id);
});

test('the Apollo script has the quiz, the shortcut and the 4b side branch', () => {
  const a = MISSIONS.find((m) => m.id === 'apollo');
  const ids = a.story.map((n) => n.id);
  assert.deepEqual(ids, ['apollo-1', 'apollo-2', 'apollo-3', 'apollo-4', 'apollo-4b', 'apollo-5', 'apollo-6']);
  assert.deepEqual(a.story[0].replies.map((r) => r.next), ['apollo-2', 'apollo-5']);
  assert.deepEqual(a.story[3].replies.map((r) => r.next), ['apollo-4b', 'apollo-5']);
  assert.equal(a.years, '1969–1972');
  assert.equal(a.sources.length, 3);
});

test('Chandrayaan-3 is gone from the stories (its facts live in the lunar-day explainer notes)', () => {
  const here = new URL('.', import.meta.url).pathname;
  const files = [here + 'dialogues/dialogues.ts', ...readdirSync(here + '../missions').map((f) => here + '../missions/' + f)];
  for (const f of files) assert.ok(!/chandrayaan/i.test(readFileSync(f, 'utf8')), f);
  const ex = readFileSync(here + '../explainers.ts', 'utf8');
  assert.match(ex, /Chandrayaan-3/);
  assert.match(ex, /69\.37°S, 32\.35°E/);
  assert.match(ex, /near the south pole region/);
});

test('See it yourself is replaced by the upright-panels explainer when the site is not in the catalogue', () => {
  const finals = MISSIONS[0].story.at(-1).replies;
  const kept = adaptReplies(finals, () => true);
  assert.equal(kept[0].label, 'See it yourself');
  const swapped = adaptReplies(finals, () => false);
  assert.equal(swapped[0].label, 'How panels catch a low Sun');
  assert.deepEqual(swapped[0].action, { type: 'openExplainer', id: 'upright-panels' });
  assert.equal(swapped[0].note, undefined);
  assert.equal(swapped.length, 3);
});
