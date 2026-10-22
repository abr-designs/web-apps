// Created by Claude (claude-opus-5-5)
// Date: 2026-10-21

import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createGrid, toIndex, placeProp, rebuildAllEdgeCover } from '../js/sim/grid.js';
import { STATE_VERSION, PHASE, createUnit, hasStatus } from '../js/sim/state.js';
import { createContext } from '../js/sim/events.js';
import { execute, setHooks, resetHooks } from '../js/sim/executor.js';
import { next } from '../js/sim/rng.js';
import { validate, use } from '../js/sim/abilities.js';
import { CLASSES } from '../js/data/classes.js';
import { ENEMIES } from '../js/data/enemies.js';
import * as Detection from '../js/sim/detection.js';
import * as Reactions from '../js/sim/reactions.js';

/** @created Claude (claude-opus-5-5) - 2026-10-21 */
beforeEach(() => {
  resetHooks();
  setHooks({ detection: Detection, reactions: Reactions, abilities: { validate, use } });
});

// Open 24x5 strip on the xcom turn, squad already unconcealed. props: [x, z, kind].
/** @created Claude (claude-opus-5-5) - 2026-10-21 */
function makeState(props = []) {
  const grid = createGrid(24, 5);
  for (const [x, z, kind] of props) placeProp(grid, toIndex(grid, x, z), kind);
  rebuildAllEdgeCover(grid);
  return {
    version: STATE_VERSION, seed: 1, rngState: 1, turn: 1, activeSide: 'xcom', phase: PHASE.playerTurn,
    grid, units: {}, pods: [], squadConcealed: false, outcome: null,
  };
}

/** @created Claude (claude-opus-5-5) - 2026-10-21 */
function addUnit(state, id, defId, x, z, { ap = 0, overwatch = false } = {}) {
  const team = CLASSES[defId] ? 'xcom' : 'alien';
  const unit = createUnit(id, team, defId, CLASSES[defId] ?? ENEMIES[defId], toIndex(state.grid, x, z));
  unit.ap = ap;
  if (overwatch) unit.statuses.push({ id: 'overwatch', turns: null });
  state.units[id] = unit;
  return unit;
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

const lt = (v) => (r) => r < v;
const ge = (v) => (r) => r >= v;
const at = (state, x, z) => toIndex(state.grid, x, z);
const move = (state, unitId, x, z) => execute(state, { type: 'move', unitId, dest: at(state, x, z) }, { autosave: false });
const indexOf = (events, type, extra = {}) => events.findIndex((e) => e.type === type && Object.entries(extra).every(([k, v]) => e[k] === v));
const triggers = (events) => events.filter((e) => e.type === 'OverwatchTriggered').map(({ unitId, targetId }) => [unitId, targetId]);

test('overwatch fires once, on the first step that enters its sight, then clears', () => {
  const state = makeState();
  const x1 = addUnit(state, 'x1', 'ranger', 0, 2, { ap: 2 });
  const a01 = addUnit(state, 'a01', 'trooper', 16, 2, { overwatch: true });
  const a03 = addUnit(state, 'a03', 'trooper', 17, 2, { overwatch: true });
  state.rngState = seedFor(ge(99), ge(99));

  const events = move(state, 'x1', 5, 2);
  // sight 14: a01 sees (2,2), a03 only (3,2); both shots miss
  assert.deepEqual(triggers(events), [['a01', 'x1'], ['a03', 'x1']]);
  const step2 = indexOf(events, 'UnitStepped', { to: at(state, 2, 2) });
  const step3 = indexOf(events, 'UnitStepped', { to: at(state, 3, 2) });
  assert.equal(indexOf(events, 'OverwatchTriggered', { unitId: 'a01' }), step2 + 1);
  assert.equal(indexOf(events, 'OverwatchTriggered', { unitId: 'a03' }), step3 + 1);
  assert.equal(events[step2 + 2].type, 'ShotResolved');
  assert.equal(events[step2 + 2].breakdown.overwatch, true);
  assert.equal(events.filter((e) => e.type === 'ShotResolved').length, 2);

  assert.equal(hasStatus(a01, 'overwatch'), false);
  assert.equal(hasStatus(a03, 'overwatch'), false);
  assert.deepEqual([a01.ammo, a03.ammo, a01.ap, a03.ap], [3, 3, 0, 0], 'one round each, no AP');
  assert.equal(x1.tile, at(state, 5, 2), 'misses let the mover finish its path');
});

test('overwatchers that see the same step fire in unit id order', () => {
  const state = makeState();
  addUnit(state, 'x1', 'ranger', 0, 2, { ap: 2 });
  addUnit(state, 'a02', 'trooper', 16, 1, { overwatch: true });
  addUnit(state, 'a01', 'trooper', 16, 3, { overwatch: true });
  state.rngState = seedFor(ge(99), ge(99));
  const events = move(state, 'x1', 5, 2);
  assert.deepEqual(triggers(events), [['a01', 'x1'], ['a02', 'x1']]);
});

test('a mover killed by overwatch stops on that tile and still pays for the move', () => {
  const state = makeState();
  const x1 = addUnit(state, 'x1', 'ranger', 0, 2, { ap: 2 });
  addUnit(state, 'x2', 'ranger', 0, 4, { ap: 2 });
  addUnit(state, 'a01', 'trooper', 16, 2, { overwatch: true });
  x1.hp = 1;
  state.rngState = seedFor(lt(30));

  const events = move(state, 'x1', 5, 2);
  assert.equal(x1.hp, 0);
  assert.equal(x1.tile, at(state, 2, 2));
  const killed = indexOf(events, 'UnitKilled', { unitId: 'x1' });
  assert.ok(killed > 0);
  assert.equal(events.slice(killed).some((e) => e.type === 'UnitStepped'), false);
  assert.deepEqual(events.at(-1), { type: 'ApSpent', unitId: 'x1', spent: 1, ap: 1 });
  assert.equal(state.outcome, null, 'x2 still stands');
});

test('no trigger for allies, units out of sight, or an empty magazine; their overwatch stays set', () => {
  const state = makeState();
  addUnit(state, 'x1', 'ranger', 0, 2, { ap: 2 });
  const x2 = addUnit(state, 'x2', 'ranger', 1, 4, { overwatch: true });
  const far = addUnit(state, 'a01', 'trooper', 23, 0, { overwatch: true });
  const dry = addUnit(state, 'a02', 'trooper', 6, 2, { overwatch: true });
  dry.ammo = 0;
  const events = move(state, 'x1', 3, 2);
  assert.deepEqual(triggers(events), []);
  assert.ok([x2, far, dry].every((u) => hasStatus(u, 'overwatch')));
});

test('a concealed soldier on overwatch ambushes a patrol: concealment breaks, the shot noise reveals the pod', () => {
  const state = makeState();
  state.squadConcealed = true;
  state.activeSide = 'alien';
  state.phase = PHASE.enemyTurn;
  const x1 = addUnit(state, 'x1', 'ranger', 0, 2, { overwatch: true });
  const a01 = addUnit(state, 'a01', 'trooper', 16, 2, { ap: 2 });
  state.pods.push({ id: 'p1', unitIds: ['a01'], alert: 'unaware', patrolRoute: [], patrolIndex: 0 });
  state.rngState = seedFor(ge(99));

  const events = move(state, 'a01', 12, 2);
  const step = indexOf(events, 'UnitStepped', { to: at(state, 14, 2) });
  assert.deepEqual(events.slice(step + 1, step + 4).map((e) => e.type), ['OverwatchTriggered', 'ConcealmentBroken', 'ShotResolved']);
  assert.deepEqual(events[step + 2], { type: 'ConcealmentBroken', byUnitId: 'x1', reason: 'overwatch' });
  assert.ok(indexOf(events, 'PodRevealed', { podId: 'p1' }) > step + 3);
  assert.equal(state.squadConcealed, false);
  assert.equal(state.pods[0].alert, 'engaged');
  assert.equal(hasStatus(x1, 'overwatch'), false);
  assert.equal(a01.tile, at(state, 12, 2), 'open ground: the scamper stays put and the patrol finishes');
});

test('overwatch fires on scampering aliens; a member killed mid-scamper stops and the rest still scamper', () => {
  const state = makeState([[14, 0, 'crate'], [14, 4, 'crate']]);
  const x1 = addUnit(state, 'x1', 'ranger', 0, 2, { ap: 2 });
  const x2 = addUnit(state, 'x2', 'ranger', 4, 0, { overwatch: true });
  const a01 = addUnit(state, 'a01', 'trooper', 16, 2);
  const a02 = addUnit(state, 'a02', 'trooper', 16, 3);
  a01.hp = 1;
  state.pods.push({ id: 'p1', unitIds: ['a01', 'a02'], alert: 'unaware', patrolRoute: [], patrolIndex: 0 });
  state.rngState = seedFor(lt(20));

  const events = move(state, 'x1', 5, 2);
  assert.deepEqual(triggers(events), [['x2', 'a01']]);
  const scamper = indexOf(events, 'ScamperStarted', { podId: 'p1' });
  const firstScamperStep = indexOf(events, 'UnitStepped', { unitId: 'a01' });
  assert.ok(scamper > 0 && firstScamperStep > scamper);
  assert.equal(indexOf(events, 'OverwatchTriggered'), firstScamperStep + 1);
  assert.equal(a01.hp, 0);
  assert.equal(events.filter((e) => e.type === 'UnitStepped' && e.unitId === 'a01').length, 1);
  assert.equal(a02.tile, at(state, 15, 4));
  assert.equal(state.pods[0].alert, 'engaged');
  assert.equal(hasStatus(x2, 'overwatch'), false);
  assert.equal(x1.tile, at(state, 5, 2));
});

test('onStep returns true when the mover died and false when nothing watched it', () => {
  const state = makeState();
  const x1 = addUnit(state, 'x1', 'ranger', 10, 2);
  addUnit(state, 'a01', 'trooper', 12, 2, { overwatch: true });
  x1.hp = 1;
  state.rngState = seedFor(lt(30));
  const ctx = createContext(state);
  assert.equal(Reactions.onStep(state, ctx, x1), true);
  assert.equal(Reactions.onStep(state, createContext(state), state.units.a01), false);
});
