// Created by Claude (claude-opus-5-5)
// Date: 2026-10-22

import test from 'node:test';
import assert from 'node:assert/strict';
import { SQUAD_SLOTS, defaultLoadout, normalizeLoadout, itemAllowed } from '../js/sim/loadout.js';
import { buildMission } from '../js/sim/map-builder.js';
import { createUnit, PHASE } from '../js/sim/state.js';
import { validate } from '../js/sim/abilities.js';
import { CLASSES } from '../js/data/classes.js';
import { ABILITIES } from '../js/data/abilities.js';
import { RULES } from '../js/data/rules.js';

test('the default loadout gives the grenadier slot the Rocket and everyone else a Frag Grenade', () => {
  assert.deepEqual(defaultLoadout(), { x1: 'fragGrenade', x2: 'fragGrenade', x3: 'rocket', x4: 'fragGrenade' });
  assert.notEqual(defaultLoadout(), defaultLoadout(), 'a fresh object each call');
});

test('normalizeLoadout repairs unknown items, missing slots and a second Rocket in slot order', () => {
  assert.deepEqual(normalizeLoadout({ x1: 'rocket', x2: 'laser', x4: 'rocket' }), { x1: 'rocket', x2: 'fragGrenade', x3: 'fragGrenade', x4: 'fragGrenade' });
  assert.deepEqual(normalizeLoadout(null), { x1: 'fragGrenade', x2: 'fragGrenade', x3: 'fragGrenade', x4: 'fragGrenade' });
  const input = { x1: 'fragGrenade', x2: 'rocket', x3: 'fragGrenade', x4: 'fragGrenade' };
  assert.deepEqual(normalizeLoadout(input), input);
  assert.notEqual(normalizeLoadout(input), input, 'returns a new object');
});

test('itemAllowed blocks an item another slot holds at its cap', () => {
  const lo = defaultLoadout();
  assert.equal(itemAllowed(lo, 'x1', 'rocket'), false, 'x3 holds the only Rocket');
  assert.equal(itemAllowed(lo, 'x3', 'rocket'), true, 'the holder may keep it');
  assert.equal(itemAllowed(lo, 'x1', 'fragGrenade'), true, 'no cap on grenades');
  assert.equal(itemAllowed(lo, 'x1', 'medkit'), false, 'not a loadout item');
  assert.equal(itemAllowed({ ...lo, x3: 'fragGrenade' }, 'x1', 'rocket'), true);
});

test('every loadout item is a charge-limited ability', () => {
  assert.ok(RULES.loadout.items.includes(RULES.loadout.defaultItem));
  for (const id of RULES.loadout.items) assert.ok(ABILITIES[id]?.charges > 0, id);
  assert.equal(SQUAD_SLOTS.length, 4);
});

test('a custom loadout moves the Rocket and leaves the map unchanged', () => {
  const base = buildMission(77);
  const moved = buildMission(77, { loadout: { x1: 'rocket', x2: 'fragGrenade', x3: 'fragGrenade', x4: 'fragGrenade' } });
  assert.deepEqual(moved.units.x1.utility, ['rocket']);
  assert.deepEqual(moved.units.x1.charges, { rocket: 1 });
  assert.deepEqual(moved.units.x3.charges, { launchGrenade: 2, fragGrenade: 1 });
  assert.deepEqual(moved.grid, base.grid);
  assert.equal(moved.rngState, base.rngState);
  for (const id of Object.keys(base.units)) assert.equal(moved.units[id].tile, base.units[id].tile, id);
});

test('a soldier without the Rocket cannot fire one', () => {
  const state = buildMission(77);
  state.phase = PHASE.playerTurn;
  state.units.x1.ap = 2;
  const cmd = { type: 'ability', unitId: 'x1', abilityId: 'rocket', targetTile: state.units.x2.tile };
  assert.deepEqual(validate(state, cmd), { ok: false, reason: 'This unit cannot use that ability' });
});

test('createUnit copies utility onto the unit and adds its charges', () => {
  const items = ['rocket'];
  const unit = createUnit('x1', 'xcom', 'ranger', CLASSES.ranger, 0, items);
  assert.deepEqual(unit.utility, ['rocket']);
  assert.notEqual(unit.utility, items);
  assert.equal(unit.charges.rocket, 1);
  assert.deepEqual(createUnit('x2', 'xcom', 'ranger', CLASSES.ranger, 0).utility, [], 'classes carry no utility');
});
