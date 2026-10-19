// Created by Claude (claude-opus-5-5)
// Date: 2026-10-16

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { moveVector } from '../js/player/movement.js';

const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);
const keys = (k) => ({ f: false, b: false, l: false, r: false, ...k });

test('forward at yaw 0 faces -z', () => {
  const v = moveVector(keys({ f: true }), 0);
  close(v.x, 0);
  close(v.z, -1);
});

test('right at yaw 0 is +x', () => {
  const v = moveVector(keys({ r: true }), 0);
  close(v.x, 1);
  close(v.z, 0);
});

test('diagonals are normalized', () => {
  const v = moveVector(keys({ f: true, r: true }), 0);
  close(Math.hypot(v.x, v.z), 1);
});

test('forward follows camera yaw', () => {
  const v = moveVector(keys({ f: true }), Math.PI / 2);
  close(v.x, -1);
  close(v.z, 0);
});

test('no keys, or opposing keys, give no movement', () => {
  assert.deepEqual(moveVector(keys({}), 0), { x: 0, z: 0 });
  assert.deepEqual(moveVector(keys({ f: true, b: true }), 0), { x: 0, z: 0 });
});
