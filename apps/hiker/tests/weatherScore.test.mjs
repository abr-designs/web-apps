// Created by Claude (claude-opus-5-5)
// Date: 2026-09-28

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { weatherScore, bandFor } from '../js/weatherScore.js';

const day = over => ({ highC: 18, lowC: 8, cloudPct: 0, popPct: 0, visKm: 30, ...over });

test('temperature limits are no-go', () => {
  assert.equal(weatherScore(day({ highC: 30 })), Infinity);
  assert.equal(weatherScore(day({ highC: 5 })), Infinity);
  assert.notEqual(weatherScore(day({ highC: 29.9 })), Infinity);
  assert.notEqual(weatherScore(day({ highC: 5.1 })), Infinity);
});

test('clear day scores near zero', () => {
  assert.equal(weatherScore(day()), 0.02); // round(0 + 2^1) / 100
});

test('rainy day scores high', () => {
  assert.equal(weatherScore(day({ popPct: 80, cloudPct: 90 })), 625.02); // round(250^2 + 2) / 100
});

test('band boundaries', () => {
  assert.equal(bandFor(0), 'good');
  assert.equal(bandFor(25), 'good');
  assert.equal(bandFor(25.01), 'fair');
  assert.equal(bandFor(100), 'fair');
  assert.equal(bandFor(100.01), 'poor');
  assert.equal(bandFor(Infinity), 'nogo');
});
