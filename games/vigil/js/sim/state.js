// Created by Claude (claude-opus-5-5)
// Date: 2026-10-21
// The serializable battle root. units is keyed by id; ids sort in turn order (x1..x4 squad, a1.. aliens).

import { ABILITIES } from '../data/abilities.js';
import { WEAPONS } from '../data/weapons.js';

export const STATE_VERSION = 1;

/** @created Claude (claude-opus-5-5) - 2026-10-21 */
export function createUnit(id, team, defId, def, tile) {
  const charges = {};
  for (const abilityId of [...def.abilities, ...(def.utility ?? [])]) {
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
