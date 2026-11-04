// Created by Claude (claude-opus-5-5)
// Date: 2026-10-21

import test from 'node:test';
import assert from 'node:assert/strict';
import { createGrid, toIndex, placeProp, rebuildAllEdgeCover, damageProp } from '../js/sim/grid.js';
import { coverAt, hasAnyCover } from '../js/sim/cover.js';

/** @created Claude (claude-opus-5-5) - 2026-10-21 */
function makeState(width, depth, props = []) {
  const grid = createGrid(width, depth);
  for (const [x, z, kind] of props) placeProp(grid, toIndex(grid, x, z), kind);
  rebuildAllEdgeCover(grid);
  return { grid, units: {} };
}

const at = (state, x, z) => toIndex(state.grid, x, z);

test('half vs full cover by angle', () => {
  // Target at (4,4): wall to the north, crate to the east.
  const s = makeState(9, 9, [[4, 3, 'wall'], [5, 4, 'crate']]);
  const target = at(s, 4, 4);
  assert.deepEqual(coverAt(s, target, at(s, 4, 0)), { level: 'full', flanked: false, coverTile: at(s, 4, 3) });
  assert.deepEqual(coverAt(s, target, at(s, 8, 0)), { level: 'full', flanked: false, coverTile: at(s, 4, 3) });
  assert.deepEqual(coverAt(s, target, at(s, 8, 4)), { level: 'half', flanked: false, coverTile: at(s, 5, 4) });
  // One row north sits inside the 0.5 tile margin, so only the crate counts.
  assert.deepEqual(coverAt(s, target, at(s, 8, 3)), { level: 'half', flanked: false, coverTile: at(s, 5, 4) });
});

test('flanked from the side', () => {
  const s = makeState(9, 9, [[4, 3, 'wall']]);
  const target = at(s, 4, 4);
  assert.deepEqual(coverAt(s, target, at(s, 8, 4)), { level: 'none', flanked: true, coverTile: -1 });
  assert.deepEqual(coverAt(s, target, at(s, 0, 8)), { level: 'none', flanked: true, coverTile: -1 });
  // Level with the wall's row is still a flank.
  assert.equal(coverAt(s, target, at(s, 8, 3)).flanked, true);
  // Two rows north clears the margin.
  assert.deepEqual(coverAt(s, target, at(s, 8, 2)), { level: 'full', flanked: false, coverTile: at(s, 4, 3) });
});

test('no flank on open ground', () => {
  const s = makeState(9, 9);
  const target = at(s, 4, 4);
  assert.equal(hasAnyCover(s, target), false);
  for (let i = 0; i < 81; i++) assert.deepEqual(coverAt(s, target, i), { level: 'none', flanked: false, coverTile: -1 });
});

test('each edge direction covers against attackers beyond it', () => {
  const cases = [
    { prop: [4, 3], from: [4, 0] }, // north
    { prop: [5, 4], from: [8, 4] }, // east
    { prop: [4, 5], from: [4, 8] }, // south
    { prop: [3, 4], from: [0, 4] }, // west
  ];
  for (const { prop, from } of cases) {
    const s = makeState(9, 9, [[prop[0], prop[1], 'rock']]);
    const target = at(s, 4, 4);
    assert.deepEqual(coverAt(s, target, at(s, from[0], from[1])), { level: 'full', flanked: false, coverTile: at(s, prop[0], prop[1]) });
    // The opposite side flanks.
    assert.equal(coverAt(s, target, at(s, 8 - from[0], 8 - from[1])).flanked, true);
  }
});

test('adjacent attackers never count an edge', () => {
  const s = makeState(9, 9, [[4, 3, 'wall'], [5, 4, 'crate']]);
  const target = at(s, 4, 4);
  for (const [x, z] of [[3, 3], [5, 3], [3, 4], [3, 5], [4, 5], [5, 5]]) {
    assert.deepEqual(coverAt(s, target, at(s, x, z)), { level: 'none', flanked: true, coverTile: -1 }, `${x},${z}`);
  }
});

test('hasAnyCover follows destroyed cover', () => {
  const s = makeState(5, 5, [[2, 1, 'crate']]);
  const tile = at(s, 2, 2);
  assert.equal(hasAnyCover(s, tile), true);
  damageProp(s.grid, at(s, 2, 1), 99);
  assert.equal(hasAnyCover(s, tile), false);
  assert.deepEqual(coverAt(s, tile, at(s, 2, 0)), { level: 'none', flanked: false, coverTile: -1 });
});
