// Created by Claude (claude-sonnet-5-5)
// Date: 2026-10-21
// EffectRegistry: one function per ability effect type (Strategy). abilities.js runs an ability's effect list through runEffects.
// Signature: EFFECTS[type](state, ctx, src, target, effect, ability, run)
//   src is the acting unit. target is a unit for unit-targeted abilities, src itself for self abilities and a tile index for
//   tile abilities (area effects hit every living unit within ability.radius of that tile, friend or foe).
//   ability is the ability def. run is the scratch for one use: { overwatch, last, noise, moveTile, path, aborted }.
// Loud effects push tiles onto run.noise; the caller flushes them through the detection.onNoise hook once the whole effect
// list has resolved, so a pod revealed by a grenade scampers only after the blast landed.

import { WEAPONS } from '../data/weapons.js';
import { PROPS } from '../data/props.js';
import { EVENT } from './events.js';
import { nextInt } from './rng.js';
import { livingUnits } from './state.js';
import { tileDistance } from './visibility.js';
import { abilityId, compute, unitDef } from './hit.js';
import { resolve, applyDamage, shredArmor, hitProp, tilesInRadius } from './combat.js';
import { walkPath, getHooks } from './executor.js';

// Hit points a grenade takes off every destructible prop in its radius: crates, barriers and barrels fall, walls (hardness 8) hold.
export const EXPLOSION_PROP_DAMAGE = 4;

export { tilesInRadius };

/** @created Claude (claude-sonnet-5-5) - 2026-10-21 */
export function newRun(extra = {}) {
  return { overwatch: false, last: null, noise: [], moveTile: null, path: [], aborted: false, ...extra };
}

/** @created Claude (claude-sonnet-5-5) - 2026-10-21 */
export function runEffects(state, ctx, src, target, effects, ability, run) {
  for (const effect of effects) {
    if (run.aborted) break;
    const fn = EFFECTS[effect.type];
    if (!fn) throw new Error(`unknown effect type ${effect.type}`);
    fn(state, ctx, src, target, effect, ability, run);
  }
}

// Calls the noise hook once per distinct tile, in the order the effects made noise.
/** @created Claude (claude-sonnet-5-5) - 2026-10-21 */
export function flushNoise(state, ctx, run) {
  const tiles = [...new Set(run.noise)];
  run.noise = [];
  for (const tile of tiles) getHooks().detection.onNoise(state, ctx, tile);
}

/** @created Claude (claude-sonnet-5-5) - 2026-10-21 */
function isTile(target) {
  return typeof target === 'number';
}

// Living units an effect lands on: everyone in the blast for a tile target, else the single target.
/** @created Claude (claude-sonnet-5-5) - 2026-10-21 */
function affected(state, target, ability) {
  if (isTile(target)) {
    return livingUnits(state).filter((u) => tileDistance(state.grid, target, u.tile) <= (ability.radius ?? 0));
  }
  return target.hp > 0 ? [target] : [];
}

// Replaces a status of the same id, so re-applying refreshes it instead of stacking.
/** @created Claude (claude-sonnet-5-5) - 2026-10-21 */
function addStatus(ctx, unit, status) {
  const at = unit.statuses.findIndex((s) => s.id === status.id);
  if (at !== -1) unit.statuses.splice(at, 1);
  unit.statuses.push(status);
  ctx.emit(EVENT.StatusApplied, { unitId: unit.id, status: status.id, turns: status.turns });
}

export const EFFECTS = {
  // Returns the CombatResolver result, or null when the target cannot be hit. Sets run.last for applyStatus onHit.
  /** @created Claude (claude-sonnet-5-5) - 2026-10-21 */
  weaponDamage(state, ctx, src, target, effect, ability, run) {
    run.last = null;
    if (isTile(target) || target.hp <= 0) return null;
    const breakdown = compute(state, src, target, ability, { overwatch: run.overwatch, fromTile: src.tile });
    if (!breakdown) return null;
    run.last = resolve(state, ctx, src, target, breakdown, ability);
    run.noise.push(src.tile, target.tile);
    return run.last;
  },

  /** @created Claude (claude-sonnet-5-5) - 2026-10-21 */
  flatDamage(state, ctx, src, target, effect, ability) {
    for (const unit of affected(state, target, ability)) {
      const amount = nextInt(state, effect.damage[0], effect.damage[1]);
      applyDamage(state, ctx, unit, amount, { pierce: effect.pierce ?? 0 });
    }
  },

  /** @created Claude (claude-sonnet-5-5) - 2026-10-21 */
  shred(state, ctx, src, target, effect, ability) {
    for (const unit of affected(state, target, ability)) shredArmor(state, ctx, unit, effect.amount);
  },

  // Explosion, then hitProp on every prop in the radius, ascending tile order (barrels caught in it burst and chain).
  // The Explosion names its source and ability so the view can play the throw or fire clip.
  /**
   * @created Claude (claude-sonnet-5-5) - 2026-10-21
   * @modified Claude (claude-opus-5-5) - 2026-10-22 - props hit through hitProp
   * @modified Claude (claude-opus-5-5) - 2026-10-23 - Explosion carries sourceId and abilityId
   */
  destroyCover(state, ctx, src, tile, effect, ability, run) {
    const radius = ability.radius ?? 0;
    const tiles = tilesInRadius(state.grid, tile, radius);
    ctx.emit(EVENT.Explosion, { center: tile, radius, tiles, sourceId: src.id, abilityId: abilityId(ability) });
    run.noise.push(tile);
    for (const t of tiles) if (state.grid.props[t]) hitProp(state, ctx, t, effect.damage ?? EXPLOSION_PROP_DAMAGE, run.noise);
  },

  // Destroys the prop on the target tile outright; a barrel bursts.
  /** @created Claude (claude-opus-5-5) - 2026-10-22 */
  destroyProp(state, ctx, src, tile, effect, ability, run) {
    const prop = state.grid.props[tile];
    if (!prop || prop.hp === null) return;
    run.noise.push(src.tile);
    hitProp(state, ctx, tile, Math.max(prop.hp, PROPS[prop.kind].hardness), run.noise);
  },

  /** @created Claude (claude-sonnet-5-5) - 2026-10-21 */
  heal(state, ctx, src, target, effect) {
    if (isTile(target) || target.hp <= 0) return;
    const amount = Math.min(effect.amount, target.stats.hp - target.hp);
    if (amount <= 0) return;
    target.hp += amount;
    ctx.emit(EVENT.UnitHealed, { unitId: target.id, amount, hp: target.hp });
  },

  // onHit: only after a weaponDamage that landed (hit, graze or crit) and left the target alive.
  /** @created Claude (claude-sonnet-5-5) - 2026-10-21 */
  applyStatus(state, ctx, src, target, effect, ability, run) {
    if (isTile(target) || target.hp <= 0) return;
    if (effect.onHit && (!run.last || run.last.outcome === 'miss')) return;
    addStatus(ctx, target, { id: effect.status, turns: effect.turns });
  },

  // Timed stat change stored as a status; hit.js reads it back through the status list.
  /** @created Claude (claude-sonnet-5-5) - 2026-10-21 */
  modifyStat(state, ctx, src, target, effect) {
    if (isTile(target) || target.hp <= 0) return;
    addStatus(ctx, target, { id: effect.status, turns: effect.turns, stat: effect.stat, amount: effect.amount });
  },

  // The status clears at the start of the owner's next side (TurnManager).
  /** @created Claude (claude-sonnet-5-5) - 2026-10-21 */
  setOverwatch(state, ctx, src) {
    if (!src.statuses.some((s) => s.id === 'overwatch')) src.statuses.push({ id: 'overwatch', turns: null });
    ctx.emit(EVENT.OverwatchSet, { unitId: src.id });
  },

  /** @created Claude (claude-sonnet-5-5) - 2026-10-21 */
  hunker(state, ctx, src) {
    addStatus(ctx, src, { id: 'hunkered', turns: null });
  },

  /** @created Claude (claude-sonnet-5-5) - 2026-10-21 */
  reload(state, ctx, src) {
    src.ammo = WEAPONS[unitDef(src).weapon].ammo;
  },

  /** @created Claude (claude-sonnet-5-5) - 2026-10-21 */
  grantAp(state, ctx, src, target, effect) {
    src.ap += effect.amount;
  },

  // Walks run.path to run.moveTile (reactions and detection fire per step through walkPath), then runs the inner effects.
  // A mover that dies, is stopped short or loses its target skips them.
  /** @created Claude (claude-sonnet-5-5) - 2026-10-21 */
  moveThenAct(state, ctx, src, target, effect, ability, run) {
    if (run.moveTile !== null && run.moveTile !== src.tile) walkPath(state, ctx, src, run.path);
    const stopped = run.moveTile !== null && src.tile !== run.moveTile;
    if (src.hp <= 0 || stopped || isTile(target) || target.hp <= 0) {
      run.aborted = true;
      return;
    }
    runEffects(state, ctx, src, target, effect.effects, ability, run);
  },
};
