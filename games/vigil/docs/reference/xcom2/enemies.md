---
created_by: Claude (claude-opus-5-5)
date: 2026-10-22
---

# Enemies and difficulty

Source tags are defined in [README.md](README.md#sources-and-tags).

## Difficulty scaling

Source: UFO Difficulty page (values taken from the game config files; spot-checked).

| Setting | Rookie | Veteran | Commander | Legend |
| --- | --- | --- | --- | --- |
| Max engaged enemies | 4 | 6 | 6 | No limit |
| Intel to contact a region | 30 | 30 | 40 | 80 |
| Hidden aim assist for the player | Significant | Some | Minor | None |
| Rookie soldier HP | 6 | 5 | 4 | 4 |
| ADVENT Trooper HP | 3 | 3 | 4 | 4 |
| Muton HP | 8 | 8 | 9 | 11 |
| Heal time scalar (FD) | 1.5 | 1.5 | 1.5 | 2.5 |

- Commander needs a few extra missions to reach Colonel; Legend needs almost double. Legend also raises facility costs and research time, needs 3 Faceless corpses per Mimic Beacon, delays dangerous enemies (Sectopods in October instead of August) and disables the tutorial.
- Rank kill thresholds per difficulty are in [soldiers.md](soldiers.md#squad-classes-and-promotion).

## Enemy stats per difficulty

Source: `XComGameData_CharacterStats.ini` [INI]. Each cell reads Rookie / Veteran / Commander / Legend; a single value is the same on every difficulty. Sight radius is 27 (meters, 18 tiles) for every unit listed. Detection radius is 12 unless noted. Hack is the unit's hack defense (Tech).

| Enemy (INI template) | HP | Aim | Defense | Mobility | Will | Dodge | Armor | Crit | Hack |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ADVENT Trooper (AdvTrooperM1) | 3/3/4/4 | 65 | 0 | 12 | 50 | 0 | 0 | 0 | 125 |
| Advanced Trooper (M2) | 6/7/8/9 | 65/70/70/70 | 0 | 12 | 50/60/60/60 | 0 | 0 | 0 | 125 |
| Elite Trooper (M3) | 8/8/12/12 | 70/75/75/75 | 0/10/10/10 | 12 | 50/50/60/60 | 0 | 0 | 0/0/10/10 | 125 |
| ADVENT Officer (AdvCaptainM1) | 6/6/7/7 | 65/75/75/75 | 0 | 12 | 50/60/60/60 | 0 | 0 | 0/0/10/10 | 125 |
| Advanced Officer (M2) | 8/12/12/13 | 65/75/75/75 | 0 | 12 | 50/70/70/70 | 0/15/15/15 | 0 | 0/10/10/10 | 125 |
| Elite Officer (M3) | 9/16/16/18 | 70/75/80/80 | 0/10/10/10 | 12 | 50/75/75/75 | 0/20/15/15 | 0 | 0/10/10/10 | 125 |
| Stun Lancer (M1) | 4/6/7/8 | 65 | 0 | 12/14/14/14 | 50/60/60/60 | 0 | 0 | 0/15/15/15 | 125 |
| Advanced Stun Lancer (M2) | 7/7/8/10 | 65 | 10/0/10/10 | 13/14/15/15 | 50/70/70/70 | 0/25/25/25 | 1 | 0/15/15/15 | 125 |
| Elite Stun Lancer (M3) | 8/10/12/15 | 65/65/70/70 | 0/10/10/10 | 14/14/15/15 | 50/70/70/70 | 0/20/25/25 | 1/0/1/1 | 0/15/15/15 | 125 |
| Shieldbearer (M2) | 6/6/8/9 | 65/70/70/70 | 10 | 12 | 50/75/75/75 | 0 | 1/2/2/3 | 0/0/10/10 | 125 |
| Elite Shieldbearer (M3) | 8/7/11/12 | 65/75/75/75 | 0/15/10/10 | 12 | 50/75/75/75 | 0 | 2/3/3/4 | 0/0/10/10 | 125 |
| Purifier (M1, WotC) | 4/5/6/6 | 65/65/70/70 | 0 | 12 | 50 | 0 | 0 | 0/0/10/10 | 125 |
| Priest (M1, WotC) | 5/6/8/8 | 75 | 0 | 12 | 60 | 0/0/10/15 | 0 | 0/0/10/10 | 125 (Psi 40) |
| ADVENT MEC (M1) | 7/7/8/9 | 70/75/75/75 | 0 | 12/12/14/14 | 50 | 0 | 1/2/2/2 | 0/10/10/10 | 50/50/70/70 |
| Heavy MEC (M2) | 12/14/15/18 | 75 | 10 | 12/15/15/15 | 50 | 0 | 2/3/3/3 | 0/10/10/10 | 80/80/90/90 |
| ADVENT Turret (M1) | 4/4/5/6 | 50 | 0 | 0 | 50 | 0 | 1/2/3/3 | 0 | 30/30/35/35 (detection 10) |
| Sectoid | 7/8/8/10 | 70/75/75/75 | 0 | 12 | 80/80/100/100 | 0 | 0 | 0/0/10/10 | 0 (Psi 40/90/90/90, detection 15) |
| Viper | 7/8/8/10 | 75 | 0 | 12/14/15/15 | 50/60/60/60 | 15/25/33/33 | 0 | 0/10/10/10 | 0 |
| Muton | 8/8/9/11 | 80 | 10 | 12/14/14/14 | 50 | 0 | 1/1/2/2 | 0/10/10/10 | 0 |
| Berserker | 15/18/24/28 | 75 | 0 | 14/15/15/15 | 75 | 0 | 0 | 0/15/15/15 | 0 |
| Faceless | 8/10/10/12 | 60/75/75/75 | 0 | 12/14/14/14 | 50/50/70/70 | 0 | 0 | 0/15/15/15 | 0 |
| Chryssalid | 8/9/10/13 | 75 | 0/0/10/10 | 12/12/15/15 | 50/70/70/70 | 10/20/20/20 | 1 | 0/10/15/15 | 0 |
| Archon | 12/18/20/24 | 75 | 25 | 14/15/15/15 | 50/100/100/100 | 25 | 0 | 0/10/10/10 | 0 |
| Andromedon | 12/15/18/21 | 70/80/80/80 | 10 | 12/14/14/14 | 50/85/100/100 | 0 | 3/4/4/4 | 0/10/10/10 | 0 |
| Andromedon Shell (AndromedonRobot) | 14/14/18/21 | 75 | 0 | 12/12/15/15 | 50 | 0 | 0 | 0/15/0/0 | 80 |
| Codex (Cyberus) | 10/12/12/13 | 75/80/80/80 | 0 | 12/12/14/14 | 100 | 20/25/25/25 | 0 | 0/10/10/10 | 150 (Psi 100) |
| Gatekeeper | 20/20/25/30 | 70/80/80/80 | 0/10/15/15 | 15/16/16/16 | 100/110/120/120 | 0 | 2/3/3/4 | 0/0/10/10 | 150 (Psi 120) |
| Sectopod | 30/28/32/40 | 70 | 0 | 16/14/16/16 | 50 | 0 | 4/4/5/6 | 0/10/10/10 | 125/125/150/150 (detection 15) |
| Spectre (M1, WotC) | 11/13/14/16 | 65/65/80/80 | 0 | 15 | 100 | 10/20/20/20 | 0 | 0/0/15/15 | 150 (Psi 100) |
| The Lost (WotC) | 4 | 75/75/85/90 | 0 | 8 | 50 | 0 | 0 | 0 | 0 |
| Lost Dasher (WotC) | 6 | 75/75/85/90 | 0 | 24 | 50 | 0 | 0 | 0 | 0 |
| Psi Zombie | 4/6/6/8 | 75/65/75/75 | 0 | 12/12/15/15 | 50 | 0 | 0 | 0/0/15/15 | 0 |

- Odd-looking values are copied as the INI has them: Advanced Stun Lancer Defense 10/0/10/10, Elite Officer Dodge 0/20/15/15, Elite Shieldbearer HP 8/7/11/12, Sectopod HP and Mobility higher on Rookie than Veteran, Andromedon Shell crit 0/15/0/0.
- UFO matches INI except Elite Trooper HP (UFO 8/8/10/11), Gatekeeper Defense (UFO 25/35/40/40) and Sectopod Rookie (UFO "?"). INI is the WotC value.
- ADVENT units have 40 flanking crit chance. [INI]
- A unit spots a concealed enemy within its detection radius × (1 − the target's detection modifier). [SRC]

## Enemy stats, single values

Source: FX enemy pages, which give one value per stat without naming a difficulty. Most HP values match the UFO Commander column (Trooper 4, Muton 9, Berserker 24, Archon 20, Gatekeeper 25, Sectopod 32, Chryssalid 10), so read these as Commander unless a UFO row says otherwise. "?" is "??" on the page.

| Enemy | HP | Armor | Aim | Crit | Defense | Mobility | Will | Dodge | Tech / Psi |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ADVENT Officer | 7 | | 75 | 10 | ? | 12 | 60 | | Tech 125 |
| ADVENT Stun Lancer | 7 | | 65 | 15 | ? | 14 | 60 | | Tech 125 |
| ADVENT Shieldbearer | 8 | | 70 | 10 | 10 | 12 | 75 | | Tech 125 |
| ADVENT Turret | 6 | 3 | 50 | ? | ? | | 50 | | Tech 35 |
| ADVENT MEC | 8 | | 75 | 10 | ? | 14 | 50 | | Tech 70 |
| Sectoid | 8 | | 75 | 10 | ? | 12 | 100 | | Psi 90 |
| Viper | 8 | | 75 | 10 | ? | 15 | 60 | 33 | |
| Muton | 9 | 2 | 80 | 10 | 10 | 14 | 50 | | |
| Chryssalid | 10 | 1 | 75 | 15 | 10 | 15 | 70 | 20 | |
| Faceless | 10 | | 75 | 15 | 0 | 14 | 70 | | |
| Andromedon | 15 | 4 | 80 | 10 | 10 | 14 | 100 | | |
| Archon | 20 | | 75 | 10 | 25 | 15 | 100 | 25 | |
| Berserker | 24 | | 75 | 15 | ? | 15 | 75 | | |
| Gatekeeper | 25 | ? | 80 | 10 | 40 | 16 | 120 | | Psi 120 |
| Sectopod | 32 | 5 | 70 | 10 | ? | 16 | 50 | | |

Codex has no numeric stats in any source. Shen's Last Gift's JULIAN Sectopod reaches 80 HP and 7 armor. [UFO]

## Enemy attacks

| Enemy | Attack | Damage | Shred / notes | Source |
| --- | --- | --- | --- | --- |
| ADVENT Trooper | Mag Rifle | 3-4 | Crit 5, crit chance 10 | UFO, FX |
| Advanced Trooper | Mag Rifle; Frag Grenade | 5; 2-3 | Grenade shred 1 | UFO |
| Elite Trooper | Mag Rifle; Frag Grenade | 5-6; 3-4 | Grenade shred 1 | UFO |
| ADVENT Officer | Mag Rifle; Grenade | 3-4; 2-3 | Grenade shred 1. Mark: nearby ADVENT focus the marked soldier (+10 aim vs Marked per UFO) | FX, UFO, GP |
| ADVENT Stun Lancer | Mag Rifle; Shock Lance | 3-4; 2-4 | Dashes 3 to 4 soldier moves; melee may disorient, stun 1 turn or knock out | FX, GP |
| ADVENT Shieldbearer | Mag Rifle; Energy Shield | 5-6 | Shield gives allies within 15 m (10 tiles) 3 HP for 3 full turns, no cooldown (INI); 5 on the elite (FX) | INI, FX, GP |
| ADVENT MEC | Mag Cannon; Micro-Missiles | 4-6; 3 | Shred 1 each; cannot take cover | UFO, FX, GP |
| ADVENT Heavy MEC | Mag Cannon; Micro-Missiles | 8-9; 3-5 | Shred 2; shred 1 | UFO |
| ADVENT Turret | Mag Rifle | 3-4 | Stationary, fires twice or fires then overwatches, aim bonus from elevation | FX |
| Sectoid | Plasma pistol | 3-4 | Mindspin (1-turn cooldown): disorient, panic or mind control, weaker on high Will. Raises Psi Zombies; killing or flashbanging it ends both | UFO, FX, GP |
| Viper | Beam Rifle; Bind; Poison Spit | 3-5; 2-3; 3 | Tongue pull across the map; any damage to the Viper breaks Bind | UFO, FX, GP |
| Muton | Beam Rifle; Plasma Grenade; Bayonet | 4-6; 4-5; 6-8 | Rifle shred 1, grenade shred 1 (INI `Damage=4, PlusOne=50, Shred=1`; UFO prose says 2); Suppression, Counterattack, Execute | UFO, FX |
| Berserker | Melee | 5-8 (UFO) / 6-7 (FX) | Rage raises range and damage | UFO, FX |
| Faceless | Claws | 3-4 | Hides as a civilian; regenerates at end of turn | UFO, FX, GP |
| Chryssalid | Poison Claws | 5-6 | Burrows; poison | UFO, FX |
| Archon | Staff | 7-8 ranged, 6-9 melee | Blazing Pinions 4-7 area | UFO, FX |
| Andromedon | Cannon; Acid Bomb | 9-11; 5-7 | Shred 2; shred 3. Shell form: fists 9-10 | UFO, FX |
| Gatekeeper | Beam Cannon; Gateway; Consume | 9-12; 5-7; 7-10 | Consume heals and raises zombies; death explosion 5, shred 2 | UFO, FX |
| Sectopod | Blaster; Wrath Cannon; Lightning Field | 10-11 (INI 10, +1 at 50%, shred 2); 9-12 (INI 10 ± 1, +1 at 50%); 7-9 (INI 8 ± 1, pierce 3) | Blaster fires twice per turn; Wrath Cannon charges for a turn and destroys cover | UFO, FX |
| Codex | Psi Blackhole | | Large area effect lasting 2 turns; Clone splits remaining HP (clone takes the rounded-up half); teleport does not trigger overwatch | UFO, FX |

## ADVENT roles and target priority

- Troopers flank aggressively and throw grenades at 2 or 3 grouped soldiers. [GP]
- Officers, then Troopers, appear from the first mission; other types arrive over the campaign. ADVENT often arrive as reinforcements. [GP]
- Suggested kill order: Shieldbearer, Stun Lancer, Officer, MEC, Trooper; among aliens Sectoids, Vipers and Stun Lancers first. [GP]
- Do not isolate soldiers (Viper pulls, Faceless ambushes) or cluster them (grenades, area attacks). [GP]

## The Chosen (WotC)

- Each Chosen starts with two strengths, gains up to five over time, and has two fixed weaknesses (for example extra damage from explosives, melee, or a faction class). They grow stronger weekly. [GP]
- They stun a soldier, then kidnap them off the map; reviving the stunned soldier first prevents it. [GP]
- Assassin: camouflaged while moving, revealed by scanners or nearby units, never triggers overwatch. Hunter: long-range sniper with a grapple, aims for a full turn before firing, pistol ignores 5 armor. Warlock: summons units, mind controls, spawns 2 to 5 exploding zombies, raises a shield of about 20% HP. [GP]
- Regeneration heals 25% per turn. Defeating one on a normal mission makes it teleport away and awards 5 ability points. [UFO]
- No source gave Chosen stat tables.

## The Lost (WotC)

- Lost: 2 to 4 HP, minor damage, no abilities. Dashers have more HP and mobility; Brutes are slow with much more HP. [GP]
- They are drawn by noise (explosions summon more) and attack aliens as well as XCOM. They keep arriving and cannot be cleared. [GP]
- A regular shot that kills a Lost refunds the action; a Lost kill is worth 0.25 for promotion. [GP, FD]
