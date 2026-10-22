// Created by Claude (claude-sonnet-5-5)
// Date: 2026-10-21
// AbilitySystem: which abilities a unit has, what they can target, whether a command is valid, and paying for and running one.
// The executor's 'ability' command reaches validate and use through setHooks({ abilities: { validate, use } }); this module wires nothing itself.
// Targeting results: unit ids for unit targets (self abilities return [unit.id]), tile indices for 'tile' abilities.
//   enemyLos         living enemies the unit can target (own sight, or squad vision for the squadsight passive)
//   enemySquadsight  living enemies any squadmate sees
//   ally             squadmates other than the unit that it can see
//   allyAny          every living squadmate on the map, the unit included (the drone flies there)
//   tile             any tile within range of the unit, own tile excluded; no line of sight needed in v1
//   melee            visible enemies with a free tile next to them inside the 1 AP band; cmd.targetTile picks that tile
// Abilities that heal only list wounded allies. Active abilities need at least 1 AP even when apCost is 0 (runAndGun).

import { ABILITIES } from '../data/abilities.js';
import { WEAPONS } from '../data/weapons.js';
import { RULES } from '../data/rules.js';
import { EVENT } from './events.js';
import { livingUnits } from './state.js';
import { reachable, pathTo } from './pathfinder.js';
import { neighbours8, isWalkable } from './grid.js';
import { canSee, squadVisible, tileDistance } from './visibility.js';
import { compute, unitDef } from './hit.js';
import { EFFECTS, newRun, runEffects, flushNoise } from './effects.js';
import { breakConcealment } from './detection.js';

/** @created Claude (claude-sonnet-5-5) - 2026-10-21 */
function abilityIds(unit) {
  const def = unitDef(unit);
  return [...new Set([...def.abilities, ...(def.utility ?? [])])];
}

/** @created Claude (claude-sonnet-5-5) - 2026-10-21 */
function hasEffect(def, type) {
  return def.effects.some((e) => e.type === type);
}

/** @created Claude (claude-sonnet-5-5) - 2026-10-21 */
function enemiesOf(state, unit) {
  return livingUnits(state).filter((u) => u.team !== unit.team);
}

// Free tiles next to the target the unit can reach within the 1 AP band (the unit's own tile first when already adjacent),
// ordered by path cost then tile index. Diagonals follow the pathfinder's no-corner-cutting rule.
/** @created Claude (claude-sonnet-5-5) - 2026-10-21 */
function meleeTilesFrom(state, unit, reach, target) {
  const grid = state.grid;
  const candidates = [[unit.tile, 0]];
  for (const [tile, step] of reach) if (step.apCost === 1) candidates.push([tile, step.cost]);

  const out = [];
  for (const [tile, cost] of candidates) {
    const link = neighbours8(grid, tile).find((n) => n.i === target.tile);
    if (!link) continue;
    if (link.diagonal && !(isWalkable(grid, tile + link.dx) && isWalkable(grid, tile + link.dz * grid.width))) continue;
    if (Math.abs(grid.heights[tile] - grid.heights[target.tile]) > RULES.maxClimb) continue;
    out.push([tile, cost]);
  }
  return out.sort((a, b) => a[1] - b[1] || a[0] - b[0]).map(([tile]) => tile);
}

// -> tile indices the unit can attack the target from, best first; [] when the target is not a legal melee target.
/** @created Claude (claude-sonnet-5-5) - 2026-10-21 */
export function meleeTiles(state, unit, targetId) {
  const target = Object.hasOwn(state.units, targetId) ? state.units[targetId] : null;
  if (!target || target.hp <= 0 || target.team === unit.team) return [];
  if (!squadVisible(state, unit.team).has(target.id)) return [];
  return meleeTilesFrom(state, unit, reachable(state, unit), target);
}

/** @created Claude (claude-sonnet-5-5) - 2026-10-21 */
export function validTargets(state, unit, abilityId) {
  const def = ABILITIES[abilityId];
  switch (def.targeting) {
    case 'self':
      return [unit.id];
    case 'enemyLos':
      return enemiesOf(state, unit).filter((e) => compute(state, unit, e, def) !== null).map((e) => e.id);
    case 'enemySquadsight': {
      const seen = squadVisible(state, unit.team);
      return enemiesOf(state, unit).filter((e) => seen.has(e.id)).map((e) => e.id);
    }
    case 'ally':
    case 'allyAny': {
      const wanted = def.targeting === 'ally' ? (u) => u.id !== unit.id && canSee(state, unit, u) : () => true;
      const wounded = hasEffect(def, 'heal');
      return livingUnits(state, unit.team).filter((u) => wanted(u) && (!wounded || u.hp < u.stats.hp)).map((u) => u.id);
    }
    case 'tile': {
      const out = [];
      for (let t = 0; t < state.grid.heights.length; t++) if (tileInRange(state, unit, def, t)) out.push(t);
      return out;
    }
    case 'melee': {
      const seen = squadVisible(state, unit.team);
      const reach = reachable(state, unit);
      return enemiesOf(state, unit)
        .filter((e) => seen.has(e.id) && meleeTilesFrom(state, unit, reach, e).length > 0)
        .map((e) => e.id);
    }
    default:
      return [];
  }
}

/** @created Claude (claude-sonnet-5-5) - 2026-10-21 */
function tileInRange(state, unit, def, tile) {
  if (!Number.isInteger(tile) || tile < 0 || tile >= state.grid.heights.length || tile === unit.tile) return false;
  return tileDistance(state.grid, unit.tile, tile) <= def.range;
}

// Checks that depend only on the unit and the ability, never on a target. -> player-facing reason or null.
/** @created Claude (claude-sonnet-5-5) - 2026-10-21 */
function unitReason(unit, abilityId) {
  const def = ABILITIES[abilityId];
  if (unit.hp <= 0) return 'That unit is dead';
  if (!abilityIds(unit).includes(abilityId)) return 'This unit cannot use that ability';
  if (def.passive) return 'Passive ability, always active';
  if (unit.ap < 1) return 'No actions left';
  if (unit.ap < def.apCost) return 'Not enough actions';
  const cooldown = unit.cooldowns[abilityId];
  if (cooldown > 0) return `On cooldown (${cooldown} more ${cooldown === 1 ? 'turn' : 'turns'})`;
  if (def.charges && (unit.charges[abilityId] ?? 0) <= 0) return 'No charges left';

  // Overwatch fires from the magazine, so it needs a round even though it spends none.
  const rounds = Math.max(def.usesAmmo, hasEffect(def, 'setOverwatch') ? 1 : 0);
  if (rounds > 0 && unit.ammo !== null && unit.ammo < rounds) return unit.ammo === 0 ? 'Out of ammo' : 'Not enough ammo';
  if (hasEffect(def, 'reload')) {
    const max = WEAPONS[unitDef(unit).weapon].ammo;
    if (max === null) return 'Nothing to reload';
    if (unit.ammo >= max) return 'Weapon is full';
  }
  return null;
}

/** @created Claude (claude-sonnet-5-5) - 2026-10-21 */
function noTargetsReason(def) {
  return hasEffect(def, 'heal') ? 'No one needs healing' : 'No valid targets';
}

// Checks cmd's target against the ability's targeting. -> reason or null.
/** @created Claude (claude-sonnet-5-5) - 2026-10-21 */
function targetReason(state, unit, cmd) {
  const def = ABILITIES[cmd.abilityId];
  if (def.targeting === 'self') return null;
  if (def.targeting === 'tile') {
    if (!Number.isInteger(cmd.targetTile)) return 'Pick a tile';
    return tileInRange(state, unit, def, cmd.targetTile) ? null : 'Target is out of range';
  }
  if (typeof cmd.targetId !== 'string') return 'Pick a target';
  if (!validTargets(state, unit, cmd.abilityId).includes(cmd.targetId)) return 'Invalid target';
  if (def.targeting === 'melee' && cmd.targetTile !== undefined && !meleeTiles(state, unit, cmd.targetId).includes(cmd.targetTile)) {
    return 'Cannot reach that tile';
  }
  return null;
}

// One entry per active ability of the unit (class abilities, then utility), passives excluded.
// reason is null when usable. HUD list; the side and phase checks live in the executor's validate.
/** @created Claude (claude-sonnet-5-5) - 2026-10-21 */
export function abilitiesFor(state, unit) {
  return abilityIds(unit)
    .filter((id) => !ABILITIES[id].passive)
    .map((id) => {
      const def = ABILITIES[id];
      let reason = unitReason(unit, id);
      if (!reason && def.targeting !== 'self' && validTargets(state, unit, id).length === 0) reason = noTargetsReason(def);
      return { id, def, usable: reason === null, reason, charges: unit.charges[id] ?? null, cooldown: unit.cooldowns[id] ?? 0 };
    });
}

// No side effects. cmd is the executor's ability command; the executor has already checked side, phase and that the unit lives.
/** @created Claude (claude-sonnet-5-5) - 2026-10-21 */
export function validate(state, cmd) {
  const unit = Object.hasOwn(state.units, cmd.unitId) ? state.units[cmd.unitId] : null;
  if (!unit) return { ok: false, reason: 'Unknown unit' };
  const reason = unitReason(unit, cmd.abilityId) ?? targetReason(state, unit, cmd);
  return reason ? { ok: false, reason } : { ok: true };
}

// Pays AP, charge, cooldown and ammo, breaks concealment when flagged, runs the effects, then flushes noise.
// Runs only after validate passed. AP is paid before the effects so reactions see the remaining AP.
/**
 * @created Claude (claude-sonnet-5-5) - 2026-10-21
 * @modified Claude (claude-opus-5-5) - 2026-10-21 - concealment breaks through Detection.breakConcealment
 */
export function use(state, ctx, cmd) {
  const unit = state.units[cmd.unitId];
  const id = cmd.abilityId;
  const def = ABILITIES[id];
  const run = newRun();

  let target = unit;
  if (def.targeting === 'tile') {
    target = cmd.targetTile;
  } else if (def.targeting !== 'self') {
    target = state.units[cmd.targetId];
  }
  if (def.targeting === 'melee') {
    // Plan the walk before AP is paid: reachable depends on unit.ap.
    run.moveTile = cmd.targetTile ?? meleeTiles(state, unit, target.id)[0];
    run.path = run.moveTile === unit.tile ? [] : pathTo(reachable(state, unit), run.moveTile);
  }

  const apBefore = unit.ap;
  unit.ap -= def.apCost;
  if (def.charges) unit.charges[id] -= 1;
  if (def.cooldown) unit.cooldowns[id] = def.cooldown;
  if (def.usesAmmo && unit.ammo !== null) unit.ammo -= def.usesAmmo;
  // Squad-wide concealment (Settled rules): only soldiers hold it.
  if (def.breaksConcealment && unit.team === 'xcom') breakConcealment(state, ctx, unit.id, 'ability');

  runEffects(state, ctx, unit, target, def.effects, def, run);

  if (def.endsTurn) unit.ap = 0;
  ctx.emit(EVENT.ApSpent, { unitId: unit.id, spent: Math.max(0, apBefore - unit.ap), ap: unit.ap });
  flushNoise(state, ctx, run);
}

// A shot outside the command flow, for reactions: no AP, no cooldown, no concealment change. Spends one round when the
// weapon is finite. -> the CombatResolver result, or null when the shooter is out of ammo or cannot target the unit.
// With { overwatch: true } the hit chance takes RULES.overwatchAimMult.
/** @created Claude (claude-sonnet-5-5) - 2026-10-21 */
export function standardShot(state, ctx, shooter, target, { overwatch = false } = {}) {
  if (shooter.hp <= 0 || target.hp <= 0) return null;
  if (shooter.ammo !== null && shooter.ammo < 1) return null;
  const def = ABILITIES.standardShot;
  const run = newRun({ overwatch });
  const result = EFFECTS.weaponDamage(state, ctx, shooter, target, def.effects[0], def, run);
  if (!result) return null;
  if (shooter.ammo !== null) shooter.ammo -= 1;
  flushNoise(state, ctx, run);
  return result;
}
