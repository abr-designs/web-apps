// Created by Claude (claude-opus-5-5)
// Date: 2026-10-16

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isInFrame, sizeScore, centerScore, scoreSubject, starsFor } from '../js/photo/scoring.js';

const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);

test('sizeScore is 1 across the target band', () => {
  assert.equal(sizeScore(0.15), 1);
  assert.equal(sizeScore(0.3), 1);
  assert.equal(sizeScore(0.45), 1);
});

test('sizeScore falls off linearly on both sides', () => {
  close(sizeScore(0.09), 0.5);
  close(sizeScore(0.675), 0.5);
});

test('sizeScore is 0 outside the falloff', () => {
  assert.equal(sizeScore(0.02), 0);
  assert.equal(sizeScore(0.95), 0);
});

test('centerScore is 1 at center and clamps at 0', () => {
  assert.equal(centerScore(0), 1);
  assert.equal(centerScore(1.2), 0);
});

test('starsFor thresholds', () => {
  assert.equal(starsFor(0.85), 3);
  assert.equal(starsFor(0.8499), 2);
  assert.equal(starsFor(0.6), 2);
  assert.equal(starsFor(0.1), 1);
});

test('isInFrame needs 40 percent of sample points visible', () => {
  assert.equal(isInFrame({ visibleRatio: 0.39 }), false);
  assert.equal(isInFrame({ visibleRatio: 0.4 }), true);
});

test('scoreSubject of a perfect shot is 1', () => {
  close(scoreSubject({ visibleRatio: 1, heightRatio: 0.3, centerOffset: 0 }), 1);
});
