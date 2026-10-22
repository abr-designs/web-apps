// Created by Claude (claude-opus-5-5)
// Date: 2026-10-21
// EnemyAI: picks the next alien command, one at a time, so every choice sees the latest state (Enemy turn diagram).
// Pure: nothing here writes BattleState or draws from the Rng. Ties break on fixed keys (score, then path cost, then tile
// index or unit id), so the same state always gives the same command without spending an rngState draw.
// Termination: every command returned passes executor validate and spends at least 1 AP (moves cost 1 or 2, every alien
// ability costs 1), so a driver looping nextCommand until null ends within the side's total AP.
// Unaware pods patrol: each member makes one 1 AP move per turn (only while it still holds RULES.apPerTurn), the first
// living member toward the turn's waypoint, the rest toward that leader. The remaining AP is left unspent.
// Engaged units (and aliens outside any pod) score tiles and attacks with their ENEMIES ai profile (Strategy).
// Aliens know where every living soldier is once their pod is engaged (v1 has no alien-side fog of war).
// Aggression ramp: an engaged alien whose idleTurns reaches RESTLESS_TURNS (its third engaged turn in a row without a hostile
// ability) stops overwatching, takes any attack with a hit chance above 0, and otherwise closes on the nearest soldier.

import { RULES } from '../data/rules.js';
import { ABILITIES } from '../data/abilities.js';
import { ENEMIES } from '../data/enemies.js';
import { PHASE, livingUnits, hasStatus } from './state.js';
import { neighbours8 } from './grid.js';
import { reachable, stepCost } from './pathfinder.js';
import { canSee } from './visibility.js';
import { coverAt } from './cover.js';
import { compute, unitDef, abilityWeapon, weaponEffect } from './hit.js';
import { validTargets, meleeTiles } from './abilities.js';
import { validate } from './executor.js';

// Starting weights per profile (Open Questions: tune in the step 17 playtest).
// scoreTile = cover*w1 + bestShotChance*w2 + flankThreat*w3 - exposure*w4. minHit is the lowest hit chance (percent) a
// weapon attack needs before the unit takes it over overwatch or repositioning.
export const AI_PROFILES = Object.freeze({
  rifleman: Object.freeze({ w1: 1.0, w2: 1.2, w3: 0.6, w4: 0.7, minHit: 35 }),
  melee:    Object.freeze({ w1: 0.4, w2: 2.0, w3: 0.3, w4: 0.3, minHit: 40 }),
  caster:   Object.freeze({ w1: 1.2, w2: 0.8, w3: 0.3, w4: 1.0, minHit: 30 }),
});

export const RESTLESS_TURNS = 3;
// A move must beat staying put by this much when the unit could already attack from where it stands.
const MOVE_MARGIN = 0.15;
// Share of closeness a ranged unit scores on tiles with no shot, so engaged units advance instead of stalling out of sight.
const APPROACH_SHARE = 0.25;
// Attack values are expected damage plus these bonuses (hit points).
const KILL_BONUS = 2;
const STATUS_BONUS = 1;
const DEBUFF_VALUE = 1.5;
// A restless unit stops closing in once within this path cost of a soldier (a diagonal neighbour).
const ADJACENT_COST = 1.5;
// Patrol followers stop once within this path cost of the leader.
const FOLLOW_DISTANCE = 2;
const EPS = 1e-9;

// Cover against one shooter, as in Detection's scamper: flanked is worse than open ground.
const COVER_RANK = Object.freeze({ none: 0, half: 1, full: 2 });
const FLANKED_RANK = -1;

/** @created Claude (claude-opus-5-5) - 2026-10-21 */
function podOf(state, unitId) {
  return (state.pods ?? []).find((p) => p.unitIds.includes(unitId)) ?? null;
}

/** @created Claude (claude-opus-5-5) - 2026-10-21 */
function livingMembers(state, pod) {
  return [...pod.unitIds].sort()
    .map((id) => state.units[id])
    .filter((u) => u && u.hp > 0);
}

/** @created Claude (claude-opus-5-5) - 2026-10-21 */
function enemiesOf(state, unit) {
  return livingUnits(state).filter((u) => u.team !== unit.team);
}

// -> the unit's ENEMIES ai profile name; soldiers and unknown defs fall back to rifleman.
/** @created Claude (claude-opus-5-5) - 2026-10-21 */
export function profileOf(unit) {
  const name = ENEMIES[unit.defId]?.ai;
  return Object.hasOwn(AI_PROFILES, name ?? '') ? name : 'rifleman';
}

/** @created Claude (claude-opus-5-5) - 2026-10-21 */
function weightsOf(profile) {
  return typeof profile === 'string' ? AI_PROFILES[profile] : profile;
}

/** @created Claude (claude-opus-5-5) - 2026-10-21 */
function heapLess(a, b) {
  return a[0] < b[0] || (a[0] === b[0] && a[1] < b[1]);
}

/** @created Claude (claude-opus-5-5) - 2026-10-21 */
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

/** @created Claude (claude-opus-5-5) - 2026-10-21 */
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

// Path cost from every tile to the nearest source tile over terrain only (units ignored, since they move).
// -> Float64Array, Infinity where no source is reachable. Reverse Dijkstra: relaxing a from b costs the step a -> b.
/** @created Claude (claude-opus-5-5) - 2026-10-21 */
export function distanceField(state, sources) {
  const terrain = { grid: state.grid, units: {} };
  const dist = new Float64Array(state.grid.heights.length).fill(Infinity);
  const heap = [];
  for (const s of sources) {
    dist[s] = 0;
    heapPush(heap, [0, s]);
  }
  while (heap.length > 0) {
    const [cost, b] = heapPop(heap);
    if (cost > dist[b]) continue;
    for (const n of neighbours8(state.grid, b)) {
      const next = cost + stepCost(terrain, n.i, b);
      if (next < dist[n.i]) {
        dist[n.i] = next;
        heapPush(heap, [next, n.i]);
      }
    }
  }
  return dist;
}

// Tiles the unit can move to this command: [tile, pathCost] within maxApCost and the unit's AP.
/** @created Claude (claude-opus-5-5) - 2026-10-21 */
function moveTiles(state, unit, maxApCost) {
  const out = [];
  for (const [tile, step] of reachable(state, unit)) {
    if (step.apCost <= maxApCost && step.apCost <= unit.ap) out.push([tile, step.cost]);
  }
  return out;
}

// -> 1 adjacent to a soldier, falling toward 0 with path cost (one mobility of cost halves it).
/** @created Claude (claude-opus-5-5) - 2026-10-21 */
function closeness(unit, field, tile) {
  const d = field[tile];
  return Number.isFinite(d) ? 1 / (1 + d / unit.stats.mobility) : 0;
}

// cache holds per-decision data (enemies, distance field) so chooseAction scores many tiles cheaply. It is a local
// scratch object, never part of BattleState.
/** @created Claude (claude-opus-5-5) - 2026-10-21 */
function scoreCache(state, unit, cache) {
  cache.enemies ??= enemiesOf(state, unit);
  cache.field ??= distanceField(state, cache.enemies.map((e) => e.tile));
  return cache;
}

// Terms, each roughly 0..1 per soldier:
//   cover          worst-case cover against every living enemy: flanked 0, none 1/3, half 2/3, full 1
//   bestShotChance best standardShot hit chance from the tile; melee profiles use closeness instead, and ranged tiles
//                  with no shot score APPROACH_SHARE of closeness
//   flankThreat    best over targets seen from the tile: 1 flanked, 0.5 no cover, 0 in cover
//   exposure       sum of every enemy's standardShot hit chance against the unit standing on the tile
/** @created Claude (claude-opus-5-5) - 2026-10-21 */
export function scoreTile(state, unit, tile, profile = profileOf(unit), cache = {}) {
  const w = weightsOf(profile);
  const { enemies, field } = scoreCache(state, unit, cache);
  if (enemies.length === 0) return 0;

  let worst = Infinity;
  for (const e of enemies) {
    const c = coverAt(state, tile, e.tile);
    worst = Math.min(worst, c.flanked ? FLANKED_RANK : COVER_RANK[c.level]);
  }
  const cover = (worst - FLANKED_RANK) / (COVER_RANK.full - FLANKED_RANK);

  let shot = 0;
  let flank = 0;
  for (const e of enemies) {
    const b = compute(state, unit, e, 'standardShot', { fromTile: tile });
    if (!b) continue;
    shot = Math.max(shot, b.hit / 100);
    flank = Math.max(flank, b.flanked ? 1 : b.cover === 'none' ? 0.5 : 0);
  }
  const near = closeness(unit, field, tile);
  if (profile === 'melee' || w === AI_PROFILES.melee) shot = near;
  else if (shot === 0) shot = APPROACH_SHARE * near;

  // The unit as if it stood on the tile; a shallow copy, so state is untouched.
  const ghost = { ...unit, tile };
  let exposure = 0;
  for (const e of enemies) {
    if (!canSee(state, e, ghost)) continue;
    const b = compute(state, e, ghost, 'standardShot');
    if (b) exposure += b.hit / 100;
  }
  return cover * w.w1 + shot * w.w2 + flank * w.w3 - exposure * w.w4;
}

// Best move within maxApCost that beats `here` by `margin`. -> move command or null.
/** @created Claude (claude-opus-5-5) - 2026-10-21 */
function bestMove(state, unit, profile, cache, here, margin, maxApCost = 1) {
  let best = null;
  for (const [tile, cost] of moveTiles(state, unit, maxApCost)) {
    const score = scoreTile(state, unit, tile, profile, cache);
    if (!best || score > best.score + EPS || (Math.abs(score - best.score) <= EPS && (cost < best.cost || (cost === best.cost && tile < best.tile)))) {
      best = { tile, cost, score };
    }
  }
  if (!best || best.score <= here + margin + EPS) return null;
  return { type: 'move', unitId: unit.id, dest: best.tile };
}

/** @created Claude (claude-opus-5-5) - 2026-10-21 */
function hasEffect(effects, type) {
  return (effects ?? []).some((e) => e.type === type || (e.type === 'moveThenAct' && hasEffect(e.effects, type)));
}

// Expected value of one attack in hit points, and whether the profile accepts it. -> { value, acceptable } or null.
/** @created Claude (claude-opus-5-5) - 2026-10-21 */
function attackValue(state, unit, abilityId, target, fromTile, w, restless = false) {
  const def = ABILITIES[abilityId];
  if (weaponEffect(def)) {
    const b = compute(state, unit, target, abilityId, { fromTile });
    if (!b) return null;
    const weapon = abilityWeapon(unit, abilityId);
    const p = b.hit / 100;
    const avg = ((weapon.damage[0] + weapon.damage[1]) / 2) * (weaponEffect(def).damageMult ?? 1);
    let value = p * (avg + (b.crit / 100) * weapon.critDamage);
    if (avg >= target.hp) value += p * KILL_BONUS;
    if (hasEffect(def.effects, 'applyStatus')) value += p * STATUS_BONUS;
    return { value, acceptable: b.hit >= w.minHit || (restless && b.hit > 0) };
  }
  const debuff = def.effects.find((e) => e.type === 'modifyStat' || e.type === 'applyStatus');
  if (!debuff || hasStatus(target, debuff.status)) return null;
  return { value: DEBUFF_VALUE, acceptable: true };
}

// Acceptable attacks on enemies, best first (value, then target id). melee: true lists only melee abilities, false only
// the rest. Melee commands carry the best-scoring attack tile. restless accepts any hit chance above 0.
/**
 * @created Claude (claude-opus-5-5) - 2026-10-21
 * @modified Claude (claude-opus-5-5) - 2026-10-22 - restless
 */
function attackOptions(state, unit, profile, cache, melee, restless = false) {
  const w = weightsOf(profile);
  const options = [];
  for (const abilityId of unitDef(unit).abilities) {
    const def = ABILITIES[abilityId];
    if (def.passive || def.apCost < 1 || (def.targeting === 'melee') !== melee) continue;
    if (def.targeting !== 'enemyLos' && def.targeting !== 'enemySquadsight' && def.targeting !== 'melee') continue;
    for (const targetId of validTargets(state, unit, abilityId)) {
      const target = state.units[targetId];
      const cmd = { type: 'ability', unitId: unit.id, abilityId, targetId };
      let fromTile = unit.tile;
      if (melee) {
        fromTile = bestTileOf(state, unit, meleeTiles(state, unit, targetId), profile, cache);
        if (fromTile === null) continue;
        cmd.targetTile = fromTile;
      }
      const v = attackValue(state, unit, abilityId, target, fromTile, w, restless);
      if (v && v.acceptable) options.push({ cmd, value: v.value });
    }
  }
  options.sort((a, b) => b.value - a.value || (a.cmd.targetId < b.cmd.targetId ? -1 : a.cmd.targetId > b.cmd.targetId ? 1 : 0));
  return options.map((o) => o.cmd);
}

// Highest-scoring tile of a list already in preference order (first wins ties). -> tile or null for an empty list.
/** @created Claude (claude-opus-5-5) - 2026-10-21 */
function bestTileOf(state, unit, tiles, profile, cache) {
  let best = null;
  for (const tile of tiles) {
    const score = scoreTile(state, unit, tile, profile, cache);
    if (!best || score > best.score + EPS) best = { tile, score };
  }
  return best ? best.tile : null;
}

// Candidates in preference order; the first that passes executor validate wins:
//   melee profile: melee attack, then (2+ AP) close in
//   other profiles: (2+ AP) reposition when the best tile beats staying put
//   then ranged attacks, reload when empty, overwatch, a 1 AP reposition, reload when not full.
//   Restless (idleTurns >= RESTLESS_TURNS): no overwatch; after the 1 AP reposition, a 1 AP step toward the nearest soldier.
// -> command or null when the unit cannot usefully act.
/**
 * @created Claude (claude-opus-5-5) - 2026-10-21
 * @modified Claude (claude-opus-5-5) - 2026-10-22 - aggression ramp
 */
export function chooseAction(state, unit, profile = profileOf(unit)) {
  if (!unit || unit.hp <= 0 || unit.ap <= 0) return null;
  const cache = {};
  const self = (abilityId) => ({ type: 'ability', unitId: unit.id, abilityId });
  const restless = (unit.idleTurns ?? 0) >= RESTLESS_TURNS;
  const meleeAttacks = profile === 'melee' ? attackOptions(state, unit, profile, cache, true, restless) : [];
  const attacks = attackOptions(state, unit, profile, cache, false, restless);
  const here = scoreTile(state, unit, unit.tile, profile, cache);
  const margin = meleeAttacks.length + attacks.length > 0 ? MOVE_MARGIN : 0;

  const candidates = [...meleeAttacks];
  let move;
  const moveCmd = () => (move === undefined ? (move = bestMove(state, unit, profile, cache, here, margin)) : move);
  if (unit.ap >= 2) candidates.push(moveCmd);
  candidates.push(...attacks);
  if (unit.ammo === 0) candidates.push(self('reload'));
  if (restless) candidates.push(moveCmd, () => stepToward(state, unit, scoreCache(state, unit, cache).field, ADJACENT_COST));
  else candidates.push(self('overwatch'), moveCmd);
  candidates.push(self('reload'));

  for (const entry of candidates) {
    const cmd = typeof entry === 'function' ? entry() : entry;
    if (cmd && validate(state, cmd).ok) return cmd;
  }
  return null;
}

// The waypoint an Unaware pod heads for this turn: patrolRoute[(patrolIndex + turn) % length], skipping one the leader
// already stands on. patrolIndex is read as the route's starting offset; the AI never writes it (single writer).
// -> tile or null when the pod has no route or no living member.
/** @created Claude (claude-opus-5-5) - 2026-10-21 */
export function patrolTarget(state, pod) {
  const route = pod.patrolRoute ?? [];
  const leader = livingMembers(state, pod)[0];
  if (route.length === 0 || !leader) return null;
  const k = ((pod.patrolIndex ?? 0) + (state.turn ?? 0)) % route.length;
  const tile = route[k];
  return tile === leader.tile && route.length > 1 ? route[(k + 1) % route.length] : tile;
}

// 1 AP move that gets the unit strictly closer to the goal by path cost. -> move command or null.
/** @created Claude (claude-opus-5-5) - 2026-10-21 */
function stepToward(state, unit, field, stopWithin = 0) {
  if (field[unit.tile] <= stopWithin + EPS) return null;
  let best = null;
  for (const [tile, cost] of moveTiles(state, unit, 1)) {
    const d = field[tile];
    if (!best || d < best.d - EPS || (Math.abs(d - best.d) <= EPS && (cost < best.cost || (cost === best.cost && tile < best.tile)))) {
      best = { tile, cost, d };
    }
  }
  if (!best || !Number.isFinite(best.d) || best.d >= field[unit.tile] - EPS) return null;
  return { type: 'move', unitId: unit.id, dest: best.tile };
}

// The next patrol move of an Unaware pod: the first member in id order that still holds RULES.apPerTurn AP and has a
// useful step. The leader walks toward patrolTarget; followers close to within FOLLOW_DISTANCE of the leader.
// -> move command or null when the pod is not Unaware or has no member left to move.
/** @created Claude (claude-opus-5-5) - 2026-10-21 */
export function patrolStep(state, pod) {
  if (!pod || pod.alert !== 'unaware') return null;
  const members = livingMembers(state, pod);
  const target = patrolTarget(state, pod);
  if (target === null) return null;
  const [leader] = members;
  let leaderField = null;
  for (const unit of members) {
    if (unit.ap < RULES.apPerTurn) continue;
    let cmd;
    if (unit === leader) {
      cmd = stepToward(state, unit, distanceField(state, [target]));
    } else {
      leaderField ??= distanceField(state, [leader.tile]);
      cmd = stepToward(state, unit, leaderField, FOLLOW_DISTANCE);
    }
    if (cmd && validate(state, cmd).ok) return cmd;
  }
  return null;
}

// Aliens in id order: an Unaware pod gets its patrol step (once, at its first member), everyone else chooseAction.
// -> the first valid command, or null when it is not the alien turn or no alien can usefully act.
/** @created Claude (claude-opus-5-5) - 2026-10-21 */
export function nextCommand(state) {
  if (state.outcome || state.phase !== PHASE.enemyTurn || state.activeSide !== 'alien') return null;
  const patrolled = new Set();
  for (const unit of livingUnits(state, 'alien')) {
    if (unit.ap <= 0) continue;
    const pod = podOf(state, unit.id);
    let cmd;
    if (pod && pod.alert === 'unaware') {
      if (patrolled.has(pod.id)) continue;
      patrolled.add(pod.id);
      cmd = patrolStep(state, pod);
    } else {
      cmd = chooseAction(state, unit, profileOf(unit));
    }
    if (cmd) return cmd;
  }
  return null;
}
