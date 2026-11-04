// Created by Claude (claude-opus-5-5)
// Date: 2026-10-21

import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createGrid, toIndex, placeProp, rebuildAllEdgeCover } from '../js/sim/grid.js';
import { STATE_VERSION, PHASE, createUnit, livingUnits } from '../js/sim/state.js';
import { execute, validate as executorValidate, setHooks, resetHooks } from '../js/sim/executor.js';
import { validate, use } from '../js/sim/abilities.js';
import { buildMission } from '../js/sim/map-builder.js';
import { coverAt } from '../js/sim/cover.js';
import { tileDistance } from '../js/sim/visibility.js';
import { CLASSES } from '../js/data/classes.js';
import { ENEMIES } from '../js/data/enemies.js';
import { RULES } from '../js/data/rules.js';
import * as Detection from '../js/sim/detection.js';
import * as Reactions from '../js/sim/reactions.js';
import {
  AI_PROFILES, RESTLESS_TURNS, nextCommand, patrolStep, patrolTarget, scoreTile, chooseAction, profileOf, distanceField,
} from '../js/sim/ai.js';
import { compute } from '../js/sim/hit.js';

/** @created Claude (claude-opus-5-5) - 2026-10-21 */
beforeEach(() => {
  resetHooks();
  setHooks({ detection: Detection, reactions: Reactions, abilities: { validate, use } });
});

// Open map on the alien turn, squad unconcealed. props: [x, z, kind].
/** @created Claude (claude-opus-5-5) - 2026-10-21 */
function makeState(width = 24, depth = 9, props = []) {
  const grid = createGrid(width, depth);
  for (const [x, z, kind] of props) placeProp(grid, toIndex(grid, x, z), kind);
  rebuildAllEdgeCover(grid);
  return {
    version: STATE_VERSION, seed: 1, rngState: 1, turn: 1, activeSide: 'alien', phase: PHASE.enemyTurn,
    grid, units: {}, pods: [], squadConcealed: false, outcome: null,
  };
}

// Aliens start with full AP, soldiers with none (it is the alien turn).
/** @created Claude (claude-opus-5-5) - 2026-10-21 */
function addUnit(state, id, defId, x, z) {
  const team = CLASSES[defId] ? 'xcom' : 'alien';
  const unit = createUnit(id, team, defId, CLASSES[defId] ?? ENEMIES[defId], toIndex(state.grid, x, z));
  unit.ap = team === 'alien' ? RULES.apPerTurn : 0;
  state.units[id] = unit;
  return unit;
}

/** @created Claude (claude-opus-5-5) - 2026-10-21 */
function addPod(state, id, unitIds, alert = 'engaged', patrolRoute = []) {
  const pod = { id, unitIds, alert, patrolRoute, patrolIndex: 0 };
  state.pods.push(pod);
  return pod;
}

const at = (state, x, z) => toIndex(state.grid, x, z);
const run = (state, cmd) => execute(state, cmd, { autosave: false });

test('every enemy ai profile has frozen weights', () => {
  assert.ok(Object.isFrozen(AI_PROFILES));
  for (const def of Object.values(ENEMIES)) {
    const w = AI_PROFILES[def.ai];
    assert.ok(w, `profile ${def.ai}`);
    assert.ok(Object.isFrozen(w));
    for (const key of ['w1', 'w2', 'w3', 'w4', 'minHit']) assert.equal(typeof w[key], 'number');
  }
  assert.equal(profileOf({ defId: 'stunLancer' }), 'melee');
  assert.equal(profileOf({ defId: 'sectoid' }), 'caster');
  assert.equal(profileOf({ defId: 'ranger' }), 'rifleman');
});

test('an Unaware pod patrols: the leader heads for the waypoint, the follower closes on the leader, then null', () => {
  const state = makeState();
  state.squadConcealed = true;
  addUnit(state, 'x1', 'ranger', 23, 0);
  addUnit(state, 'a01', 'trooper', 5, 4);
  addUnit(state, 'a02', 'trooper', 4, 4);
  const pod = addPod(state, 'p1', ['a01', 'a02'], 'unaware', [at(state, 15, 4), at(state, 15, 7), at(state, 10, 7)]);

  // turn 1 with patrolIndex 0 aims at route[1]; the next turn moves on to route[2]
  const waypoint = patrolTarget(state, pod);
  assert.equal(waypoint, at(state, 15, 7));
  assert.equal(patrolTarget({ ...state, turn: 2 }, pod), at(state, 10, 7));

  const field = distanceField(state, [waypoint]);
  const lead = nextCommand(state);
  assert.deepEqual(lead, patrolStep(state, pod));
  assert.equal(lead.type, 'move');
  assert.equal(lead.unitId, 'a01');
  assert.ok(field[lead.dest] < field[at(state, 5, 4)]);
  run(state, lead);
  assert.equal(state.units.a01.ap, 1);

  const follow = nextCommand(state);
  assert.equal(follow.unitId, 'a02');
  const before = tileDistance(state.grid, at(state, 4, 4), state.units.a01.tile);
  assert.ok(tileDistance(state.grid, follow.dest, state.units.a01.tile) < before);
  run(state, follow);

  // each member patrols once per turn and keeps its last AP
  assert.equal(nextCommand(state), null);
  assert.equal(state.units.a02.ap, 1);
  assert.equal(state.pods[0].patrolIndex, 0);
  assert.equal(state.squadConcealed, true);
});

test('an engaged rifleman moves into cover, then shoots the soldier in the open', () => {
  // barriers give (13,3) and (13,5) half cover facing west; x2 hides behind a crate, x1 stands in the open
  const state = makeState(24, 9, [[12, 3, 'barrier'], [12, 5, 'barrier'], [5, 6, 'crate']]);
  addUnit(state, 'x1', 'ranger', 4, 2);
  addUnit(state, 'x2', 'ranger', 4, 6);
  addUnit(state, 'a01', 'trooper', 14, 4);
  addPod(state, 'p1', ['a01']);

  const first = nextCommand(state);
  assert.equal(first.type, 'move');
  assert.equal(first.unitId, 'a01');
  for (const s of ['x1', 'x2']) assert.notEqual(coverAt(state, first.dest, state.units[s].tile).level, 'none');
  assert.ok(scoreTile(state, state.units.a01, first.dest) > scoreTile(state, state.units.a01, state.units.a01.tile));
  run(state, first);

  const second = nextCommand(state);
  assert.deepEqual(second, { type: 'ability', unitId: 'a01', abilityId: 'standardShot', targetId: 'x1' });
  run(state, second);
  assert.equal(state.units.a01.ap, 0);
  assert.equal(nextCommand(state), null);
});

test('an engaged stun lancer closes in, then lances', () => {
  const state = makeState();
  addUnit(state, 'x1', 'ranger', 6, 4);
  addUnit(state, 'a01', 'stunLancer', 18, 4);
  addPod(state, 'p1', ['a01']);

  const first = nextCommand(state);
  assert.equal(first.type, 'move');
  const x1 = state.units.x1.tile;
  assert.ok(tileDistance(state.grid, first.dest, x1) < tileDistance(state.grid, state.units.a01.tile, x1));
  run(state, first);

  const second = nextCommand(state);
  assert.equal(second.abilityId, 'stunLance');
  assert.equal(second.targetId, 'x1');
  assert.ok(tileDistance(state.grid, second.targetTile, x1) <= 1.5);
  assert.equal(executorValidate(state, second).ok, true);
});

test('a rifleman with no good shot overwatches', () => {
  // x1 hunkers behind a wall: the trooper can see it by step-out but the shot rounds to 0
  const state = makeState(24, 9, [[5, 4, 'wall']]);
  const x1 = addUnit(state, 'x1', 'ranger', 4, 4);
  x1.statuses.push({ id: 'hunkered', turns: null });
  const a01 = addUnit(state, 'a01', 'trooper', 16, 4);
  a01.ap = 1;
  addPod(state, 'p1', ['a01']);

  assert.deepEqual(chooseAction(state, a01, 'rifleman'), { type: 'ability', unitId: 'a01', abilityId: 'overwatch' });

  // the same trooper takes the shot once x1 stands in the open
  x1.statuses = [];
  x1.tile = at(state, 8, 4);
  assert.equal(chooseAction(state, a01, 'rifleman').abilityId, 'standardShot');
});

test('a restless rifleman never overwatches: it takes a long-odds shot, else moves', () => {
  const state = makeState(24, 9, [[5, 4, 'wall']]);
  const x1 = addUnit(state, 'x1', 'ranger', 4, 4);
  const a01 = addUnit(state, 'a01', 'trooper', 16, 4);
  a01.ap = 1;
  addPod(state, 'p1', ['a01']);
  const { hit } = compute(state, a01, x1, 'standardShot');
  assert.ok(hit > 0 && hit < AI_PROFILES.rifleman.minHit, `precondition: long odds (${hit})`);
  assert.notEqual(chooseAction(state, a01, 'rifleman').abilityId, 'standardShot');

  a01.idleTurns = RESTLESS_TURNS;
  assert.equal(chooseAction(state, a01, 'rifleman').abilityId, 'standardShot');

  // Hunkered, the shot rounds to 0, so the restless trooper moves instead of overwatching.
  x1.statuses.push({ id: 'hunkered', turns: null });
  assert.equal(chooseAction(state, a01, 'rifleman').type, 'move');
});

test('idleTurns counts engaged alien turns and resets on a hostile ability', () => {
  const state = makeState(24, 9);
  state.activeSide = 'xcom';
  state.phase = PHASE.playerTurn;
  addUnit(state, 'x1', 'ranger', 2, 4).hp = 50; // survives the shot below
  const a01 = addUnit(state, 'a01', 'trooper', 10, 4);
  const a02 = addUnit(state, 'a02', 'trooper', 22, 0);
  addPod(state, 'p1', ['a01']);
  addPod(state, 'p2', ['a02'], 'unaware');
  run(state, { type: 'endTurn' });
  assert.deepEqual([a01.idleTurns, a02.idleTurns], [1, 0]);
  run(state, { type: 'ability', unitId: 'a01', abilityId: 'standardShot', targetId: 'x1' });
  assert.equal(a01.idleTurns, 0);
  run(state, { type: 'endTurn' });
  run(state, { type: 'endTurn' });
  assert.equal(a01.idleTurns, 1);
});

test('a rifleman out of ammo reloads before it overwatches', () => {
  const state = makeState(24, 9, [[10, 0, 'wall'], [10, 1, 'wall'], [10, 2, 'wall'], [10, 3, 'wall'], [10, 4, 'wall'],
    [10, 5, 'wall'], [10, 6, 'wall'], [10, 7, 'wall'], [10, 8, 'wall']]);
  addUnit(state, 'x1', 'ranger', 4, 4);
  const a01 = addUnit(state, 'a01', 'trooper', 16, 4);
  a01.ap = 1;
  a01.ammo = 0;
  addPod(state, 'p1', ['a01']);
  assert.equal(nextCommand(state).abilityId, 'reload');
});

test('a sectoid with a soldier in sight casts Mindspin', () => {
  const state = makeState();
  addUnit(state, 'x1', 'ranger', 6, 4);
  const a01 = addUnit(state, 'a01', 'sectoid', 14, 4);
  a01.ap = 1;
  addPod(state, 'p1', ['a01']);
  assert.deepEqual(nextCommand(state), { type: 'ability', unitId: 'a01', abilityId: 'psiDisorient', targetId: 'x1' });
});

test('nextCommand is null outside the alien turn and when the aliens are out of AP', () => {
  const state = makeState();
  addUnit(state, 'x1', 'ranger', 6, 4);
  const a01 = addUnit(state, 'a01', 'trooper', 14, 4);
  addPod(state, 'p1', ['a01']);
  assert.notEqual(nextCommand(state), null);
  assert.equal(nextCommand({ ...state, activeSide: 'xcom', phase: PHASE.playerTurn }), null);
  assert.equal(nextCommand({ ...state, outcome: 'victory', phase: PHASE.ended }), null);
  a01.ap = 0;
  assert.equal(nextCommand(state), null);
});

// A mission on the alien turn of round 1: deployed, xcom ended its turn. engaged: every pod engaged, squad unconcealed.
/** @created Claude (claude-opus-5-5) - 2026-10-21 */
function missionOnAlienTurn(seed, engaged) {
  const state = buildMission(seed);
  run(state, { type: 'deploy' });
  if (engaged) {
    state.squadConcealed = false;
    for (const pod of state.pods) pod.alert = 'engaged';
  }
  run(state, { type: 'endTurn' });
  return state;
}

// Loops nextCommand until null for one alien side, checking every command and the AP bound. -> events of the side.
/** @created Claude (claude-opus-5-5) - 2026-10-21 */
function playAlienSide(state) {
  const budget = livingUnits(state, 'alien').reduce((sum, u) => sum + u.ap, 0);
  const events = [];
  let count = 0;
  for (let cmd = nextCommand(state); cmd; cmd = nextCommand(state)) {
    assert.equal(executorValidate(state, cmd).ok, true, JSON.stringify(cmd));
    count += 1;
    assert.ok(count <= budget, `more commands than AP (${budget})`);
    events.push(cmd, ...run(state, cmd));
    if (state.outcome) break;
  }
  return events;
}

for (const engaged of [false, true]) {
  test(`full enemy turns on buildMission end with null (${engaged ? 'engaged' : 'unaware'} pods)`, () => {
    for (const seed of [1, 2, 3, 7, 42, 1234]) {
      const state = missionOnAlienTurn(seed, engaged);
      for (let round = 0; round < 3 && !state.outcome; round++) {
        playAlienSide(state);
        if (state.outcome) break;
        assert.equal(nextCommand(state), null);
        run(state, { type: 'endTurn' });
        assert.equal(nextCommand(state), null, 'null on the xcom turn');
        run(state, { type: 'endTurn' });
      }
    }
  });
}

test('an enemy turn replays exactly from the same state', () => {
  const a = missionOnAlienTurn(42, true);
  const b = structuredClone(a);
  assert.deepEqual(playAlienSide(a), playAlienSide(b));
  assert.deepEqual(a, b);
});

test('the same state gives the same command and nextCommand changes nothing', () => {
  for (const engaged of [false, true]) {
    const state = missionOnAlienTurn(7, engaged);
    const snapshot = structuredClone(state);
    const cmd = nextCommand(state);
    assert.notEqual(cmd, null);
    assert.deepEqual(state, snapshot);
    assert.deepEqual(nextCommand(state), cmd);
    assert.deepEqual(nextCommand(snapshot), cmd);
    assert.deepEqual(state, snapshot);
  }
});
