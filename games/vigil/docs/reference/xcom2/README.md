---
created_by: Claude (claude-opus-5-5)
date: 2026-10-22
---

# XCOM 2 reference

Stats tables and gameplay rules for XCOM 2 (2016) and War of the Chosen (WotC), gathered from four community sources on 2026-10-22. Use it to answer "how does XCOM 2 do X" questions and to pull numbers when tuning Vigil. Vigil's own values live in `games/vigil/js/data/`; nothing here is wired into the game.

## Files

| File | Covers |
| --- | --- |
| [combat.md](combat.md) | Hit chance, aim and defense, cover, flanking, height, crits, dodge and graze, armor and shred, overwatch, suppression |
| [turns-and-stealth.md](turns-and-stealth.md) | Action points, blue and yellow moves, turn-ending actions, concealment and detection, ambushes, pods, hacking, evac, loot, timers |
| [soldiers.md](soldiers.md) | Attributes, HP and wounds, ranks and kills, ability points, squad size, class ability trees |
| [weapons-and-gear.md](weapons-and-gear.md) | Weapon tables by class, heavy weapons, grenades, ammo, vests, utility items, armor, weapon upgrades, combat sims |
| [enemies.md](enemies.md) | Difficulty scaling, enemy stats per difficulty, enemy attacks, ADVENT roles, Chosen, the Lost |

## Sources and tags

Every table and rule names its source with a tag.

| Tag | Source | How it was read | Reliability |
| --- | --- | --- | --- |
| UFO | https://www.ufopaedia.org/XCOM_2 , https://www.ufopaedia.org/Gameplay_Mechanics_(XCOM2) and linked pages | WebFetch through a summariser; Difficulty, Berserker and Equipment tables spot-checked against the live page and matched | Best for enemy stats and item tables. Its XCOM 2 mechanics page defers to the Enemy Unknown (2012) pages, so it has few XCOM 2 formulas. |
| FX | https://xcom2.wiki.fextralife.com/XCOM_2_Wiki , https://xcom2.wiki.fextralife.com/Soldier_Classes and linked pages | WebFetch through a summariser | Thin on numbers, base game only (no WotC classes), ability ranks disagree between pages. |
| FD | https://xcom.fandom.com/wiki/Data_Tables , https://xcom.fandom.com/wiki/Hit_Points_(XCOM_2) , https://xcom.fandom.com/wiki/Soldier_(XCOM_2) | Read verbatim in the browser pane (WebFetch is blocked by Fandom) | Best for weapon tables (includes WotC and DLC) and rank requirements. Content is CC-BY-SA. |
| GP | https://www.gamepressure.com/xcom2/movement/za848f , https://www.gamepressure.com/xcom2/concealment-phase/z58490 and linked guide chapters | WebFetch through a summariser | Strategy guide prose: good for rule shapes and concealment behaviour, few numbers, some class ability ranks mislabelled. |
| EU | https://www.ufopaedia.org/Gameplay_Mechanics_(EU2012) | WebFetch | Enemy Unknown (2012) rules. Included only where UFOpaedia points XCOM 2 readers to them. Never treat as XCOM 2 fact. |
| INI | War of the Chosen game config files mirrored at https://github.com/daakru/xcom2-wotc-modding (commit 75bf2d5, folder `Firaxis/XCOM/XCOM 2 Config/`): `XComGameCore.ini`, `XComGameData*.ini`, `XComClassData.ini`, `XComAI.ini`, `XComGame.ini`, `XComMissions.ini` | Downloaded raw and parsed with scripts | Highest authority for numbers. The mirror is a third-party copy, but its Difficulty, enemy and weapon values match UFO and FD wherever both exist. WotC values, which can differ from the 2016 base game. |
| SRC | UnrealScript source: the WotC Community Highlander https://github.com/X2CommunityCore/X2WOTCCommunityHighlander (commit 384e5d2) for the hit roll and damage code, and the base-game SDK copy in https://github.com/quixotic-cloud/Tactical-Co-Op for classes the Highlander does not ship | Read directly | Explains how the INI numbers combine. The Highlander is a community fork of the vanilla code; where it changes vanilla behaviour it marks the change with an issue number, and this reference describes the vanilla behaviour and notes the fix. |

Where INI disagrees with a wiki, INI wins and the wiki value is kept beside it for reference.

Raw per-source notes from the research pass (more detail, including fetch logs) were kept in the session scratchpad and are not part of the repo.

## Known gaps

Still open after the INI pass:

- Pod size and composition (`XComEncounters.ini`, not fetched), patrol logic, mission timer lengths (set in map scripts, not config).
- Most ability cooldowns and charges beyond the four base classes, Chosen stats, Lost Brute stats.
- Explosive radius units (weapon range is confirmed in tiles; radius is not) and explosive falloff.
- Detection radius units (sight radius is confirmed in meters; detection radius is likely meters too but unconfirmed).

## Reading conventions

- Difficulty rows use the order Rookie / Veteran / Commander / Legend (INI `_Diff_0` to `_Diff_3`, confirmed).
- Units [SRC]: one tile is 96 Unreal units; one meter is 64 units, so one tile is 1.5 m. Weapon and grenade range (`iRange`) is in tiles. Sight radius is in meters (27 m = 18 tiles). Explosive radius units are unconfirmed.
- Where sources disagree, the table shows each value with its tag.
