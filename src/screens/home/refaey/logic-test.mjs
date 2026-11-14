// Run: node --test src/screens/home/refaey/   (files named *-test.mjs, so vitest does not pick them up)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fill, resolveNode, packBeats, isVisible, adaptReplies } from './logic.ts';

const base = { horizons: true, values: {}, flags: {}, terminalLabel: 'OK', hasExplainer: () => true };
const node = (o) => ({ id: 'n', lines: ['a'], replies: [], ...o });

test('no token: the line is kept on any provider', () => {
  assert.equal(fill('Hello', { horizons: false, values: {} }), 'Hello');
});
test('demo provider: every line with a token is skipped, even if a value exists', () => {
  assert.equal(fill('Sun {sunElev} up', { horizons: false, values: { sunElev: '1.7°' } }), null);
});
test('Horizons: tokens are filled; any missing token skips the whole line', () => {
  assert.equal(fill('Sun {sunElev} up, sets in {sunsetIn}', { horizons: true, values: { sunElev: '1.7°', sunsetIn: '3d 04h' } }), 'Sun 1.7° up, sets in 3d 04h');
  assert.equal(fill('Sun {sunElev} up, sets in {sunsetIn}', { horizons: true, values: { sunElev: '1.7°' } }), null);
  assert.equal(fill('Hours {sunHours}', { horizons: true, values: { sunHours: '' } }), null);
});
test('a node whose lines are all skipped is not shown', () => {
  const n = node({ lines: ['x {sunHours}'], replies: [] });
  assert.equal(resolveNode(n, base, () => undefined), null);
});
test('when conditions gate a node', () => {
  const n = node({ when: 'horizonLola' });
  assert.equal(resolveNode(n, base, () => undefined), null);
  assert.ok(resolveNode(n, { ...base, flags: { horizonLola: true } }, () => undefined));
  for (const w of ['altBetter', 'altNone']) assert.equal(resolveNode(node({ when: w }), base, () => undefined), null);
});
test('replies that lead to a hidden node are dropped; a node with none left gets one closing OK', () => {
  const hidden = node({ id: 'h', when: 'altBetter' });
  const n = node({ replies: [{ label: 'Could I do better?', next: 'h' }] });
  const r = resolveNode(n, base, (id) => (id === 'h' ? hidden : undefined));
  assert.deepEqual(r.replies, [{ label: 'OK', action: { type: 'collapse' } }]);
});
test('a reply to an explainer that does not exist is dropped', () => {
  const n = node({ replies: [{ label: 'Why?', action: { type: 'openExplainer', id: 'nope' } }, { label: 'OK', action: { type: 'collapse' } }] });
  const r = resolveNode(n, { ...base, hasExplainer: (id) => id !== 'nope' }, () => undefined);
  assert.deepEqual(r.replies.map((x) => x.label), ['OK']);
});
test('reply labels with tokens are filled, or the reply is skipped', () => {
  const n = node({ replies: [{ label: 'Try {altSite}', action: { type: 'collapse' } }, { label: 'Other', action: { type: 'collapse' } }] });
  assert.deepEqual(resolveNode(n, { ...base, values: { altSite: 'Malapert' } }, () => undefined).replies.map((x) => x.label), ['Try Malapert', 'Other']);
  assert.deepEqual(resolveNode(n, base, () => undefined).replies.map((x) => x.label), ['Other']);
});
test('at most 3 replies', () => {
  const n = node({ replies: [1, 2, 3, 4].map((i) => ({ label: 'r' + i, action: { type: 'collapse' } })) });
  assert.equal(resolveNode(n, base, () => undefined).replies.length, 3);
});
test('beats: whole lines are grouped to at most 4 visual lines; nothing is truncated', () => {
  assert.deepEqual(packBeats([2, 2], 4), [[0, 1]]);
  assert.deepEqual(packBeats([2, 3], 4), [[0], [1]]);
  assert.deepEqual(packBeats([6], 4), [[0]]); // a single long line stays whole
  assert.deepEqual(packBeats([1, 1, 1, 1, 1], 4), [[0, 1, 2, 3], [4]]);
});
test('isVisible follows the same rules', () => {
  assert.equal(isVisible(node({ lines: ['{sunsetIn}'] }), { ...base, horizons: false }), false);
});

// ---- recorded facts (history) fill on every provider; live tokens still need Horizons
test('a recorded fact fills on the demo provider; a live token on the same line still skips it', () => {
  const facts = { a11Sun: '10.7°' };
  assert.equal(fill('Sun {a11Sun}.', { horizons: false, values: {}, facts }), 'Sun 10.7°.');
  assert.equal(fill('Sun {a11Sun}, sets in {sunsetIn}.', { horizons: false, values: { sunsetIn: '3d' }, facts }), null);
  assert.equal(fill('Sun {a11Sun}, sets in {sunsetIn}.', { horizons: true, values: { sunsetIn: '3d' }, facts }), 'Sun 10.7°, sets in 3d.');
  assert.equal(fill('Sets in {sunsetIn}.', { horizons: false, values: { sunsetIn: '3d' }, facts }), null);
});
test('usesFacts tells the page when to show the recorded label', () => {
  const ctx = { ...base, horizons: false, facts: { a11Sun: '10.7°' } };
  assert.equal(resolveNode(node({ lines: ['Sun {a11Sun}.'] }), ctx, () => undefined).usesFacts, true);
  assert.equal(resolveNode(node({ lines: ['No numbers.'] }), ctx, () => undefined).usesFacts, false);
});

// ---- "See the sky at touchdown" is only true on the live provider
const see = { label: 'See the sky at touchdown', demoLabel: 'Open this site in the planner', action: { type: 'openPlanner', siteId: 'x', at: '1969-07-20T20:17:40Z' } };
test('live: the reply passes the touchdown moment', () => {
  const [r] = adaptReplies([see], () => true, true);
  assert.equal(r.label, 'See the sky at touchdown');
  assert.equal(r.action.at, '1969-07-20T20:17:40Z');
});
test('demo: the reply uses its demo label and carries no `at`', () => {
  const [r] = adaptReplies([see], () => true, false);
  assert.equal(r.label, 'Open this site in the planner');
  assert.equal('at' in r.action, false);
});
test('a site missing from the catalogue becomes the panels explainer, never a link', () => {
  const [r] = adaptReplies([see], () => false, true);
  assert.equal(r.label, 'How panels catch a low Sun');
  assert.deepEqual(r.action, { type: 'openExplainer', id: 'upright-panels' });
});
