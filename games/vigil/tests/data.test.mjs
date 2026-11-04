// Created by Claude (claude-opus-5-5)
// Date: 2026-10-21

import test from 'node:test';
import assert from 'node:assert/strict';
import { RULES } from '../js/data/rules.js';
import { CLASSES } from '../js/data/classes.js';
import { WEAPONS } from '../js/data/weapons.js';
import { ABILITIES } from '../js/data/abilities.js';
import { ENEMIES } from '../js/data/enemies.js';
import { PROPS } from '../js/data/props.js';

const EFFECT_TYPES = ['weaponDamage', 'flatDamage', 'shred', 'destroyCover', 'heal', 'applyStatus', 'modifyStat',
  'setOverwatch', 'hunker', 'reload', 'grantAp', 'moveThenAct', 'destroyProp'];
const TARGETING = ['self', 'enemyLos', 'enemySquadsight', 'ally', 'allyAny', 'tile', 'melee', 'prop'];

function assertDeepFrozen(value, path) {
  if (!value || typeof value !== 'object') return;
  assert.ok(Object.isFrozen(value), `${path} is not frozen`);
  for (const [k, v] of Object.entries(value)) assertDeepFrozen(v, `${path}.${k}`);
}

function walkEffects(effects, visit) {
  for (const e of effects) {
    visit(e);
    if (e.effects) walkEffects(e.effects, visit);
  }
}

test('every table is frozen all the way down', () => {
  for (const [name, table] of Object.entries({ RULES, CLASSES, WEAPONS, ABILITIES, ENEMIES, PROPS })) assertDeepFrozen(table, name);
  assert.throws(() => { RULES.coverDefense.half = 99; }, TypeError);
});

test('the plan lists four classes, four enemies and all its abilities', () => {
  assert.deepEqual(Object.keys(CLASSES), ['ranger', 'sharpshooter', 'grenadier', 'specialist']);
  assert.deepEqual(Object.keys(ENEMIES), ['trooper', 'officer', 'stunLancer', 'sectoid']);
  for (const id of ['standardShot', 'overwatch', 'hunker', 'reload', 'slash', 'runAndGun', 'squadsight', 'deadeye', 'pistolShot',
    'launchGrenade', 'shredder', 'hailOfBullets', 'medicalProtocol', 'aidProtocol', 'combatProtocol', 'fragGrenade',
    'markTarget', 'stunLance', 'psiDisorient']) {
    assert.ok(ABILITIES[id], `missing ability ${id}`);
  }
});

test('classes and enemies reference real weapons and abilities', () => {
  for (const [id, def] of [...Object.entries(CLASSES), ...Object.entries(ENEMIES)]) {
    assert.ok(WEAPONS[def.weapon], `${id}: unknown weapon ${def.weapon}`);
    for (const a of def.abilities) assert.ok(ABILITIES[a], `${id}: unknown ability ${a}`);
    for (const stat of ['aim', 'hp', 'armor', 'mobility', 'sight', 'defense', 'dodge']) {
      assert.ok(Number.isInteger(def.stats[stat]), `${id}: stat ${stat} missing`);
    }
  }
  for (const [id, def] of Object.entries(ENEMIES)) {
    assert.ok(['rifleman', 'melee', 'caster'].includes(def.ai), `${id}: unknown ai ${def.ai}`);
    assert.ok(Number.isInteger(def.stats.detection), `${id}: detection missing`);
  }
});

test('weapons have sane damage and existing range tables', () => {
  for (const [id, w] of Object.entries(WEAPONS)) {
    const [min, max] = w.damage;
    assert.ok(Number.isInteger(min) && Number.isInteger(max) && min >= 0 && min <= max, `${id}: bad damage`);
    assert.ok(w.ammo === null || (Number.isInteger(w.ammo) && w.ammo > 0), `${id}: bad ammo`);
    assert.ok(w.rangeTable === null || RULES.rangeTables[w.rangeTable], `${id}: unknown range table ${w.rangeTable}`);
  }
});

test('range tables are integer arrays starting at distance 0', () => {
  for (const [id, table] of Object.entries(RULES.rangeTables)) {
    assert.ok(table.length > 1 && table.every(Number.isInteger), `${id}: bad table`);
    assert.equal(table[0], 0, `${id}: distance 0 should be 0`);
  }
});

test('abilities match the AbilitySystem shape', () => {
  for (const [id, a] of Object.entries(ABILITIES)) {
    assert.ok(typeof a.name === 'string' && typeof a.description === 'string', `${id}: name or description`);
    assert.ok(Number.isInteger(a.apCost) && a.apCost >= 0, `${id}: apCost`);
    assert.equal(typeof a.endsTurn, 'boolean', `${id}: endsTurn`);
    assert.ok(Number.isInteger(a.usesAmmo) && a.usesAmmo >= 0, `${id}: usesAmmo`);
    assert.equal(typeof a.breaksConcealment, 'boolean', `${id}: breaksConcealment`);
    assert.ok(TARGETING.includes(a.targeting), `${id}: targeting ${a.targeting}`);
    if (a.targeting === 'tile') assert.ok(a.range > 0 && a.radius >= 0, `${id}: tile abilities need range and radius`);
    walkEffects(a.effects, (e) => {
      assert.ok(EFFECT_TYPES.includes(e.type), `${id}: unknown effect ${e.type}`);
      if (e.weapon) assert.ok(WEAPONS[e.weapon], `${id}: unknown weapon ${e.weapon}`);
    });
  }
});

test('props name existing rubble kinds', () => {
  for (const [id, p] of Object.entries(PROPS)) {
    assert.ok(['half', 'full'].includes(p.cover), `${id}: cover`);
    assert.ok(p.rubble === null || PROPS[p.rubble], `${id}: unknown rubble ${p.rubble}`);
    assert.ok(Number.isInteger(p.hardness) && p.hardness >= 0, `${id}: hardness`);
  }
  assert.equal(PROPS.wall.rubble, null, 'destroyed walls leave open ground');
});

test('alsoTargets names a hidden ability', () => {
  for (const [id, a] of Object.entries(ABILITIES)) {
    if (a.alsoTargets) assert.equal(ABILITIES[a.alsoTargets]?.hidden, true, id);
  }
});
