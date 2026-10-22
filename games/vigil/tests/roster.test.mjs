// Created by Claude (claude-opus-5-5)
// Date: 2026-10-22

import test from 'node:test';
import assert from 'node:assert/strict';
import { Roster, ROSTER_KEY, SLOTS, NAME_POOL } from '../js/view/roster.js';
import { createUnit } from '../js/sim/state.js';
import { CLASSES } from '../js/data/classes.js';
import { ENEMIES } from '../js/data/enemies.js';
import { defaultLoadout } from '../js/sim/loadout.js';

/** @created Claude (claude-opus-5-5) - 2026-10-22 */
function memoryStorage(initial = {}) {
  const data = { ...initial };
  return { data, getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = String(v); }, removeItem: (k) => { delete data[k]; } };
}

const throwing = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
const soldier = (id) => createUnit(id, 'xcom', 'ranger', CLASSES.ranger, 0);
const names = (r) => SLOTS.map((id) => r.slots[id].name);

test('a fresh roster draws four distinct pool names and saves them', () => {
  const store = memoryStorage();
  const roster = new Roster(store, () => 0);
  assert.equal(new Set(names(roster)).size, 4);
  for (const n of names(roster)) assert.ok(NAME_POOL.includes(n), n);
  assert.deepEqual(JSON.parse(store.data[ROSTER_KEY]).slots, roster.slots);
  assert.deepEqual(names(new Roster(store, () => 0.99)), names(roster), 'stored names survive a reload');
});

test('rename trims, caps at 16 and persists; blank draws a new unused pool name', () => {
  const store = memoryStorage();
  const roster = new Roster(store, () => 0);
  assert.equal(roster.rename('x2', '   Commander Shepardson the Third  '), 'Commander Shepar');
  assert.equal(new Roster(store).nameOf(soldier('x2')), 'Commander Shepar');
  const blank = roster.rename('x3', '   ');
  assert.ok(NAME_POOL.includes(blank));
  assert.ok(!names(roster).filter((_, k) => k !== 2).includes(blank), 'not taken by another slot');
  assert.equal(roster.rename('a01', 'Nope'), null);
});

test('corrupt JSON, bad slots and throwing storage fall back to random names', () => {
  const corrupt = new Roster(memoryStorage({ [ROSTER_KEY]: '{oops' }), () => 0.5);
  assert.equal(new Set(names(corrupt)).size, 4);

  const partial = new Roster(memoryStorage({ [ROSTER_KEY]: JSON.stringify({ slots: { x1: { name: 'Ripley' }, x2: { name: 42 } } }) }), () => 0);
  assert.equal(partial.slots.x1.name, 'Ripley');
  assert.ok(NAME_POOL.includes(partial.slots.x2.name));

  const denied = new Roster(throwing, () => 0);
  assert.equal(new Set(names(denied)).size, 4);
  assert.equal(denied.rename('x1', 'Hicks'), 'Hicks');
});

test('aliens get their class name and no colour; soldiers get a slot colour', () => {
  const roster = new Roster(memoryStorage(), () => 0);
  const alien = createUnit('a01', 'alien', 'trooper', ENEMIES.trooper, 0);
  assert.equal(roster.nameOf(alien), ENEMIES.trooper.name);
  assert.equal(roster.colorOf(alien), null);
  assert.match(roster.colorOf(soldier('x1')), /^#[0-9A-F]{6}$/i);
  assert.notEqual(roster.colorOf(soldier('x1')), roster.colorOf(soldier('x2')));
});

test('a localStorage getter that throws (blocked site data) still boots with random names', () => {
  const desc = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('SecurityError'); } });
  try {
    const roster = new Roster();
    assert.equal(new Set(names(roster)).size, 4);
    assert.equal(roster.rename('x1', 'Hicks'), 'Hicks');
  } finally {
    if (desc) Object.defineProperty(globalThis, 'localStorage', desc);
    else delete globalThis.localStorage;
  }
});

test('stored names are capped at 16 and repeats are replaced; renaming to a taken name keeps the current one', () => {
  const stored = { slots: { x1: { name: 'Bartholomew Montgomery' }, x2: { name: 'Hudson' }, x3: { name: 'Hudson' } } };
  const roster = new Roster(memoryStorage({ [ROSTER_KEY]: JSON.stringify(stored) }), () => 0);
  assert.equal(roster.slots.x1.name, 'Bartholomew Mont');
  assert.equal(roster.slots.x2.name, 'Hudson');
  assert.notEqual(roster.slots.x3.name, 'Hudson');
  assert.equal(new Set(names(roster)).size, 4);
  const before = roster.slots.x4.name;
  assert.equal(roster.rename('x4', 'Hudson'), before);
});

test('a fresh roster holds the default loadout and setLoadout round-trips through storage', () => {
  const store = memoryStorage();
  const roster = new Roster(store, () => 0);
  assert.deepEqual(roster.loadout(), defaultLoadout());
  const moved = { x1: 'rocket', x2: 'fragGrenade', x3: 'fragGrenade', x4: 'fragGrenade' };
  assert.deepEqual(roster.setLoadout(moved), moved);
  const reloaded = new Roster(store, () => 0.5);
  assert.deepEqual(reloaded.loadout(), moved);
  assert.deepEqual(names(reloaded), names(roster), 'names untouched');
  assert.equal(roster.rename('x1', 'Hicks'), 'Hicks');
  assert.equal(new Roster(store).slots.x1.utility, 'rocket', 'rename keeps the item');
});

test('stored utility that is unknown or past the Rocket cap is repaired and saved; a plan 0003 roster gets the defaults', () => {
  const stored = { slots: { x1: { name: 'Ripley', utility: 'rocket' }, x2: { name: 'Hicks', utility: 'rocket' }, x3: { name: 'Hudson', utility: 'laser' }, x4: { name: 'Vasquez', utility: 'fragGrenade' } } };
  const store = memoryStorage({ [ROSTER_KEY]: JSON.stringify(stored) });
  const roster = new Roster(store, () => 0);
  assert.deepEqual(roster.loadout(), { x1: 'rocket', x2: 'fragGrenade', x3: 'fragGrenade', x4: 'fragGrenade' });
  assert.deepEqual(JSON.parse(store.data[ROSTER_KEY]).slots.x2, { name: 'Hicks', utility: 'fragGrenade' });
  assert.deepEqual(roster.setLoadout({ x1: 'rocket', x2: 'rocket' }), { x1: 'rocket', x2: 'fragGrenade', x3: 'fragGrenade', x4: 'fragGrenade' });

  const old = { slots: { x1: { name: 'Ripley' }, x2: { name: 'Hicks' }, x3: { name: 'Hudson' }, x4: { name: 'Vasquez' } } };
  assert.deepEqual(new Roster(memoryStorage({ [ROSTER_KEY]: JSON.stringify(old) })).loadout(), defaultLoadout());
});
