// Created by Claude (claude-opus-5-5)
// Date: 2026-10-21
// Map data and derived per-edge cover. x runs east, z runs south; tile index = z * width + x.
// props[i] is { kind, hp } or null; hp null marks an indestructible prop (PROPS hp Infinity), which keeps saves JSON-safe.
// edgeCover[i] is [n, e, s, w], each 'none' | 'half' | 'full', taken from the prop across that edge.

import { PROPS } from '../data/props.js';

// Orthogonal directions in edgeCover order: n, e, s, w.
export const DIRS = Object.freeze([[0, -1], [1, 0], [0, 1], [-1, 0]]);

/** @created Claude (claude-opus-5-5) - 2026-10-21 */
export function createGrid(width, depth) {
  const size = width * depth;
  return {
    width,
    depth,
    heights: new Array(size).fill(0),
    props: new Array(size).fill(null),
    edgeCover: Array.from({ length: size }, () => ['none', 'none', 'none', 'none']),
  };
}

/** @created Claude (claude-opus-5-5) - 2026-10-21 */
export function toIndex(grid, x, z) {
  if (x < 0 || z < 0 || x >= grid.width || z >= grid.depth) return -1;
  return z * grid.width + x;
}

/** @created Claude (claude-opus-5-5) - 2026-10-21 */
export function toXZ(grid, i) {
  return [i % grid.width, Math.floor(i / grid.width)];
}

/** @created Claude (claude-opus-5-5) - 2026-10-21 */
export function neighbours8(grid, i) {
  const [x, z] = toXZ(grid, i);
  const out = [];
  for (let dz = -1; dz <= 1; dz++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dz === 0) continue;
      const n = toIndex(grid, x + dx, z + dz);
      if (n !== -1) out.push({ i: n, dx, dz, diagonal: dx !== 0 && dz !== 0 });
    }
  }
  return out;
}

/** @created Claude (claude-opus-5-5) - 2026-10-21 */
export function isWalkable(grid, i) {
  return grid.props[i] === null;
}

/** @created Claude (claude-opus-5-5) - 2026-10-21 */
export function placeProp(grid, i, kind) {
  const hp = PROPS[kind].hp;
  grid.props[i] = { kind, hp: Number.isFinite(hp) ? hp : null };
}

/** @created Claude (claude-opus-5-5) - 2026-10-21 */
export function rebuildEdgeCover(grid, i) {
  const [x, z] = toXZ(grid, i);
  grid.edgeCover[i] = DIRS.map(([dx, dz]) => {
    const n = toIndex(grid, x + dx, z + dz);
    const prop = n === -1 ? null : grid.props[n];
    return prop ? PROPS[prop.kind].cover : 'none';
  });
}

/** @created Claude (claude-opus-5-5) - 2026-10-21 */
export function rebuildAllEdgeCover(grid) {
  for (let i = 0; i < grid.heights.length; i++) rebuildEdgeCover(grid, i);
}

/** @created Claude (claude-opus-5-5) - 2026-10-21 */
export function damageProp(grid, i, amount) {
  const prop = grid.props[i];
  if (!prop || prop.hp === null) return { destroyed: false, rubbleKind: null };
  prop.hp -= amount;
  if (prop.hp > 0) return { destroyed: false, rubbleKind: null };

  const rubbleKind = PROPS[prop.kind].rubble;
  if (rubbleKind) placeProp(grid, i, rubbleKind);
  else grid.props[i] = null;

  // Dirty flag: only the four tiles whose edges face this prop change.
  const [x, z] = toXZ(grid, i);
  for (const [dx, dz] of DIRS) {
    const n = toIndex(grid, x + dx, z + dz);
    if (n !== -1) rebuildEdgeCover(grid, n);
  }
  return { destroyed: true, rubbleKind };
}
