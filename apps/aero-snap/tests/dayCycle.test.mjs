// Created by Claude (claude-opus-5-5)
// Date: 2026-10-16

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dayPhaseAt, clampDt, DAY_LENGTH } from '../js/world/dayCycle.js';

test('day loop is 480 seconds', () => {
  assert.equal(DAY_LENGTH, 480);
});

test('dayPhaseAt splits the loop into day, golden and dusk', () => {
  assert.equal(dayPhaseAt(0), 'day');
  assert.equal(dayPhaseAt(299.9), 'day');
  assert.equal(dayPhaseAt(300), 'golden');
  assert.equal(dayPhaseAt(390), 'dusk');
});

test('dayPhaseAt wraps past the loop length', () => {
  assert.equal(dayPhaseAt(480), 'day');
  assert.equal(dayPhaseAt(785), 'golden');
});

test('clampDt caps long frames and rejects negatives', () => {
  assert.equal(clampDt(5), 0.1);
  assert.equal(clampDt(0.016), 0.016);
  assert.equal(clampDt(-1), 0);
});
