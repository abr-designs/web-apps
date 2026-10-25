---
created_by: Claude (claude-opus-5-5)
date: 2026-10-23
---

# Abilities and combat

## Purpose

Every action a unit takes beyond moving is an ability: shooting, overwatch, grenades, healing, melee charges. Abilities are data (a definition plus a list of effects), so new actions mostly need a table entry. The combat modules turn a shot into a hit chance with labelled modifiers, roll it, and apply damage, armor, shred and explosions. One calculator feeds both the HUD preview and the actual roll, so the shown chance is always the real one.

## Where it lives

| File | Role |
| --- | --- |
| `js/data/abilities.js` | `ABILITIES` table; header comment documents the shape, targeting kinds and effect types |
| `js/data/weapons.js` | `WEAPONS`: damage range, crit, crit damage, ammo, range table, shred |
| `js/data/rules.js` | `RULES`: cover defense, high ground, flank crit, overwatch multiplier, graze band, range tables |
| `js/sim/abilities.js` | AbilitySystem: `abilitiesFor`, `validTargets`, `meleeTiles`, `validate`, `use`, `standardShot` (reaction shots) |
| `js/sim/effects.js` | EffectRegistry `EFFECTS` (one function per effect type), `runEffects`, `newRun`, `flushNoise` |
| `js/sim/hit.js` | `compute` (hit, graze, crit, dodge, modifiers), `grazeWindow`, `unitDef`, `abilityId`, `weaponEffect`, `abilityWeapon` |
| `js/sim/combat.js` | `resolve` (roll and apply a shot), `rollShot`, `rollDamage`, `applyDamage`, `shredArmor`, `hitProp`, `explode`, `tilesInRadius` |
| Tests | `tests/abilities.test.mjs`, `tests/hit.test.mjs`, `tests/combat.test.mjs`, `tests/data.test.mjs` |

## How it works

**Which abilities a unit has:** its class or enemy `abilities` list plus `unit.utility` (loadout items). `abilitiesFor(state, unit)` returns one entry per active, non-hidden ability with `{ id, def, usable, reason, charges, cooldown }`; the HUD rail renders exactly this list.

**Targeting kinds** (`def.targeting`), resolved by `validTargets(state, unit, abilityId)`:

| Kind | Targets |
| --- | --- |
| `self` | the unit |
| `enemyLos` | enemies the unit can hit (own sight; squad sight with the `squadsight` passive) |
| `enemySquadsight` | enemies any squadmate sees |
| `ally` | visible squadmates other than the unit |
| `allyAny` | every living squadmate, the unit included |
| `tile` | tiles within `range` the unit sees, or holding an enemy it can see |
| `melee` | visible enemies with a free adjacent tile in the 1 AP move band; `cmd.targetTile` picks the tile |
| `prop` | tiles of burstable props (barrels) the unit sees |

Unit targets are ids (`cmd.targetId`); tile and prop targets are indices (`cmd.targetTile`). `alsoTargets` folds a hidden ability's targets into another's target cycle (Shoot also cycles barrels through `shootBarrel`).

**Using an ability** (`use`): pays AP, a charge, the cooldown and ammo; resets `idleTurns` for hostile targeting; breaks squad concealment when `breaksConcealment` and the user is a soldier; runs `def.effects` through `runEffects`; zeroes AP when `endsTurn`; emits `ApSpent`; then flushes noise to detection.

**Effects** are `EFFECTS[type](state, ctx, src, target, effect, ability, run)`. `target` is a unit, or a tile index for tile abilities, where area effects hit every living unit within `ability.radius`, friend or foe. `run` is per-use scratch: `run.last` holds the last shot result (for `onHit`), `run.noise` collects tiles to flush, and `run.aborted` stops the rest of the list.

| Effect | Does |
| --- | --- |
| `weaponDamage { weapon?, damageMult? }` | full shot through `compute` and `resolve` |
| `flatDamage { damage: [min, max] }` | no roll, every affected unit |
| `shred { amount }` | permanent armor loss |
| `destroyCover { damage? }` | `Explosion` event (with `sourceId`, `abilityId`) and prop damage in the radius |
| `destroyProp {}` | destroys the prop on the target tile; barrels burst |
| `heal { amount }` | capped at max HP |
| `applyStatus { status, turns, onHit? }` | `onHit` requires the preceding shot to land |
| `modifyStat { status, stat, amount, turns }` | timed stat change stored as a status |
| `setOverwatch`, `hunker`, `reload`, `grantAp { amount }` | self effects |
| `moveThenAct { effects }` | walks to the melee tile (reactions fire), then runs the inner effects |

**Hit chance** (`compute`) returns `null` when the target cannot be hit, else `{ hit, graze, crit, dodge, flanked, cover, coverTile, guaranteed, overwatch, modifiers }`. Modifiers are `{ label, value, stat: 'hit' | 'crit' }`: aim, range table entry, ability aim, high ground, squadsight penalty, target defense, cover, hunkered, overwatch scaling, weapon crit, ability crit, flank crit. Melee ignores cover and range.

**Rolling** (`rollShot`): one roll against a graze band centred on the hit chance (`RULES.grazeBand` wide); inside the hit zone a crit roll and a dodge roll follow (dodge downgrades to graze). Graze halves damage (rounded up), crit adds `critDamage`.

**Damage** (`applyDamage`): effective armor is `armor - shred - pierce` and absorbs up to that much per hit. Kills emit `UnitKilled`; survivors take the weapon's and passives' shred. A missed shot can chip the cover it passed through (`RULES.strayCoverHitChance`).

**Explosions:** `destroyCover` damages every prop in the radius by `effect.damage` (default `EXPLOSION_PROP_DAMAGE`). `hitProp` destroys props whose hardness the hit meets; a destroyed prop with `burst` calls `explode`, which damages units and props in its own radius and chains depth first.

## How to interact

```js
import { abilitiesFor, validTargets, validate } from './sim/abilities.js';
import { compute } from './sim/hit.js';

abilitiesFor(state, unit);                         // rail list with reasons
validTargets(state, unit, 'standardShot');         // ['a01', 'a03']
compute(state, unit, state.units.a01, 'standardShot', { fromTile });  // preview from a hypothetical tile
execute(state, { type: 'ability', unitId: 'x2', abilityId: 'fragGrenade', targetTile: 210 });
```

The AI and the HUD both call `compute` with a `fromTile` to score or preview positions without moving.

## Extend

### Add an ability using existing effects

1. Add an entry to `ABILITIES` in `js/data/abilities.js` following the shape comment (`name, description, apCost, endsTurn, usesAmmo, targeting, breaksConcealment, effects`, plus optional `charges, cooldown, range, radius, aim, crit, guaranteedHit, passive, hidden, alsoTargets`). Tile abilities need `range` and `radius`.
2. Give it to a unit: add the id to a class or enemy `abilities` list (`data/classes.js`, `data/enemies.js`), or to `RULES.loadout.items` to make it a loadout pick.
3. Add an icon mapping in `ABILITY_ICON` in `js/view/hud.js` (falls back to `shoot`).
4. If it should animate differently: shots map to clips in `SHOT_CLIPS`, explosions in `BLAST_CLIPS`, both in `js/view/event-player.js`.
5. If enemies use it, check that `js/sim/ai.js` scores it. `attackValue` scores only abilities with a `weaponDamage` effect and `modifyStat` or `applyStatus` debuffs; other attacks (flat damage, tile blasts) return `null` and are never chosen until it learns them.
6. Add tests in `tests/abilities.test.mjs`. `tests/data.test.mjs` validates the shape automatically.

### Add an effect type

1. Add a function to `EFFECTS` in `js/sim/effects.js` with the standard signature. Emit events for everything visible; push noise tiles onto `run.noise` for loud effects.
2. Document it in the header comment of `js/data/abilities.js`.
3. Add the type to `EFFECT_TYPES` in `tests/data.test.mjs`.
4. If the effect is unique to some abilities, check whether `hasEffect` checks in `sim/abilities.js` (`heal`, `reload`, `setOverwatch`) need a sibling.

### Add a targeting kind

Add a `case` to `validTargets` and to `targetReason` in `js/sim/abilities.js`, handle it in `use` (choose `target`), add it to `TARGETING` in `tests/data.test.mjs`, and teach the `targeting` mode in `js/view/input.js` how to pick it. Add it to `HOSTILE_TARGETING` when it attacks enemies.

### Add a weapon

Add it to `WEAPONS` and, for ranged weapons, a range table to `RULES.rangeTables` (index = tile distance, last entry repeats). Point a class or enemy `weapon` at it, or reference it from an effect's `weapon`. For a visible model, see [unit-models.md](unit-models.md#extend).
