// Created by Claude (claude-opus-5-5)
// Date: 2026-10-21
// ReactionSystem: per-step interrupts during any move (overwatch now, future reactions later).
// Overwatch fires once, on the first step that puts the mover inside the overwatcher's sight with LOS and inside weapon
// range, then clears (Settled rules). Ranged weapons reach as far as the shooter sees; melee weapons reach adjacent tiles.
// A soldier firing from concealment breaks it for the squad before the shot.
// The executor reaches onStep through setHooks({ reactions }); this module wires nothing itself.

import { EVENT } from './events.js';
import { livingUnits, hasStatus } from './state.js';
import { canSee, tileDistance } from './visibility.js';
import { abilityWeapon } from './hit.js';
import { standardShot } from './abilities.js';
import { breakConcealment } from './detection.js';

// Diagonal neighbours sit at sqrt(2); a melee weapon reaches no further.
const MELEE_REACH = 1.5;

/** @created Claude (claude-opus-5-5) - 2026-10-21 */
function inWeaponRange(state, shooter, target) {
  const weapon = abilityWeapon(shooter, 'standardShot');
  if (weapon.rangeTable !== null) return true;
  return tileDistance(state.grid, shooter.tile, target.tile) <= MELEE_REACH;
}

/** @created Claude (claude-opus-5-5) - 2026-10-21 */
function clearOverwatch(unit) {
  unit.statuses = unit.statuses.filter((s) => s.id !== 'overwatch');
}

// Opposing overwatchers in unit id order. -> true when the mover died or was moved off its step (a reveal the shot's noise
// caused made the mover's own pod scamper), so walkPath stops the path.
/** @created Claude (claude-opus-5-5) - 2026-10-21 */
export function onStep(state, ctx, mover) {
  if (mover.hp <= 0) return true;
  const tile = mover.tile;
  const watchers = livingUnits(state).filter((u) => u.team !== mover.team && hasStatus(u, 'overwatch'));
  for (const watcher of watchers) {
    if (mover.hp <= 0 || mover.tile !== tile) break;
    if (watcher.hp <= 0 || !hasStatus(watcher, 'overwatch')) continue;
    if (watcher.ammo !== null && watcher.ammo < 1) continue;
    if (!canSee(state, watcher, mover) || !inWeaponRange(state, watcher, mover)) continue;

    clearOverwatch(watcher);
    ctx.emit(EVENT.OverwatchTriggered, { unitId: watcher.id, targetId: mover.id });
    if (watcher.team === 'xcom') breakConcealment(state, ctx, watcher.id, 'overwatch');
    standardShot(state, ctx, watcher, mover, { overwatch: true });
  }
  return mover.hp <= 0 || mover.tile !== tile;
}
