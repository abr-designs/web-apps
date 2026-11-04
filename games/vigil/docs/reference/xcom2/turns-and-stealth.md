---
created_by: Claude (claude-opus-5-5)
date: 2026-10-22
---

# Turns, movement and stealth

Source tags are defined in [README.md](README.md#sources-and-tags).

## Turn structure and action points

- The player squad acts, then the aliens act; there is no initiative stat. [GP]
- Most units get 2 actions per turn. The usual pattern is move, then attack or use an item. [GP]
- Attacking ends the soldier's turn; moving with the first action leaves the second action free. EU2012 rules state it the same way: any non-move first action ends the turn. [GP, EU]
- Free or turn-preserving exceptions: Quickdraw (pistol first action), Salvo (grenade or heavy weapon first action), Total Combat (Skirmisher), Death From Above and Serial (kill refunds), Lightning Hands (0 AP pistol shot), Overdrive (SPARK, 3 actions), Darklance (1 AP shot), Hunter's Axe throw (0 AP). [FD, FX]
- Opening the hack screen and backing out costs no action. [GP]
- A regular shot that kills a Lost refunds its action (WotC). Explosives, melee and psi do not. [GP]

## Movement

- Blue area: a normal move that leaves the second action available. Yellow area: a dash that uses both actions and ends the turn. [GP]
- Mobility sets distance per action as ground covered, not a tile count, so a dash goes further than two separate moves. [FD]
- EU2012 used 1.625 mobility points per square; at XCOM 2's standard mobility of 12 that would be about 7 squares per move (derived, unverified for XCOM 2). [EU]
- Sprinting is described as making the unit harder to hit; no number given. [GP, unverified]
- Turn order is XCOM, aliens, the Lost, resistance, neutral (`PlayerTurnOrder`). [INI]
- Run and Gun (Ranger, cooldown 4 in INI, quoted as 3 turns by the wikis): act after dashing. Implacable: bonus move after a kill. Inspire (Psi): give a nearby ally one extra action. Lightning Strike: +3 mobility for the first two concealment turns (pre-release). [FX, UFO, GP]
- A drop is allowed when it is less than three elevation levels (EU2012). [EU]
- Mobility examples: soldiers and ADVENT Troopers 12, Stun Lancer 14, Viper 12/14/15/15, Gatekeeper 15/16/16/16. Armor modifies it (EXO and WAR Suit -2, Spider Suit +1, Wraith Suit +2). [UFO, FX]

## Concealment

- Most missions start with the squad concealed; Retaliation missions do not. Concealed units show a hooded icon and enemies cannot see them. [GP]
- Enemy detection range shows as red ground markers a few tiles out from each enemy; stepping on one reveals the whole squad. The markers are unreliable in dense cities and forests. [GP]
- Detection range = detector's detection radius × (1 − target's detection modifier). Detection radius is 12 for most enemies, 15 for Sectoids and Sectopods, 10 for turrets, 9 for soldiers. Units are likely meters (12 m = 8 tiles) but unconfirmed. Cover gives no detection modifier in WotC config (`HighCoverDetectionModifier=0`, `NoCoverDetectionModifier=0`). [INI, SRC]
- Sight radius is 27 m (18 tiles) for soldiers and every enemy listed. Squadsight shots take -2 aim per tile beyond it. [INI, SRC]
- The visible area around a patrolling pod is roughly that pod's movement range; staying outside it usually prevents detection on its next move. [UFO Concealment]
- A soldier can get within 1 to 2 tiles of an enemy if an obstacle blocks line of sight. An enemy moving next to a still soldier does not detect it. [GP, UFO]
- Breaks concealment: attacking or throwing a grenade, moving into a detection tile, being flanked by a patrolling enemy (which also grants that enemy a free shot), bursting through a door or window, a failed hack, breaking security on a key mission objective, civilians spotting the squad in cities. [UFO, GP]
- Does not break concealment: a successful hack, most non-offensive abilities, scanning, healing, Claymores (Reaper). [GP, FD]
- One soldier breaking concealment reveals everyone, except a Ranger with Phantom who was not the one spotted. [UFO, GP]
- Attacks from concealment skip the overwatch penalty, can crit, and cannot be dodged. Enemies have reduced hack defense while the squad is undetected. [UFO]
- Shadowstrike: +25 aim and +25 crit from concealment. Conceal (Ranger): re-enter concealment once per mission. Phantom also allows concealment on Retaliation missions. [UFO, FX, GP]
- Dark Event Vigilance enlarges enemy detection radius. [UFO]
- Breaking concealment does not alert every enemy on the map; distant pods may carry on. [GP]

## Ambush setup

- Spread the squad over elevated full-cover positions, put most on overwatch, and let one soldier open fire. [GP]
- A grenade opener hurts several enemies and strips their cover. Keep one soldier off overwatch to finish survivors. [GP]
- Attack from several sides so ambushed enemies cannot find cover. [GP]
- Avoid opening when another pod is nearby, because two or three pods can converge. [GP]

## Pods

- Enemies patrol in groups (pods) and activate when they spot the squad. Pod size and patrol logic are not covered. [GP]
- Scamper (the reveal move): paths are cut to at most 6 tiles and never shorter than 2 (`MAX_SURPRISED_SCAMPER_PATH_LENGTH`, `MIN_SURPRISED_SCAMPER_PATH_LENGTH`). Pod leaders weight full cover 2.5 times more when choosing where to go. `SURPRISED_SCAMPER_CHANCE=0`. [INI XComAI.ini]
- The AI ignores height differences under 3 tiles when scoring destinations for height advantage. [INI XComAI.ini]
- An enemy sitting in solid cover without attacking may be bait for a hidden pod; flanking it can reveal that pod. [GP]
- Rookie difficulty caps engaged enemies at 4; Veteran and Commander at 6; Legend has no cap. [UFO Difficulty]
- Approaching along a map edge reduces the chance of meeting new pods (no method given). [UFO Tactics]

## Hacking

- Any soldier can hack mission objects when adjacent. Specialists can hack more object types at range with the GREMLIN. Robotic enemies need Haywire Protocol. [GP, UFO]
- A hack costs one action and does not end the turn if it is the first action. [UFO]
- Success depends on the gap between the hacker's Hack stat and the target's Tech (security) stat. [UFO, GP]
- Each hack offers two rewards: an easier one and a harder, better one. Failure brings a penalty. [GP]

| Hack source | Bonus | Source |
| --- | --- | --- |
| Each promotion | +5 | GP |
| GREMLIN | +0 | GP, FD |
| GREMLIN Mk II | +20 | GP, FD |
| GREMLIN Mk III | +40 | GP, FD |
| Skulljack with Skullmining | +25 | GP, UFO |
| Rare permanent hack reward | +20 | GP |

- A maxed Specialist reaches about 160 to 180 Hack. Enemy Tech examples: ADVENT Trooper 125, MEC 50/50/70/70, Heavy MEC 80/80/90/90, Sectopod 125/125/150/150, Turret 35. [GP, UFO, FX]
- Rewards include: stat boosts, action point refunds, resources, scan time cuts, Run and Gun for the squad, sight range, re-concealment, disorienting all enemies for 2 rounds, halving enemy will, controlling a random enemy, permanent +20 Hack. [GP]
- Penalties include: reinforcements (a red flare, arriving next round), enemy stat boosts, nearby pods moving toward the squad, broken concealment. [GP]
- Haywire Protocol: the easier option stuns a robot for 2 rounds, the harder one takes control for a few rounds. Security Tower hacks disorient for 2 turns or control robots for 1 turn (pre-release). [GP, UFO]
- Skulljack: fixed 70% hit chance; a successful hit always kills. A miss deals 2 damage to the user and spends an action. Using it on a Codex outside its story objective summons an Avatar. [UFO, GP]

## Evac, loot and timers

- The evac zone is a 3 by 3 blue square. On non-fixed missions it can be called anywhere. Entering it grants a free evac action. [UFO]
- Loot must be picked up by hand and self-destructs after a turn countdown. Explosions and tile effects can destroy it; explosive kills drop none. [UFO, GP]
- Some missions have turn timers; no source gave lengths. Idling about five turns on overwatch is described as wasted time. [GP]
- Failed hacks call reinforcements that land the next round. The Alien Fortress final mission spawns groups from four portals nearly every round. [GP]
