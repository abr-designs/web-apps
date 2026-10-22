// Created by Claude (claude-haiku-5-5)
// Date: 2026-10-21

import test, { beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { SAVE_KEY, save, load, clear } from '../js/sim/save.js';
import { STATE_VERSION } from '../js/sim/state.js';
import { next } from '../js/sim/rng.js';
import { buildMission } from '../js/sim/map-builder.js';
import { execute, setHooks, resetHooks } from '../js/sim/executor.js';

const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');

/** @created Claude (claude-haiku-5-5) - 2026-10-21 */
function memoryStorage() {
  const map = new Map();
  return {
    map,
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => { map.set(key, String(value)); },
    removeItem: (key) => { map.delete(key); },
  };
}

/** @created Claude (claude-haiku-5-5) - 2026-10-21 */
function stubStorage(store) {
  Object.defineProperty(globalThis, 'localStorage', { value: store, configurable: true, writable: true });
}

let store;

beforeEach(() => {
  store = memoryStorage();
  stubStorage(store);
});

afterEach(() => {
  resetHooks();
  if (original) Object.defineProperty(globalThis, 'localStorage', original);
  else delete globalThis.localStorage;
});

test('a saved mission loads back deep-equal to the original', () => {
  const state = buildMission(42);
  save(state);
  assert.deepEqual(load(), state);
});

test('save writes the JSON snapshot under SAVE_KEY', () => {
  const state = buildMission(42);
  save(state);
  assert.equal(SAVE_KEY, 'vigil.battle.v2');
  assert.deepEqual(JSON.parse(store.map.get(SAVE_KEY)), JSON.parse(JSON.stringify(state)));
});

test('load returns null when nothing is saved', () => {
  assert.equal(load(), null);
});

test('corrupt JSON loads as null', () => {
  store.map.set(SAVE_KEY, '{"version":');
  assert.equal(load(), null);
});

test('non-object JSON loads as null', () => {
  for (const raw of ['42', '"battle"', 'null', 'true', '[]']) {
    store.map.set(SAVE_KEY, raw);
    assert.equal(load(), null, raw);
  }
});

test('a version other than STATE_VERSION loads as null', () => {
  const state = buildMission(42);
  state.version = STATE_VERSION + 1;
  save(state);
  assert.equal(load(), null);
});

test('clear removes the key and a later load returns null', () => {
  save(buildMission(42));
  assert.equal(store.map.has(SAVE_KEY), true);
  clear();
  assert.equal(store.map.has(SAVE_KEY), false);
  assert.equal(load(), null);
});

test('rngState survives a round trip, so the next roll matches the original', () => {
  const state = buildMission(42);
  save(state);
  const loaded = load();
  assert.equal(loaded.rngState, state.rngState);
  for (let k = 0; k < 5; k++) {
    const fromLoaded = next(loaded);
    const fromOriginal = next(state);
    assert.equal(fromLoaded, fromOriginal);
  }
});

test('load coerces rngState to a uint32', () => {
  const state = buildMission(42);
  store.map.set(SAVE_KEY, JSON.stringify({ ...state, rngState: -1 }));
  assert.equal(load().rngState, 4294967295);
});

test('save swallows a setItem that throws', () => {
  store.setItem = () => { throw new Error('QuotaExceededError'); };
  assert.doesNotThrow(() => save(buildMission(42)));
});

test('clear swallows a removeItem that throws', () => {
  store.removeItem = () => { throw new Error('SecurityError'); };
  assert.doesNotThrow(() => clear());
});

test('a missing localStorage is handled: save and clear are no-ops, load is null', () => {
  delete globalThis.localStorage;
  assert.doesNotThrow(() => save(buildMission(42)));
  assert.doesNotThrow(() => clear());
  assert.equal(load(), null);
});

test('the save hook writes the key when execute runs a command', () => {
  const state = buildMission(42);
  setHooks({ save });
  execute(state, { type: 'deploy' });
  assert.equal(store.map.has(SAVE_KEY), true);
  assert.equal(load().phase, 'playerTurn');
});
