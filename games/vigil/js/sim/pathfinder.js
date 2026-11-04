// Created by Claude (claude-sonnet-5-5)
// Date: 2026-10-21
// Movement costs and reachable tiles. Dijkstra over 8 neighbours with deterministic ties (lowest cost, then lowest tile index).
// Costs: orthogonal 1, diagonal RULES.diagonalCost, climbing adds RULES.climbCost per level, drops are free.
// Blue band is cost <= mobility (1 AP); yellow band is cost <= 2 * mobility (2 AP, needs unit.ap >= 2).

import { RULES } from '../data/rules.js';
import { toXZ, neighbours8, isWalkable } from './grid.js';

// Terrain-only cost of one step between adjacent tiles, ignoring units. n is a neighbours8 entry from `from`.
function terrainStep(grid, from, n) {
  const to = n.i;
  if (!isWalkable(grid, to)) return Infinity;
  const rise = grid.heights[to] - grid.heights[from];
  if (Math.abs(rise) > RULES.maxClimb) return Infinity;
  if (n.diagonal) {
    // No corner cutting: both orthogonal tiles passed must be open.
    // `to` is in bounds, so both side tiles are too.
    if (!isWalkable(grid, from + n.dx) || !isWalkable(grid, from + n.dz * grid.width)) return Infinity;
  }
  return (n.diagonal ? RULES.diagonalCost : 1) + (rise > 0 ? rise * RULES.climbCost : 0);
}

// Min-heap of [cost, tile] ordered by cost, then tile index, so pops are fully deterministic.
function heapLess(a, b) {
  return a[0] < b[0] || (a[0] === b[0] && a[1] < b[1]);
}

function heapPush(heap, item) {
  heap.push(item);
  let k = heap.length - 1;
  while (k > 0) {
    const parent = (k - 1) >> 1;
    if (!heapLess(heap[k], heap[parent])) break;
    [heap[k], heap[parent]] = [heap[parent], heap[k]];
    k = parent;
  }
}

function heapPop(heap) {
  const top = heap[0];
  const last = heap.pop();
  if (heap.length > 0) {
    heap[0] = last;
    let k = 0;
    for (;;) {
      const l = 2 * k + 1;
      const r = l + 1;
      let m = k;
      if (l < heap.length && heapLess(heap[l], heap[m])) m = l;
      if (r < heap.length && heapLess(heap[r], heap[m])) m = r;
      if (m === k) break;
      [heap[k], heap[m]] = [heap[m], heap[k]];
      k = m;
    }
  }
  return top;
}

/** @created Claude (claude-sonnet-5-5) - 2026-10-21 */
export function stepCost(state, from, to) {
  const { grid } = state;
  const size = grid.heights.length;
  if (from < 0 || to < 0 || from >= size || to >= size || from === to) return Infinity;
  const [fx, fz] = toXZ(grid, from);
  const [tx, tz] = toXZ(grid, to);
  if (Math.abs(tx - fx) > 1 || Math.abs(tz - fz) > 1) return Infinity;
  for (const u of Object.values(state.units)) if (u.hp > 0 && u.tile === to) return Infinity;
  return terrainStep(grid, from, { i: to, dx: tx - fx, dz: tz - fz, diagonal: tx !== fx && tz !== fz });
}

/** @created Claude (claude-sonnet-5-5) - 2026-10-21 */
export function reachable(state, unit) {
  const { grid } = state;
  const mobility = unit.stats.mobility;
  const limit = unit.ap >= 2 ? 2 * mobility : mobility;

  // Other living units block their tiles (friend or foe).
  const occupied = new Set();
  for (const u of Object.values(state.units)) if (u.hp > 0 && u.id !== unit.id) occupied.add(u.tile);

  const start = unit.tile;
  const dist = new Map([[start, 0]]);
  const prev = new Map();
  const settled = new Set();
  const heap = [[0, start]];

  while (heap.length > 0) {
    const [cost, tile] = heapPop(heap);
    if (settled.has(tile)) continue;
    settled.add(tile);
    for (const n of neighbours8(grid, tile)) {
      if (settled.has(n.i) || occupied.has(n.i)) continue;
      const step = terrainStep(grid, tile, n);
      if (step === Infinity) continue;
      const next = cost + step;
      if (next > limit) continue;
      // Strictly lower only: the first settled parent wins equal-cost ties.
      if (next < (dist.get(n.i) ?? Infinity)) {
        dist.set(n.i, next);
        prev.set(n.i, tile);
        heapPush(heap, [next, n.i]);
      }
    }
  }

  const out = new Map();
  for (const [tile, cost] of dist) {
    if (tile === start) continue;
    out.set(tile, { cost, apCost: cost <= mobility ? 1 : 2, prev: prev.get(tile) });
  }
  return out;
}

/** @created Claude (claude-sonnet-5-5) - 2026-10-21 */
export function pathTo(reachMap, dest) {
  const path = [];
  let tile = dest;
  // The start tile is not in the map, so the walk ends there.
  while (reachMap.has(tile)) {
    path.push(tile);
    tile = reachMap.get(tile).prev;
  }
  return path.reverse();
}
