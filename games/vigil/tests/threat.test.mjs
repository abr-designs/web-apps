// Created by Claude (claude-opus-5-5)
// Date: 2026-10-23

import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { THREAT, threatLevel, threatOf, nextThreat } from '../js/data/threat.js';
import { ENEMIES } from '../js/data/enemies.js';
import { WEAPONS } from '../js/data/weapons.js';
import { buildMission } from '../js/sim/map-builder.js';
import { rollDamage } from '../js/sim/combat.js';
import { livingUnits } from '../js/sim/state.js';
import { execute, validate as executorValidate, setHooks, resetHooks } from '../js/sim/executor.js';
import { validate, use } from '../js/sim/abilities.js';
import { nextCommand } from '../js/sim/ai.js';
import * as Detection from '../js/sim/detection.js';
import * as Reactions from '../js/sim/reactions.js';
import { Progress, PROGRESS_KEY, HEAL_PER_WIN } from '../js/view/progress.js';

/** @created Claude (claude-opus-5-5) - 2026-10-23 */
beforeEach(() => {
  resetHooks();
  setHooks({ detection: Detection, reactions: Reactions, abilities: { validate, use } });
});

/** @created Claude (claude-opus-5-5) - 2026-10-23 */
function memoryStorage(initial = {}) {
  const data = { ...initial };
  return { data, getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = String(v); }, removeItem: (k) => { delete data[k]; } };
}

const LEVELS = Object.keys(THREAT.levels).map(Number);
const aliens = (state) => livingUnits(state, 'alien');
const run = (state, cmd) => execute(state, cmd, { autosave: false });

test('every level from min to max is defined with known enemies and a sane pod size', () => {
  assert.deepEqual(LEVELS, Array.from({ length: THREAT.max - THREAT.min + 1 }, (_, k) => THREAT.min + k));
  for (const level of LEVELS) {
    const t = THREAT.levels[level];
    for (const id of t.pool) assert.ok(ENEMIES[id], `${level}: ${id}`);
    assert.ok(t.podSize[0] >= 2 && t.podSize[0] <= t.podSize[1], `${level}: podSize`);
  }
});

test('threatLevel clamps and reads anything else as the baseline; nextThreat steps by outcome', () => {
  assert.equal(threatLevel(undefined), THREAT.baseline);
  assert.equal(threatLevel(0), THREAT.min);
  assert.equal(threatLevel(99), THREAT.max);
  assert.equal(nextThreat(1, 'victory'), 2);
  assert.equal(nextThreat(THREAT.max, 'victory'), THREAT.max);
  assert.equal(nextThreat(3, 'defeat'), 2);
  assert.equal(nextThreat(3, 'forfeit'), 2);
  assert.equal(nextThreat(THREAT.min, 'defeat'), THREAT.min);
});

test('the baseline level builds the same mission as no threat option', () => {
  for (const seed of [1, 42, 1234]) assert.deepEqual(buildMission(seed, { threat: THREAT.baseline }), buildMission(seed));
});

test('level 1 builds two pods of two small, weak troopers', () => {
  for (const seed of [1, 2, 3, 7, 42, 1234]) {
    const state = buildMission(seed, { threat: 1 });
    assert.equal(state.threat, 1);
    assert.equal(state.pods.length, 2);
    for (const pod of state.pods) assert.equal(pod.unitIds.length, 2);
    for (const a of aliens(state)) {
      assert.equal(a.defId, 'trooper');
      assert.equal(a.hp, ENEMIES.trooper.stats.hp - 1);
      assert.equal(a.stats.aim, ENEMIES.trooper.stats.aim - 20);
      assert.equal(a.damageBonus, -1);
      assert.equal(a.scale, 0.75);
    }
  }
});

test('aliens get stronger and more accurate as the level rises', () => {
  const avg = (state, stat) => aliens(state).reduce((sum, a) => sum + a.stats[stat] - ENEMIES[a.defId].stats[stat], 0) / aliens(state).length;
  let lastAim = -Infinity;
  for (const level of LEVELS) {
    const state = buildMission(42, { threat: level });
    const aim = avg(state, 'aim');
    assert.ok(aim > lastAim, `level ${level} aim offset ${aim}`);
    lastAim = aim;
  }
});

test('rollDamage bonus lowers a hit but never below 1', () => {
  const st = { rngState: 5 };
  const seen = new Set();
  for (let k = 0; k < 200; k++) seen.add(rollDamage(st, WEAPONS.pistol, 'hit', { bonus: -1 }));
  assert.deepEqual([...seen].sort(), [1, 2]);
});

// A mission on the alien turn of round 1 with every pod engaged and the squad unconcealed.
/** @created Claude (claude-opus-5-5) - 2026-10-23 */
function engagedMission(seed, threat) {
  const state = buildMission(seed, { threat });
  run(state, { type: 'deploy' });
  state.squadConcealed = false;
  for (const pod of state.pods) pod.alert = 'engaged';
  run(state, { type: 'endTurn' });
  return state;
}

for (const level of LEVELS) {
  test(`level ${level}: full enemy turns end with null and respect the level's overwatch and debuff rules`, () => {
    const { ai } = threatOf(level);
    for (const seed of [1, 2, 3, 7, 42, 1234]) {
      const state = engagedMission(seed, level);
      for (let round = 0; round < 3 && !state.outcome; round++) {
        const budget = aliens(state).reduce((sum, u) => sum + u.ap, 0);
        let count = 0;
        for (let cmd = nextCommand(state); cmd && !state.outcome; cmd = nextCommand(state)) {
          assert.equal(executorValidate(state, cmd).ok, true, JSON.stringify(cmd));
          assert.ok(++count <= budget, 'more commands than AP');
          if (!ai.overwatch) assert.notEqual(cmd.abilityId, 'overwatch', `seed ${seed}`);
          if (!ai.debuffs) assert.ok(!['markTarget', 'psiDisorient'].includes(cmd.abilityId), `seed ${seed}`);
          run(state, cmd);
        }
        if (state.outcome) break;
        run(state, { type: 'endTurn' });
        run(state, { type: 'endTurn' });
      }
    }
  });
}

test('Progress starts at THREAT.start, steps on record and survives a reload', () => {
  const store = memoryStorage();
  const progress = new Progress(store);
  assert.equal(progress.level, THREAT.start);
  assert.deepEqual(progress.record('victory'), { from: THREAT.start, to: THREAT.start + 1 });
  assert.equal(new Progress(store).level, THREAT.start + 1);
  progress.record('defeat');
  assert.equal(new Progress(store).level, THREAT.start);
});

test('Progress falls back to THREAT.start on bad storage', () => {
  assert.equal(new Progress(memoryStorage({ [PROGRESS_KEY]: '{oops' })).level, THREAT.start);
  assert.equal(new Progress(memoryStorage({ [PROGRESS_KEY]: '{"threat":"x"}' })).level, THREAT.start);
  assert.equal(new Progress(memoryStorage({ [PROGRESS_KEY]: '{"threat":42}' })).level, THREAT.max);
  const throwing = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
  const progress = new Progress(throwing);
  assert.equal(progress.level, THREAT.start);
  assert.deepEqual(progress.record('victory'), { from: THREAT.start, to: THREAT.start + 1 });
});

test('survivors builds only those soldiers at their hp on the same map with the same aliens', () => {
  const full = buildMission(42, { threat: 2 });
  const state = buildMission(42, { threat: 2, survivors: { x1: 2, x3: 99 } });
  assert.deepEqual(livingUnits(state, 'xcom').map((u) => u.id), ['x1', 'x3']);
  assert.equal(state.units.x1.hp, 2);
  assert.equal(state.units.x3.hp, state.units.x3.stats.hp);
  assert.equal(state.units.x1.tile, full.units.x1.tile);
  assert.deepEqual(aliens(state), aliens(full));
  assert.deepEqual(state.grid, full.grid);
});

test('Progress keeps the healed survivors of a victory and clears them on a defeat', () => {
  const store = memoryStorage();
  const progress = new Progress(store);
  assert.equal(progress.squad, null);
  const battle = buildMission(42, { threat: 1 });
  battle.units.x1.hp = 1;
  battle.units.x2.hp = 0;
  battle.units.x3.hp = battle.units.x3.stats.hp - 1;
  progress.record('victory', battle);
  const expected = { x1: 1 + HEAL_PER_WIN, x3: battle.units.x3.stats.hp, x4: battle.units.x4.stats.hp };
  assert.deepEqual(progress.squad, expected);
  assert.deepEqual(new Progress(store).squad, expected);
  progress.record('defeat', battle);
  assert.equal(new Progress(store).squad, null);
  progress.record('victory', battle);
  progress.record('forfeit', battle);
  assert.equal(progress.squad, null);
});

test('Progress drops unknown slots and bad hp from a stored squad', () => {
  const read = (squad) => new Progress(memoryStorage({ [PROGRESS_KEY]: JSON.stringify({ threat: 2, squad }) })).squad;
  assert.deepEqual(read({ x1: 3, x2: 0, x9: 4, x4: 'x' }), { x1: 3 });
  assert.equal(read({ x2: -1 }), null);
  assert.equal(read('oops'), null);
});
