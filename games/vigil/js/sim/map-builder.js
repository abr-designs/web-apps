// Created by Claude (claude-opus-5-5)
// Date: 2026-10-21
// Assembles a plot of 8x8 parcels into one grid and places the squad and the alien pods. Pure and seeded.

import { RULES } from '../data/rules.js';
import { CLASSES } from '../data/classes.js';
import { ENEMIES } from '../data/enemies.js';
import { PARCELS, PROP_CODES } from '../data/parcels.js';
import { seedState, nextInt, pick } from './rng.js';
import { createGrid, toIndex, toXZ, isWalkable, placeProp, rebuildAllEdgeCover, DIRS } from './grid.js';
import { STATE_VERSION, createUnit, unitAt } from './state.js';

const PARCEL_SIZE = 8;
const POD_MIN_DISTANCE = 10; // tiles between every pod member or patrol tile and every squad start
const POD_SPACING = 6;       // tiles between pod anchors
const PATROL_MIN_STEPS = 3;
const PATROL_MAX_STEPS = 8;

export const DEFAULT_SQUAD = Object.freeze(['ranger', 'sharpshooter', 'grenadier', 'specialist']);
export const DEFAULT_ENEMY_POOL = Object.freeze(['trooper', 'trooper', 'trooper', 'officer', 'stunLancer', 'sectoid']);

/** @created Claude (claude-opus-5-5) - 2026-10-21 */
export function buildMission(seed, { plotSize = 3, pods = 3, squad = DEFAULT_SQUAD, enemyPool = DEFAULT_ENEMY_POOL } = {}) {
  const size = plotSize * PARCEL_SIZE;
  const grid = createGrid(size, size);
  const state = {
    version: STATE_VERSION, seed: seed >>> 0, rngState: seedState(seed), turn: 0, activeSide: 'xcom', phase: 'deploy',
    grid, units: {}, pods: [], squadConcealed: true, outcome: null,
  };

  // Parcels: one spawn parcel in a random corner, the rest drawn from the others, each with a random rotation.
  const spawnParcels = PARCELS.filter((p) => p.tags.includes('spawn'));
  const fillParcels = PARCELS.filter((p) => !p.tags.includes('spawn'));
  const last = plotSize - 1;
  const [cornerX, cornerZ] = pick(state, [[0, 0], [last, 0], [0, last], [last, last]]);
  const markers = { S: [], P: [] };
  for (let pz = 0; pz < plotSize; pz++) {
    for (let px = 0; px < plotSize; px++) {
      const isSpawn = px === cornerX && pz === cornerZ;
      const parcel = rotateParcel(pick(state, isSpawn ? spawnParcels : fillParcels), nextInt(state, 0, 3));
      stampParcel(grid, parcel, px * PARCEL_SIZE, pz * PARCEL_SIZE, markers);
    }
  }
  rebuildAllEdgeCover(grid);

  if (markers.S.length < squad.length) throw new Error(`spawn parcel has ${markers.S.length} S tiles for ${squad.length} soldiers`);
  const squadTiles = markers.S.slice(0, squad.length);
  squad.forEach((classId, k) => {
    const id = `x${k + 1}`;
    state.units[id] = createUnit(id, 'xcom', classId, CLASSES[classId], squadTiles[k]);
  });

  const farFromSquad = (tile) => squadTiles.every((s) => distance(grid, s, tile) >= POD_MIN_DISTANCE);
  const anchors = [];
  for (const a of shuffle(state, markers.P.filter(farFromSquad))) {
    if (anchors.length === pods) break;
    if (anchors.every((b) => distance(grid, a, b) >= POD_SPACING)) anchors.push(a);
  }
  if (anchors.length < pods) throw new Error(`seed ${seed}: only ${anchors.length} of ${pods} pod anchors fit`);

  let alienCount = 0;
  anchors.forEach((anchor, k) => {
    const reach = reachableFrom(grid, anchor, PATROL_MAX_STEPS);
    // BFS order puts the anchor first, then its nearest tiles.
    const spots = [...reach.keys()].filter((t) => reach.get(t) <= 2 && farFromSquad(t) && !unitAt(state, t));
    const memberTiles = spots.slice(0, nextInt(state, 2, 3));
    if (memberTiles.length < 2) throw new Error(`seed ${seed}: no room for pod at tile ${anchor}`);
    const unitIds = memberTiles.map((tile) => {
      const id = `a${String(++alienCount).padStart(2, '0')}`;
      const defId = pick(state, enemyPool);
      state.units[id] = createUnit(id, 'alien', defId, ENEMIES[defId], tile);
      return id;
    });

    const routePool = [...reach.keys()].filter((t) => reach.get(t) >= PATROL_MIN_STEPS && farFromSquad(t));
    const patrolRoute = shuffle(state, routePool).slice(0, nextInt(state, 3, 4));
    if (patrolRoute.length < 3) throw new Error(`seed ${seed}: no patrol route for pod at tile ${anchor}`);
    state.pods.push({ id: `p${k + 1}`, unitIds, alert: 'unaware', patrolRoute, patrolIndex: 0 });
  });

  return state;
}

/** @created Claude (claude-opus-5-5) - 2026-10-21 */
export function rotateParcel(parcel, quarterTurns) {
  let { heights, props } = parcel;
  for (let t = 0; t < ((quarterTurns % 4) + 4) % 4; t++) {
    heights = rotateRows(heights);
    props = rotateRows(props);
  }
  return { ...parcel, heights, props };
}

// 90 degrees clockwise: new[r][c] = old[n - 1 - c][r].
/** @created Claude (claude-opus-5-5) - 2026-10-21 */
function rotateRows(rows) {
  const n = rows.length;
  return Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => rows[n - 1 - c][r]).join(''));
}

/** @created Claude (claude-opus-5-5) - 2026-10-21 */
function stampParcel(grid, parcel, ox, oz, markers) {
  for (let r = 0; r < PARCEL_SIZE; r++) {
    for (let c = 0; c < PARCEL_SIZE; c++) {
      const i = toIndex(grid, ox + c, oz + r);
      grid.heights[i] = Number(parcel.heights[r][c]);
      const code = parcel.props[r][c];
      if (PROP_CODES[code]) placeProp(grid, i, PROP_CODES[code]);
      else if (markers[code]) markers[code].push(i);
    }
  }
}

// Orthogonal flood over walkable tiles within one climb level; -> Map(tile -> steps) in BFS order.
/** @created Claude (claude-opus-5-5) - 2026-10-21 */
function reachableFrom(grid, start, maxSteps) {
  const steps = new Map([[start, 0]]);
  const queue = [start];
  for (let q = 0; q < queue.length; q++) {
    const i = queue[q];
    if (steps.get(i) === maxSteps) continue;
    const [x, z] = toXZ(grid, i);
    for (const [dx, dz] of DIRS) {
      const n = toIndex(grid, x + dx, z + dz);
      if (n === -1 || steps.has(n) || !isWalkable(grid, n)) continue;
      if (Math.abs(grid.heights[n] - grid.heights[i]) > RULES.maxClimb) continue;
      steps.set(n, steps.get(i) + 1);
      queue.push(n);
    }
  }
  return steps;
}

/** @created Claude (claude-opus-5-5) - 2026-10-21 */
function distance(grid, a, b) {
  const [ax, az] = toXZ(grid, a);
  const [bx, bz] = toXZ(grid, b);
  return Math.hypot(ax - bx, az - bz);
}

// Fisher-Yates on a copy.
/** @created Claude (claude-opus-5-5) - 2026-10-21 */
function shuffle(state, list) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = nextInt(state, 0, i);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
