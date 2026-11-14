// Run: node --test src/screens/home/refaey/   (files named *-test.mjs, so vitest does not pick them up)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fill, resolveNode, packBeats, isVisible } from './logic.ts';

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
