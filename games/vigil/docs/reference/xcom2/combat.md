---
created_by: Claude (claude-opus-5-5)
date: 2026-10-22
---

# Combat

Source tags are defined in [README.md](README.md#sources-and-tags). INI and SRC are authoritative; wiki values are kept where they add context.

## Hit chance formula

Built in `X2AbilityToHitCalc_StandardAim.GetHitChance` [SRC], with constants from `XComGameCore.ini` [INI]. Every term is a flat percentage point added to the hit chance:

| Term | Value | Notes |
| --- | --- | --- |
| Shooter Aim (Offense) | Soldier 65, ADVENT Trooper 65, Muton 80 | Base stat plus stat modifiers from effects |
| Weapon aim | Per weapon (0 for standard rifles), plus Scope upgrades | |
| Range modifier | Lookup by tile distance, see [range table](#range-modifiers) | Alien weapons use a flat 0 table |
| Target Defense | Subtracted | Base stat plus effect modifiers (smoke, Aid Protocol, hunker) |
| Low cover | -20 | `LOW_COVER_BONUS` |
| High cover | -40 | `HIGH_COVER_BONUS` |
| Cover angle bonus | Up to +50% of the cover value back to the shooter | XCOM shooters only, within 11 tiles; see below |
| Height advantage | +20 | Shooter at least 3 levels above the target (`UnitHeightAdvantage=3`, `UnitHeightAdvantageBonus=20`) |
| Height disadvantage | Variable exists, no value set in config | `UnitHeightDisadvantagePenalty` |
| Flanking aim | +`FlankingAimBonus` stat (0 for every unit in config) | Not on overwatch or melee |
| Squadsight | -2 per tile beyond the shooter's sight radius | `SQUADSIGHT_DISTANCE_MOD` |
| Ability and effect modifiers | Shadowstrike +25, Holo Targeting +15, Steady Hands +10, Marked +10, Suppression -50, etc. | |

- A target is flanked when it can take cover but has no cover against this shooter. [SRC]
- Cover angle bonus: when an XCOM soldier within 11 tiles attacks a covered target at an angle under 44 degrees to that cover, the shooter gains `cover value × lerp(0.5, 0.0)` as the angle goes from 10 to 44 degrees (full +50% of the cover value below 10 degrees). It is skipped when the low cover continues one more tile toward the shooter. The code does not define the angle's reference line; read it as "close to flanking". [SRC, INI `MIN_ANGLE_TO_COVER=10`, `MAX_ANGLE_TO_COVER=44`, `MAX_TILE_DISTANCE_TO_COVER=11`]
- Reaction fire (overwatch) multiplies the final success chance by 0.7 (`REACTION_FINALMOD=0.3`; the reduction is truncated to an integer). A shooter who entered overwatch while concealed takes no reduction. The config also has `REACTION_DASHING_FINALMOD=0.4` for dashing targets, applied correctly only after a Highlander fix (issue 493). [SRC, INI]
- Melee gets no flat bonus (`MELEE_HIT_BONUS=0`); melee accuracy comes from the weapon (Sword +20) or the unit's own Aim. [INI]
- Guaranteed-hit abilities skip every modifier except crit. [SRC]
- There is no lower clamp beyond 0 for display, and the success part of the roll table is capped at 100. [SRC]

## Crit chance formula

| Term | Value | Source |
| --- | --- | --- |
| Shooter crit stat | 0 for soldiers, 0 to 15 for enemies by difficulty | INI |
| Weapon crit | Shotgun and sniper 10, rifle and cannon 0 | INI, FD |
| Flanking crit | +`FlankingCritChance` stat: soldiers 50, ADVENT 40 | INI |
| Squadsight | -10 | INI `SQUADSIGHT_CRIT_MOD` |
| Reaction fire | Crit removed entirely unless an effect allows it (Opportunist) | SRC |
| Abilities and ammo | Shadowstrike +25, Talon +20 (+1 crit damage), crit weapon upgrade +5/+10/+15, Hunter's Instinct +10, Biggest Booms +20 (+2 crit damage, Grenadier explosives) | INI |

Flanking crit does not apply to melee. [SRC]

## The roll

One roll `R` from 0 to 99 is checked against a table built in `FinalizeHitChance` [SRC]:

1. Success band = min(hit chance, 100) minus crit chance (crit cannot go below 0).
2. If the target can dodge and hit chance is under 100: graze share = round(dodge / 100 × hit chance), taken out of the success band. (Vanilla takes it only from the success band; the Highlander, issue 1200, splits it between success and crit so dodge never raises the miss chance.)
3. Table order: Success, Crit, Graze, Miss. Miss = 100 minus hit chance.

- Dodge does not apply when the shooter is concealed, when the weapon cannot be dodged, or against area attacks. [SRC, UFO]
- After the roll, aim assist may flip the result; see below. Effects such as Untouchable or Lightning Reflexes can then change it again. [SRC]

## Aim assist

Applies only to non-reaction, non-guaranteed shots [SRC]. Per-difficulty values from INI (Rookie / Veteran / Commander / Legend):

| Setting | Rookie | Veteran | Commander | Legend |
| --- | --- | --- | --- | --- |
| XCOM hit chance multiplier | 1.2 | 1.1 | 1.0 | 1.0 |
| XCOM bonus per consecutive miss | +10 | +10 | +15 | 0 |
| XCOM bonus per soldier lost below 4 | +15 | +10 | 0 | 0 |
| Alien penalty per consecutive hit | -10 | 0 | 0 | 0 |
| Alien penalty per soldier lost below 4 | -10 | -10 | 0 | 0 |

- An XCOM miss becomes a hit if `R` < hit chance × multiplier, plus the streak and losses bonuses when the base chance is at least 50. Capped at 95.
- An alien hit becomes a miss if `R` ≥ hit chance plus the alien penalties, only while 4 or fewer soldiers are alive.

## Range modifiers

Aim added by tile distance [INI `XComGameData_WeaponData.ini`]. Index 1 is an adjacent tile; distances beyond the last entry use the last value [SRC]. Assault rifles and cannons use Medium, shotguns and pistols use Short, sniper rifles use Long, ADVENT and alien weapons use Flat (always 0) [SRC].

| Tiles | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 | 21 | 22 | 23 | 24 | 25 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Short (conventional) | 40 | 35 | 32 | 28 | 23 | 19 | 16 | 12 | 6 | 2 | 0 | -2 | -4 | -7 | -10 | -12 | -15 | -17 | -18 | -18 | -19 | -19 | -21 | -25 | -30 |
| Medium (conventional) | 20 | 19 | 17 | 16 | 13 | 11 | 9 | 7 | 5 | 4 | 3 | 2 | 1 | 1 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Medium (magnetic) | 21 | 20 | 19 | 17 | 16 | 14 | 11 | 9 | 7 | 5 | 4 | 3 | 2 | 1 | 1 | 1 | 1 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Medium (beam) | 22 | 22 | 21 | 20 | 19 | 17 | 15 | 13 | 11 | 9 | 7 | 5 | 3 | 2 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Long (all tiers) | -30 | -27 | -24 | -21 | -18 | -15 | -12 | -9 | -6 | -3 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Vektor (Reaper, conventional) | 25 | 24 | 22 | 21 | 18 | 16 | 14 | 12 | 10 | 9 | 8 | 7 | 6 | 4 | 2 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

Short magnetic and beam match conventional except +3 at 10 tiles.

## Cover

- Low cover -20, high cover -40 to the attacker's hit chance. [INI]
- Hunker Down: +30 defense and +50 dodge (`HUNKERDOWN_DEFENSE`, `HUNKERDOWN_DODGE`). [INI] The EU2012 "doubles cover" rule does not apply to XCOM 2.
- On Rookie through Legend (`XComIndestructibleCoverMaxDifficulty=3`, so every difficulty), missed shots do not destroy XCOM's cover. [INI]
- Frag and Plasma grenades, Demolition and Sectopod Wrath Cannon destroy cover. [UFO, GP]
- ADVENT MECs cannot take cover; units that cannot take cover can never be flanked. [GP, SRC]
- SPARK Bulwark gives adjacent allies high cover and +1 armor. [FX]

## Damage roll

From `X2Effect_ApplyWeaponDamage` [SRC] with weapon entries written as `(Damage, Spread, PlusOne, Crit, Pierce, Shred)` [INI]:

1. Damage = base ± spread, uniform: `base + spread - rand(2 × spread + 1)`. Assault rifle `Damage=4, Spread=1` gives 3 to 5.
2. `PlusOne` is a percent chance of +1 (pistol `Damage=2, Spread=0, PlusOne=50` gives 2 or 3; Frag `Damage=3, PlusOne=20` gives 3, or 4 one time in five).
3. Crit adds the weapon's `Crit` value. Graze multiplies by 0.5 (`GRAZE_DMG_MULT`), truncated to an integer.
4. Rupture on the target adds its value. Effect modifiers add or subtract.
5. Armor: mitigation = target armor minus the attack's `Pierce` (and A.P. Rounds), never below 0. Armor cannot reduce a hit below 1 damage (vanilla; the Highlander adds an opt-in to allow 0).
6. Shred removes armor permanently, capped at the target's armor before the hit.

## Dodge and graze

- Graze deals half damage, truncated. [INI, SRC]
- Graze share of the roll = dodge% × hit chance; see [The roll](#the-roll). [SRC]
- Ignored when the shooter is concealed or the hit chance is 100 or more. [SRC, UFO]
- Dodge sources: Hunker Down +50, Spider Suit +20, Wraith Suit +25, Agility combat sim, Templar Focus. [INI, FX, FD]
- Enemy dodge examples: Viper 15/25/33/33, Archon 25, Chryssalid 10/20/20/20, Codex 20/25/25/25. [INI]

## Overwatch and reaction fire

- Entering overwatch needs an action point; it fires at a unit that moves in view. Multiple shots resolve one after another. [UFO]
- Hit chance × 0.7, no crit, no flank aim bonus, no aim assist. No reduction if the shooter went into overwatch while concealed. [SRC, INI]
- Overwatch ignores Shadowstep users and teleports (Teleport, Templar Invert and Exchange, Skirmisher Justice). [INI]
- Cancelled by damage, flashbangs and suppression. [UFO]

| Ability | Effect | Source |
| --- | --- | --- |
| Covering Fire (Specialist) | Overwatch triggers on any enemy action | UFO, FX |
| Threat Assessment (Specialist) | Aid Protocol also grants a Covering Fire overwatch | UFO, FX |
| Ever Vigilant (Specialist) | Auto overwatch if every action was a move | UFO, FX |
| Guardian (Specialist, `Sentinel` in INI) | 50% chance of another overwatch shot after a hit (`GUARDIAN_PROC=50`) | INI |
| Long Watch (Sharpshooter) | Overwatch through squadsight | UFO, FX |
| Kill Zone (Sharpshooter) | Reaction shot at every enemy that moves or attacks in a cone; cooldown 4 in INI | INI, UFO |
| Cool Under Pressure | `UNDER_PRESSURE_BONUS=10` (aim on reaction shots); UFO pre-release adds that those shots can crit | INI, UFO |
| Bladestorm, Retribution | Free melee strike on enemies entering or attacking from melee range | FD |

## Suppression

| Property | Value | Source |
| --- | --- | --- |
| Aim penalty when XCOM suppresses | -50 | INI |
| Aim penalty when an alien suppresses | -35 | INI |
| Ammo cost | 2 | UFO, GP |

- Pins the target and grants reaction fire if it moves; ends if the suppressor is damaged. [UFO]

## Explosives

- Grenades hit every unit in the radius, ignore dodge, shred and (Frag, Plasma) destroy cover. [UFO, GP]
- Explosive kills drop no loot. [UFO, GP]
- Volatile Mix +2 damage (`VOLATILE_DAMAGE=2`); Blast Padding takes 66% less explosive damage (`BLAST_PADDING_DMG_ADJUST=0.66`). [INI]
- Falling deals at least 2 damage (`MinimumFallingDamage=2`). [INI]
- Item numbers are in [weapons-and-gear.md](weapons-and-gear.md#grenades-and-explosives).
