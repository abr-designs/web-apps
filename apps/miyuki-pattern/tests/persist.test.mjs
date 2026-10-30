// Created by Claude (claude-opus-5-5)
// Date: 2026-10-30
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STORAGE_KEY, saveState, loadState } from '../js/persist.js';

/** In-memory storage that throws past a size limit, like a full localStorage. */
function fakeStorage(limit = Infinity) {
  const data = new Map();
  return {
    data,
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => {
      if (v.length > limit) throw new Error('QuotaExceededError');
      data.set(k, v);
    },
  };
}

const state = { settings: { columns: 36 }, transform: { offsetX: 1, offsetY: 2, scale: 1 }, available: ['DB-651'], photo: 'data:x' };

test('round trip', () => {
  const s = fakeStorage();
  assert.deepEqual(saveState(s, state), { photoSaved: true });
  assert.deepEqual(loadState(s), state);
  assert.equal(STORAGE_KEY, 'miyuki-pattern:v1');
});

test('drops the photo when storage is full', () => {
  const s = fakeStorage(1000);
  const big = { ...state, photo: 'x'.repeat(5000) };
  assert.deepEqual(saveState(s, big), { photoSaved: false });
  const saved = loadState(s);
  assert.equal(saved.photo, null);
  assert.deepEqual(saved.settings, state.settings);
});

test('invalid JSON loads as null', () => {
  const s = fakeStorage();
  s.setItem(STORAGE_KEY, '{nope');
  assert.equal(loadState(s), null);
  assert.equal(loadState(fakeStorage()), null);
});
