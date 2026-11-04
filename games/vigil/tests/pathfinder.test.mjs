// Created by Claude (claude-sonnet-5-5)
// Date: 2026-10-21

import test from 'node:test';
import assert from 'node:assert/strict';
import { createGrid, toIndex, placeProp, rebuildAllEdgeCover } from '../js/sim/grid.js';
import { createUnit } from '../js/sim/state.js';
import { CLASSES } from '../js/data/classes.js';
import { reachable, pathTo, stepCost } from '../js/sim/pathfinder.js';

// Open grid with one ranger at (x, z); mobility and ap are set per test.
function setup(width, depth, x, z, mobility, ap = 2) {
  const grid = createGrid(width, depth);
  const unit = createUnit('x1', 'xcom', 'ranger', CLASSES.ranger, toIndex(grid, x, z));
  unit.stats.mobility = mobility;
  unit.ap = ap;
  return { state: { grid, units: { x1: unit } }, unit, grid };
}

function addUnit(state, id, team, x, z) {
  const u = createUnit(id, team, 'ranger', CLASSES.ranger, toIndex(state.grid, x, z));
  state.units[id] = u;
  return u;
}

test('blue band is cost <= mobility, yellow band is cost <= 2 * mobility', () => {
  const { state, unit, grid } = setup(11, 3, 0, 1, 3);
  const reach = reachable(state, unit);
  const at = (x) => reach.get(toIndex(grid, x, 1));
  assert.equal(at(3).apCost, 1);
  assert.equal(at(3).cost, 3);
  assert.equal(at(4).apCost, 2);
  assert.equal(at(6).apCost, 2);
  assert.equal(at(7), undefined);
});

test('yellow band needs 2 AP, and the unit own tile is not in the map', () => {
  const { state, unit, grid } = setup(11, 3, 0, 1, 3, 1);
  const reach = reachable(state, unit);
  assert.equal(reach.has(unit.tile), false);
  assert.equal(reach.get(toIndex(grid, 3, 1)).apCost, 1);
  assert.equal(reach.has(toIndex(grid, 4, 1)), false);
});

test('diagonal steps cost 1.5', () => {
  const { state, unit, grid } = setup(5, 5, 0, 0, 6);
  const reach = reachable(state, unit);
  assert.equal(reach.get(toIndex(grid, 1, 1)).cost, 1.5);
  assert.equal(reach.get(toIndex(grid, 2, 2)).cost, 3);
  assert.equal(reach.get(toIndex(grid, 2, 1)).cost, 2.5);
  assert.equal(stepCost(state, toIndex(grid, 0, 0), toIndex(grid, 1, 1)), 1.5);
  assert.equal(stepCost(state, toIndex(grid, 0, 0), toIndex(grid, 1, 0)), 1);
});

test('no corner cutting past a prop on either orthogonal tile', () => {
  const { state, unit, grid } = setup(3, 3, 0, 0, 6);
  placeProp(grid, toIndex(grid, 1, 0), 'crate');
  rebuildAllEdgeCover(grid);
  const from = toIndex(grid, 0, 0);
  const diag = toIndex(grid, 1, 1);
  assert.equal(stepCost(state, from, diag), Infinity);
  // The only route is south then east: 1 + 1, not the 1.5 diagonal.
  assert.equal(reachable(state, unit).get(diag).cost, 2);

  // A prop on the other orthogonal tile blocks it too.
  const other = setup(3, 3, 0, 0, 6);
  placeProp(other.grid, toIndex(other.grid, 0, 1), 'crate');
  assert.equal(stepCost(other.state, from, diag), Infinity);
  assert.equal(reachable(other.state, other.unit).get(diag).cost, 2);
});

test('props block tiles, and a walled-off tile is unreachable', () => {
  const { state, unit, grid } = setup(3, 3, 0, 0, 6);
  for (const z of [0, 1, 2]) placeProp(grid, toIndex(grid, 1, z), 'wall');
  const reach = reachable(state, unit);
  assert.equal(reach.has(toIndex(grid, 1, 1)), false);
  assert.equal(reach.has(toIndex(grid, 2, 1)), false);
  assert.deepEqual(pathTo(reach, toIndex(grid, 2, 1)), []);
  assert.equal(stepCost(state, toIndex(grid, 0, 0), toIndex(grid, 1, 0)), Infinity);
});

test('climbing one level costs +1, two-level steps are impassable, drops are free', () => {
  const { state, unit, grid } = setup(4, 1, 0, 0, 6);
  grid.heights[toIndex(grid, 1, 0)] = 1;
  grid.heights[toIndex(grid, 2, 0)] = 1;
  grid.heights[toIndex(grid, 3, 0)] = 3;
  const up = toIndex(grid, 0, 0);
  assert.equal(stepCost(state, up, toIndex(grid, 1, 0)), 2);
  assert.equal(stepCost(state, toIndex(grid, 1, 0), toIndex(grid, 2, 0)), 1);
  assert.equal(stepCost(state, toIndex(grid, 2, 0), toIndex(grid, 3, 0)), Infinity);

  const reach = reachable(state, unit);
  assert.equal(reach.get(toIndex(grid, 2, 0)).cost, 3);
  assert.equal(reach.has(toIndex(grid, 3, 0)), false);

  // Drops are free: move the unit off the low tile first, since units block tiles.
  unit.tile = toIndex(grid, 3, 0);
  assert.equal(stepCost(state, toIndex(grid, 1, 0), up), 1);
});

test('a two-level cliff is impassable going down as well', () => {
  const { state, grid } = setup(2, 1, 0, 0, 6);
  grid.heights[0] = 2;
  assert.equal(stepCost(state, 0, 1), Infinity);
  assert.equal(stepCost(state, 1, 0), Infinity);
});

test('other living units block their tiles, dead ones do not', () => {
  const { state, unit, grid } = setup(5, 1, 0, 0, 6);
  addUnit(state, 'a01', 'alien', 2, 0);
  const reach = reachable(state, unit);
  assert.equal(reach.has(toIndex(grid, 1, 0)), true);
  assert.equal(reach.has(toIndex(grid, 2, 0)), false);
  assert.equal(reach.has(toIndex(grid, 3, 0)), false); // corridor is cut
  assert.equal(stepCost(state, toIndex(grid, 1, 0), toIndex(grid, 2, 0)), Infinity);

  state.units.a01.hp = 0;
  assert.equal(reachable(state, unit).has(toIndex(grid, 4, 0)), true);
});

test('a unit routes around a blocker', () => {
  const { state, unit, grid } = setup(3, 3, 0, 1, 6);
  addUnit(state, 'x2', 'xcom', 1, 1);
  const reach = reachable(state, unit);
  const dest = toIndex(grid, 2, 1);
  assert.equal(reach.get(dest).cost, 3); // diagonal, diagonal around the blocker
  assert.equal(pathTo(reach, dest).length, 2);
});

test('pathTo walks from the first step to dest and excludes the start', () => {
  const { state, unit, grid } = setup(5, 1, 0, 0, 6);
  const reach = reachable(state, unit);
  const dest = toIndex(grid, 4, 0);
  assert.deepEqual(pathTo(reach, dest), [1, 2, 3, 4].map((x) => toIndex(grid, x, 0)));
  assert.deepEqual(pathTo(reach, unit.tile), []);
  assert.deepEqual(pathTo(reach, -1), []);
});

test('pathTo returns [] for tiles past the reach limit', () => {
  const { state, unit, grid } = setup(9, 1, 0, 0, 2);
  const reach = reachable(state, unit);
  assert.deepEqual(pathTo(reach, toIndex(grid, 4, 0)).length, 4);
  assert.deepEqual(pathTo(reach, toIndex(grid, 5, 0)), []);
});

test('path costs add up along the reported prev chain', () => {
  const { state, unit, grid } = setup(6, 6, 0, 0, 5);
  placeProp(grid, toIndex(grid, 2, 1), 'crate');
  grid.heights[toIndex(grid, 3, 2)] = 1;
  rebuildAllEdgeCover(grid);
  const reach = reachable(state, unit);
  for (const [tile, info] of reach) {
    const path = pathTo(reach, tile);
    let from = unit.tile;
    let sum = 0;
    for (const t of path) {
      sum += stepCost(state, from, t);
      from = t;
    }
    assert.equal(sum, info.cost);
    assert.equal(info.apCost, info.cost <= 5 ? 1 : 2);
  }
});

test('equal-cost ties resolve identically on every run', () => {
  const run = () => {
    const { state, unit, grid } = setup(7, 7, 3, 3, 4);
    placeProp(grid, toIndex(grid, 4, 3), 'crate');
    const reach = reachable(state, unit);
    return [...reach].map(([tile, info]) => [tile, info.cost, info.apCost, info.prev]);
  };
  assert.deepEqual(run(), run());

  // (2, 1) is 2.5 via (1, 0) or via (1, 1); the first parent settled (lowest index) wins.
  const { state, unit, grid } = setup(3, 3, 0, 0, 6);
  const reach = reachable(state, unit);
  const prev = reach.get(toIndex(grid, 2, 1)).prev;
  assert.equal(prev, toIndex(grid, 1, 0));
  assert.equal(reachable(state, unit).get(toIndex(grid, 2, 1)).prev, prev);
});
