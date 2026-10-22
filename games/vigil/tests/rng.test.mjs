// Created by Claude (claude-opus-5-5)
// Date: 2026-10-21

import test from 'node:test';
import assert from 'node:assert/strict';
import { seedState, next, nextInt, pick } from '../js/sim/rng.js';

const fresh = (seed) => ({ rngState: seedState(seed) });

test('same seed gives the same sequence', () => {
  const a = fresh(1234);
  const b = fresh(1234);
  for (let i = 0; i < 100; i++) assert.equal(next(a), next(b));
});

test('different seeds diverge', () => {
  const a = fresh(1);
  const b = fresh(2);
  const sa = Array.from({ length: 5 }, () => next(a));
  const sb = Array.from({ length: 5 }, () => next(b));
  assert.notDeepEqual(sa, sb);
});

test('state survives a JSON round trip mid-sequence', () => {
  const a = fresh(99);
  for (let i = 0; i < 10; i++) next(a);
  const b = JSON.parse(JSON.stringify(a));
  for (let i = 0; i < 20; i++) assert.equal(next(a), next(b));
});

test('seedState wraps to uint32 and rngState stays uint32', () => {
  assert.equal(seedState(-1), 4294967295);
  assert.equal(seedState(2 ** 32 + 5), 5);
  const s = fresh(-1);
  for (let i = 0; i < 1000; i++) {
    next(s);
    assert.ok(Number.isInteger(s.rngState) && s.rngState >= 0 && s.rngState < 2 ** 32);
  }
});

test('next stays in [0, 1)', () => {
  const s = fresh(42);
  for (let i = 0; i < 20000; i++) {
    const v = next(s);
    assert.ok(v >= 0 && v < 1, `out of range: ${v}`);
  }
});

test('nextInt is inclusive at both ends and never leaves the range', () => {
  const s = fresh(7);
  const seen = new Set();
  for (let i = 0; i < 2000; i++) {
    const v = nextInt(s, 1, 3);
    assert.ok(Number.isInteger(v) && v >= 1 && v <= 3, `out of range: ${v}`);
    seen.add(v);
  }
  assert.deepEqual([...seen].sort(), [1, 2, 3]);
});

test('nextInt handles min === max and negative ranges', () => {
  const s = fresh(3);
  assert.equal(nextInt(s, 5, 5), 5);
  for (let i = 0; i < 500; i++) {
    const v = nextInt(s, -2, 0);
    assert.ok(v >= -2 && v <= 0);
  }
});

test('nextInt rejects bad bounds', () => {
  const s = fresh(3);
  assert.throws(() => nextInt(s, 3, 1), RangeError);
  assert.throws(() => nextInt(s, 0.5, 2), RangeError);
});

test('pick returns members and throws on an empty list', () => {
  const s = fresh(11);
  const list = ['a', 'b', 'c'];
  const seen = new Set();
  for (let i = 0; i < 300; i++) seen.add(pick(s, list));
  assert.deepEqual([...seen].sort(), list);
  assert.throws(() => pick(s, []), RangeError);
});
