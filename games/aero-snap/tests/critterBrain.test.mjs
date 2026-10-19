// Created by Claude (claude-opus-5-5)
// Date: 2026-10-16

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBrain } from '../js/critters/critterBrain.js';

const calm = { phase: 'day', playerDistance: 50, playerRunning: false };
function run(brain, seconds, ctx = calm, step = 0.1) {
  for (let i = 0; i < Math.round(seconds / step); i++) brain.update(step, ctx);
}

test('special starts when its timer elapses and lasts its duration', () => {
  const brain = createBrain({ special: 'leaping', interval: [20, 40], duration: 1.6, rng: () => 0 });
  run(brain, 19.9);
  assert.equal(brain.action(), null);
  run(brain, 0.2);
  assert.equal(brain.state, 'special');
  assert.equal(brain.action(), 'leaping');
  run(brain, 1.7);
  assert.equal(brain.action(), null);
  assert.notEqual(brain.state, 'special');
});

test('canSpecial gates the special and retries within 2 s once allowed', () => {
  const brain = createBrain({
    special: 'glowing', interval: [8, 14], duration: 6, rng: () => 0,
    canSpecial: (c) => c.phase === 'dusk',
  });
  run(brain, 60);
  assert.equal(brain.action(), null);
  run(brain, 2.1, { ...calm, phase: 'dusk' });
  assert.equal(brain.action(), 'glowing');
});

test('a running player close by cancels the special and makes the critter flee', () => {
  const brain = createBrain({ special: 'sleeping', interval: [35, 55], duration: 20, rng: () => 0 });
  run(brain, 35.1);
  assert.equal(brain.action(), 'sleeping');
  brain.update(0.1, { ...calm, playerDistance: 2, playerRunning: true });
  assert.equal(brain.action(), null);
  assert.equal(brain.fleeing, true);
});

test('a walking player close by does not disturb the special', () => {
  const brain = createBrain({ special: 'sleeping', interval: [35, 55], duration: 20, rng: () => 0 });
  run(brain, 35.1);
  brain.update(0.1, { ...calm, playerDistance: 2, playerRunning: false });
  assert.equal(brain.action(), 'sleeping');
  assert.equal(brain.fleeing, false);
});
