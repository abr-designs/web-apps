// Created by Claude (claude-opus-5-5)
// Date: 2026-10-21

import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createGrid, toIndex, placeProp, rebuildAllEdgeCover } from '../js/sim/grid.js';
import { STATE_VERSION, PHASE, createUnit } from '../js/sim/state.js';
import { createContext } from '../js/sim/events.js';
import { execute, setHooks, resetHooks } from '../js/sim/executor.js';
import { next } from '../js/sim/rng.js';
import { validate, use } from '../js/sim/abilities.js';
import { CLASSES } from '../js/data/classes.js';
import { ENEMIES } from '../js/data/enemies.js';
import { RULES } from '../js/data/rules.js';
import * as Detection from '../js/sim/detection.js';
import * as Reactions from '../js/sim/reactions.js';

/** @created Claude (claude-opus-5-5) - 2026-10-21 */
beforeEach(() => {
  resetHooks();
  setHooks({ detection: Detection, reactions: Reactions, abilities: { validate, use } });
});

// Open strip, xcom turn, squad concealed. props: [x, z, kind].
/** @created Claude (claude-opus-5-5) - 2026-10-21 */
function makeState(width = 24, depth = 5, props = []) {
  const grid = createGrid(width, depth);
  for (const [x, z, kind] of props) placeProp(grid, toIndex(grid, x, z), kind);
  rebuildAllEdgeCover(grid);
  return {
    version: STATE_VERSION, seed: 1, rngState: 1, turn: 1, activeSide: 'xcom', phase: PHASE.playerTurn,
    grid, units: {}, pods: [], squadConcealed: true, outcome: null,
  };
}

// Soldiers start with 2 AP, aliens with 0 (it is the xcom turn).
/** @created Claude (claude-opus-5-5) - 2026-10-21 */
function addUnit(state, id, defId, x, z) {
  const team = CLASSES[defId] ? 'xcom' : 'alien';
  const unit = createUnit(id, team, defId, CLASSES[defId] ?? ENEMIES[defId], toIndex(state.grid, x, z));
  unit.ap = team === 'xcom' ? 2 : 0;
  state.units[id] = unit;
  return unit;
}

/** @created Claude (claude-opus-5-5) - 2026-10-21 */
function addPod(state, id, unitIds, alert = 'unaware') {
  const pod = { id, unitIds, alert, patrolRoute: [], patrolIndex: 0 };
  state.pods.push(pod);
  return pod;
}

// First rngState whose successive draws (x100) satisfy each predicate in turn.
/** @created Claude (claude-opus-5-5) - 2026-10-21 */
function seedFor(...preds) {
  for (let seed = 0; seed < 3000000; seed++) {
    const st = { rngState: seed };
    if (preds.every((p) => p(next(st) * 100))) return seed;
  }
  throw new Error('no seed found');
}

const ge = (v) => (r) => r >= v;
const at = (state, x, z) => toIndex(state.grid, x, z);
const types = (events) => events.map((e) => e.type);
const move = (state, unitId, x, z) => execute(state, { type: 'move', unitId, dest: at(state, x, z) }, { autosave: false });
const indexOf = (events, type, extra = {}) => events.findIndex((e) => e.type === type && Object.entries(extra).every(([k, v]) => e[k] === v));

test('stepping inside an enemy detection radius with LOS breaks concealment on that step', () => {
  const state = makeState();
  addUnit(state, 'x1', 'ranger', 0, 2);
  addUnit(state, 'a01', 'trooper', 10, 2);
  addPod(state, 'p1', ['a01']);

  // (5,2) is 5 tiles out: the trooper is in plain sight, yet a concealed squad stays hidden and the pod unaware
  let events = move(state, 'x1', 5, 2);
  assert.equal(state.squadConcealed, true);
  assert.equal(state.pods[0].alert, 'unaware');
  assert.deepEqual(types(events), ['UnitStepped', 'UnitStepped', 'UnitStepped', 'UnitStepped', 'UnitStepped', 'ApSpent']);

  // (6,2) sits exactly on the trooper's detection radius
  assert.equal(ENEMIES.trooper.stats.detection, 4);
  events = move(state, 'x1', 6, 2);
  assert.equal(state.squadConcealed, false);
  assert.deepEqual(events[1], { type: 'ConcealmentBroken', byUnitId: 'x1', reason: 'detected' });
  assert.equal(indexOf(events, 'UnitStepped', { to: at(state, 6, 2) }), 0);
  // once unconcealed the soldier sees the trooper, so its pod reveals on the same step
  assert.deepEqual(events[2], { type: 'PodRevealed', podId: 'p1', byUnitId: 'x1' });
  assert.equal(state.pods[0].alert, 'engaged');
});

test('a wall between the soldier and the enemy keeps the squad concealed inside the radius', () => {
  const props = [0, 1, 2, 3, 4].map((z) => [8, z, 'wall']);
  const state = makeState(24, 5, props);
  const x1 = addUnit(state, 'x1', 'ranger', 7, 2);
  addUnit(state, 'a01', 'trooper', 10, 2);
  addPod(state, 'p1', ['a01']);
  const ctx = createContext(state);
  assert.equal(Detection.onStep(state, ctx, x1), false);
  assert.equal(state.squadConcealed, true);
  assert.deepEqual(ctx.events, []);
});

test('an enemy outside any pod breaks concealment and reveals nothing', () => {
  const state = makeState();
  const x1 = addUnit(state, 'x1', 'ranger', 6, 2);
  addUnit(state, 'a01', 'trooper', 10, 2);
  const ctx = createContext(state);
  assert.equal(Detection.onStep(state, ctx, x1), false);
  assert.deepEqual(types(ctx.events), ['ConcealmentBroken']);
  assert.equal(state.squadConcealed, false);
});

test('shooting breaks concealment once, and the shot noise reveals the target pod after the shot', () => {
  const state = makeState(12, 5);
  addUnit(state, 'x1', 'ranger', 2, 2);
  addUnit(state, 'a01', 'trooper', 6, 2);
  addPod(state, 'p1', ['a01']);
  state.rngState = seedFor(ge(99));
  const events = execute(state, { type: 'ability', unitId: 'x1', abilityId: 'standardShot', targetId: 'a01' }, { autosave: false });
  assert.equal(state.squadConcealed, false);
  assert.equal(events.filter((e) => e.type === 'ConcealmentBroken').length, 1);
  assert.deepEqual(events[0], { type: 'ConcealmentBroken', byUnitId: 'x1', reason: 'ability' });
  const shot = indexOf(events, 'ShotResolved');
  assert.ok(shot > 0);
  assert.ok(indexOf(events, 'PodRevealed', { podId: 'p1', byUnitId: 'x1' }) > shot);
  assert.equal(state.pods[0].alert, 'engaged');
});

test('seeing a pod member reveals the pod mid-move, it scampers to cover, then the mover finishes its path', () => {
  const state = makeState(24, 5, [[14, 0, 'crate'], [14, 4, 'crate']]);
  state.squadConcealed = false;
  const x1 = addUnit(state, 'x1', 'ranger', 0, 2);
  const a01 = addUnit(state, 'a01', 'trooper', 16, 2);
  const a02 = addUnit(state, 'a02', 'trooper', 16, 3);
  addPod(state, 'p1', ['a02', 'a01']);

  const events = move(state, 'x1', 5, 2);
  // sight 14: a01 comes into view from (2,2)
  const step2 = indexOf(events, 'UnitStepped', { unitId: 'x1', to: at(state, 2, 2) });
  assert.deepEqual(events[step2 + 1], { type: 'PodRevealed', podId: 'p1', byUnitId: 'x1' });
  assert.deepEqual(events[step2 + 2], { type: 'ScamperStarted', podId: 'p1' });

  // members scamper in id order to the tiles behind the crates, spending no AP
  const scamper = events.filter((e) => e.type === 'UnitStepped' && e.unitId !== 'x1');
  assert.deepEqual([...new Set(scamper.map((e) => e.unitId))], ['a01', 'a02']);
  assert.equal(a01.tile, at(state, 15, 0));
  assert.equal(a02.tile, at(state, 15, 4));
  assert.deepEqual([a01.ap, a02.ap], [0, 0]);
  assert.equal(state.pods[0].alert, 'engaged');

  // the soldier then walks on to its destination and pays for the move once
  assert.equal(x1.tile, at(state, 5, 2));
  assert.equal(events.filter((e) => e.type === 'UnitStepped' && e.unitId === 'x1').length, 5);
  assert.deepEqual(events.at(-1), { type: 'ApSpent', unitId: 'x1', spent: 1, ap: 1 });
  assert.equal(events.filter((e) => e.type === 'PodRevealed').length, 1);
});

test('a patrolling alien that sees an unconcealed soldier reveals its pod and stops when the scamper moves it', () => {
  const state = makeState(24, 5, [[12, 0, 'crate'], [12, 4, 'crate']]);
  state.squadConcealed = false;
  state.activeSide = 'alien';
  state.phase = PHASE.enemyTurn;
  addUnit(state, 'x1', 'ranger', 0, 2).ap = 0;
  const a01 = addUnit(state, 'a01', 'trooper', 17, 2);
  const a02 = addUnit(state, 'a02', 'trooper', 18, 2);
  a01.ap = 2;
  a02.ap = 2;
  addPod(state, 'p1', ['a01', 'a02']);

  const events = move(state, 'a01', 13, 2);
  const seen = indexOf(events, 'UnitStepped', { unitId: 'a01', to: at(state, 14, 2) });
  assert.deepEqual(events[seen + 1], { type: 'PodRevealed', podId: 'p1', byUnitId: 'a01' });
  assert.equal(a01.tile, at(state, 13, 0), 'scampered behind the crate and did not resume the patrol path');
  assert.equal(a02.tile, at(state, 13, 4));
  assert.deepEqual(events.at(-1), { type: 'ApSpent', unitId: 'a01', spent: 1, ap: 1 });
  assert.equal(a02.ap, 2);
  assert.equal(state.pods[0].alert, 'engaged');
});

test('an alien stepping within detection range of a concealed soldier breaks concealment and reveals its pod', () => {
  const state = makeState();
  state.activeSide = 'alien';
  state.phase = PHASE.enemyTurn;
  addUnit(state, 'x1', 'ranger', 0, 2).ap = 0;
  const a01 = addUnit(state, 'a01', 'trooper', 6, 2);
  a01.ap = 2;
  addPod(state, 'p1', ['a01']);
  const events = move(state, 'a01', 3, 2);
  const step = indexOf(events, 'UnitStepped', { to: at(state, 4, 2) });
  assert.deepEqual(events[step + 1], { type: 'ConcealmentBroken', byUnitId: 'a01', reason: 'spotted' });
  assert.deepEqual(events[step + 2], { type: 'PodRevealed', podId: 'p1', byUnitId: 'a01' });
  assert.equal(a01.tile, at(state, 3, 2), 'open ground: the scamper stays put, so the patrol finishes');
});

test('noise reveals only Unaware pods with a living member within the hearing radius', () => {
  const state = makeState(30, 5);
  state.squadConcealed = false;
  const x1 = addUnit(state, 'x1', 'ranger', 0, 2);
  addUnit(state, 'a01', 'trooper', RULES.hearingRadius, 2);
  addUnit(state, 'a02', 'trooper', RULES.hearingRadius + 1, 4);
  addUnit(state, 'a03', 'trooper', 1, 0).hp = 0;
  addUnit(state, 'a04', 'trooper', 2, 0);
  addPod(state, 'p1', ['a01']);
  addPod(state, 'p2', ['a02']);
  addPod(state, 'p3', ['a03']);
  addPod(state, 'p4', ['a04'], 'engaged');

  const ctx = createContext(state);
  Detection.onNoise(state, ctx, x1.tile);
  assert.deepEqual(ctx.events.filter((e) => e.type === 'PodRevealed'), [{ type: 'PodRevealed', podId: 'p1', byUnitId: 'x1' }]);
  assert.deepEqual(state.pods.map((p) => p.alert), ['engaged', 'unaware', 'unaware', 'engaged']);
});

test('revealPod ignores unknown, already revealed and wiped-out pods', () => {
  const state = makeState();
  addUnit(state, 'a01', 'trooper', 10, 2).hp = 0;
  addUnit(state, 'a02', 'trooper', 12, 2);
  addPod(state, 'p1', ['a01']);
  addPod(state, 'p2', ['a02'], 'engaged');
  const ctx = createContext(state);
  assert.equal(Detection.revealPod(state, ctx, 'p1', null), false);
  assert.equal(Detection.revealPod(state, ctx, 'p2', null), false);
  assert.equal(Detection.revealPod(state, ctx, 'p9', null), false);
  assert.deepEqual(ctx.events, []);
  assert.equal(state.pods[0].alert, 'unaware');
});

test('breakConcealment emits once and reports whether it changed anything', () => {
  const state = makeState();
  const ctx = createContext(state);
  assert.equal(Detection.breakConcealment(state, ctx, 'x1', 'ability'), true);
  assert.equal(Detection.breakConcealment(state, ctx, 'x1', 'ability'), false);
  assert.deepEqual(types(ctx.events), ['ConcealmentBroken']);
});

test('scamperTile prefers full cover over half, then the shorter walk, and stays put on open ground', () => {
  const state = makeState(24, 7, [[13, 1, 'crate'], [13, 5, 'wall']]);
  addUnit(state, 'x1', 'ranger', 0, 3);
  const a01 = addUnit(state, 'a01', 'trooper', 15, 3);
  // (14,1) has half cover west, (14,5) full cover west; both lie inside the 1 AP band
  assert.equal(Detection.scamperTile(state, a01), at(state, 14, 5));

  const open = makeState();
  addUnit(open, 'x1', 'ranger', 0, 2);
  const lone = addUnit(open, 'a01', 'trooper', 15, 2);
  assert.equal(Detection.scamperTile(open, lone), lone.tile);
});
