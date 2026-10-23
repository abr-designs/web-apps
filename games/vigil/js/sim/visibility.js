// Created by Claude (claude-opus-5-5)
// Date: 2026-10-21
// Line of sight over the heightmap, sight radius and squad vision.
// A ray runs from the viewer's eye (tile centre, terrain + RULES.eyeHeight) to the target's body (tile centre, terrain + RULES.bodyHeight).
// Units never block sight; only terrain and props with blocksLos do. No LOS cache yet: callers are cheap enough on a 24x24 map.

import { RULES } from '../data/rules.js';
import { PROPS } from '../data/props.js';
import { DIRS, toIndex, toXZ, isWalkable } from './grid.js';
import { livingUnits, unitAt } from './state.js';

/** @created Claude (claude-opus-5-5) - 2026-10-21 */
export function tileDistance(grid, a, b) {
  const [ax, az] = toXZ(grid, a);
  const [bx, bz] = toXZ(grid, b);
  return Math.hypot(ax - bx, az - bz);
}

// Terrain plus the height of a prop that blocks sight.
/** @created Claude (claude-opus-5-5) - 2026-10-21 */
function occluderHeight(grid, i) {
  const prop = grid.props[i];
  const def = prop ? PROPS[prop.kind] : null;
  return grid.heights[i] + (def && def.blocksLos ? def.height : 0);
}

// Boundary n on an axis spanning `span` tiles sits at ray parameter t = (2n + 1) / (2 * span).
/** @created Claude (claude-opus-5-5) - 2026-10-21 */
function boundaryT(n, span) {
  return n < span ? (2 * n + 1) / (2 * span) : Infinity;
}

/** @created Claude (claude-opus-5-5) - 2026-10-21 */
export function hasLosTiles(state, from, to) {
  if (from === to) return true;
  const grid = state.grid;
  const [x0, z0] = toXZ(grid, from);
  const [x1, z1] = toXZ(grid, to);
  const adx = Math.abs(x1 - x0);
  const adz = Math.abs(z1 - z0);
  const sx = Math.sign(x1 - x0);
  const sz = Math.sign(z1 - z0);
  const eye = grid.heights[from] + RULES.eyeHeight;
  const body = grid.heights[to] + RULES.bodyHeight;
  const rayAt = (t) => eye + (body - eye) * t;

  // Amanatides-Woo over the XZ grid. nx, nz count boundaries crossed; crossings compare as integers so corner ties are exact.
  let x = x0;
  let z = z0;
  let nx = 0;
  let nz = 0;
  while (nx < adx || nz < adz) {
    const cmp = nx >= adx ? 1 : nz >= adz ? -1 : (2 * nx + 1) * adz - (2 * nz + 1) * adx;
    let tEnter;
    if (cmp === 0) {
      // The ray passes exactly through a corner: sealed only when both side tiles reach the ray.
      tEnter = boundaryT(nx, adx);
      const h = rayAt(tEnter);
      if (occluderHeight(grid, toIndex(grid, x + sx, z)) >= h && occluderHeight(grid, toIndex(grid, x, z + sz)) >= h) return false;
      x += sx; z += sz; nx++; nz++;
    } else if (cmp < 0) {
      tEnter = boundaryT(nx, adx);
      x += sx; nx++;
    } else {
      tEnter = boundaryT(nz, adz);
      z += sz; nz++;
    }
    if (nx === adx && nz === adz) return true;

    // The ray is straight, so its lowest point inside this tile is at the entry or exit boundary.
    const tExit = Math.min(boundaryT(nx, adx), boundaryT(nz, adz));
    if (occluderHeight(grid, toIndex(grid, x, z)) >= Math.min(rayAt(tEnter), rayAt(tExit))) return false;
  }
  return true;
}

// Tiles a unit on `tile` may peek from: only when the tile has a full-cover edge, then each orthogonal neighbour
// that is walkable, free of other units, and within RULES.maxClimb of the tile's height.
/** @created Claude (claude-opus-5-5) - 2026-10-21 */
export function stepOutTiles(state, tile, selfId) {
  const grid = state.grid;
  if (!grid.edgeCover[tile].includes('full')) return [];
  const [x, z] = toXZ(grid, tile);
  const out = [];
  for (const [dx, dz] of DIRS) {
    const n = toIndex(grid, x + dx, z + dz);
    if (n === -1 || !isWalkable(grid, n)) continue;
    if (Math.abs(grid.heights[n] - grid.heights[tile]) > RULES.maxClimb) continue;
    const occupant = unitAt(state, n);
    if (occupant && occupant.id !== selfId) continue;
    out.push(n);
  }
  return out;
}

// fromTile and targetTile let callers test hypothetical positions (move previews, AI, detection danger tiles).
/** @created Claude (claude-opus-5-5) - 2026-10-21 */
export function hasLos(state, viewer, target, { fromTile = viewer.tile, targetTile = target.tile } = {}) {
  const origins = [fromTile, ...stepOutTiles(state, fromTile, viewer.id)];
  const dests = [targetTile, ...stepOutTiles(state, targetTile, target.id)];
  for (const o of origins) {
    for (const d of dests) {
      if (hasLosTiles(state, o, d)) return true;
    }
  }
  return false;
}

// Sight radius is measured between the units' own tiles, not their step-out tiles.
/** @created Claude (claude-opus-5-5) - 2026-10-21 */
export function canSee(state, viewer, target, { fromTile = viewer.tile, targetTile = target.tile } = {}) {
  if (tileDistance(state.grid, fromTile, targetTile) > viewer.stats.sight) return false;
  return hasLos(state, viewer, target, { fromTile, targetTile });
}

/** @created Claude (claude-opus-5-5) - 2026-10-21 */
export function visibleEnemies(state, unit, { fromTile = unit.tile } = {}) {
  return livingUnits(state).filter((u) => u.team !== unit.team && canSee(state, unit, u, { fromTile }));
}

/** @created Claude (claude-opus-5-5) - 2026-10-21 */
export function squadVisible(state, team) {
  const members = livingUnits(state, team);
  const seen = new Set();
  for (const enemy of livingUnits(state)) {
    if (enemy.team === team) continue;
    if (members.some((m) => canSee(state, m, enemy))) seen.add(enemy.id);
  }
  return seen;
}

// Sight radius from fromTile, LOS from it or one of its step-out tiles; the target tile's own prop never blocks.
/**
 * @created Claude (claude-opus-5-5) - 2026-10-22
 * @modified Claude (claude-opus-5-5) - 2026-10-22 - moved from abilities.js, fromTile added
 */
export function seesTile(state, unit, tile, fromTile = unit.tile) {
  if (tileDistance(state.grid, fromTile, tile) > unit.stats.sight) return false;
  return [fromTile, ...stepOutTiles(state, fromTile, unit.id)].some((o) => hasLosTiles(state, o, tile));
}

// -> Set of tiles any living team member sees by seesTile. tileOf and alive give drawn positions and HP during playback.
// Fog dimming only; whether a unit is seen stays canSee. Same rule as seesTile, with each member's origins built once.
/** @created Claude (claude-opus-5-5) - 2026-10-22 */
export function squadSightTiles(state, team, tileOf = (u) => u.tile, alive = (u) => u.hp > 0) {
  const seen = new Set();
  const viewers = Object.values(state.units)
    .filter((u) => u.team === team && alive(u))
    .map((m) => {
      const from = tileOf(m);
      return { from, sight: m.stats.sight, origins: [from, ...stepOutTiles(state, from, m.id)] };
    });
  for (let t = 0; t < state.grid.heights.length; t++) {
    const visible = viewers.some(({ from, sight, origins }) =>
      tileDistance(state.grid, from, t) <= sight && origins.some((o) => hasLosTiles(state, o, t)));
    if (visible) seen.add(t);
  }
  return seen;
}
