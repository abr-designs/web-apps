// Created by Claude (claude-sonnet-5-5)
// Date: 2026-10-21

import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createGrid, toIndex, placeProp, rebuildAllEdgeCover } from '../js/sim/grid.js';
import { STATE_VERSION, PHASE, createUnit, hasStatus, statValue } from '../js/sim/state.js';
import { createContext } from '../js/sim/events.js';
import { InvalidCommand, validate as executorValidate, execute, setHooks, resetHooks } from '../js/sim/executor.js';
import { next } from '../js/sim/rng.js';
import { CLASSES } from '../js/data/classes.js';
import { ENEMIES } from '../js/data/enemies.js';
import { ABILITIES } from '../js/data/abilities.js';
import { compute } from '../js/sim/hit.js';
import {
  abilitiesFor, validTargets, validate, use, meleeTiles, standardShot,
} from '../js/sim/abilities.js';
import { EFFECTS, EXPLOSION_PROP_DAMAGE, tilesInRadius } from '../js/sim/effects.js';

/** @created Claude (claude-sonnet-5-5) - 2026-10-21 */
beforeEach(() => {
  resetHooks();
  setHooks({ abilities: { validate, use } });
});

/** @created Claude (claude-sonnet-5-5) - 2026-10-21 */
function makeState(width = 24, depth = 9, props = []) {
  const grid = createGrid(width, depth);
  for (const [x, z, kind] of props) placeProp(grid, toIndex(grid, x, z), kind);
  rebuildAllEdgeCover(grid);
  return {
    version: STATE_VERSION, seed: 1, rngState: 1, turn: 1, activeSide: 'xcom', phase: PHASE.playerTurn,
    grid, units: {}, pods: [], squadConcealed: false, outcome: null,
  };
}

// Units start with 2 AP, like the first turn of their side.
/** @created Claude (claude-sonnet-5-5) - 2026-10-21 */
function addUnit(state, id, defId, x, z) {
  const team = CLASSES[defId] ? 'xcom' : 'alien';
  const unit = createUnit(id, team, defId, CLASSES[defId] ?? ENEMIES[defId], toIndex(state.grid, x, z));
  unit.ap = 2;
  state.units[id] = unit;
  return unit;
}

const at = (state, x, z) => toIndex(state.grid, x, z);
const cmd = (unitId, abilityId, extra = {}) => ({ type: 'ability', unitId, abilityId, ...extra });
const types = (ctx) => ctx.events.map((e) => e.type);

/** @created Claude (claude-sonnet-5-5) - 2026-10-21 */
function run(state, c) {
  const ctx = createContext(state);
  use(state, ctx, c);
  return ctx;
}

// First rngState whose successive draws (x100) satisfy each predicate in turn.
/** @created Claude (claude-sonnet-5-5) - 2026-10-21 */
function seedFor(...preds) {
  for (let seed = 0; seed < 3000000; seed++) {
    const st = { rngState: seed };
    if (preds.every((p) => p(next(st) * 100))) return seed;
  }
  throw new Error('no seed found');
}

const any = () => true;
const lt = (v) => (r) => r < v;
const ge = (v) => (r) => r >= v;

// Ranger (shotgun, aim 65) one tile from a trooper: the hit chance clamps to 100, so only the crit roll varies.
/** @created Claude (claude-sonnet-5-5) - 2026-10-21 */
function duel(props = []) {
  const state = makeState(12, 9, props);
  const ranger = addUnit(state, 'x1', 'ranger', 6, 4);
  const trooper = addUnit(state, 'a01', 'trooper', 5, 4);
  state.rngState = seedFor(any, ge(50));
  return { state, ranger, trooper };
}

test('EFFECTS has a function for every effect type the data uses', () => {
  const used = new Set();
  const walk = (effects) => effects.forEach((e) => { used.add(e.type); if (e.effects) walk(e.effects); });
  for (const def of Object.values(ABILITIES)) walk(def.effects);
  for (const type of used) assert.equal(typeof EFFECTS[type], 'function', type);
  assert.deepEqual(Object.keys(EFFECTS).sort(), [
    'applyStatus', 'destroyCover', 'flatDamage', 'grantAp', 'heal', 'hunker', 'modifyStat',
    'moveThenAct', 'reload', 'setOverwatch', 'shred', 'weaponDamage',
  ]);
});

test('standardShot pays AP and ammo, ends the turn and resolves the shot', () => {
  const { state, ranger, trooper } = duel();
  const ctx = run(state, cmd('x1', 'standardShot', { targetId: 'a01' }));
  assert.deepEqual(types(ctx).slice(0, 2), ['ShotResolved', 'UnitDamaged']);
  assert.equal(ctx.events[0].abilityId, 'standardShot');
  assert.equal(ctx.events[0].result, 'hit');
  assert.ok(trooper.hp < 4 || trooper.hp === 0, 'shotgun does 4 to 6');
  assert.equal(ranger.ammo, 3);
  assert.equal(ranger.ap, 0);
  assert.deepEqual(ctx.events.at(-1), { type: 'ApSpent', unitId: 'x1', spent: 2, ap: 0 });
});

test('a shot breaks squad concealment once, only for xcom', () => {
  const { state } = duel();
  state.squadConcealed = true;
  let ctx = run(state, cmd('x1', 'standardShot', { targetId: 'a01' }));
  assert.equal(state.squadConcealed, false);
  assert.equal(ctx.events.filter((e) => e.type === 'ConcealmentBroken').length, 1);
  assert.equal(ctx.events.find((e) => e.type === 'ConcealmentBroken').byUnitId, 'x1');

  // overwatch is not flagged, so it leaves a concealed squad alone
  const quiet = duel();
  quiet.state.squadConcealed = true;
  ctx = run(quiet.state, cmd('x1', 'overwatch'));
  assert.equal(quiet.state.squadConcealed, true);
  assert.equal(ctx.events.some((e) => e.type === 'ConcealmentBroken'), false);
});

test('shots and grenades report noise through the detection hook, after the effects resolved', () => {
  const { state } = duel();
  const heard = [];
  setHooks({ detection: { onNoise: (s, ctx, tile) => heard.push([tile, ctx.events.length]) } });
  const ctx = run(state, cmd('x1', 'standardShot', { targetId: 'a01' }));
  assert.deepEqual(heard.map(([tile]) => tile), [at(state, 6, 4), at(state, 5, 4)]);
  assert.ok(heard.every(([, n]) => n >= 2), 'ShotResolved and UnitDamaged came first');
  assert.ok(ctx.events.length >= 3);

  heard.length = 0;
  const nade = makeState(20, 9);
  addUnit(nade, 'x1', 'grenadier', 2, 4);
  run(nade, cmd('x1', 'launchGrenade', { targetTile: at(nade, 9, 4) }));
  assert.deepEqual(heard.map(([tile]) => tile), [at(nade, 9, 4)]);

  heard.length = 0;
  run(duel().state, cmd('x1', 'overwatch'));
  assert.deepEqual(heard, [], 'quiet abilities make no noise');
});

test('reload refills the magazine for 1 AP and keeps the turn going', () => {
  const { state, ranger } = duel();
  ranger.ammo = 1;
  const ctx = run(state, cmd('x1', 'reload'));
  assert.equal(ranger.ammo, 4);
  assert.equal(ranger.ap, 1);
  assert.deepEqual(types(ctx), ['ApSpent']);
});

test('overwatch sets the status, emits OverwatchSet and ends the turn', () => {
  const { state, ranger } = duel();
  const ctx = run(state, cmd('x1', 'overwatch'));
  assert.ok(hasStatus(ranger, 'overwatch'));
  assert.deepEqual(types(ctx), ['OverwatchSet', 'ApSpent']);
  assert.equal(ranger.ap, 0);
  assert.equal(ranger.ammo, 4, 'setting overwatch spends no ammo');
});

test('hunker sets the status, doubles cover defense in compute and ends the turn', () => {
  const state = makeState(12, 9, [[5, 4, 'crate']]);
  const trooper = addUnit(state, 'a01', 'trooper', 4, 4);
  const ranger = addUnit(state, 'x1', 'ranger', 8, 4);
  state.activeSide = 'alien';
  const before = compute(state, ranger, trooper, 'standardShot').hit;
  const ctx = run(state, cmd('a01', 'hunker'));
  assert.ok(hasStatus(trooper, 'hunkered'));
  assert.deepEqual(types(ctx), ['StatusApplied', 'ApSpent']);
  assert.equal(trooper.ap, 0);
  assert.equal(compute(state, ranger, trooper, 'standardShot').hit, before - 20);
});

test('slash walks next to the enemy, strikes with the sword and ends the turn', () => {
  const state = makeState(12, 9);
  const ranger = addUnit(state, 'x1', 'ranger', 1, 4);
  const trooper = addUnit(state, 'a01', 'trooper', 6, 4);
  state.rngState = seedFor(lt(60), ge(50));
  assert.deepEqual(validTargets(state, ranger, 'slash'), ['a01']);
  assert.deepEqual(meleeTiles(state, ranger, 'a01').slice(0, 1), [at(state, 5, 4)]);

  const ctx = run(state, cmd('x1', 'slash', { targetId: 'a01' }));
  const stepped = ctx.events.filter((e) => e.type === 'UnitStepped');
  assert.equal(stepped.length, 4);
  assert.equal(ranger.tile, at(state, 5, 4));
  const shot = ctx.events.find((e) => e.type === 'ShotResolved');
  assert.equal(shot.abilityId, 'slash');
  assert.equal(shot.result, 'hit');
  assert.ok(types(ctx).indexOf('UnitStepped') < types(ctx).indexOf('ShotResolved'));
  assert.ok(trooper.hp <= 1, 'sword does 3 to 5 against 4 hp');
  assert.equal(ranger.ap, 0);
  assert.equal(ranger.ammo, 4, 'melee uses no ammo');
});

test('slash honours a chosen attack tile and refuses tiles that are not adjacent or reachable', () => {
  const state = makeState(12, 9);
  const ranger = addUnit(state, 'x1', 'ranger', 1, 4);
  addUnit(state, 'a01', 'trooper', 6, 4);
  const north = at(state, 6, 3);
  assert.ok(meleeTiles(state, ranger, 'a01').includes(north));
  assert.equal(validate(state, cmd('x1', 'slash', { targetId: 'a01', targetTile: north })).ok, true);
  assert.deepEqual(validate(state, cmd('x1', 'slash', { targetId: 'a01', targetTile: at(state, 1, 1) })), { ok: false, reason: 'Cannot reach that tile' });
  run(state, cmd('x1', 'slash', { targetId: 'a01', targetTile: north }));
  assert.equal(ranger.tile, north);
});

test('slash from beyond the 1 AP band has no target; one already adjacent strikes without moving', () => {
  const state = makeState(24, 9);
  const ranger = addUnit(state, 'x1', 'ranger', 1, 4);
  const far = addUnit(state, 'a01', 'trooper', 14, 4);
  assert.deepEqual(validTargets(state, ranger, 'slash'), []);
  far.tile = at(state, 2, 4);
  assert.deepEqual(meleeTiles(state, ranger, 'a01')[0], ranger.tile);
  const ctx = run(state, cmd('x1', 'slash', { targetId: 'a01' }));
  assert.equal(ctx.events.some((e) => e.type === 'UnitStepped'), false);
  assert.equal(ranger.tile, at(state, 1, 4));
});

test('a slash cut short by a hook skips the strike but still costs the action', () => {
  const state = makeState(12, 9);
  const ranger = addUnit(state, 'x1', 'ranger', 1, 4);
  addUnit(state, 'a01', 'trooper', 6, 4);
  setHooks({ reactions: { onStep: () => true } });
  const ctx = run(state, cmd('x1', 'slash', { targetId: 'a01' }));
  assert.equal(ctx.events.filter((e) => e.type === 'UnitStepped').length, 1);
  assert.equal(ctx.events.some((e) => e.type === 'ShotResolved'), false);
  assert.equal(ranger.ap, 0);
  assert.equal(ranger.ammo, 4);
});

test('runAndGun grants an extra action without spending one, then goes on cooldown', () => {
  const { state, ranger } = duel();
  const ctx = run(state, cmd('x1', 'runAndGun'));
  assert.equal(ranger.ap, 3);
  assert.equal(ranger.cooldowns.runAndGun, 4);
  assert.deepEqual(ctx.events.at(-1), { type: 'ApSpent', unitId: 'x1', spent: 0, ap: 3 });
  assert.equal(validate(state, cmd('x1', 'runAndGun')).reason, 'On cooldown (4 more turns)');
});

test('squadsight targets what a squadmate sees at -2 aim per tile beyond own sight', () => {
  const state = makeState(30, 9);
  const sharp = addUnit(state, 'x1', 'sharpshooter', 0, 4);
  const spotter = addUnit(state, 'x2', 'specialist', 10, 4);
  addUnit(state, 'a01', 'trooper', 22, 4);
  assert.deepEqual(validTargets(state, sharp, 'standardShot'), ['a01']);
  assert.deepEqual(validTargets(state, spotter, 'standardShot'), ['a01'], 'in its own sight, 12 tiles');

  const squadsight = compute(state, sharp, state.units.a01, 'standardShot').modifiers.find((m) => m.label === 'Squadsight');
  assert.equal(squadsight.value, -16, '22 - 14 sight = 8 tiles');

  // without the passive, or without a spotter, the target is out of reach
  const plain = addUnit(state, 'x3', 'ranger', 0, 6);
  assert.deepEqual(validTargets(state, plain, 'standardShot'), []);
  spotter.tile = at(state, 0, 0);
  assert.deepEqual(validTargets(state, sharp, 'standardShot'), []);
  assert.equal(validate(state, cmd('x1', 'standardShot', { targetId: 'a01' })).reason, 'Invalid target');
});

test('launchGrenade destroys cover, shreds armor, hurts everyone in the radius and spends a charge', () => {
  const state = makeState(20, 9, [[10, 4, 'crate'], [11, 4, 'wall'], [14, 4, 'crate']]);
  const gren = addUnit(state, 'x1', 'grenadier', 2, 4);
  const trooper = addUnit(state, 'a01', 'trooper', 10, 5);
  const ally = addUnit(state, 'x2', 'specialist', 9, 4);
  const far = addUnit(state, 'a02', 'trooper', 16, 4);
  trooper.armor = 2;
  const target = at(state, 10, 4);

  const ctx = run(state, cmd('x1', 'launchGrenade', { targetTile: target }));
  const e = ctx.events;
  assert.deepEqual(e.find((x) => x.type === 'Explosion'), {
    type: 'Explosion', center: target, radius: 2, tiles: tilesInRadius(state.grid, target, 2),
  });
  assert.equal(state.grid.props[target], null, 'crate (3 hp) destroyed');
  assert.ok(e.some((x) => x.type === 'CoverDestroyed' && x.tile === target));
  assert.equal(state.grid.props[at(state, 11, 4)].hp, 8 - EXPLOSION_PROP_DAMAGE, 'wall damaged, not destroyed');
  assert.ok(e.some((x) => x.type === 'CoverDamaged' && x.tile === at(state, 11, 4)));
  assert.notEqual(state.grid.props[at(state, 14, 4)], null, 'outside the radius');

  assert.equal(trooper.shred, 1);
  assert.ok(e.some((x) => x.type === 'ArmorShredded' && x.unitId === 'a01'));
  assert.ok(e.some((x) => x.type === 'UnitDamaged' && x.unitId === 'a01' && x.armorAbsorbed === 2));
  assert.ok(ally.hp < 4, 'friendly fire');
  assert.equal(far.hp, 4);
  assert.equal(gren.charges.launchGrenade, 1);
  assert.equal(gren.ap, 0);
  assert.equal(gren.ammo, 3, 'grenades use no ammo');
});

test('a blast rubbles a wall after two grenades and a kill emits UnitKilled', () => {
  const state = makeState(12, 9, [[6, 4, 'wall']]);
  addUnit(state, 'x1', 'grenadier', 1, 4);
  const lone = addUnit(state, 'a01', 'trooper', 6, 6);
  lone.hp = 40;
  const target = at(state, 6, 4);
  run(state, cmd('x1', 'launchGrenade', { targetTile: target }));
  assert.equal(state.grid.props[target].hp, 4);
  lone.hp = 1;
  state.units.x1.ap = 2;
  const ctx = run(state, cmd('x1', 'launchGrenade', { targetTile: target }));
  assert.equal(state.grid.props[target].kind, 'rubble');
  assert.ok(ctx.events.some((x) => x.type === 'CoverDestroyed' && x.rubbleKind === 'rubble'));
  assert.equal(lone.hp, 0);
  assert.ok(ctx.events.some((x) => x.type === 'UnitKilled' && x.unitId === 'a01'));
});

test('grenade targeting: tiles within range, not the unit tile, and range is enforced', () => {
  const state = makeState(20, 9);
  const gren = addUnit(state, 'x1', 'grenadier', 2, 4);
  const tiles = validTargets(state, gren, 'fragGrenade');
  assert.ok(tiles.includes(at(state, 12, 4)));
  assert.ok(!tiles.includes(at(state, 13, 4)), 'range 10');
  assert.ok(!tiles.includes(gren.tile));
  assert.ok(validTargets(state, gren, 'launchGrenade').includes(at(state, 16, 4)), 'range 14');
  assert.deepEqual(validate(state, cmd('x1', 'fragGrenade', { targetTile: at(state, 15, 4) })), { ok: false, reason: 'Target is out of range' });
  assert.deepEqual(validate(state, cmd('x1', 'fragGrenade', {})), { ok: false, reason: 'Pick a tile' });
});

test('medicalProtocol heals up to max hp from anywhere and runs out of charges', () => {
  const state = makeState(24, 9);
  const medic = addUnit(state, 'x1', 'specialist', 0, 4);
  const hurt = addUnit(state, 'x2', 'ranger', 20, 4);
  const well = addUnit(state, 'x3', 'sharpshooter', 5, 4);
  hurt.hp = 2;
  assert.deepEqual(validTargets(state, medic, 'medicalProtocol'), ['x2'], 'only the wounded');
  assert.equal(well.hp, 4);

  const ctx = run(state, cmd('x1', 'medicalProtocol', { targetId: 'x2' }));
  assert.equal(hurt.hp, 5, 'ranger max hp is 5');
  assert.deepEqual(ctx.events.find((e) => e.type === 'UnitHealed'), { type: 'UnitHealed', unitId: 'x2', amount: 3, hp: 5 });
  assert.equal(medic.charges.medicalProtocol, 0);
  assert.equal(medic.ap, 1, 'does not end the turn');

  hurt.hp = 1;
  assert.deepEqual(validate(state, cmd('x1', 'medicalProtocol', { targetId: 'x2' })), { ok: false, reason: 'No charges left' });
});

test('a specialist can heal itself', () => {
  const state = makeState(12, 9);
  const medic = addUnit(state, 'x1', 'specialist', 0, 4);
  medic.hp = 1;
  assert.deepEqual(validTargets(state, medic, 'medicalProtocol'), ['x1']);
  run(state, cmd('x1', 'medicalProtocol', { targetId: 'x1' }));
  assert.equal(medic.hp, 4);
});

test('aidProtocol adds a defense status that hit.js reads, and cooldown 3 blocks reuse', () => {
  const state = makeState(24, 9);
  const medic = addUnit(state, 'x1', 'specialist', 0, 4);
  const buddy = addUnit(state, 'x2', 'ranger', 20, 4);
  const ctx = run(state, cmd('x1', 'aidProtocol', { targetId: 'x2' }));
  assert.deepEqual(buddy.statuses, [{ id: 'aided', turns: 1, stat: 'defense', amount: 20 }]);
  assert.equal(statValue(buddy, 'defense'), 20);
  assert.deepEqual(ctx.events.find((e) => e.type === 'StatusApplied'), { type: 'StatusApplied', unitId: 'x2', status: 'aided', turns: 1 });
  assert.equal(medic.cooldowns.aidProtocol, 3);
  medic.ap = 2;
  assert.equal(validate(state, cmd('x1', 'aidProtocol', { targetId: 'x2' })).reason, 'On cooldown (3 more turns)');
});

test('combatProtocol zaps any enemy the squad sees for 2, ignoring cover and aim, and has 2 charges', () => {
  const state = makeState(40, 9);
  const medic = addUnit(state, 'x1', 'specialist', 0, 4);
  addUnit(state, 'x2', 'ranger', 20, 4);
  const seen = addUnit(state, 'a01', 'trooper', 29, 4);
  const hidden = addUnit(state, 'a02', 'trooper', 39, 4);
  assert.deepEqual(validTargets(state, medic, 'combatProtocol'), ['a01'], 'a02 is out of everyone sight');
  assert.equal(hidden.hp, 4);

  const ctx = run(state, cmd('x1', 'combatProtocol', { targetId: 'a01' }));
  assert.equal(seen.hp, 2);
  assert.equal(ctx.events.some((e) => e.type === 'ShotResolved'), false);
  assert.equal(medic.charges.combatProtocol, 1);
  assert.equal(medic.ap, 0);
});

test('deadeye shoots at -25 aim for 1.5x damage and takes a 3 turn cooldown', () => {
  const state = makeState(14, 9);
  const sharp = addUnit(state, 'x1', 'sharpshooter', 1, 4);
  const target = addUnit(state, 'a01', 'sectoid', 4, 4);
  target.stats.defense = 0;
  const normal = compute(state, sharp, target, 'standardShot').hit;
  const careful = compute(state, sharp, target, 'deadeye');
  assert.equal(careful.hit, normal - 25);
  assert.equal(careful.modifiers.find((m) => m.label === 'Deadeye').value, -25);

  state.rngState = seedFor(lt(careful.hit - careful.graze / 2), ge(50));
  const ctx = run(state, cmd('x1', 'deadeye', { targetId: 'a01' }));
  assert.equal(ctx.events.find((e) => e.type === 'ShotResolved').result, 'hit');
  const dealt = 8 - target.hp;
  assert.ok(dealt >= 6 && dealt <= 9, `sniper 4 to 6 times 1.5 rounded, got ${dealt}`);
  assert.equal(sharp.cooldowns.deadeye, 3);
  assert.equal(sharp.ammo, 2);
});

test('hailOfBullets is a guaranteed hit that spends 3 rounds', () => {
  const state = makeState(14, 9);
  const gren = addUnit(state, 'x1', 'grenadier', 1, 4);
  const target = addUnit(state, 'a01', 'trooper', 4, 4);
  target.stats.defense = 50;
  const ctx = run(state, cmd('x1', 'hailOfBullets', { targetId: 'a01' }));
  assert.equal(ctx.events.find((e) => e.type === 'ShotResolved').result, 'hit');
  assert.ok(target.hp < 4);
  assert.equal(gren.ammo, 0);
  assert.equal(gren.cooldowns.hailOfBullets, 5);
  gren.ap = 2;
  gren.cooldowns = {};
  assert.equal(validate(state, cmd('x1', 'hailOfBullets', { targetId: 'a01' })).reason, 'Out of ammo');
  gren.ammo = 2;
  assert.equal(validate(state, cmd('x1', 'hailOfBullets', { targetId: 'a01' })).reason, 'Not enough ammo');
});

test('shredder adds a point of shred to grenadier weapon hits', () => {
  const state = makeState(14, 9);
  addUnit(state, 'x1', 'grenadier', 1, 4);
  const target = addUnit(state, 'a01', 'trooper', 3, 4);
  target.armor = 1;
  target.hp = 20;
  target.stats.hp = 20;
  state.rngState = seedFor(lt(60), ge(50));
  run(state, cmd('x1', 'standardShot', { targetId: 'a01' }));
  assert.equal(target.shred, 1);
});

test('pistolShot fires the sidearm without using the primary magazine', () => {
  const state = makeState(14, 9);
  const sharp = addUnit(state, 'x1', 'sharpshooter', 1, 4);
  addUnit(state, 'a01', 'trooper', 2, 4);
  sharp.ammo = 0;
  assert.equal(validate(state, cmd('x1', 'standardShot', { targetId: 'a01' })).reason, 'Out of ammo');
  assert.equal(validate(state, cmd('x1', 'pistolShot', { targetId: 'a01' })).ok, true);
  const ctx = run(state, cmd('x1', 'pistolShot', { targetId: 'a01' }));
  assert.equal(sharp.ammo, 0);
  assert.equal(ctx.events.find((e) => e.type === 'ShotResolved').abilityId, 'pistolShot');
});

test('markTarget and psiDisorient apply timed stat statuses that change later hit chances', () => {
  const state = makeState(14, 9);
  const officer = addUnit(state, 'a01', 'officer', 8, 4);
  const sectoid = addUnit(state, 'a02', 'sectoid', 8, 6);
  const ranger = addUnit(state, 'x1', 'ranger', 4, 4);
  state.activeSide = 'alien';

  const before = compute(state, ranger, officer, 'standardShot').hit;
  // markTarget is aimed at an enemy of its user, so the officer marks the ranger; check the defense drop on the ranger.
  const aimBefore = compute(state, officer, ranger, 'standardShot').hit;
  run(state, cmd('a01', 'markTarget', { targetId: 'x1' }));
  assert.deepEqual(ranger.statuses, [{ id: 'marked', turns: 2, stat: 'defense', amount: -15 }]);
  assert.equal(compute(state, officer, ranger, 'standardShot').hit, Math.min(100, aimBefore + 15));
  assert.equal(compute(state, ranger, officer, 'standardShot').hit, before, 'the mark only changes the marked unit defense');
  assert.equal(officer.cooldowns.markTarget, 2);

  run(state, cmd('a02', 'psiDisorient', { targetId: 'x1' }));
  assert.equal(statValue(ranger, 'aim'), 45);
  assert.equal(sectoid.ap, 0);
});

test('stunLance moves in and a hit applies stunned; a miss does not', () => {
  const state = makeState(14, 9);
  const lancer = addUnit(state, 'a01', 'stunLancer', 8, 4);
  const ranger = addUnit(state, 'x1', 'ranger', 2, 4);
  state.activeSide = 'alien';
  assert.deepEqual(validTargets(state, lancer, 'stunLance'), ['x1']);

  const miss = structuredClone(state);
  miss.rngState = seedFor(ge(90));
  run(miss, cmd('a01', 'stunLance', { targetId: 'x1' }));
  assert.equal(hasStatus(miss.units.x1, 'stunned'), false);

  state.rngState = seedFor(lt(60), ge(50));
  const ctx = run(state, cmd('a01', 'stunLance', { targetId: 'x1' }));
  assert.ok(hasStatus(ranger, 'stunned'));
  assert.equal(ranger.statuses.find((s) => s.id === 'stunned').turns, 1);
  assert.equal(lancer.ap, 0);
  assert.ok(ctx.events.some((e) => e.type === 'StatusApplied' && e.status === 'stunned'));
});

test('cooldowns and charges block reuse through the executor and leave state untouched', () => {
  const state = makeState(24, 9);
  const sharp = addUnit(state, 'x1', 'sharpshooter', 1, 4);
  addUnit(state, 'x2', 'ranger', 1, 6);
  addUnit(state, 'a01', 'sectoid', 5, 4).stats.hp = 80;
  state.units.a01.hp = 80;
  state.rngState = seedFor(any, ge(50));

  execute(state, cmd('x1', 'deadeye', { targetId: 'a01' }), { autosave: false });
  assert.equal(sharp.cooldowns.deadeye, 3);
  sharp.ap = 2;
  const snapshot = structuredClone(state);
  assert.throws(
    () => execute(state, cmd('x1', 'deadeye', { targetId: 'a01' }), { autosave: false }),
    (err) => err instanceof InvalidCommand && err.reason === 'On cooldown (3 more turns)',
  );
  assert.deepEqual(state, snapshot);

  sharp.charges.fragGrenade = 0;
  assert.deepEqual(executorValidate(state, cmd('x1', 'fragGrenade', { targetTile: at(state, 5, 4) })), { ok: false, reason: 'No charges left' });
});

test('cooldowns count down through TurnManager and unlock the ability', () => {
  const state = makeState(14, 9);
  const sharp = addUnit(state, 'x1', 'sharpshooter', 1, 4);
  addUnit(state, 'x2', 'ranger', 1, 6);
  addUnit(state, 'a01', 'sectoid', 5, 4).hp = 80;
  state.rngState = seedFor(any, ge(50));
  execute(state, cmd('x1', 'deadeye', { targetId: 'a01' }), { autosave: false });
  for (let round = 1; round <= 3; round++) {
    state.units.x2.ap = 0;
    execute(state, { type: 'endTurn' }, { autosave: false });
    execute(state, { type: 'endTurn', side: 'alien' }, { autosave: false });
    assert.equal(sharp.cooldowns.deadeye, round < 3 ? 3 - round : undefined);
  }
  assert.equal(validate(state, cmd('x1', 'deadeye', { targetId: 'a01' })).ok, true);
});

test('abilitiesFor lists active abilities and reports why one is disabled', () => {
  const state = makeState(24, 9);
  const sharp = addUnit(state, 'x1', 'sharpshooter', 1, 4);
  const list = () => Object.fromEntries(abilitiesFor(state, sharp).map((a) => [a.id, a]));

  let l = list();
  assert.deepEqual(Object.keys(l), ['standardShot', 'overwatch', 'hunker', 'reload', 'deadeye', 'pistolShot', 'fragGrenade']);
  assert.equal(l.squadsight, undefined, 'passives are not listed');
  assert.equal(l.standardShot.def, ABILITIES.standardShot);
  assert.equal(l.standardShot.usable, false);
  assert.equal(l.standardShot.reason, 'No valid targets');
  assert.equal(l.overwatch.usable, true);
  assert.equal(l.overwatch.reason, null);
  assert.equal(l.reload.reason, 'Weapon is full');
  assert.equal(l.fragGrenade.usable, true);
  assert.equal(l.fragGrenade.charges, 1);

  addUnit(state, 'a01', 'trooper', 8, 4);
  sharp.ammo = 0;
  sharp.charges.fragGrenade = 0;
  l = list();
  assert.equal(l.standardShot.reason, 'Out of ammo');
  assert.equal(l.overwatch.reason, 'Out of ammo');
  assert.equal(l.reload.usable, true);
  assert.equal(l.pistolShot.usable, true);
  assert.equal(l.deadeye.reason, 'Out of ammo');
  sharp.ammo = 3;
  sharp.cooldowns.deadeye = 1;
  l = list();
  assert.equal(l.deadeye.reason, 'On cooldown (1 more turn)');
  assert.equal(l.fragGrenade.reason, 'No charges left');

  sharp.ap = 0;
  assert.equal(list().overwatch.reason, 'No actions left');
  sharp.hp = 0;
  assert.equal(list().overwatch.reason, 'That unit is dead');
});

test('abilitiesFor explains the heal and ally cases', () => {
  const state = makeState(12, 9);
  const medic = addUnit(state, 'x1', 'specialist', 1, 4);
  const l = Object.fromEntries(abilitiesFor(state, medic).map((a) => [a.id, a]));
  assert.equal(l.medicalProtocol.reason, 'No one needs healing');
  assert.equal(l.aidProtocol.usable, true);
  assert.equal(l.combatProtocol.reason, 'No valid targets');
});

test('validate rejects unknown or foreign abilities, passives and bad targets', () => {
  const { state } = duel();
  assert.equal(validate(state, cmd('x1', 'stunLance', { targetId: 'a01' })).reason, 'This unit cannot use that ability');
  assert.equal(validate(state, cmd('x1', 'standardShot')).reason, 'Pick a target');
  assert.equal(validate(state, cmd('x1', 'standardShot', { targetId: 'x1' })).reason, 'Invalid target');
  assert.equal(validate(state, cmd('x1', 'standardShot', { targetId: 'zz' })).reason, 'Invalid target');
  assert.equal(validate(state, cmd('nobody', 'standardShot')).reason, 'Unknown unit');

  const sharp = addUnit(state, 'x2', 'sharpshooter', 0, 0);
  assert.equal(validate(state, cmd(sharp.id, 'squadsight')).reason, 'Passive ability, always active');
  state.units.x1.ap = 0;
  assert.equal(validate(state, cmd('x1', 'runAndGun')).reason, 'No actions left');
});

test('execute routes ability commands through the hooks and rejects with the reason', () => {
  const { state, trooper } = duel();
  trooper.hp = 40;
  addUnit(state, 'x2', 'specialist', 0, 0);
  const events = execute(state, cmd('x1', 'standardShot', { targetId: 'a01' }), { autosave: false });
  assert.equal(events[0].type, 'ShotResolved');
  assert.equal(state.units.x1.ap, 0);
  assert.equal(state.activeSide, 'xcom', 'x2 still has actions');
  assert.throws(
    () => execute(state, cmd('x1', 'overwatch'), { autosave: false }),
    (err) => err instanceof InvalidCommand && err.reason === 'No actions left',
  );
});

test('standardShot helper fires for reactions: overwatch multiplier, one round, no AP, no concealment change', () => {
  const state = makeState(30, 9);
  const sharp = addUnit(state, 'x1', 'sharpshooter', 1, 4);
  const trooper = addUnit(state, 'a01', 'trooper', 8, 4);
  trooper.hp = 40;
  state.squadConcealed = true;
  sharp.ap = 1;
  const full = compute(state, sharp, trooper, 'standardShot').hit;
  const ctx = createContext(state);
  const result = standardShot(state, ctx, sharp, trooper, { overwatch: true });
  assert.ok(result);
  const shot = ctx.events.find((e) => e.type === 'ShotResolved');
  assert.equal(shot.breakdown.hit, Math.round(full * 0.7 + 1e-9));
  assert.equal(shot.breakdown.overwatch, true);
  assert.equal(sharp.ammo, 2);
  assert.equal(sharp.ap, 1);
  assert.equal(state.squadConcealed, true);
  assert.deepEqual(sharp.cooldowns, {});

  sharp.ammo = 0;
  assert.equal(standardShot(state, createContext(state), sharp, trooper, { overwatch: true }), null);
  sharp.ammo = 3;
  sharp.tile = at(state, 0, 4);
  trooper.tile = at(state, 22, 4);
  assert.equal(standardShot(state, createContext(state), sharp, trooper), null, 'out of sight means no shot and no round spent');
  assert.equal(sharp.ammo, 3);
});

test('tilesInRadius is a Euclidean disc clipped to the map', () => {
  const grid = createGrid(10, 10);
  assert.equal(tilesInRadius(grid, toIndex(grid, 5, 5), 2).length, 13);
  assert.equal(tilesInRadius(grid, toIndex(grid, 0, 0), 2).length, 6);
  assert.deepEqual(tilesInRadius(grid, toIndex(grid, 5, 5), 0), [toIndex(grid, 5, 5)]);
});
