// Created by Claude (claude-opus-5-5)
// Date: 2026-10-21
// Detection: squad concealment, pod reveal and scamper (Pod alert diagram, Settled rules).
// Pod.alert: 'unaware' -> 'revealed' (PodRevealed, ScamperStarted, members walk) -> 'engaged' once the scamper is done.
// Detection radius is the enemy's stats.detection, measured with tileDistance and checked with hasLos (never stats.sight).
// While the squad is concealed only detection radius matters; once broken, ordinary sight (canSee) reveals pods both ways.
// Aliens outside every pod can still break concealment; there is no pod of theirs to reveal. Pods with no living member are skipped.
// The executor reaches onStep and onNoise through setHooks({ detection }); this module wires nothing itself.

import { RULES } from '../data/rules.js';
import { EVENT } from './events.js';
import { livingUnits } from './state.js';
import { canSee, hasLos, tileDistance } from './visibility.js';
import { coverAt } from './cover.js';
import { reachable, pathTo } from './pathfinder.js';
import { walkPath } from './executor.js';

// Cover against one shooter: flanked is worse than open ground.
const COVER_SCORE = Object.freeze({ none: 0, half: 1, full: 2 });
const FLANKED_SCORE = -1;

/** @created Claude (claude-opus-5-5) - 2026-10-21 */
function sortedPods(state) {
  return [...(state.pods ?? [])].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** @created Claude (claude-opus-5-5) - 2026-10-21 */
function livingMembers(state, pod) {
  return [...pod.unitIds].sort()
    .map((id) => state.units[id])
    .filter((u) => u && u.hp > 0);
}

/** @created Claude (claude-opus-5-5) - 2026-10-21 */
function podOf(state, unitId) {
  return (state.pods ?? []).find((p) => p.unitIds.includes(unitId)) ?? null;
}

// True when `alien` would notice `soldier` through its detection radius (concealed rules).
/** @created Claude (claude-opus-5-5) - 2026-10-21 */
function detects(state, alien, soldier) {
  const radius = alien.stats.detection ?? 0;
  if (tileDistance(state.grid, alien.tile, soldier.tile) > radius) return false;
  return hasLos(state, alien, soldier);
}

/** @created Claude (claude-opus-5-5) - 2026-10-21 */
export function breakConcealment(state, ctx, byUnitId, reason) {
  if (state.squadConcealed !== true) return false;
  state.squadConcealed = false;
  ctx.emit(EVENT.ConcealmentBroken, { byUnitId, reason });
  return true;
}

// -> true when the mover died or was moved off its step (its own pod scampered), so walkPath stops the path.
/** @created Claude (claude-opus-5-5) - 2026-10-21 */
export function onStep(state, ctx, mover) {
  if (mover.hp <= 0) return true;
  const tile = mover.tile;
  if (mover.team === 'xcom') soldierStep(state, ctx, mover);
  else alienStep(state, ctx, mover);
  return mover.hp <= 0 || mover.tile !== tile;
}

// Concealed: any enemy whose detection radius holds the soldier with LOS breaks it. Then, unconcealed, every Unaware pod
// with a member the soldier can see is revealed (the soldier finishes its path afterwards).
/** @created Claude (claude-opus-5-5) - 2026-10-21 */
function soldierStep(state, ctx, mover) {
  if (state.squadConcealed === true) {
    const spotter = livingUnits(state).find((u) => u.team !== mover.team && detects(state, u, mover));
    if (!spotter) return;
    breakConcealment(state, ctx, mover.id, 'detected');
  }
  for (const pod of sortedPods(state)) {
    if (mover.hp <= 0) return;
    if (pod.alert !== 'unaware') continue;
    if (livingMembers(state, pod).some((m) => canSee(state, mover, m))) revealPod(state, ctx, pod.id, mover.id);
  }
}

// Concealed: the alien breaks concealment when a soldier stands inside its detection radius with LOS.
// Unconcealed: its Unaware pod is revealed when it sees a soldier or a soldier sees it.
/** @created Claude (claude-opus-5-5) - 2026-10-21 */
function alienStep(state, ctx, mover) {
  const soldiers = livingUnits(state).filter((u) => u.team !== mover.team);
  if (state.squadConcealed === true) {
    if (!soldiers.some((s) => detects(state, mover, s))) return;
    breakConcealment(state, ctx, mover.id, 'spotted');
  }
  const pod = podOf(state, mover.id);
  if (!pod || pod.alert !== 'unaware') return;
  if (soldiers.some((s) => canSee(state, mover, s) || canSee(state, s, mover))) revealPod(state, ctx, pod.id, mover.id);
}

// Shots and explosions: every Unaware pod with a living member within RULES.hearingRadius of the tile is revealed.
// byUnitId is the living unit on the noise tile when it is not one of the pod's own members, else null.
/** @created Claude (claude-opus-5-5) - 2026-10-21 */
export function onNoise(state, ctx, tile) {
  for (const pod of sortedPods(state)) {
    if (pod.alert !== 'unaware') continue;
    const heard = livingMembers(state, pod).some((m) => tileDistance(state.grid, tile, m.tile) <= RULES.hearingRadius);
    if (!heard) continue;
    const source = livingUnits(state).find((u) => u.tile === tile && !pod.unitIds.includes(u.id));
    revealPod(state, ctx, pod.id, source ? source.id : null);
  }
}

// Unaware -> Revealed -> Engaged. Members scamper in id order to their best cover inside the 1 AP band through walkPath,
// so reactions fire on every step and overwatch can kill a member mid-scamper. No AP is spent.
// -> false (and no events) when the pod is unknown, not Unaware, or has no living member.
/** @created Claude (claude-opus-5-5) - 2026-10-21 */
export function revealPod(state, ctx, podId, byUnitId) {
  const pod = (state.pods ?? []).find((p) => p.id === podId);
  if (!pod || pod.alert !== 'unaware' || livingMembers(state, pod).length === 0) return false;
  // 'revealed' before any step, so detection on scamper steps never reveals this pod again.
  pod.alert = 'revealed';
  ctx.emit(EVENT.PodRevealed, { podId, byUnitId });
  ctx.emit(EVENT.ScamperStarted, { podId });
  for (const member of livingMembers(state, pod)) {
    if (member.hp <= 0) continue;
    const reach = reachable(state, member);
    const dest = scamperTile(state, member, reach);
    if (dest !== member.tile) walkPath(state, ctx, member, pathTo(reach, dest));
  }
  pod.alert = 'engaged';
  return true;
}

// Best cover tile within the 1 AP band, staying put included. Order: best worst-case cover against every living enemy,
// then best total cover, then shortest path, then lowest tile index.
/** @created Claude (claude-opus-5-5) - 2026-10-21 */
export function scamperTile(state, unit, reach = reachable(state, unit)) {
  const threats = livingUnits(state).filter((u) => u.team !== unit.team);
  const candidates = [[unit.tile, 0]];
  for (const [tile, step] of reach) if (step.apCost === 1) candidates.push([tile, step.cost]);

  let best = null;
  for (const [tile, cost] of candidates) {
    let worst = Infinity;
    let total = 0;
    for (const t of threats) {
      const cover = coverAt(state, tile, t.tile);
      const score = cover.flanked ? FLANKED_SCORE : COVER_SCORE[cover.level];
      worst = Math.min(worst, score);
      total += score;
    }
    if (threats.length === 0) worst = 0;
    const entry = { tile, cost, worst, total };
    if (!best || better(entry, best)) best = entry;
  }
  return best.tile;
}

/** @created Claude (claude-opus-5-5) - 2026-10-21 */
function better(a, b) {
  if (a.worst !== b.worst) return a.worst > b.worst;
  if (a.total !== b.total) return a.total > b.total;
  if (a.cost !== b.cost) return a.cost < b.cost;
  return a.tile < b.tile;
}
