// Created by Claude (claude-opus-5-5)
// Date: 2026-10-21

import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createGrid, toIndex } from '../js/sim/grid.js';
import { STATE_VERSION, PHASE, createUnit, hasStatus, statValue } from '../js/sim/state.js';
import { EVENT, createContext } from '../js/sim/events.js';
import { InvalidCommand, validate, execute, setHooks, resetHooks, getHooks, walkPath } from '../js/sim/executor.js';
import { reachable } from '../js/sim/pathfinder.js';
import { buildMission } from '../js/sim/map-builder.js';
import { CLASSES } from '../js/data/classes.js';
import { ENEMIES } from '../js/data/enemies.js';

beforeEach(() => resetHooks());

// Open 10x10 grid in Deploy phase. Soldiers on row 0, aliens on row 9; mobility 3 keeps bands short.
function setup({ soldiers = 2, aliens = 1 } = {}) {
  const grid = createGrid(10, 10);
  const units = {};
  for (let k = 1; k <= soldiers; k++) {
    units[`x${k}`] = createUnit(`x${k}`, 'xcom', 'ranger', CLASSES.ranger, toIndex(grid, k - 1, 0));
    units[`x${k}`].stats.mobility = 3;
  }
  for (let k = 1; k <= aliens; k++) {
    const id = `a${String(k).padStart(2, '0')}`;
    units[id] = createUnit(id, 'alien', 'trooper', ENEMIES.trooper, toIndex(grid, 9 - (k - 1), 9));
  }
  return {
    version: STATE_VERSION, seed: 1, rngState: 1, turn: 0, activeSide: 'xcom', phase: PHASE.deploy,
    grid, units, pods: [], squadConcealed: false, outcome: null,
  };
}

function deployed(opts) {
  const state = setup(opts);
  execute(state, { type: 'deploy' }, { autosave: false });
  return state;
}

const types = (events) => events.map((e) => e.type);

function assertRejected(state, cmd, reason) {
  const before = structuredClone(state);
  assert.deepEqual(validate(state, cmd), { ok: false, reason });
  assert.throws(() => execute(state, cmd, { autosave: false }), (err) => err instanceof InvalidCommand && err.reason === reason);
  assert.deepEqual(state, before);
}

test('createContext emits { type, ...payload } in order and rejects unknown types', () => {
  const ctx = createContext({});
  ctx.emit(EVENT.UnitKilled, { unitId: 'a01' });
  ctx.emit(EVENT.TurnStarted, { side: 'xcom', turn: 2 });
  assert.deepEqual(ctx.events, [{ type: 'UnitKilled', unitId: 'a01' }, { type: 'TurnStarted', side: 'xcom', turn: 2 }]);
  assert.throws(() => ctx.emit('Nope', {}));
});

test('deploy starts turn 1 for xcom: concealed, soldiers at 2 AP, aliens at 0', () => {
  const state = setup();
  const events = execute(state, { type: 'deploy' }, { autosave: false });
  assert.deepEqual(events, [{ type: 'TurnStarted', side: 'xcom', turn: 1 }]);
  assert.equal(state.phase, PHASE.playerTurn);
  assert.equal(state.turn, 1);
  assert.equal(state.squadConcealed, true);
  assert.deepEqual([state.units.x1.ap, state.units.x2.ap, state.units.a01.ap], [2, 2, 0]);
  assertRejected(state, { type: 'deploy' }, 'The squad is already deployed');
});

test('endTurn zeroes AP, switches side, refreshes AP and advances the turn on the way back', () => {
  const state = deployed();
  let events = execute(state, { type: 'endTurn' }, { autosave: false });
  assert.deepEqual(events, [{ type: 'TurnStarted', side: 'alien', turn: 1 }]);
  assert.equal(state.activeSide, 'alien');
  assert.equal(state.phase, PHASE.enemyTurn);
  assert.deepEqual([state.units.x1.ap, state.units.a01.ap], [0, 2]);

  events = execute(state, { type: 'endTurn', side: 'alien' }, { autosave: false });
  assert.deepEqual(events, [{ type: 'TurnStarted', side: 'xcom', turn: 2 }]);
  assert.deepEqual([state.units.x1.ap, state.units.a01.ap], [2, 0]);
});

test('endTurn is valid only for the active side', () => {
  const state = deployed();
  assertRejected(state, { type: 'endTurn', side: 'alien' }, 'It is not your turn');
});

test('move in the blue band spends 1 AP and steps tile by tile', () => {
  const state = deployed();
  const { grid } = state;
  const dest = toIndex(grid, 0, 3);
  const events = execute(state, { type: 'move', unitId: 'x1', dest }, { autosave: false });
  assert.deepEqual(events, [
    { type: 'UnitStepped', unitId: 'x1', from: toIndex(grid, 0, 0), to: toIndex(grid, 0, 1) },
    { type: 'UnitStepped', unitId: 'x1', from: toIndex(grid, 0, 1), to: toIndex(grid, 0, 2) },
    { type: 'UnitStepped', unitId: 'x1', from: toIndex(grid, 0, 2), to: dest },
    { type: 'ApSpent', unitId: 'x1', spent: 1, ap: 1 },
  ]);
  assert.equal(state.units.x1.tile, dest);
  assert.equal(state.units.x1.ap, 1);
});

test('move in the yellow band spends 2 AP', () => {
  const state = deployed();
  const dest = toIndex(state.grid, 0, 5);
  const events = execute(state, { type: 'move', unitId: 'x1', dest }, { autosave: false });
  assert.equal(types(events).filter((t) => t === 'UnitStepped').length, 5);
  assert.deepEqual(events.at(-1), { type: 'ApSpent', unitId: 'x1', spent: 2, ap: 0 });
  assert.equal(state.units.x1.ap, 0);
  assert.equal(state.activeSide, 'xcom', 'x2 still has AP');
});

test('the xcom side ends on its own once no soldier has AP', () => {
  const state = deployed({ soldiers: 1 });
  const events = execute(state, { type: 'move', unitId: 'x1', dest: toIndex(state.grid, 0, 5) }, { autosave: false });
  assert.deepEqual(events.slice(-2), [
    { type: 'ApSpent', unitId: 'x1', spent: 2, ap: 0 },
    { type: 'TurnStarted', side: 'alien', turn: 1 },
  ]);
  assert.equal(state.activeSide, 'alien');

  // The alien side never auto-ends: the AI driver sends endTurn.
  execute(state, { type: 'move', unitId: 'a01', dest: toIndex(state.grid, 9, 1) }, { autosave: false });
  assert.equal(state.units.a01.ap, 0);
  assert.equal(state.activeSide, 'alien');
});

test('invalid commands throw InvalidCommand with a reason and change nothing', () => {
  const state = deployed();
  const { grid } = state;
  assertRejected(state, null, 'Unknown command');
  assertRejected(state, { type: 'teleport' }, 'Unknown command');
  assertRejected(state, { type: 'move', unitId: 'x9', dest: 5 }, 'Unknown unit');
  assertRejected(state, { type: 'move', unitId: 'constructor', dest: 5 }, 'Unknown unit');
  assertRejected(state, { type: 'move', unitId: 'a01', dest: toIndex(grid, 9, 8) }, 'That unit cannot act this turn');
  assertRejected(state, { type: 'move', unitId: 'x1', dest: 1.5 }, 'Pick a tile on the map');
  assertRejected(state, { type: 'move', unitId: 'x1', dest: 100 }, 'Pick a tile on the map');
  assertRejected(state, { type: 'move', unitId: 'x1', dest: toIndex(grid, 0, 7) }, 'That tile is out of reach');
  assertRejected(state, { type: 'move', unitId: 'x1', dest: toIndex(grid, 1, 0) }, 'That tile is out of reach'); // x2 stands there
  assertRejected(state, { type: 'move', unitId: 'x1', dest: state.units.x1.tile }, 'That tile is out of reach');
  assertRejected(state, { type: 'ability', unitId: 'x1', abilityId: 'nope' }, 'Unknown ability');
  assertRejected(state, { type: 'ability', unitId: 'x1', abilityId: 'standardShot', targetId: 'a01' }, 'Abilities are not implemented yet');

  // reachable drops the yellow band at 1 AP, so a dash tile reads as out of reach.
  state.units.x1.ap = 1;
  assertRejected(state, { type: 'move', unitId: 'x1', dest: toIndex(grid, 0, 5) }, 'That tile is out of reach');
  state.units.x1.ap = 0;
  assertRejected(state, { type: 'move', unitId: 'x1', dest: toIndex(grid, 0, 1) }, 'No actions left');
  state.units.x2.hp = 0;
  assertRejected(state, { type: 'move', unitId: 'x2', dest: toIndex(grid, 1, 1) }, 'That unit is dead');
});

test('commands before deploy and after the battle are rejected', () => {
  const state = setup();
  assertRejected(state, { type: 'endTurn' }, 'The battle has not started');
  assertRejected(state, { type: 'move', unitId: 'x1', dest: toIndex(state.grid, 0, 1) }, 'The battle has not started');
  state.outcome = 'victory';
  state.phase = PHASE.ended;
  assertRejected(state, { type: 'endTurn' }, 'The battle is over');
});

test('each step runs detection, then reactions, and the move hook order is stable', () => {
  const state = deployed();
  const calls = [];
  setHooks({
    detection: { onStep: (s, ctx, mover) => { calls.push(['detect', mover.id, mover.tile]); } },
    reactions: { onStep: (s, ctx, mover) => { calls.push(['react', mover.id, mover.tile]); } },
  });
  execute(state, { type: 'move', unitId: 'x1', dest: toIndex(state.grid, 0, 2) }, { autosave: false });
  const t1 = toIndex(state.grid, 0, 1);
  const t2 = toIndex(state.grid, 0, 2);
  assert.deepEqual(calls, [['detect', 'x1', t1], ['react', 'x1', t1], ['detect', 'x1', t2], ['react', 'x1', t2]]);
});

test('a reaction that kills the mover stops the path; ApSpent still follows', () => {
  const state = deployed();
  setHooks({
    reactions: {
      onStep: (s, ctx, mover) => {
        ctx.emit(EVENT.OverwatchTriggered, { unitId: 'a01', targetId: mover.id });
        mover.hp = 0;
        ctx.emit(EVENT.UnitKilled, { unitId: mover.id });
        return true;
      },
    },
  });
  const events = execute(state, { type: 'move', unitId: 'x1', dest: toIndex(state.grid, 0, 3) }, { autosave: false });
  assert.deepEqual(types(events), ['UnitStepped', 'OverwatchTriggered', 'UnitKilled', 'ApSpent']);
  assert.equal(state.units.x1.tile, toIndex(state.grid, 0, 1));
});

test('detection that kills the mover skips reactions; a true return stops after the step', () => {
  const state = deployed();
  let reacted = 0;
  setHooks({
    detection: { onStep: (s, ctx, mover) => { mover.hp = 0; } },
    reactions: { onStep: () => { reacted += 1; } },
  });
  execute(state, { type: 'move', unitId: 'x1', dest: toIndex(state.grid, 0, 3) }, { autosave: false });
  assert.equal(reacted, 0);

  const other = deployed();
  setHooks({ detection: { onStep: () => true }, reactions: { onStep: () => { reacted += 1; } } });
  execute(other, { type: 'move', unitId: 'x1', dest: toIndex(other.grid, 0, 3) }, { autosave: false });
  assert.equal(other.units.x1.tile, toIndex(other.grid, 0, 1));
  assert.equal(other.units.x1.ap, 1);
  assert.equal(reacted, 1, 'reactions still see the step where detection stopped the path');
});

test('walkPath stops before a tile another unit took mid-move', () => {
  const state = deployed();
  const { grid } = state;
  const unit = state.units.x1;
  const ctx = createContext(state);
  const path = [toIndex(grid, 0, 1), toIndex(grid, 0, 2), toIndex(grid, 0, 3)];
  setHooks({ detection: { onStep: (s) => { s.units.a01.tile = toIndex(grid, 0, 2); } } });
  assert.equal(walkPath(state, ctx, unit, path), 1);
  assert.equal(unit.tile, path[0]);
});

test('abilities route through the abilities hooks', () => {
  const state = deployed();
  setHooks({ abilities: { validate: () => ({ ok: true }) } });
  // validate passes but the default use still refuses, and nothing changes.
  const before = structuredClone(state);
  assert.throws(() => execute(state, { type: 'ability', unitId: 'x1', abilityId: 'hunker' }, { autosave: false }), InvalidCommand);
  assert.deepEqual(state, before);

  setHooks({
    abilities: {
      validate: (s, cmd) => (cmd.abilityId === 'hunker' ? { ok: true } : { ok: false, reason: 'No' }),
      use: (s, ctx, cmd) => {
        const unit = s.units[cmd.unitId];
        unit.ap = 0;
        unit.statuses.push({ id: 'hunkered', turns: null });
        ctx.emit(EVENT.StatusApplied, { unitId: unit.id, status: 'hunkered', turns: null });
      },
    },
  });
  assert.deepEqual(validate(state, { type: 'ability', unitId: 'x1', abilityId: 'overwatch' }), { ok: false, reason: 'No' });
  const events = execute(state, { type: 'ability', unitId: 'x1', abilityId: 'hunker' }, { autosave: false });
  assert.deepEqual(types(events), ['StatusApplied']);
  assert.equal(hasStatus(state.units.x1, 'hunkered'), true);
});

test('setHooks accepts module namespaces and getHooks exposes onNoise', () => {
  const tiles = [];
  setHooks({ detection: { onNoise: (s, ctx, tile) => tiles.push(tile), extra: 1 } });
  getHooks().detection.onNoise({}, null, 7);
  assert.deepEqual(tiles, [7]);
  assert.equal(typeof getHooks().detection.onStep, 'function', 'merging keeps the other hook');
});

test('beginSide ticks statuses and cooldowns for its own side only', () => {
  const state = deployed();
  const x1 = state.units.x1;
  x1.statuses = [
    { id: 'overwatch', turns: null },
    { id: 'aided', turns: 1, stat: 'defense', amount: 20 },
    { id: 'marked', turns: 2, stat: 'defense', amount: -15 },
    { id: 'hunkered', turns: 1 },
  ];
  x1.cooldowns = { runAndGun: 2, deadeye: 1 };
  assert.equal(statValue(x1, 'defense'), 5);

  // Alien side begins: xcom statuses stay put.
  let events = execute(state, { type: 'endTurn' }, { autosave: false });
  assert.deepEqual(types(events), ['TurnStarted']);
  assert.equal(x1.statuses.length, 4);

  events = execute(state, { type: 'endTurn' }, { autosave: false });
  assert.deepEqual(events, [
    { type: 'TurnStarted', side: 'xcom', turn: 2 },
    { type: 'StatusExpired', unitId: 'x1', status: 'overwatch' },
    { type: 'StatusExpired', unitId: 'x1', status: 'aided' },
    { type: 'StatusExpired', unitId: 'x1', status: 'hunkered' },
  ]);
  assert.deepEqual(x1.statuses, [{ id: 'marked', turns: 1, stat: 'defense', amount: -15 }]);
  assert.deepEqual(x1.cooldowns, { runAndGun: 1 });
  assert.equal(statValue(x1, 'defense'), -15);
});

test('a stunned unit starts its side with 0 AP, then the stun expires', () => {
  const state = deployed();
  state.units.x1.statuses.push({ id: 'stunned', turns: 1 });
  execute(state, { type: 'endTurn' }, { autosave: false });
  const events = execute(state, { type: 'endTurn' }, { autosave: false });
  assert.equal(state.units.x1.ap, 0);
  assert.equal(state.units.x2.ap, 2);
  assert.deepEqual(events.at(-1), { type: 'StatusExpired', unitId: 'x1', status: 'stunned' });
});

test('killing the last alien sets victory, emits BattleEnded and locks further commands', () => {
  const state = deployed();
  setHooks({
    abilities: {
      validate: () => ({ ok: true }),
      use: (s, ctx, cmd) => {
        s.units[cmd.targetId].hp = 0;
        ctx.emit(EVENT.UnitKilled, { unitId: cmd.targetId });
      },
    },
  });
  const events = execute(state, { type: 'ability', unitId: 'x1', abilityId: 'standardShot', targetId: 'a01' }, { autosave: false });
  assert.deepEqual(events, [{ type: 'UnitKilled', unitId: 'a01' }, { type: 'BattleEnded', outcome: 'victory' }]);
  assert.equal(state.outcome, 'victory');
  assert.equal(state.phase, PHASE.ended);
  assertRejected(state, { type: 'endTurn' }, 'The battle is over');
});

test('losing the last soldier mid-move sets defeat', () => {
  const state = deployed({ soldiers: 1 });
  setHooks({ reactions: { onStep: (s, ctx, mover) => { mover.hp = 0; ctx.emit(EVENT.UnitKilled, { unitId: mover.id }); } } });
  const events = execute(state, { type: 'move', unitId: 'x1', dest: toIndex(state.grid, 0, 2) }, { autosave: false });
  assert.deepEqual(types(events), ['UnitStepped', 'UnitKilled', 'ApSpent', 'BattleEnded']);
  assert.equal(state.outcome, 'defeat');
  assert.equal(state.activeSide, 'xcom', 'no side switch after the battle ends');
});

test('autosave calls the save hook after a command, not when off or on a throw', () => {
  const saved = [];
  setHooks({ save: (s) => saved.push(s.turn) });
  const state = setup();
  execute(state, { type: 'deploy' });
  execute(state, { type: 'endTurn' }, { autosave: false });
  assert.throws(() => execute(state, { type: 'endTurn', side: 'xcom' }), InvalidCommand);
  assert.deepEqual(saved, [1]);
});

test('the same seed and commands give the same JSON-safe event list', () => {
  const run = () => {
    const state = buildMission(1234);
    const events = [...execute(state, { type: 'deploy' }, { autosave: false })];
    for (const id of ['x1', 'x2', 'x3', 'x4']) {
      const unit = state.units[id];
      const tiles = [...reachable(state, unit)].filter(([, r]) => r.apCost === 1).map(([t]) => t).sort((a, b) => a - b);
      events.push(...execute(state, { type: 'move', unitId: id, dest: tiles.at(-1) }, { autosave: false }));
    }
    events.push(...execute(state, { type: 'endTurn' }, { autosave: false }));
    return { events, state };
  };
  const a = run();
  const b = run();
  assert.deepEqual(a.events, b.events);
  assert.deepEqual(a.state, b.state);
  assert.ok(a.events.length > 6);
  assert.deepEqual(JSON.parse(JSON.stringify(a.events)), a.events);
  for (const e of a.events) for (const v of Object.values(e)) assert.ok(typeof v !== 'object' || v === null, `${e.type} carries an object`);
});
