// Created by Claude (claude-opus-5-5)
// Date: 2026-10-16

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFrameGuard } from '../js/frameGuard.js';

function feed(guard, dt, seconds) {
  let fired = 0;
  for (let t = 0; t < seconds; t += dt) if (guard.push(dt)) fired++;
  return fired;
}

test('smooth 60 fps never trips the guard', () => {
  assert.equal(feed(createFrameGuard(), 0.016, 10), 0);
});

test('sustained 30 ms frames trip it once, after a full window', () => {
  const guard = createFrameGuard();
  assert.equal(feed(guard, 0.03, 2.9), 0);
  assert.equal(feed(guard, 0.03, 0.2), 1);
  assert.equal(feed(guard, 0.03, 10), 0);
});

test('a single long spike among smooth frames does not trip it', () => {
  const guard = createFrameGuard();
  feed(guard, 0.016, 2);
  assert.equal(guard.push(0.5), false);
  assert.equal(feed(guard, 0.016, 5), 0);
});
