// Created by Claude (claude-opus-5-5)
// Date: 2026-10-21
// The serializable battle root. units is keyed by id; ids sort in turn order (x1..x4 squad, a01.. aliens).
// phase is one of PHASE; activeSide is 'xcom' | 'alien'; outcome is null | 'victory' | 'defeat' | 'forfeit' (set with phase 'ended').
// Unit.statuses: [{ id, turns }] in application order. turns counts the owner's side starts left: TurnManager.beginSide
//   subtracts 1 and expires the status at 0. turns null means no timer (cleared by a rule or an effect).
//   'overwatch' and 'hunkered' always clear at the start of the owner's side. A 'stunned' unit starts its side with 0 AP.
//   modifyStat statuses may also carry { stat, amount }; read them with statValue, never bake them into unit.stats.
// Unit.cooldowns: { abilityId: turns } with the same countdown; the ability is ready when its key is absent.
// Unit.idleTurns: alien sides begun while engaged since the unit's last hostile ability (TurnManager adds, AbilitySystem
//   resets); EnemyAI turns aggressive once it reaches RESTLESS_TURNS. Unaware aliens hold 0.
// Unit.utility: the soldier's utility ability ids from the loadout (plan 0002); empty for aliens.

import { ABILITIES } from '../data/abilities.js';
import { WEAPONS } from '../data/weapons.js';

export const STATE_VERSION = 3;

// deploy -> playerTurn <-> enemyTurn -> ended (Battle phase diagram; Victory and Defeat are ended plus outcome).
export const PHASE = Object.freeze({ deploy: 'deploy', playerTurn: 'playerTurn', enemyTurn: 'enemyTurn', ended: 'ended' });

/**
 * @created Claude (claude-opus-5-5) - 2026-10-21
 * @modified Claude (claude-opus-5-5) - 2026-10-22 - utility parameter stored on the unit
 */
export function createUnit(id, team, defId, def, tile, utility = def.utility ?? []) {
  const charges = {};
  for (const abilityId of [...def.abilities, ...utility]) {
    const max = ABILITIES[abilityId].charges;
    if (max) charges[abilityId] = (charges[abilityId] ?? 0) + max;
  }
  return {
    id,
    team,
    defId,
    stats: { ...def.stats },
    tile,
    ap: 0,
    hp: def.stats.hp,
    armor: def.stats.armor,
    shred: 0,
    ammo: WEAPONS[def.weapon].ammo,
    statuses: [],
    cooldowns: {},
    charges,
    utility: [...utility],
    idleTurns: 0,
  };
}

/** @created Claude (claude-opus-5-5) - 2026-10-21 */
export function livingUnits(state, team) {
  return Object.keys(state.units).sort()
    .map((id) => state.units[id])
    .filter((u) => u.hp > 0 && (team === undefined || u.team === team));
}

/** @created Claude (claude-opus-5-5) - 2026-10-21 */
export function unitAt(state, tile) {
  for (const u of Object.values(state.units)) if (u.hp > 0 && u.tile === tile) return u;
  return null;
}

/** @created Claude (claude-opus-5-5) - 2026-10-21 */
export function hasStatus(unit, id) {
  return unit.statuses.some((s) => s.id === id);
}

// Base stat plus every status modifier for it (modifyStat statuses carry stat and amount).
/** @created Claude (claude-opus-5-5) - 2026-10-21 */
export function statValue(unit, stat) {
  let value = unit.stats[stat] ?? 0;
  for (const s of unit.statuses) if (s.stat === stat) value += s.amount;
  return value;
}
