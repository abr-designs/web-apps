---
created_by: Claude (claude-opus-5-5)
date: 2026-10-23
---

# Map and movement

## Purpose

These modules define the battlefield and the geometry rules that everything else reads: the tile grid with heights and props, seeded mission generation from hand-made parcels, movement cost and reachable tiles, cover and flanking, and line of sight. They are pure functions over `state.grid`, so the AI can evaluate hypothetical positions freely.

## Where it lives

| File | Role |
| --- | --- |
| `js/sim/grid.js` | `createGrid`, `toIndex`, `toXZ`, `neighbours8`, `isWalkable`, `placeProp`, `damageProp`, `rebuildEdgeCover`, `DIRS` |
| `js/data/props.js` | `PROPS`: cover level, height, hp, `blocksLos`, `hardness`, `rubble`, `burst` |
| `js/data/parcels.js` | `PARCELS` (8x8 ASCII blocks) and `PROP_CODES` |
| `js/sim/map-builder.js` | `buildMission(seed, options)`, `rotateParcel`, `DEFAULT_SQUAD`, `DEFAULT_ENEMY_POOL` |
| `js/sim/pathfinder.js` | `reachable(state, unit)`, `pathTo(reach, dest)`, `stepCost` |
| `js/sim/cover.js` | `coverAt(state, targetTile, fromTile)`, `hasAnyCover` |
| `js/sim/visibility.js` | `tileDistance`, `hasLos`, `canSee`, `seesTile`, `stepOutTiles`, `visibleEnemies`, `squadVisible`, `squadSightTiles` |
| Tests | `tests/grid.test.mjs`, `tests/map-builder.test.mjs`, `tests/pathfinder.test.mjs`, `tests/cover.test.mjs`, `tests/visibility.test.mjs` |

## How it works

**Grid.** `{ width, depth, heights[], props[], edgeCover[] }`, all indexed by `tile = z * width + x` (x east, z south, row 0 north). `props[i]` is `{ kind, hp }` or `null`; `hp: null` marks an indestructible prop. `edgeCover[i]` is `[n, e, s, w]`, each `'none' | 'half' | 'full'`, derived from neighbouring props; call `rebuildEdgeCover` around a tile after changing its prop (`damageProp` does this).

**Props.** A tile with a prop is not walkable. `hardness` ignores any single hit below it (walls ignore grenades); `burst` makes the prop explode when destroyed (barrels).

**Mission generation.** `buildMission` lays out a `plotSize` x `plotSize` grid of parcels (default 3, so 24x24): one `spawn` parcel in a random corner, the rest drawn from the others, each randomly rotated. Parcel `S` markers become squad tiles, `P` markers pod anchors. Pods of 2 or 3 aliens from `enemyPool` are placed at anchors far from the squad (retrying at 15, 14, then 12 tiles), each with a patrol route. The loadout draws no RNG, so a seed builds the same map for any loadout.

**Movement.** Dijkstra over 8 neighbours. Orthogonal steps cost 1, diagonal `RULES.diagonalCost`, climbing adds `RULES.climbCost` per level, drops are free, climbs above `RULES.maxClimb` are impassable, diagonals cannot cut corners. `reachable` returns `Map(tile -> { cost, apCost, prev })`: the blue band (`apCost` 1) is cost up to mobility, the yellow band (`apCost` 2) up to twice mobility. Other units block. Ties break on cost, then tile index.

**Cover.** `coverAt(state, targetTile, fromTile)` returns `{ level, flanked, coverTile }`. An edge's cover counts only when the attacker sits at least 2 tiles past that edge's plane; a target with cover edges but none facing the attacker is flanked.

**Line of sight.** A ray from the viewer's eye (`RULES.eyeHeight`) to the target's body (`RULES.bodyHeight`) over terrain and props with `blocksLos`. Units never block. A unit beside a full-cover edge can also peek from its step-out tiles. `canSee` adds the sight radius (`stats.sight`); `seesTile` is the tile version used for fog and tile targeting.

## How to interact

```js
const reach = reachable(state, unit);       // Map of reachable tiles
const path = pathTo(reach, dest);           // tiles to walk, excluding the start
coverAt(state, target.tile, attacker.tile); // { level: 'half', flanked: false, coverTile: 133 }
canSee(state, viewer, target, { fromTile: 40 });  // hypothetical position
squadVisible(state, 'xcom');                // Set of enemy ids the squad sees
```

All functions take an optional `fromTile` or `targetTile` so callers can test positions without moving units.

## Extend

### Add a parcel

Add an entry to `PARCELS` in `js/data/parcels.js`: an `id`, `tags` (`['spawn']` for a squad start parcel), 8 `heights` strings of `'0'`-`'3'`, and 8 `props` strings using `PROP_CODES` plus `S` and `P`. Keep borders at height 0 so parcels join in any rotation. Spawn parcels need at least 4 `S` tiles and no `P`; every other parcel needs at least one `P`. `tests/map-builder.test.mjs` checks generated maps.

### Add a prop kind

1. Add it to `PROPS` in `js/data/props.js` and a one-letter code to `PROP_CODES` in `js/data/parcels.js`.
2. Add its look (footprint, colour token, shade) to `PROP_LOOK` in `js/view/renderer.js`.
3. Add a `burst` to make it explode, or `rubble` to leave another prop behind.

### Change movement or sight rules

Tune `diagonalCost`, `climbCost`, `maxClimb`, `eyeHeight`, `bodyHeight` in `js/data/rules.js`. Structural changes go in `stepCost` (`pathfinder.js`) or `hasLosTiles` (`visibility.js`); the view, AI and detection all read through these functions, so they pick up changes automatically. There is no LOS cache, which matters only if maps grow well past 24x24.
