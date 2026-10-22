// Created by Claude (claude-opus-5-5)
// Date: 2026-10-21
// TurnManager: side switching, AP refresh, status and cooldown ticks, victory and defeat (Battle phase diagram).
// Only CommandExecutor handlers call these, so they write state as part of a command.

import { RULES } from '../data/rules.js';
import { EVENT } from './events.js';
import { PHASE, livingUnits, hasStatus } from './state.js';

// Statuses that end when their owner's side begins, whatever their turns value (Settled rules).
const CLEAR_AT_OWN_TURN = Object.freeze(['overwatch', 'hunkered']);

/** @created Claude (claude-opus-5-5) - 2026-10-21 */
export function beginDeploy(state, ctx) {
  state.squadConcealed = true;
  state.turn = 1;
  beginSide(state, ctx, 'xcom');
}

/** @created Claude (claude-opus-5-5) - 2026-10-21 */
export function endSide(state, ctx) {
  for (const u of livingUnits(state, state.activeSide)) u.ap = 0;
  const next = state.activeSide === 'xcom' ? 'alien' : 'xcom';
  if (next === 'xcom') state.turn += 1;
  beginSide(state, ctx, next);
}

// TurnStarted comes first so the view shows the banner before the side's statuses drop.
/** @created Claude (claude-opus-5-5) - 2026-10-21 */
export function beginSide(state, ctx, side) {
  state.activeSide = side;
  state.phase = side === 'xcom' ? PHASE.playerTurn : PHASE.enemyTurn;
  ctx.emit(EVENT.TurnStarted, { side, turn: state.turn });

  for (const u of livingUnits(state, side)) {
    // AP reads statuses before they tick, so a 1-turn stun costs exactly one turn.
    u.ap = hasStatus(u, 'stunned') ? 0 : RULES.apPerTurn;

    const kept = [];
    for (const s of u.statuses) {
      const cleared = CLEAR_AT_OWN_TURN.includes(s.id);
      if (!cleared && s.turns !== null) s.turns -= 1;
      if (cleared || (s.turns !== null && s.turns <= 0)) ctx.emit(EVENT.StatusExpired, { unitId: u.id, status: s.id });
      else kept.push(s);
    }
    u.statuses = kept;

    for (const abilityId of Object.keys(u.cooldowns).sort()) {
      u.cooldowns[abilityId] -= 1;
      if (u.cooldowns[abilityId] <= 0) delete u.cooldowns[abilityId];
    }
  }
}

// Both teams wiped in one command counts as a defeat.
/** @created Claude (claude-opus-5-5) - 2026-10-21 */
export function check(state, ctx) {
  if (state.outcome) return state.outcome;
  let outcome = null;
  if (livingUnits(state, 'xcom').length === 0) outcome = 'defeat';
  else if (livingUnits(state, 'alien').length === 0) outcome = 'victory';
  if (outcome) {
    state.outcome = outcome;
    state.phase = PHASE.ended;
    ctx.emit(EVENT.BattleEnded, { outcome });
  }
  return outcome;
}
