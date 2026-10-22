// Created by Claude (claude-sonnet-5-5)
// Date: 2026-10-21
// Rolls a hit breakdown into an outcome, applies damage with armor and shred, and handles stray cover hits.
// Armor model: unit.armor is the base value and unit.shred the points lost, so effective armor is armor - shred.
// Armor absorbs up to its value from every hit; pierce ignores that many armor points; shred is permanent.
// Events are emitted through ctx.emit with the plan's EVENT names; this module does not import events.js.

import { RULES } from '../data/rules.js';
import { ABILITIES } from '../data/abilities.js';
import { damageProp } from './grid.js';
import { next, nextInt } from './rng.js';
import { abilityDef, abilityId, abilityWeapon, grazeWindow, unitDef, weaponEffect } from './hit.js';

// Hit points a stray shot takes off the cover it hits.
export const STRAY_COVER_DAMAGE = 1;

// Draw order: hit roll; when it lands in the hit zone, then crit roll, then dodge roll (hit or crit -> graze).
/** @created Claude (claude-sonnet-5-5) - 2026-10-21 */
export function rollShot(state, breakdown) {
  const roll = next(state) * 100;
  const [lo, hi] = grazeWindow(breakdown.hit);
  if (roll >= hi) return { outcome: 'miss', roll };
  if (roll >= lo) return { outcome: 'graze', roll };
  const critRoll = next(state) * 100;
  const dodgeRoll = next(state) * 100;
  if (dodgeRoll < breakdown.dodge) return { outcome: 'graze', roll };
  return { outcome: critRoll < breakdown.crit ? 'crit' : 'hit', roll };
}

/** @created Claude (claude-sonnet-5-5) - 2026-10-21 */
export function rollOutcome(state, breakdown) {
  return rollShot(state, breakdown).outcome;
}

// mult scales the base roll (deadeye 1.5, rounded) before the graze halving or crit bonus.
/** @created Claude (claude-sonnet-5-5) - 2026-10-21 */
export function rollDamage(state, weapon, outcome, { mult = 1 } = {}) {
  if (outcome === 'miss') return 0;
  let damage = nextInt(state, weapon.damage[0], weapon.damage[1]);
  if (mult !== 1) damage = Math.round(damage * mult);
  if (outcome === 'graze') return Math.ceil(damage / 2);
  if (outcome === 'crit') return damage + weapon.critDamage;
  return damage;
}

// Permanently removes up to `amount` armor points the target still has. Returns the amount removed.
/** @created Claude (claude-sonnet-5-5) - 2026-10-21 */
export function shredArmor(state, ctx, target, amount) {
  const left = Math.max(0, target.armor - target.shred);
  const shredded = Math.min(Math.max(0, amount), left);
  if (shredded > 0) {
    target.shred += shredded;
    ctx.emit('ArmorShredded', { unitId: target.id, amount: shredded });
  }
  return shredded;
}

/** @created Claude (claude-sonnet-5-5) - 2026-10-21 */
export function applyDamage(state, ctx, target, amount, { shred = 0, pierce = 0 } = {}) {
  if (target.hp <= 0) return { dealt: 0, absorbed: 0, shredded: 0, killed: false };
  const armor = Math.max(0, target.armor - target.shred - pierce);
  const absorbed = Math.min(armor, Math.max(0, amount));
  const dealt = Math.max(0, amount) - absorbed;
  target.hp = Math.max(0, target.hp - dealt);
  ctx.emit('UnitDamaged', { unitId: target.id, amount: dealt, armorAbsorbed: absorbed, hp: target.hp });
  const killed = target.hp === 0;
  let shredded = 0;
  if (killed) ctx.emit('UnitKilled', { unitId: target.id });
  else shredded = shredArmor(state, ctx, target, shred);
  return { dealt, absorbed, shredded, killed };
}

// Shred added to every weapon hit by the attacker's passives (shredder).
/** @created Claude (claude-sonnet-5-5) - 2026-10-21 */
function passiveShred(unit) {
  let total = 0;
  for (const id of unitDef(unit).abilities) {
    const a = ABILITIES[id];
    if (a.passive && a.shred) total += a.shred;
  }
  return total;
}

// A missed shot may chip the cover it passed through (breakdown.coverTile, -1 for none).
/** @created Claude (claude-sonnet-5-5) - 2026-10-21 */
function strayCoverHit(state, ctx, breakdown) {
  if (breakdown.coverTile < 0) return false;
  if (next(state) >= RULES.strayCoverHitChance) return false;
  const tile = breakdown.coverTile;
  const prop = state.grid.props[tile];
  if (!prop || prop.hp === null) return false;
  const { destroyed, rubbleKind } = damageProp(state.grid, tile, STRAY_COVER_DAMAGE);
  if (destroyed) ctx.emit('CoverDestroyed', { tile, rubbleKind });
  else ctx.emit('CoverDamaged', { tile, hp: state.grid.props[tile].hp });
  return true;
}

// Full weapon shot. ability is an id or a def; the weapon and damageMult come from its weaponDamage effect.
// Returns { outcome, roll, damage, absorbed, shredded, killed, coverHit }; damage is hit points lost.
/** @created Claude (claude-sonnet-5-5) - 2026-10-21 */
export function resolve(state, ctx, attacker, target, breakdown, ability) {
  const def = abilityDef(ability);
  const weapon = abilityWeapon(attacker, def);
  const { outcome, roll } = rollShot(state, breakdown);
  ctx.emit('ShotResolved', {
    attackerId: attacker.id,
    targetId: target.id,
    abilityId: abilityId(ability),
    result: outcome,
    roll,
    breakdown: { ...breakdown, modifiers: breakdown.modifiers.map((m) => ({ ...m })) },
  });

  const result = { outcome, roll, damage: 0, absorbed: 0, shredded: 0, killed: false, coverHit: false };
  if (outcome === 'miss') {
    result.coverHit = strayCoverHit(state, ctx, breakdown);
    return result;
  }
  const amount = rollDamage(state, weapon, outcome, { mult: weaponEffect(def)?.damageMult ?? 1 });
  const hit = applyDamage(state, ctx, target, amount, {
    shred: weapon.shred + passiveShred(attacker),
    pierce: weapon.pierce ?? 0,
  });
  result.damage = hit.dealt;
  result.absorbed = hit.absorbed;
  result.shredded = hit.shredded;
  result.killed = hit.killed;
  return result;
}
