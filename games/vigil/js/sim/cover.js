// Created by Claude (claude-opus-5-5)
// Date: 2026-10-21
// Cover level and flank status of a target tile against an attacker tile. Pure; reads grid.edgeCover only.

import { DIRS, toIndex, toXZ } from './grid.js';

const RANK = Object.freeze({ none: 0, half: 1, full: 2 });

// An edge counts when the attacker's tile centre lies beyond the edge plane by more than 0.5 tiles.
// Centre-to-plane distance is (tiles past the edge) - 0.5, so the attacker must sit at least 2 tiles out along that edge's normal.
const MIN_TILES_PAST_EDGE = 2;

/** @created Claude (claude-opus-5-5) - 2026-10-21 */
export function coverAt(state, targetTile, fromTile) {
  const grid = state.grid;
  const [tx, tz] = toXZ(grid, targetTile);
  const [ax, az] = toXZ(grid, fromTile);
  const edges = grid.edgeCover[targetTile];
  let level = 'none';
  let bestDir = -1;
  let bestPast = 0;
  for (let d = 0; d < DIRS.length; d++) {
    const [dx, dz] = DIRS[d];
    const past = (ax - tx) * dx + (az - tz) * dz;
    if (past < MIN_TILES_PAST_EDGE || edges[d] === 'none') continue;
    // Best level wins; on a tie, the edge the attacker faces most squarely.
    const rank = RANK[edges[d]];
    if (rank > RANK[level] || (rank === RANK[level] && past > bestPast)) {
      level = edges[d];
      bestDir = d;
      bestPast = past;
    }
  }
  // coverTile is the prop granting the cover (for stray hits), -1 when none.
  const coverTile = bestDir === -1 ? -1 : toIndex(grid, tx + DIRS[bestDir][0], tz + DIRS[bestDir][1]);
  return { level, flanked: level === 'none' && hasAnyCover(state, targetTile), coverTile };
}

/** @created Claude (claude-opus-5-5) - 2026-10-21 */
export function hasAnyCover(state, tile) {
  return state.grid.edgeCover[tile].some((c) => c !== 'none');
}
