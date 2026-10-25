---
created_by: Claude (claude-opus-5-5)
date: 2026-10-23
modified_by: Claude (claude-opus-5-5) - 2026-10-23
---

# Enemy balance

## Purpose

This page gathers every number that sets how hard a mission is: the threat level, enemy stats, how many aliens spawn and where, how fast pods join the fight, and how the AI weighs its choices. It records the current values, why they were picked, and the order to try them in when retuning. The code is the source of truth; update this page when you change a value it lists.

## Where the knobs live

| Knob | File | Current value |
| --- | --- | --- |
| Threat levels: pods, pod size, pool, stat and damage offsets, model size, AI multipliers | `THREAT` in `js/data/threat.js` | see [Threat levels](#threat-levels) |
| Player's current threat level | `Progress` in `js/view/progress.js` (localStorage `vigil.progress.v1`) | starts at 1 |
| Squad carried between missions | `Progress.squad`; after a victory Next mission fields only the survivors at their hp; a defeat or forfeit brings the full squad back | survivors only |
| Healing between victories | `HEAL_PER_WIN` in `js/view/progress.js` | +2 HP per survivor, up to max |
| Enemy stats, weapon, abilities, AI profile | `js/data/enemies.js` (`ENEMIES`) | see [Enemy roster](#enemy-roster) |
| Enemy weapon damage and range | `js/data/weapons.js`, `RULES.rangeTables` in `js/data/rules.js` | rifle 3-5, pistol 1-3, stun baton 2-4 |
| Enemy ability numbers | `js/data/abilities.js` (`markTarget`, `stunLance`, `psiDisorient`) | see [Enemy roster](#enemy-roster) |
| Pods per mission | the level's `pods`; `buildMission(seed, { pods })` overrides | 2 to 3 |
| Aliens per pod | the level's `podSize` | 2 to 3 |
| Enemy type weights | the level's `pool`; `buildMission(seed, { enemyPool })` overrides | see [Threat levels](#threat-levels) |
| Pod distance from the squad | `POD_MIN_DISTANCES` in `js/sim/map-builder.js` | 15, then 14, then 12 tiles |
| Spacing between pod anchors | `POD_SPACING` in `js/sim/map-builder.js` | 6 tiles |
| Noise reveal radius | `RULES.hearingRadius` | 6 tiles |
| Most engaged aliens a noise reveal may cause | `RULES.engagedCap` | 6 |
| Overwatch aim | `RULES.overwatchAimMult` | 0.7 |
| AI tile and attack weights | `AI_PROFILES` in `js/sim/ai.js` | see [AI tuning](#ai-tuning) |
| Aggression ramp | `RESTLESS_TURNS` in `js/sim/ai.js` | 3 |
| Attack bonuses | `KILL_BONUS`, `STATUS_BONUS`, `DEBUFF_VALUE` in `js/sim/ai.js` | 2, 1, 1.5 |

## Threat levels

Every mission is built at the player's threat level. A new player starts at level 1; a victory raises the level by 1 (up to 5) and a defeat or forfeit lowers it by 1 (down to 1). The loadout screen, the objective panel and the outcome card show the level. Level 4 (`THREAT.baseline`) is the game as it was tuned before threat levels: its aliens, pods and AI weights match the tables below exactly, and `buildMission` without a `threat` option builds at it.

| Level | Name | Pods x size | Pool | HP | Aim | Damage | Size | AI |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Stragglers | 2 x 2 | trooper | -1 | -20 | -1 | 75% | cover 0, flank 0, exposure 0, minHit 1, no overwatch, no debuffs; detection -1 |
| 2 | Patrols | 3 x 2 | trooper x3, officer | -1 | -12 | -1 | 85% | cover 0.5, flank 0, exposure 0.5, no overwatch, no debuffs |
| 3 | Garrison | 3 x 2 | trooper x2, officer, stunLancer | 0 | -6 | 0 | 95% | cover 1, flank 0.5, exposure 1 |
| 4 | Strike force | 3 x 2-3 | trooper x3, officer, stunLancer, sectoid | 0 | 0 | 0 | 100% | baseline |
| 5 | Vanguard | 3 x 3 | trooper, officer, stunLancer, sectoid | +1 | +5 | 0 | 110% | cover 1, flank 1.5, exposure 1.3 |

- **Stats:** offsets add to each alien's base stats when `buildMission` places it (each stat at least 1). `damage` adds to every weapon hit before graze and crit, with at least 1 left (`unit.damageBonus`). `scale` sizes the alien's model (`unit.scale`).
- **AI:** the level's `cover`, `flank` and `exposure` multiply a profile's `w1`, `w3` and `w4`; `minHit` replaces the profile's when set. With all three at 0 a level 1 alien scores tiles on shot chance alone, so it walks toward the squad and shoots. A level without `overwatch` closes in where it would have overwatched; one without `debuffs` never casts Mark Target or Mindspin.
- **Size over 500 seeds:** level 1 averages 4 aliens with 12 total HP and aim 45; level 2, 6 aliens, 19.5 HP, aim 54; level 3, 6 aliens, 27 HP, aim 60; level 4, 7.5 aliens, 37 HP, aim 66; level 5, 9 aliens, 58.5 HP, aim 71.

## Enemy roster

Base stats, before the threat level's offsets.

| Enemy | HP | Aim | Mobility | Defense / dodge | Weapon | Special | AI |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ADVENT Trooper | 4 | 65 | 6 | 0 / 0 | rifle 3-5 | overwatch | rifleman |
| ADVENT Officer | 5 | 70 | 6 | 0 / 0 | rifle 3-5 | Mark Target: -15 defense on a soldier for 2 turns, cooldown 2 | rifleman |
| ADVENT Stun Lancer | 5 | 65 | 7 | 0 / 10 | rifle 3-5 | Stun Lance: move then strike at +10 aim, 2-4 damage, stuns 1 turn on hit | melee |
| Sectoid | 8 | 65 | 5 | 10 / 0 | pistol 1-3 | Mindspin: -20 aim on a soldier's next turn, cooldown 3 | caster |

Every alien has sight 14 and detection 4, and no armor. Soldiers have 4 or 5 HP and aim 60 to 70 (see [units-and-loadout.md](units-and-loadout.md)), so a rifle hit (3 to 5, uniform) kills a trooper or a 4 HP soldier two times in three.

## Mission size

At the baseline a mission has 3 pods of 2 or 3 aliens each, so 6 to 9 aliens against 4 soldiers; [Threat levels](#threat-levels) lists the other levels. Each alien is drawn from the level's `pool`; the baseline pool repeats `trooper` three times, so on average half the aliens are troopers and one in six is each of the other types. Repeat an id in the pool to weight it more; pass `enemyPool` or `pods` to `buildMission` to change one mission without touching the levels.

## Pacing

How quickly pods join the fight matters as much as their stats.

- **Start distance:** pods start at least 15 tiles from every squad tile. When they do not fit, the builder retries at 14, then 12, from the same `rngState`. With these values the squad sees an alien at start in about 2% of seeds.
- **Concealment:** while the squad is hidden, an alien notices a soldier only inside its `detection` radius (4) with LOS. Raising `detection` makes scouting harder.
- **Noise:** a shot or explosion reveals unaware pods within `hearingRadius` (6), nearest first, and skips any pod that would push living engaged aliens past `engagedCap` (6). Sight reveals ignore the cap. At these values one shot wakes two or more pods in about 5% of seeds (it was 45% with radius 8 and no cap).
- **Scamper:** revealed aliens move to cover for free, so a reveal never gives the squad a free volley at aliens in the open.

## AI tuning

```js
rifleman: { w1: 1.0, w2: 1.2, w3: 0.6, w4: 0.7, minHit: 35 }
melee:    { w1: 0.4, w2: 2.0, w3: 0.3, w4: 0.3, minHit: 40 }
caster:   { w1: 1.2, w2: 0.8, w3: 0.3, w4: 1.0, minHit: 30 }
```

- `scoreTile = cover*w1 + bestShotChance*w2 + flankThreat*w3 - exposure*w4`. Raise `w1` or `w4` for a cautious profile and `w2` or `w3` for an aggressive one. The melee profile scores closeness in place of shot chance.
- `minHit` is the lowest hit chance (percent) the profile will shoot at. Below it the alien repositions, reloads or overwatches.
- Attack value is expected damage plus `KILL_BONUS` when the average roll would kill, `STATUS_BONUS` for a status on hit, and `DEBUFF_VALUE` for Mark and Mindspin. These decide which soldier an alien picks and whether it prefers a debuff to a shot.
- **Aggression ramp:** an engaged alien that has gone `RESTLESS_TURNS` (3) of its turns without a hostile ability stops overwatching, shoots at any chance above 0%, and closes on the nearest soldier. It ends overwatch standoffs; bot missions that timed out fell from 16% to 4% when it was added.

## Current baseline

The last balance pass (plan 0001, revision U-011) ran 400 headless missions with a scripted player bot: it won 49% with a bold policy and 47% with a careful one, and the AI weights were kept as set. Those numbers are for level 4. Players found it extremely hard, so threat levels now start new players at level 1 and ramp up with wins; no bot sweep has been run on levels 1 to 3 or 5 yet. The bot harness was a throwaway script and is not in the repo. Plan 0001 marks the weights for a retune once a strategy layer changes squad strength.

Known gap: a restless alien with no path toward the squad (cut off by terrain) still idles; seen in 1 of 200 bot runs.

## Retune

1. Change one knob at a time, and start with mission size and pacing (the level's pods, podSize and pool, then `hearingRadius`), since they move difficulty more than per-unit stats. To retune one level, edit its `THREAT.levels` entry; to retune them all, edit `ENEMIES` or `AI_PROFILES`.
2. Run `node --test "games/vigil/tests/*.test.mjs"` from the repo root. `tests/data.test.mjs` checks the enemy tables; `tests/map-builder.test.mjs` and `tests/ai.test.mjs` pin pod placement and AI choices at the baseline, and `tests/threat.test.mjs` checks every level, so update the expected values when a change is intended.
3. Play several missions in the browser (`vigil.newMission()` for a fresh seed; set `vigil.progress.level` first to try a level), or script a bot sweep over many seeds with `buildMission`, `Ai.nextCommand` and `execute`, and compare the win rate with the baseline above.
4. Record the change and the new win rate in the relevant plan's Revision Log, and update the tables on this page.

[`docs/reference/xcom2/enemies.md`](../reference/xcom2/enemies.md) has XCOM 2's enemy stats per difficulty for comparison; none of it is wired into the game.
