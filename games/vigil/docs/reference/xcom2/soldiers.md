---
created_by: Claude (claude-opus-5-5)
date: 2026-10-22
---

# Soldiers

Source tags are defined in [README.md](README.md#sources-and-tags).

## Attributes

| Attribute | Rule | Source |
| --- | --- | --- |
| Hit Points | Damage taken before death or a critical wound | FD |
| Armor | Subtracted from each hit's damage, 1 per point | FD, GP |
| Aim | Base accuracy, 1 point = 1% hit chance | FD |
| Defense | Subtracted from the attacker's hit chance, 1 point = 1% | FD |
| Mobility | Distance per move action as ground covered | FD |
| Will | Resistance to panic and psionics; sets bleed-out chance; in WotC sets how fast a soldier tires | FD, FX |
| Hack | Hacking success against a target's Tech | FD, GP |
| Dodge | Chance to turn a hit into a graze | FD, FX |
| Crit chance | Chance of a critical hit, rolled apart from hit chance | FD |
| Sight Radius | Hidden; vision is shared by the squad and lost when the soldier is incapacitated or mind controlled | FD |
| Psi | Success chance of chance-based psionic attacks | FD |

## Base stats

Rookie soldier template, `XComGameData_CharacterStats.ini` [INI]. Values are Rookie / Veteran / Commander / Legend where they differ.

| Stat | Value |
| --- | --- |
| HP | 6 / 5 / 4 / 4 |
| Aim | 65 |
| Defense | 0 |
| Mobility | 12 |
| Will | 50 / 40 / 40 / 40 |
| Hack | 5 |
| Crit chance | 0 |
| Flanking crit chance | 50 |
| Flanking aim bonus | 0 |
| Sight radius | 27 (meters, 18 tiles) |
| Detection radius | 9 |
| Utility slots | 1 |

HP rises with rank, armor, vests and the Conditioning combat sim.

## Stat gains per rank

From each class's `SoldierRanks` entries in `XComClassData.ini` [INI]. Ranks run Squaddie, Corporal, Sergeant, Lieutenant, Captain, Major, Colonel (Psi Operative: Initiate to Magus). Every class also gains +5 Will at Squaddie. Gains not shown are 0.

| Class | Aim per rank | HP per rank | Hack per rank | Other |
| --- | --- | --- | --- | --- |
| Ranger | 3, 3, 3, 2, 2, 1, 1 (total +15) | 1, 1, 1, 1, 0, 1, 1 (+6) | 0, 5, 0, 0, 5, 0, 5 | |
| Sharpshooter | 10, 4, 3, 3, 2, 2, 2 (+26) | 1, 0, 1, 0, 1, 0, 1 (+4) | 0, 0, 5, 0, 5, 0, 5 | |
| Grenadier | 2, 2, 2, 1, 1, 1, 1 (+10) | 1, 1, 1, 1, 0, 1, 1 (+6) | 0, 5, 0, 5, 0, 5, 0 | |
| Specialist | 3, 3, 3, 2, 2, 1, 1 (+15) | 1, 1, 1, 1, 0, 1, 1 (+6) | 45, 5, 5, 5, 5, 5, 5 (+75) | |
| Psi Operative | 2, 2, 2, 1, 1, 1, 1 (+10) | 1, 0, 1, 0, 1, 0, 1 (+4) | 0, 0, 0, 5, 0, 5, 5 | Psi +50 at Initiate, then +4 per rank |
| Reaper (WotC) | 10, 4, 3, 3, 2, 2, 2 (+26) | 1, 0, 1, 0, 1, 0, 1 (+4) | 0, 5, 0, 0, 5, 0, 5 | |
| Skirmisher (WotC) | 3, 3, 3, 2, 2, 1, 1 (+15) | 1, 1, 1, 1, 0, 1, 1 (+6) | 0, 5, 0, 0, 5, 0, 5 | |
| Templar (WotC) | 3, 3, 3, 2, 2, 1, 1 (+15) | 1, 1, 1, 1, 0, 1, 1 (+6) | 0, 5, 0, 0, 5, 0, 5 | |

A Colonel Sharpshooter at Commander therefore has 65 + 26 = 91 Aim and 4 + 4 = 8 HP before gear.

- At 0 HP a soldier may bleed out instead of dying: 1% per Will point above 50 (2% with the Stay With Me order). Stabilising with a Medikit or Medical Protocol leaves them Unconscious at 1 HP; carrying them to evac also saves them. Aliens never bleed out. [FD, FX]
- Recovery time is a random draw of wound points by HP band, converted to days, then labelled Lightly Wounded, Wounded or Gravely Wounded. In-mission healing does not reduce it. Bands overlap, so a badly hurt soldier can heal faster than a lightly hurt one. [FD]

| HP band (as listed) | Min wound points | Max wound points |
| --- | --- | --- |
| 0% to 20% | 10000 | 40000 |
| 21% to 50% | 6000 | 32000 |
| 51% to 75% | 3500 | 20000 |
| 76% to 100% | 1000 | 10000 |

Heal time scalar: 1.5 on Rookie, Veteran and Commander, 2.5 on Legend. [FD, flagged on the wiki as needing verification]

## Squad, classes and promotion

- Squad size is 4, raised to 5 and 6 by the GTS upgrades Squad Size I and II. [FD, UFO]
- A Rookie gets a random class on promotion to Squaddie: Ranger, Grenadier, Specialist or Sharpshooter. The GTS can train a class directly (5 days per FX Soldier Classes, 10 days per FX class pages). Psi Operatives train in the Psi Lab. SPARK is a DLC robot. WotC adds the hero classes Reaper, Skirmisher and Templar. [FD, FX]
- Loadout: one armor, one primary, one secondary, one utility item. Predator or Warden armor adds a utility slot; EXO or WAR Suit adds a heavy weapon slot. Grenadiers also get a grenade-only slot. [FX]
- At most one promotion per mission, whatever the kill count. [FD]
- The Advanced Warfare Center can grant a random ability from another class on promotion. [FD]

Kills required per rank [FD]:

| Rank | Rookie | Veteran | Commander | Legend |
| --- | --- | --- | --- | --- |
| Squaddie | 1 | 1 | 1 | 1 |
| Corporal | 5 | 6 | 6 | 8 |
| Sergeant | 12 | 12 | 12 | 18 |
| Lieutenant | 24 | 24 | 24 | 40 |
| Captain | 38 | 38 | 42 | 70 |
| Major | 57 | 57 | 60 | 110 |
| Colonel | 81 | 81 | 85 | 175 |
| Colonel (WotC) | 90 | 90 | 95 | 175 |

- A kill credits 1. Every deployed soldier also earns a kill assist; assists convert at 4 per kill for Ranger, SPARK, Reaper, Skirmisher and Templar, 5 for Sharpshooter and Grenadier, 3 for Specialist and Psi Operative. A Lost kill counts 0.25. Wet Work (GTS) gives +25% XP. [FD]

WotC ability points per promotion after Squaddie [FD]:

| Combat intelligence | Points per promotion |
| --- | --- |
| Standard | 3 |
| Above Average | 4 |
| Gifted | 5 |
| Genius | 7 |
| Savant | 10 |

Squad-wide ability points come from ambushes, flanking shots and high-ground shots. Defeating a Chosen on a normal mission awards 5. [FD, UFO]

## Class ability trees

Each class has two branches and picks one ability per rank. Rank placement below is confirmed by `XComClassData.ini` [INI] for all five base classes; the FX class pages had it right, and the FX Soldier Abilities page and GP were wrong. Cooldowns in the tables are as the wikis quote them; the INI values are in [Cooldowns and charges](#cooldowns-and-charges).

### Ranger

Weapons: shotgun or assault rifle, sword.

| Rank | Scout branch | Assault branch |
| --- | --- | --- |
| Squaddie | Slash: sword attack on any enemy in move range, 1 tile including diagonals, no cooldown | (same) |
| Corporal | Phantom: stays concealed when the squad is revealed | Blademaster: +2 sword damage (FD adds +10 aim) |
| Sergeant | Shadowstrike: +25 aim, +25 crit from concealment | Shadowstep: never triggers overwatch or reaction fire |
| Lieutenant | Conceal: re-enter concealment, once per mission | Run and Gun: act after dashing, 3-turn cooldown |
| Captain | Implacable: bonus move after a kill | Bladestorm: free sword strike on enemies entering or attacking from melee range |
| Major | Deep Cover: auto hunker down if the Ranger did not attack | Untouchable: next enemy attack misses after a kill |
| Colonel | Rapid Fire: two shots, -15 aim each, no cooldown | Reaper: chained melee, first strike cannot miss, kills refund the action, later strikes deal less, 4-turn cooldown |

### Sharpshooter

Weapons: sniper rifle, pistol.

| Rank | Sniper branch | Gunslinger branch |
| --- | --- | --- |
| Squaddie | Squadsight: shoot enemies any ally can see | (same) |
| Corporal | Long Watch: overwatch through squadsight | Return Fire: pistol shot back at an attacker, once per turn |
| Sergeant | Deadeye: +4 to 5 damage with 0 to 30 aim penalty by range (FD), 2-turn cooldown (GP) | Lightning Hands: 0 AP pistol shot, 3-turn cooldown |
| Lieutenant | Death From Above: kill on a lower target refunds the action | Quickdraw: pistol as first action costs 1 AP and does not end the turn |
| Captain | Kill Zone: reaction shots in a cone, 3-turn cooldown | Faceoff: pistol shot at every visible enemy, 3-turn cooldown |
| Major | Steady Hands: +10 aim, +10 crit if the sniper did not move | Aim: hunkering grants +20 aim on the first shot next turn |
| Colonel | Serial: kills refund the action, crit penalty per chained kill, 4-turn cooldown | Fan Fire: three pistol shots at one target, 3-turn cooldown |

FD lists the Darklance as "only 1 AP to fire", which implies other sniper rifles need both actions. EU2012 rules also limit sniper shots to the first action.

### Grenadier

Weapons: cannon, grenade launcher (+4 range and +1 radius; Advanced +5 range and +2 radius), extra grenade slot.

| Rank | Demolitions branch | Heavy Gunner branch |
| --- | --- | --- |
| Squaddie | Launch Grenade | (same) |
| Corporal | Blast Padding: +1 armor, 66% less explosive damage (GP) | Shredder: cannon shots shred armor |
| Sergeant | Demolition: destroys the target's cover without damage, 2 ammo, 3-turn cooldown | Suppression: target -50 aim, reaction fire if it moves, 2 ammo |
| Lieutenant | Heavy Ordnance: +1 use of the grenade-slot item | Holo Targeting: any cannon shot marks the target for +15 squad aim |
| Captain | Volatile Mix: grenades +1 radius, +2 damage | Chain Shot: -15 aim, second shot if the first hits, 2 ammo, 3-turn cooldown |
| Major | Salvo: launcher or heavy weapon as first action does not end the turn | Hail of Bullets: guaranteed hit, 3 ammo, 5-turn cooldown |
| Colonel | Saturation Fire: cone that hits every enemy and destroys cover, 3 ammo, 5-turn cooldown | Rupture: guaranteed crit, target takes +3 from all sources afterwards, 3 ammo, 3-turn cooldown |

### Specialist

Weapons: assault rifle, GREMLIN (see [weapons-and-gear.md](weapons-and-gear.md#gremlin-and-psi-amp)).

| Rank | Battle Medic branch | Combat Hacker branch |
| --- | --- | --- |
| Squaddie | Aid Protocol: defense bonus to an ally until your next turn (+20/30/40 by GREMLIN tier); Hack at range | (same) |
| Corporal | Medical Protocol: remote heal or stabilise, 1 charge plus 1 per medikit | Combat Protocol: guaranteed damage, more vs robots, 2 uses per mission (GP) |
| Sergeant | Revival Protocol: removes Disoriented, Stunned, Panicked or Unconscious | Haywire Protocol: take control of a robot |
| Lieutenant | Field Medic: medikits gain 2 charges (FX strategy text says 3 uses) | Scanning Protocol: reveals hidden enemies and widens sight for one turn |
| Captain | Covering Fire: overwatch triggers on any enemy action | Threat Assessment: Aid Protocol grants a Covering Fire overwatch, Aid cooldown +1 |
| Major | Ever Vigilant: auto overwatch if every action was a move | Guardian: 50% chance of another overwatch shot after a hit |
| Colonel | Restoration: heals or revives the squad, once per mission | Capacitor Discharge: area shock that may stun, extra vs robots, once per mission |

### Psi Operative

Weapons: assault rifle, Psi Amp. Ranks: Initiate, Acolyte, Adept, Disciple, Mystic, Warlock, Magus. No source gave psi ability numbers beyond Psi Amp damage.

| Rank | Telepath branch | Resonant branch |
| --- | --- | --- |
| Initiate | Soulfire: guaranteed psi damage to an organic, ignores cover and armor; Stasis: target stunned 1 turn and immune to damage | (same) |
| Acolyte | Insanity: chance of disorient, panic or mind control | Inspire: nearby ally gets an extra action |
| Adept | Soul Steal: Soulfire heals for half its damage | Stasis Shield: Stasis can target allies |
| Disciple | Solace: aura that blocks mental impairments | Sustain: once per mission, drop to 1 HP and enter stasis instead of dying |
| Mystic | Schism: Insanity adds small guaranteed damage and Rupture | Fortress: immune to fire, poison, acid and explosives |
| Warlock | Fuse: detonate an enemy's carried explosives | Domination: permanent mind control, one per mission |
| Magus | Null Lance: line beam hitting every target | Void Rift: large area damage with a chance of Insanity |

### SPARK (Shen's Last Gift DLC)

Weapons: autocannon, BIT. Ranks: Aspirant, Knight, Cavalier, Vanguard, Paladin, Champion.

| Rank | Future Combat branch | War Machine branch |
| --- | --- | --- |
| Base | Overdrive: 3 actions, none turn-ending, -15 aim per extra shot, every 4 turns (FD) | (same) |
| Aspirant | Bulwark: +1 armor, high cover for adjacent allies | Adaptive Aim: removes the Overdrive aim penalty |
| Knight | Rainmaker: heavy weapons +2 damage, +2 radius | Strike: melee 7/9/11 damage, 2 crit, every 4 turns (FD) |
| Cavalier | Intimidate: an attacker may panic | Wrecking Ball: smash cover and walls while moving in Overdrive |
| Vanguard | Repair: BIT heals a robotic ally | Bombard: BIT explosion (3-4/5-6/7-8, radius 3) |
| Paladin | Channeling Field: +1 damage on the next shot per time targeted | Hunter Protocol: 33% chance of an overwatch shot on newly revealed enemies |
| Champion | Sacrifice: redirects attacks on nearby allies to the SPARK | Nova: 6 damage around the SPARK, ignores armor, repeated use hurts the SPARK |

### Cooldowns and charges

From `XComGameData_SoldierSkills.ini` [INI]. The wikis quote one turn less for every ability where both exist (Run and Gun 4 vs 3, Kill Zone 4 vs 3, Lightning Hands 4 vs 3, Deadeye 3 vs 2), which fits a counter that includes the turn the ability was used. Treat the INI value as "turns until usable again, counting the current one".

| Class | Ability | INI value |
| --- | --- | --- |
| Ranger | Run and Gun | cooldown 4 |
| Ranger | Reaper | cooldown 5 |
| Ranger | Conceal | 1 charge |
| Ranger | Blademaster | +2 damage, +10 aim |
| Ranger | Rapid Fire | -15 aim per shot |
| Sharpshooter | Deadeye | cooldown 3; `DEADEYE_AIM_MULTIPLIER=0.25` (application not traced) |
| Sharpshooter | Lightning Hands | cooldown 4 |
| Sharpshooter | Kill Zone, Faceoff, Fan Fire | cooldown 4 each |
| Sharpshooter | Serial (In The Zone) | cooldown 5 |
| Sharpshooter | Aim | +20 |
| Grenadier | Demolition | cooldown 4, +10 aim |
| Grenadier | Chain Shot | cooldown 4, -15 aim |
| Grenadier | Rupture (Bullet Shred) | cooldown 4, `BULLET_SHRED=3` |
| Grenadier | Hail of Bullets, Saturation Fire | cooldown 6 each; Saturation Fire 5 tiles wide, 33% chance to destroy cover |
| Grenadier | Heavy Ordnance | +1 grenade |
| Specialist | Combat Protocol | 2 charges |
| Specialist | Revival Protocol, Scanning Protocol, Restoration, Capacitor Discharge | 1 charge each |
| Specialist | Haywire Protocol | cooldown 4 |
| Specialist | Field Medic | +2 medikit charges |
| Specialist | Restoration | radius 5, range 10 |
| Psi Operative | Soulfire, Insanity, Inspire | cooldown 4 each |
| Psi Operative | Stasis | cooldown 3 |
| Psi Operative | Domination | cooldown 5 |
| Psi Operative | Null Lance, Void Rift | cooldown 6 each; Void Rift radius 5, range 25, 50% Insanity |
| Psi Operative | Soul Steal | heals 0.5 × damage |
| Psi Operative | Schism | 3 ± 1 psi damage, rupture 2 |

### WotC hero classes

Ability rows per rank from `XComClassData.ini` [INI]; hero classes buy any unlocked ability with ability points, so a rank can offer three or four.

| Rank | Reaper | Skirmisher | Templar |
| --- | --- | --- | --- |
| Squaddie | Shadow, Claymore | Ripjack Strike, Justice, Grapple | Rend, Volt, Focus, Momentum |
| Corporal | Remote Start, Blood Trail | Reflex, Total Combat | Parry, Reverberation, Amplify |
| Sergeant | Target Definition, Shrapnel | Vengeance, Zero In | Overcharge, Pillar, Stunstrike |
| Lieutenant | Silent Killer, Distraction, Needle | Whiplash, Full Throttle | Deflect, Channel |
| Captain | Sting, Pale Horse | Combat Presence, Retribution, Interrupt | Reflect, Invert, Deep Focus |
| Major | Highlands, Soul Reaper | Ambush, Reckoning | Arc Wave, Exchange |
| Colonel | Homing Mine, Soul Harvester | Manual Override, Battlelord, Judgment | Ionic Storm, Void Conduit, Ghost |

FD lists their weapons and these ability numbers:

- Reaper: Vektor rifle, Claymore (does not break concealment). Shrapnel (+3 damage, +1 shred, +1 radius on Claymore), Highlands (+1 Claymore), Blood Trail (+1 damage vs a target wounded this turn), Needle (ignores 2 armor from Shadow), Soul Harvest (+5 crit per kill, max +20).
- Skirmisher: bullpup, Ripjack. Total Combat (bullpup, items and grenades as first action cost 1 AP), Zero In (+10 crit per extra shot in a turn, +10 aim vs the same enemy), Retribution (free Ripjack strike in melee range).
- Templar: gauntlets, autopistol. Focus raises Rend damage and mobility by 1 to 3 and dodge by 10/20/25. Amplify (+33% damage vs the marked target, min +2), Volt (+15 aim on the target afterwards).
