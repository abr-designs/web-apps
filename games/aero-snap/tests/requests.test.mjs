// Created by Claude (claude-opus-5-5)
// Date: 2026-10-16

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { REQUESTS, matchRequests } from '../js/requests.js';

let n = 0;
function subj(type, kind, overrides = {}) {
  return { id: `${type}-${n++}`, type, kind, visibleRatio: 1, heightRatio: 0.3, centerOffset: 0, action: null, ...overrides };
}
const ids = (results) => results.map((r) => r.requestId);

test('REQUESTS lists the 10 spec requests in order', () => {
  assert.deepEqual(REQUESTS.map((r) => r.id), [
    'rocket-sign', 'diner-door', 'fountain-tower', 'fish-leap', 'sparrow-rocket',
    'jelly-glow', 'sheep-sleep', 'diner-golden', 'two-critters', 'favorite',
  ]);
  assert.equal(REQUESTS[0].text, 'The rocket sign');
});

test('a well framed rocket sign matches at 3 stars', () => {
  const res = matchRequests({ subjects: [subj('rocket-sign', 'landmark')], phase: 'day' });
  assert.deepEqual(ids(res), ['rocket-sign']);
  assert.equal(res[0].stars, 3);
});

test('a mostly hidden rocket sign matches nothing', () => {
  const res = matchRequests({ subjects: [subj('rocket-sign', 'landmark', { visibleRatio: 0.3 })], phase: 'day' });
  assert.deepEqual(res, []);
});

test('fish-leap needs the leaping action', () => {
  assert.deepEqual(ids(matchRequests({ subjects: [subj('bubble-fish', 'critter')], phase: 'day' })), []);
  const leap = matchRequests({ subjects: [subj('bubble-fish', 'critter', { action: 'leaping' })], phase: 'day' });
  assert.deepEqual(ids(leap), ['fish-leap']);
});

test('diner-golden needs golden hour', () => {
  assert.ok(!ids(matchRequests({ subjects: [subj('diner', 'landmark')], phase: 'day' })).includes('diner-golden'));
  assert.ok(ids(matchRequests({ subjects: [subj('diner', 'landmark')], phase: 'golden' })).includes('diner-golden'));
});

test('fountain-tower needs both and grades by the weaker subject', () => {
  assert.deepEqual(ids(matchRequests({ subjects: [subj('fountain', 'landmark')], phase: 'day' })), []);
  const res = matchRequests({
    subjects: [subj('fountain', 'landmark'), subj('tower', 'landmark', { heightRatio: 0.02, centerOffset: 0.9, visibleRatio: 0.5 })],
    phase: 'day',
  });
  assert.deepEqual(ids(res), ['fountain-tower']);
  assert.equal(res[0].stars, 1);
});

test('two critters of the same species count for two-critters', () => {
  const res = matchRequests({ subjects: [subj('bubble-fish', 'critter'), subj('bubble-fish', 'critter')], phase: 'day' });
  assert.deepEqual(ids(res), ['two-critters']);
});

test('one critter and one landmark do not count for two-critters', () => {
  const res = matchRequests({ subjects: [subj('cloud-sheep', 'critter'), subj('tower', 'landmark')], phase: 'day' });
  assert.ok(!ids(res).includes('two-critters'));
});

test('favorite is never matched automatically', () => {
  const all = ['rocket-sign', 'diner', 'diner-door', 'fountain', 'tower'].map((t) => subj(t, 'landmark'));
  const res = matchRequests({ subjects: all, phase: 'golden' });
  assert.ok(!ids(res).includes('favorite'));
});
