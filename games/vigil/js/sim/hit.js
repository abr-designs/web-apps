// Created by Claude (claude-sonnet-5-5)
// Date: 2026-10-21
// Hit, graze and crit chances with labelled modifiers. One calculator feeds the HUD preview and the roll (CombatResolver).
// Percent values throughout: hit is 0..100 after clamping; modifiers carry { label, value, stat } with stat 'hit' or 'crit'.
// Unit stats are read with status modifiers (aided, marked, disoriented) applied; unit.stats itself is never changed.

import { RULES } from '../data/rules.js';
import { ABILITIES } from '../data/abilities.js';
import { WEAPONS } from '../data/weapons.js';
import { CLASSES } from '../data/classes.js';
import { ENEMIES } from '../data/enemies.js';
import { coverAt } from './cover.js';
import { canSee, squadVisible, tileDistance } from './visibility.js';

/** @created Claude (claude-sonnet-5-5) - 2026-10-21 */
export function unitDef(unit) {
  return CLASSES[unit.defId] ?? ENEMIES[unit.defId];
}

// Accepts an ability id or an ability def.
/** @created Claude (claude-sonnet-5-5) - 2026-10-21 */
export function abilityDef(ability) {
  return typeof ability === 'string' ? ABILITIES[ability] : ability;
}

/** @created Claude (claude-sonnet-5-5) - 2026-10-21 */
export function abilityId(ability) {
  if (typeof ability === 'string') return ability;
  return Object.keys(ABILITIES).find((id) => ABILITIES[id] === ability) ?? null;
}

// First weaponDamage effect of an ability, looking inside moveThenAct. Null for abilities that do not shoot.
/** @created Claude (claude-sonnet-5-5) - 2026-10-21 */
export function weaponEffect(ability) {
  const find = (effects) => {
    for (const e of effects ?? []) {
      if (e.type === 'weaponDamage') return e;
      if (e.type === 'moveThenAct') {
        const inner = find(e.effects);
        if (inner) return inner;
      }
    }
    return null;
  };
  return find(abilityDef(ability).effects);
}

// The weapon an ability fires: the effect's own weapon (melee, pistol) or the unit's primary.
/** @created Claude (claude-sonnet-5-5) - 2026-10-21 */
export function abilityWeapon(unit, ability) {
  const named = weaponEffect(ability)?.weapon;
  return WEAPONS[named ?? unitDef(unit).weapon];
}

// Base stat plus every status modifier for it.
/** @created Claude (claude-sonnet-5-5) - 2026-10-21 */
function stat(unit, name) {
  let value = unit.stats[name] ?? 0;
  for (const s of unit.statuses) if (s.stat === name) value += s.amount;
  return value;
}

/** @created Claude (claude-sonnet-5-5) - 2026-10-21 */
function isHunkered(unit) {
  return unit.statuses.some((s) => s.id === 'hunkered');
}

/** @created Claude (claude-sonnet-5-5) - 2026-10-21 */
function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

// Roll thresholds on 0..100: r < lo is a hit, r < hi a graze, else a miss.
// The band is centred on the hit chance; 0 never grazes and 100 never misses or grazes.
/** @created Claude (claude-sonnet-5-5) - 2026-10-21 */
export function grazeWindow(hit) {
  if (hit <= 0) return [0, 0];
  if (hit >= 100) return [100, 100];
  const half = RULES.grazeBand / 2;
  return [Math.max(0, hit - half), Math.min(100, hit + half)];
}

/** @created Claude (claude-sonnet-5-5) - 2026-10-21 */
function hasSquadsight(unit, def) {
  if (def.targeting !== 'enemyLos' && def.targeting !== 'enemySquadsight') return false;
  return def.targeting === 'enemySquadsight' || unitDef(unit).abilities.includes('squadsight');
}

// -> null when the target cannot be targeted, else the breakdown:
// { hit, graze, crit, dodge, flanked, cover, coverTile, guaranteed, overwatch, modifiers }
// graze is the percent width of the graze band; cover is 'none' | 'half' | 'full'; coverTile is the prop tile giving it or -1.
/** @created Claude (claude-sonnet-5-5) - 2026-10-21 */
export function compute(state, attacker, target, ability, { overwatch = false, fromTile = attacker.tile } = {}) {
  const def = abilityDef(ability);
  const grid = state.grid;
  const weapon = abilityWeapon(attacker, ability);
  const melee = def.targeting === 'melee' || weapon.rangeTable === null;
  const distance = tileDistance(grid, fromTile, target.tile);

  // Own sight first; squadsight (passive or enemySquadsight targeting) falls back to squad vision. Overwatch never uses it.
  let squadsight = 0;
  if (!canSee(state, attacker, target, { fromTile })) {
    if (overwatch || !hasSquadsight(attacker, def) || !squadVisible(state, attacker.team).has(target.id)) return null;
    const beyond = Math.max(0, Math.round(distance - attacker.stats.sight));
    squadsight = beyond > 0 ? beyond * RULES.squadsightAimPerTile : 0;
  }

  const modifiers = [];
  const add = (label, value, kind = 'hit') => {
    if (value !== 0) modifiers.push({ label, value, stat: kind });
  };

  // Melee ignores cover entirely, so it also never flanks.
  const cover = melee ? { level: 'none', flanked: false, coverTile: -1 } : coverAt(state, target.tile, fromTile);
  const guaranteed = Boolean(def.guaranteedHit);

  let hit;
  let dodge = 0;
  if (guaranteed) {
    hit = 100;
    modifiers.push({ label: 'Guaranteed hit', value: 100, stat: 'hit' });
  } else {
    modifiers.push({ label: 'Aim', value: stat(attacker, 'aim'), stat: 'hit' });
    if (!melee) {
      const table = RULES.rangeTables[weapon.rangeTable];
      add('Range', table[Math.min(Math.round(distance), table.length - 1)]);
    }
    add(def.name, def.aim ?? 0);
    if (grid.heights[fromTile] > grid.heights[target.tile]) add('High ground', RULES.highGroundAim);
    add('Squadsight', squadsight);
    add('Defense', -stat(target, 'defense'));
    const coverDefense = RULES.coverDefense[cover.level];
    add(`Cover (${cover.level})`, -coverDefense);
    if (isHunkered(target)) add('Hunkered', -coverDefense);

    let total = 0;
    for (const m of modifiers) total += m.value;
    hit = clamp(total, 0, 100);
    if (overwatch) {
      // The epsilon keeps exact .5 ties (45 and 85 at 0.7) rounding up despite float error.
      const scaled = Math.round(hit * RULES.overwatchAimMult + 1e-9);
      add('Overwatch', scaled - hit);
      hit = scaled;
    }
    dodge = clamp(stat(target, 'dodge'), 0, 100);
  }

  add('Weapon crit', weapon.crit, 'crit');
  add(def.name, def.crit ?? 0, 'crit');
  if (cover.flanked) add('Flanked', RULES.flankCrit, 'crit');
  let crit = 0;
  for (const m of modifiers) if (m.stat === 'crit') crit += m.value;
  crit = clamp(crit, 0, 100);

  const [lo, hi] = grazeWindow(hit);
  return {
    hit,
    graze: hi - lo,
    crit,
    dodge,
    flanked: cover.flanked,
    cover: cover.level,
    coverTile: cover.coverTile,
    guaranteed,
    overwatch,
    modifiers,
  };
}
