// Created by Claude (claude-opus-5-5)
// Date: 2026-10-21

import test from 'node:test';
import assert from 'node:assert/strict';
import { createGrid, toIndex, placeProp, rebuildAllEdgeCover } from '../js/sim/grid.js';
import { createUnit } from '../js/sim/state.js';
import { CLASSES } from '../js/data/classes.js';
import { ENEMIES } from '../js/data/enemies.js';
import {
  hasLosTiles, hasLos, canSee, visibleEnemies, squadVisible, stepOutTiles, tileDistance, seesTile, squadSightTiles,
} from '../js/sim/visibility.js';

/** @created Claude (claude-opus-5-5) - 2026-10-21 */
function makeState(width, depth, props = [], units = []) {
  const grid = createGrid(width, depth);
  for (const [x, z, kind] of props) placeProp(grid, toIndex(grid, x, z), kind);
  rebuildAllEdgeCover(grid);
  const state = { grid, units: {} };
  for (const [id, team, x, z] of units) {
    const def = team === 'xcom' ? CLASSES.ranger : ENEMIES.trooper;
    state.units[id] = createUnit(id, team, team === 'xcom' ? 'ranger' : 'trooper', def, toIndex(grid, x, z));
  }
  return state;
}

const at = (state, x, z) => toIndex(state.grid, x, z);

test('a wall blocks line of sight, open ground does not', () => {
  const open = makeState(5, 3);
  assert.equal(hasLosTiles(open, at(open, 0, 1), at(open, 4, 1)), true);
  const walled = makeState(5, 3, [[2, 1, 'wall']], [['x1', 'xcom', 0, 1], ['a01', 'alien', 4, 1]]);
  assert.equal(hasLosTiles(walled, at(walled, 0, 1), at(walled, 4, 1)), false);
  assert.equal(hasLos(walled, walled.units.x1, walled.units.a01), false);
});

test('crates, barriers and barrels do not block line of sight', () => {
  for (const kind of ['crate', 'barrier', 'barrel']) {
    const s = makeState(5, 3, [[2, 1, kind]]);
    assert.equal(hasLosTiles(s, at(s, 0, 1), at(s, 4, 1)), true, kind);
  }
});

test('high terrain blocks low viewers, high viewers see over it', () => {
  const s = makeState(5, 3);
  s.grid.heights[at(s, 2, 1)] = 2;
  assert.equal(hasLosTiles(s, at(s, 0, 1), at(s, 4, 1)), false);
  // A one-level step stays under a level ray.
  s.grid.heights[at(s, 2, 1)] = 1;
  assert.equal(hasLosTiles(s, at(s, 0, 1), at(s, 4, 1)), true);
  // From height 3 the ray clears a height 2 ridge.
  s.grid.heights[at(s, 2, 1)] = 2;
  s.grid.heights[at(s, 0, 1)] = 3;
  assert.equal(hasLosTiles(s, at(s, 0, 1), at(s, 4, 1)), true);
});

test('a ray through a corner passes one wall and is sealed by two', () => {
  const one = makeState(3, 3, [[1, 0, 'wall']]);
  assert.equal(hasLosTiles(one, at(one, 0, 0), at(one, 2, 2)), true);
  const two = makeState(3, 3, [[1, 0, 'wall'], [0, 1, 'wall']]);
  assert.equal(hasLosTiles(two, at(two, 0, 0), at(two, 2, 2)), false);
});

test('line of sight is symmetric on flat ground and trivially true on the same tile', () => {
  const s = makeState(7, 7, [[2, 3, 'wall'], [4, 1, 'rock'], [3, 5, 'crate']]);
  for (let a = 0; a < 49; a++) {
    assert.equal(hasLosTiles(s, a, a), true);
    for (let b = 0; b < 49; b++) assert.equal(hasLosTiles(s, a, b), hasLosTiles(s, b, a), `${a} -> ${b}`);
  }
});

test('step-out lets a unit behind a wall see around its corner', () => {
  // Wall line along z = 2 from x = 0 to 3; viewer tucked behind its east end.
  const walls = [[0, 2, 'wall'], [1, 2, 'wall'], [2, 2, 'wall'], [3, 2, 'wall']];
  const s = makeState(6, 5, walls, [['x1', 'xcom', 3, 1], ['a01', 'alien', 4, 4]]);
  const { x1, a01 } = s.units;
  assert.equal(hasLosTiles(s, x1.tile, a01.tile), false);
  assert.deepEqual(stepOutTiles(s, x1.tile, 'x1'), [at(s, 3, 0), at(s, 4, 1), at(s, 2, 1)]);
  assert.equal(hasLos(s, x1, a01), true);
  // Targets use the same rule.
  assert.equal(hasLos(s, a01, x1), true);
});

test('step-out needs a free, walkable tile within climb range', () => {
  const walls = [[0, 2, 'wall'], [1, 2, 'wall'], [2, 2, 'wall'], [3, 2, 'wall']];
  const blocked = makeState(6, 5, walls, [['x1', 'xcom', 3, 1], ['x2', 'xcom', 4, 1], ['a01', 'alien', 4, 4]]);
  assert.equal(hasLos(blocked, blocked.units.x1, blocked.units.a01), false);

  const cliff = makeState(6, 5, walls, [['x1', 'xcom', 3, 1], ['a01', 'alien', 4, 4]]);
  cliff.grid.heights[at(cliff, 4, 1)] = 2;
  assert.equal(stepOutTiles(cliff, cliff.units.x1.tile, 'x1').includes(at(cliff, 4, 1)), false);

  // No full-cover edge, no step-out.
  const open = makeState(6, 5, [[3, 2, 'crate']], [['x1', 'xcom', 3, 1]]);
  assert.deepEqual(stepOutTiles(open, open.units.x1.tile, 'x1'), []);
});

test('hasLos and canSee accept a hypothetical viewer tile', () => {
  const s = makeState(5, 5, [[2, 2, 'wall']], [['x1', 'xcom', 0, 2], ['a01', 'alien', 4, 2]]);
  const { x1, a01 } = s.units;
  assert.equal(canSee(s, x1, a01), false);
  assert.equal(hasLos(s, x1, a01, { fromTile: at(s, 0, 0) }), true);
  assert.equal(canSee(s, x1, a01, { fromTile: at(s, 0, 0) }), true);
  assert.equal(canSee(s, a01, x1, { targetTile: at(s, 0, 0) }), true);
});

test('canSee respects the sight radius by euclidean tile distance', () => {
  const s = makeState(20, 12, [], [['x1', 'xcom', 0, 0], ['a01', 'alien', 14, 0], ['a02', 'alien', 15, 0], ['a03', 'alien', 10, 10]]);
  const { x1, a01, a02, a03 } = s.units;
  assert.equal(x1.stats.sight, 14);
  assert.equal(canSee(s, x1, a01), true);
  assert.equal(canSee(s, x1, a02), false);
  assert.equal(tileDistance(s.grid, x1.tile, a03.tile), Math.hypot(10, 10));
  assert.equal(canSee(s, x1, a03), false);
});

test('visibleEnemies skips allies, the dead and hidden units', () => {
  const s = makeState(9, 5, [[4, 3, 'wall']],
    [['x1', 'xcom', 0, 3], ['x2', 'xcom', 1, 0], ['a01', 'alien', 8, 0], ['a02', 'alien', 8, 3], ['a03', 'alien', 6, 1]]);
  s.units.a03.hp = 0;
  assert.deepEqual(visibleEnemies(s, s.units.x1).map((u) => u.id), ['a01']);
  assert.deepEqual(visibleEnemies(s, s.units.a01).map((u) => u.id), ['x1', 'x2']);
});

test('squadVisible unions what every living member sees', () => {
  // Wall column at x = 4 hides a02 from x1 and a01 from x2.
  const walls = [[4, 0, 'wall'], [4, 1, 'wall'], [4, 2, 'wall'], [4, 3, 'wall'], [4, 4, 'wall'], [4, 5, 'wall']];
  const s = makeState(9, 7, walls,
    [['x1', 'xcom', 0, 6], ['x2', 'xcom', 8, 6], ['a01', 'alien', 1, 0], ['a02', 'alien', 7, 0]]);
  assert.deepEqual(visibleEnemies(s, s.units.x1).map((u) => u.id), ['a01']);
  assert.deepEqual(visibleEnemies(s, s.units.x2).map((u) => u.id), ['a02']);
  assert.deepEqual([...squadVisible(s, 'xcom')].sort(), ['a01', 'a02']);
  s.units.x2.hp = 0;
  assert.deepEqual([...squadVisible(s, 'xcom')], ['a01']);
});

test('seesTile peeks from step-out tiles and accepts a hypothetical viewer tile', () => {
  const walls = [[0, 2, 'wall'], [1, 2, 'wall'], [2, 2, 'wall'], [3, 2, 'wall']];
  const s = makeState(6, 5, walls, [['x1', 'xcom', 3, 1]]);
  const { x1 } = s.units;
  assert.equal(hasLosTiles(s, x1.tile, at(s, 4, 4)), false);
  assert.equal(seesTile(s, x1, at(s, 4, 4)), true, 'peek around the east end');
  assert.equal(seesTile(s, x1, at(s, 0, 4)), false);
  assert.equal(seesTile(s, x1, at(s, 0, 4), at(s, 0, 3)), true);
});

test('squadSightTiles is the union of seesTile over living members at their given tiles', () => {
  const walls = [[2, 0, 'wall'], [2, 1, 'wall'], [2, 2, 'wall'], [2, 3, 'wall']];
  const s = makeState(8, 6, walls, [['x1', 'xcom', 0, 1], ['x2', 'xcom', 6, 4], ['x3', 'xcom', 7, 0], ['a01', 'alien', 4, 2]]);
  s.units.x3.hp = 0;
  const check = (tileOf) => {
    const seen = squadSightTiles(s, 'xcom', tileOf);
    const living = [s.units.x1, s.units.x2];
    for (let t = 0; t < s.grid.heights.length; t++) {
      assert.equal(seen.has(t), living.some((m) => seesTile(s, m, t, tileOf(m))), `tile ${t}`);
    }
    return seen;
  };
  check((u) => u.tile);
  const moved = check((u) => (u.id === 'x1' ? at(s, 0, 5) : u.tile));
  assert.ok(moved.size > 0);
});
