// Created by Claude (claude-opus-5-5)
// Date: 2026-10-21

import test from 'node:test';
import assert from 'node:assert/strict';
import { createGrid, toIndex, toXZ, neighbours8, isWalkable, placeProp, rebuildAllEdgeCover, damageProp } from '../js/sim/grid.js';

test('toIndex and toXZ round trip, out of bounds is -1', () => {
  const g = createGrid(5, 4);
  for (let i = 0; i < 20; i++) {
    const [x, z] = toXZ(g, i);
    assert.equal(toIndex(g, x, z), i);
  }
  assert.equal(toIndex(g, -1, 0), -1);
  assert.equal(toIndex(g, 5, 0), -1);
  assert.equal(toIndex(g, 0, 4), -1);
});

test('neighbours8 stays in bounds and flags diagonals', () => {
  const g = createGrid(3, 3);
  assert.equal(neighbours8(g, toIndex(g, 1, 1)).length, 8);
  const corner = neighbours8(g, toIndex(g, 0, 0));
  assert.equal(corner.length, 3);
  assert.deepEqual(corner.filter((n) => n.diagonal).map((n) => n.i), [toIndex(g, 1, 1)]);
});

test('edge cover takes the cover of the prop across each edge', () => {
  const g = createGrid(3, 3);
  const centre = toIndex(g, 1, 1);
  placeProp(g, toIndex(g, 1, 0), 'wall');    // north of centre
  placeProp(g, toIndex(g, 2, 1), 'crate');   // east of centre
  rebuildAllEdgeCover(g);
  assert.deepEqual(g.edgeCover[centre], ['full', 'half', 'none', 'none']);
  // The wall's west neighbour sees it across its east edge.
  assert.deepEqual(g.edgeCover[toIndex(g, 0, 0)], ['none', 'full', 'none', 'none']);
  assert.equal(isWalkable(g, toIndex(g, 1, 0)), false);
  assert.equal(isWalkable(g, centre), true);
});

test('damageProp ignores hits below hardness, destroys a wall to open ground and rebuilds only the four neighbours', () => {
  const g = createGrid(5, 5);
  const wall = toIndex(g, 2, 2);
  placeProp(g, wall, 'wall');
  rebuildAllEdgeCover(g);
  const far = toIndex(g, 0, 0);
  const diagonal = toIndex(g, 1, 1);
  g.edgeCover[far] = 'untouched';
  g.edgeCover[diagonal] = 'untouched';
  g.edgeCover[wall] = 'untouched';

  assert.deepEqual(damageProp(g, wall, 7), { damaged: false, destroyed: false, rubbleKind: null });
  assert.equal(g.props[wall].hp, 8);
  assert.deepEqual(damageProp(g, wall, 8), { damaged: true, destroyed: true, rubbleKind: null });

  assert.equal(g.props[wall], null);
  assert.equal(g.edgeCover[toIndex(g, 2, 1)][2], 'none'); // north neighbour, south edge
  assert.equal(g.edgeCover[toIndex(g, 3, 2)][3], 'none'); // east neighbour, west edge
  assert.equal(g.edgeCover[toIndex(g, 2, 3)][0], 'none'); // south neighbour, north edge
  assert.equal(g.edgeCover[toIndex(g, 1, 2)][1], 'none'); // west neighbour, east edge
  assert.equal(g.edgeCover[far], 'untouched');
  assert.equal(g.edgeCover[diagonal], 'untouched');
  assert.equal(g.edgeCover[wall], 'untouched');
});

test('destroying a prop without rubble leaves open ground', () => {
  const g = createGrid(3, 3);
  const crate = toIndex(g, 1, 1);
  placeProp(g, crate, 'crate');
  rebuildAllEdgeCover(g);
  assert.deepEqual(damageProp(g, crate, 1), { damaged: true, destroyed: false, rubbleKind: null });
  assert.deepEqual(damageProp(g, crate, 99), { damaged: true, destroyed: true, rubbleKind: null });
  assert.equal(g.props[crate], null);
  assert.equal(g.edgeCover[toIndex(g, 1, 0)][2], 'none');
});

test('rocks are indestructible and stay JSON-safe', () => {
  const g = createGrid(3, 3);
  const rock = toIndex(g, 1, 1);
  placeProp(g, rock, 'rock');
  assert.deepEqual(damageProp(g, rock, 1000), { damaged: false, destroyed: false, rubbleKind: null });
  const loaded = JSON.parse(JSON.stringify(g));
  assert.deepEqual(damageProp(loaded, rock, 1000), { damaged: false, destroyed: false, rubbleKind: null });
  assert.equal(loaded.props[rock].kind, 'rock');
});

test('damageProp on open ground is a no-op', () => {
  const g = createGrid(2, 2);
  assert.deepEqual(damageProp(g, 0, 5), { damaged: false, destroyed: false, rubbleKind: null });
});
