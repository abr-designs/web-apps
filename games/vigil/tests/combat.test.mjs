// Created by Claude (claude-sonnet-5-5)
// Date: 2026-10-21

import test from 'node:test';
import assert from 'node:assert/strict';
import { createGrid, toIndex, placeProp, rebuildAllEdgeCover } from '../js/sim/grid.js';
import { createUnit } from '../js/sim/state.js';
import { next } from '../js/sim/rng.js';
import { CLASSES } from '../js/data/classes.js';
import { ENEMIES } from '../js/data/enemies.js';
import { WEAPONS } from '../js/data/weapons.js';
import { RULES } from '../js/data/rules.js';
import { compute } from '../js/sim/hit.js';
import { rollShot, rollOutcome, rollDamage, applyDamage, shredArmor, resolve, STRAY_COVER_DAMAGE } from '../js/sim/combat.js';

/** @created Claude (claude-sonnet-5-5) - 2026-10-21 */
function makeCtx() {
  return { events: [], emit(type, p) { this.events.push({ type, ...p }); } };
}

/** @created Claude (claude-sonnet-5-5) - 2026-10-21 */
function makeState(props = []) {
  const grid = createGrid(12, 9);
  for (const [x, z, kind] of props) placeProp(grid, toIndex(grid, x, z), kind);
  rebuildAllEdgeCover(grid);
  return { grid, units: {}, rngState: 1 };
}

/** @created Claude (claude-sonnet-5-5) - 2026-10-21 */
function addUnit(state, id, defId, x, z) {
  const team = CLASSES[defId] ? 'xcom' : 'alien';
  const def = CLASSES[defId] ?? ENEMIES[defId];
  const unit = createUnit(id, team, defId, def, toIndex(state.grid, x, z));
  state.units[id] = unit;
  return unit;
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
const between = (lo, hi) => (r) => r >= lo && r < hi;

const bd = (over = {}) => ({ hit: 50, graze: 10, crit: 0, dodge: 0, coverTile: -1, modifiers: [], ...over });

/** @created Claude (claude-sonnet-5-5) - 2026-10-21 */
function outcomeFor(seed, breakdown) {
  const st = { rngState: seed };
  return rollOutcome(st, breakdown);
}

// Hit chance 50 gives the graze window [45, 55).
test('rollOutcome: hit below the window, graze inside it, miss above it', () => {
  const b = bd();
  assert.equal(outcomeFor(seedFor(lt(40)), b), 'hit');
  assert.equal(outcomeFor(seedFor(between(44.99, 45)), b), 'hit');
  assert.equal(outcomeFor(seedFor(between(45, 45.01)), b), 'graze');
  assert.equal(outcomeFor(seedFor(between(54.99, 55)), b), 'graze');
  assert.equal(outcomeFor(seedFor(between(55, 55.01)), b), 'miss');
  assert.equal(outcomeFor(seedFor(ge(90)), b), 'miss');
});

test('rollOutcome: crit roll after a hit', () => {
  const b = bd({ crit: 40 });
  assert.equal(outcomeFor(seedFor(lt(45), lt(40)), b), 'crit');
  assert.equal(outcomeFor(seedFor(lt(45), ge(40)), b), 'hit');
  // Graze and miss never crit.
  assert.equal(outcomeFor(seedFor(between(45, 55), lt(40)), b), 'graze');
  assert.equal(outcomeFor(seedFor(ge(55), lt(40)), b), 'miss');
  // crit 0 never crits, crit 100 always does.
  assert.equal(outcomeFor(seedFor(lt(45), lt(1)), bd({ crit: 0 })), 'hit');
  assert.equal(outcomeFor(seedFor(lt(45), ge(99)), bd({ crit: 100 })), 'crit');
});

test('rollOutcome: dodge downgrades a hit or crit to a graze', () => {
  const b = bd({ crit: 100, dodge: 30 });
  assert.equal(outcomeFor(seedFor(lt(45), any, lt(30)), b), 'graze');
  assert.equal(outcomeFor(seedFor(lt(45), any, ge(30)), b), 'crit');
  const plain = bd({ crit: 0, dodge: 30 });
  assert.equal(outcomeFor(seedFor(lt(45), any, lt(30)), plain), 'graze');
  assert.equal(outcomeFor(seedFor(lt(45), any, ge(30)), plain), 'hit');
  // Dodge cannot turn a miss into anything.
  assert.equal(outcomeFor(seedFor(ge(55), any, lt(30)), plain), 'miss');
  assert.equal(outcomeFor(seedFor(lt(45), any, ge(0)), bd({ dodge: 0 })), 'hit');
});

test('rollOutcome: 100 never misses or grazes, 0 never hits or grazes', () => {
  for (let seed = 0; seed < 2000; seed++) {
    assert.ok(['hit', 'crit'].includes(outcomeFor(seed, bd({ hit: 100, crit: 50 }))));
    assert.equal(outcomeFor(seed, bd({ hit: 0, crit: 100 })), 'miss');
  }
});

test('rollShot: draw count and reported roll', () => {
  const missSeed = seedFor(ge(90));
  const st = { rngState: missSeed };
  const { outcome, roll } = rollShot(st, bd());
  assert.equal(outcome, 'miss');
  const ref = { rngState: missSeed };
  assert.equal(roll, next(ref) * 100);
  assert.equal(st.rngState, ref.rngState);

  // A hit uses three draws: hit, crit, dodge.
  const hitSeed = seedFor(lt(40));
  const h = { rngState: hitSeed };
  rollShot(h, bd());
  const ref3 = { rngState: hitSeed };
  next(ref3); next(ref3); next(ref3);
  assert.equal(h.rngState, ref3.rngState);
});

test('rollOutcome frequencies follow the hit, graze and miss chances', () => {
  const st = { rngState: 12345 };
  const counts = { hit: 0, graze: 0, miss: 0, crit: 0 };
  const n = 20000;
  for (let i = 0; i < n; i++) counts[rollOutcome(st, bd({ hit: 60, crit: 0 }))]++;
  // Window [55, 65): hit 55%, graze 10%, miss 35%.
  assert.ok(Math.abs(counts.hit / n - 0.55) < 0.02, `hit ${counts.hit / n}`);
  assert.ok(Math.abs(counts.graze / n - 0.10) < 0.02, `graze ${counts.graze / n}`);
  assert.ok(Math.abs(counts.miss / n - 0.35) < 0.02, `miss ${counts.miss / n}`);
});

test('rollDamage: ranges, graze rounds up half, crit adds critDamage', () => {
  const rifle = WEAPONS.rifle; // [3, 5], critDamage 2
  const seen = { hit: new Set(), graze: new Set(), crit: new Set() };
  const st = { rngState: 7 };
  for (let i = 0; i < 300; i++) {
    for (const k of Object.keys(seen)) seen[k].add(rollDamage(st, rifle, k));
  }
  assert.deepEqual([...seen.hit].sort((a, b) => a - b), [3, 4, 5]);
  assert.deepEqual([...seen.graze].sort((a, b) => a - b), [2, 3]); // 3 -> 2, 4 -> 2, 5 -> 3
  assert.deepEqual([...seen.crit].sort((a, b) => a - b), [5, 6, 7]);
});

test('rollDamage: miss deals 0 without drawing', () => {
  const st = { rngState: 99 };
  assert.equal(rollDamage(st, WEAPONS.rifle, 'miss'), 0);
  assert.equal(st.rngState, 99);
});

test('rollDamage: damageMult scales the base roll before graze and crit', () => {
  const sniper = WEAPONS.sniper; // [4, 6]
  const seen = new Set();
  const graze = new Set();
  const crit = new Set();
  const st = { rngState: 5 };
  for (let i = 0; i < 300; i++) {
    seen.add(rollDamage(st, sniper, 'hit', { mult: 1.5 }));
    graze.add(rollDamage(st, sniper, 'graze', { mult: 1.5 }));
    crit.add(rollDamage(st, sniper, 'crit', { mult: 1.5 }));
  }
  assert.deepEqual([...seen].sort((a, b) => a - b), [6, 8, 9]); // 4, 5, 6 -> 6, 7.5 -> 8, 9
  assert.deepEqual([...graze].sort((a, b) => a - b), [3, 4, 5]);
  assert.deepEqual([...crit].sort((a, b) => a - b), [8, 10, 11]);
});

/** @created Claude (claude-sonnet-5-5) - 2026-10-21 */
function target(hp, armor = 0) {
  const def = { ...ENEMIES.trooper, stats: { ...ENEMIES.trooper.stats, hp, armor } };
  return createUnit('a01', 'alien', 'trooper', def, 0);
}

test('applyDamage: armor absorbs up to its value per hit', () => {
  const ctx = makeCtx();
  const t = target(10, 2);
  const r = applyDamage({}, ctx, t, 5);
  assert.equal(t.hp, 7);
  assert.deepEqual(r, { dealt: 3, absorbed: 2, shredded: 0, killed: false });
  assert.deepEqual(ctx.events, [{ type: 'UnitDamaged', unitId: 'a01', amount: 3, armorAbsorbed: 2, hp: 7 }]);
  // Armor is not used up: the next hit is absorbed again.
  applyDamage({}, ctx, t, 4);
  assert.equal(t.hp, 5);
});

test('applyDamage: a hit smaller than the armor deals nothing', () => {
  const ctx = makeCtx();
  const t = target(10, 3);
  const r = applyDamage({}, ctx, t, 2);
  assert.equal(t.hp, 10);
  assert.equal(r.dealt, 0);
  assert.equal(r.absorbed, 2);
  assert.equal(ctx.events[0].amount, 0);
});

test('applyDamage: pierce ignores armor points', () => {
  const t = target(10, 2);
  const r = applyDamage({}, makeCtx(), t, 5, { pierce: 1 });
  assert.equal(r.absorbed, 1);
  assert.equal(t.hp, 6);
  const t2 = target(10, 2);
  assert.equal(applyDamage({}, makeCtx(), t2, 5, { pierce: 9 }).absorbed, 0);
});

test('applyDamage: shred lowers armor after the hit, capped at the armor left', () => {
  const ctx = makeCtx();
  const t = target(20, 2);
  // First hit still meets full armor, then shreds 1.
  let r = applyDamage({}, ctx, t, 5, { shred: 1 });
  assert.equal(r.absorbed, 2);
  assert.equal(r.shredded, 1);
  assert.equal(t.shred, 1);
  assert.deepEqual(ctx.events[1], { type: 'ArmorShredded', unitId: 'a01', amount: 1 });
  // Second hit meets armor 1, then shred caps at the 1 point left.
  r = applyDamage({}, ctx, t, 5, { shred: 5 });
  assert.equal(r.absorbed, 1);
  assert.equal(r.shredded, 1);
  assert.equal(t.shred, 2);
  // Third hit meets none and emits no ArmorShredded.
  const before = ctx.events.length;
  r = applyDamage({}, ctx, t, 5, { shred: 5 });
  assert.equal(r.absorbed, 0);
  assert.equal(r.shredded, 0);
  assert.equal(ctx.events.slice(before).some((e) => e.type === 'ArmorShredded'), false);
});

test('shredArmor on its own', () => {
  const ctx = makeCtx();
  const t = target(5, 3);
  assert.equal(shredArmor({}, ctx, t, 2), 2);
  assert.equal(t.shred, 2);
  assert.equal(shredArmor({}, ctx, t, 2), 1);
  assert.equal(shredArmor({}, ctx, t, 2), 0);
  assert.equal(ctx.events.length, 2);
  assert.equal(shredArmor({}, ctx, target(5, 0), 3), 0);
});

test('applyDamage: reaching 0 hp kills, emitted after the damage, no overkill hp', () => {
  const ctx = makeCtx();
  const t = target(3);
  const r = applyDamage({}, ctx, t, 9, { shred: 1 });
  assert.equal(t.hp, 0);
  assert.equal(r.killed, true);
  assert.deepEqual(ctx.events.map((e) => e.type), ['UnitDamaged', 'UnitKilled']);
  assert.equal(ctx.events[0].amount, 9);
  assert.deepEqual(ctx.events[1], { type: 'UnitKilled', unitId: 'a01' });
});

test('applyDamage: exactly 0 hp is a kill, 1 hp left is not', () => {
  assert.equal(applyDamage({}, makeCtx(), target(4), 4).killed, true);
  assert.equal(applyDamage({}, makeCtx(), target(4), 3).killed, false);
});

test('applyDamage: dead targets take nothing and emit nothing', () => {
  const ctx = makeCtx();
  const t = target(3);
  t.hp = 0;
  const r = applyDamage({}, ctx, t, 5);
  assert.equal(r.dealt, 0);
  assert.equal(r.killed, false);
  assert.equal(ctx.events.length, 0);
});

/** @created Claude (claude-sonnet-5-5) - 2026-10-21 */
function duel(props = [], shooter = 'ranger') {
  const s = makeState(props);
  const attacker = addUnit(s, 'x1', shooter, 8, 4);
  const trooper = addUnit(s, 'a01', 'trooper', 4, 4);
  return { s, attacker, trooper };
}

test('resolve: a hit emits ShotResolved then UnitDamaged and applies shotgun damage', () => {
  const { s, attacker, trooper } = duel();
  const breakdown = compute(s, attacker, trooper, 'standardShot');
  assert.equal(breakdown.hit, 90);
  s.rngState = seedFor(lt(85), ge(20), ge(0));
  const ctx = makeCtx();
  const r = resolve(s, ctx, attacker, trooper, breakdown, 'standardShot');
  assert.equal(r.outcome, 'hit');
  assert.ok(r.damage >= 4 && r.damage <= 6);
  assert.equal(trooper.hp, 4 - r.damage < 0 ? 0 : 4 - r.damage);
  assert.equal(r.killed, trooper.hp === 0);
  const [shot, dmg] = ctx.events;
  assert.equal(shot.type, 'ShotResolved');
  assert.equal(shot.attackerId, 'x1');
  assert.equal(shot.targetId, 'a01');
  assert.equal(shot.abilityId, 'standardShot');
  assert.equal(shot.result, 'hit');
  assert.ok(shot.roll >= 0 && shot.roll < 85);
  assert.equal(shot.breakdown.hit, 90);
  assert.notEqual(shot.breakdown, breakdown);
  assert.equal(dmg.type, 'UnitDamaged');
  assert.equal(dmg.amount, r.damage);
});

test('resolve: an ability def works as well as an id and reports the id', () => {
  const { s, attacker, trooper } = duel();
  const breakdown = compute(s, attacker, trooper, 'slash');
  s.rngState = seedFor(lt(60), ge(20), ge(0));
  const ctx = makeCtx();
  const r = resolve(s, ctx, attacker, trooper, breakdown, 'slash');
  assert.equal(ctx.events[0].abilityId, 'slash');
  // Sword damage [3, 5], not the shotgun's [4, 6].
  assert.ok(r.damage >= 3 && r.damage <= 5 + 2);
});

test('resolve: a crit adds the weapon crit damage', () => {
  const { s, attacker, trooper } = duel();
  trooper.hp = 50;
  const breakdown = compute(s, attacker, trooper, 'standardShot');
  s.rngState = seedFor(lt(85), lt(20), ge(0));
  const r = resolve(s, makeCtx(), attacker, trooper, breakdown, 'standardShot');
  assert.equal(r.outcome, 'crit');
  assert.ok(r.damage >= 6 && r.damage <= 8);
});

test('resolve: deadeye multiplies the base damage', () => {
  const s = makeState();
  const sharp = addUnit(s, 'x1', 'sharpshooter', 8, 4);
  const trooper = addUnit(s, 'a01', 'trooper', 4, 4);
  trooper.hp = 50;
  const breakdown = { ...compute(s, sharp, trooper, 'deadeye'), hit: 100, crit: 0, dodge: 0 };
  s.rngState = 3;
  const r = resolve(s, makeCtx(), sharp, trooper, breakdown, 'deadeye');
  assert.equal(r.outcome, 'hit');
  assert.ok([6, 8, 9].includes(r.damage));
});

test('resolve: the shredder passive adds shred to hits', () => {
  const { s, attacker, trooper } = duel([], 'grenadier');
  trooper.armor = 2;
  trooper.hp = 50;
  const breakdown = { ...compute(s, attacker, trooper, 'standardShot'), hit: 100, crit: 0, dodge: 0 };
  const ctx = makeCtx();
  const r = resolve(s, ctx, attacker, trooper, breakdown, 'standardShot');
  assert.equal(r.shredded, 1);
  assert.equal(trooper.shred, 1);
  assert.ok(ctx.events.some((e) => e.type === 'ArmorShredded'));
  // A soldier without the passive shreds nothing.
  const other = duel([], 'ranger');
  other.trooper.armor = 2;
  other.trooper.hp = 50;
  const b2 = { ...compute(other.s, other.attacker, other.trooper, 'standardShot'), hit: 100, crit: 0, dodge: 0 };
  assert.equal(resolve(other.s, makeCtx(), other.attacker, other.trooper, b2, 'standardShot').shredded, 0);
});

test('resolve: lethal damage kills the target and emits UnitKilled last', () => {
  const { s, attacker, trooper } = duel();
  trooper.hp = 1;
  const breakdown = { ...compute(s, attacker, trooper, 'standardShot'), hit: 100, crit: 0, dodge: 0 };
  const ctx = makeCtx();
  const r = resolve(s, ctx, attacker, trooper, breakdown, 'standardShot');
  assert.equal(r.killed, true);
  assert.equal(trooper.hp, 0);
  assert.deepEqual(ctx.events.map((e) => e.type), ['ShotResolved', 'UnitDamaged', 'UnitKilled']);
});

test('resolve: a graze deals half damage rounded up', () => {
  const { s, attacker, trooper } = duel();
  trooper.hp = 50;
  const breakdown = { ...compute(s, attacker, trooper, 'standardShot'), hit: 50, crit: 100, dodge: 0 };
  s.rngState = seedFor(between(46, 54));
  const r = resolve(s, makeCtx(), attacker, trooper, breakdown, 'standardShot');
  assert.equal(r.outcome, 'graze');
  assert.ok(r.damage >= 2 && r.damage <= 3); // shotgun [4, 6] halved, rounded up
});

test('resolve: a miss deals no damage and, with no cover, draws once', () => {
  const { s, attacker, trooper } = duel();
  const breakdown = compute(s, attacker, trooper, 'standardShot');
  s.rngState = seedFor(ge(50));
  const seed = s.rngState;
  const ctx = makeCtx();
  const r = resolve(s, ctx, attacker, trooper, { ...breakdown, hit: 10 }, 'standardShot');
  assert.equal(r.outcome, 'miss');
  assert.equal(r.damage, 0);
  assert.equal(trooper.hp, 4);
  assert.deepEqual(ctx.events.map((e) => e.type), ['ShotResolved']);
  const ref = { rngState: seed };
  next(ref);
  assert.equal(s.rngState, ref.rngState);
});

test('resolve: a miss can chip the cover it hit', () => {
  const { s, attacker, trooper } = duel([[5, 4, 'crate']]);
  const breakdown = { ...compute(s, attacker, trooper, 'standardShot'), hit: 10 };
  assert.equal(breakdown.coverTile, toIndex(s.grid, 5, 4));
  // Hit roll misses, stray roll lands under strayCoverHitChance.
  s.rngState = seedFor(ge(30), lt(RULES.strayCoverHitChance * 100));
  const ctx = makeCtx();
  const r = resolve(s, ctx, attacker, trooper, breakdown, 'standardShot');
  assert.equal(r.outcome, 'miss');
  assert.equal(r.coverHit, true);
  assert.equal(s.grid.props[breakdown.coverTile].hp, 3 - STRAY_COVER_DAMAGE);
  assert.deepEqual(ctx.events[1], { type: 'CoverDamaged', tile: breakdown.coverTile, hp: 3 - STRAY_COVER_DAMAGE });
  assert.equal(trooper.hp, 4);
});

test('resolve: a missed shot leaves the cover alone above the stray chance', () => {
  const { s, attacker, trooper } = duel([[5, 4, 'crate']]);
  const breakdown = { ...compute(s, attacker, trooper, 'standardShot'), hit: 10 };
  s.rngState = seedFor(ge(30), ge(RULES.strayCoverHitChance * 100));
  const ctx = makeCtx();
  const r = resolve(s, ctx, attacker, trooper, breakdown, 'standardShot');
  assert.equal(r.coverHit, false);
  assert.equal(s.grid.props[breakdown.coverTile].hp, 3);
  assert.deepEqual(ctx.events.map((e) => e.type), ['ShotResolved']);
});

test('resolve: a stray hit that destroys cover emits CoverDestroyed and rebuilds edge cover', () => {
  const { s, attacker, trooper } = duel([[4, 3, 'wall'], [5, 4, 'crate']]);
  const crate = toIndex(s.grid, 5, 4);
  s.grid.props[crate].hp = 1;
  const breakdown = { ...compute(s, attacker, trooper, 'standardShot'), hit: 10 };
  assert.equal(breakdown.coverTile, crate);
  s.rngState = seedFor(ge(30), lt(RULES.strayCoverHitChance * 100));
  const ctx = makeCtx();
  resolve(s, ctx, attacker, trooper, breakdown, 'standardShot');
  assert.deepEqual(ctx.events[1], { type: 'CoverDestroyed', tile: crate, rubbleKind: null });
  assert.equal(s.grid.props[crate], null);
  assert.equal(s.grid.edgeCover[trooper.tile][1], 'none');
});

test('resolve: indestructible cover takes no stray damage and emits nothing', () => {
  const { s, attacker, trooper } = duel([[5, 4, 'rock']]);
  const breakdown = { ...compute(s, attacker, trooper, 'standardShot'), hit: 10 };
  s.rngState = seedFor(ge(30), lt(RULES.strayCoverHitChance * 100));
  const ctx = makeCtx();
  const r = resolve(s, ctx, attacker, trooper, breakdown, 'standardShot');
  assert.equal(r.coverHit, false);
  assert.deepEqual(ctx.events.map((e) => e.type), ['ShotResolved']);
});

test('resolve: hits never touch cover', () => {
  const { s, attacker, trooper } = duel([[5, 4, 'crate']]);
  const breakdown = { ...compute(s, attacker, trooper, 'standardShot'), hit: 100, crit: 0, dodge: 0 };
  resolve(s, makeCtx(), attacker, trooper, breakdown, 'standardShot');
  assert.equal(s.grid.props[breakdown.coverTile].hp, 3);
});

test('same state and rng give the same shot (determinism)', () => {
  const run = () => {
    const { s, attacker, trooper } = duel([[5, 4, 'crate']]);
    s.rngState = 424242;
    const ctx = makeCtx();
    const breakdown = compute(s, attacker, trooper, 'standardShot');
    resolve(s, ctx, attacker, trooper, breakdown, 'standardShot');
    return JSON.stringify({ events: ctx.events, rng: s.rngState });
  };
  assert.equal(run(), run());
});
