---
created_by: Claude (claude-opus-5-5)
date: 2026-10-23
---

# Detection, reactions and enemy AI

## Purpose

These three systems make the aliens behave. Detection runs XCOM-style concealment: the squad starts hidden, aliens sit in unaware pods that patrol, and pods are revealed by sight or noise and then scamper to cover. Reactions run interrupts during movement, currently overwatch. The enemy AI picks alien commands one at a time, scoring tiles and attacks per profile. All three are deterministic and draw no RNG for decisions.

## Where it lives

| File | Role |
| --- | --- |
| `js/sim/detection.js` | `onStep`, `onNoise` (executor hooks), `breakConcealment`, `revealPod`, `scamperTile`, `engagedCount` |
| `js/sim/reactions.js` | `onStep` (executor hook): overwatch shots |
| `js/sim/ai.js` | `nextCommand`, `chooseAction`, `scoreTile`, `patrolStep`, `patrolTarget`, `distanceField`, `profileOf`, `AI_PROFILES`, `RESTLESS_TURNS` |
| `js/data/enemies.js` | each enemy's `ai` profile name and `stats.detection` radius |
| `js/data/rules.js` | `hearingRadius`, `engagedCap`, `overwatchAimMult` |
| Tests | `tests/detection.test.mjs`, `tests/reactions.test.mjs`, `tests/ai.test.mjs` |

## How it works

### Detection

- **Concealment** is squad-wide (`state.squadConcealed`). While concealed, an alien notices a soldier only inside its `stats.detection` radius with LOS. Any hostile soldier ability with `breaksConcealment` also breaks it (`breakConcealment`, emits `ConcealmentBroken`).
- **Pods** go `unaware -> revealed -> engaged`. Once concealment is broken, ordinary sight in either direction reveals a pod. Noise from shots and explosions reveals unaware pods within `RULES.hearingRadius`, nearest first, skipping pods that would push engaged aliens past `RULES.engagedCap` (sight reveals ignore the cap).
- **Scamper:** a revealed pod's members walk, in id order and for free, to their best cover tile inside the 1 AP band (`scamperTile`). They walk through `walkPath`, so overwatch can fire mid-scamper. Events: `PodRevealed`, `ScamperStarted`, then steps.

### Reactions

Overwatch fires once per overwatcher, on the first step that brings an enemy mover into its sight with LOS and weapon range, at `RULES.overwatchAimMult` aim, then clears. Overwatchers resolve in unit id order. A concealed soldier firing breaks concealment first. The shot uses `standardShot` from `sim/abilities.js`, which spends ammo and nothing else. Returning `true` from `onStep` stops the mover's path.

### Enemy AI

`nextCommand(state)` walks aliens in id order and returns the first valid command, or `null` when nobody can usefully act. `main.js` plays each command and asks again, then sends `endTurn`. Every returned command spends at least 1 AP, so the loop always ends.

- **Unaware pods patrol:** one 1 AP move per member per turn. The first living member heads for the turn's waypoint on `pod.patrolRoute`; the rest follow within 2 tiles.
- **Engaged aliens** use `chooseAction` with their profile from `AI_PROFILES` (`rifleman`, `melee`, `caster`). Candidate order: melee attack or close in (melee profile), reposition with 2 AP when the best tile beats staying put, ranged attacks above `minHit`, reload when empty, overwatch, 1 AP reposition, reload when not full.
- **Tile score:** `cover*w1 + bestShotChance*w2 + flankThreat*w3 - exposure*w4`, each term roughly 0..1 per soldier. Melee profiles score closeness in place of shot chance.
- **Attack value:** expected damage plus `KILL_BONUS`, `STATUS_BONUS` and `DEBUFF_VALUE` bonuses.
- **Aggression ramp:** an engaged alien whose `idleTurns` reaches `RESTLESS_TURNS` (3) stops overwatching, takes any attack above 0%, and closes on the nearest soldier.
- Engaged aliens know every soldier's position (no alien-side fog).

## How to interact

```js
import * as Ai from './sim/ai.js';
const cmd = Ai.nextCommand(state);          // null when the alien side is done
Ai.scoreTile(state, unit, tile);            // debug a positioning choice
Ai.chooseAction(state, unit, AI_PROFILES.melee);  // try another profile
```

In the browser, `vigil.state.pods` shows each pod's alert level. Detection overlays (red detection radii) are drawn by `renderer.showDetection` while the squad is concealed.

## Extend

### Add an AI profile

1. Add weights and `minHit` to `AI_PROFILES` in `js/sim/ai.js`.
2. Set `ai: '<profile>'` on an enemy in `js/data/enemies.js`.
3. If the profile needs different candidate ordering, branch on the profile name in `chooseAction`, as `melee` does.
4. Add a test in `tests/ai.test.mjs` that pins the chosen command for a small hand-built state.

### Add a reaction

Add the check to `onStep` in `js/sim/reactions.js` after overwatch, in unit id order, and return `true` when the mover died or was displaced. Emit an event for the view (add one per [sim-core.md](sim-core.md#add-an-event) if needed). Add a status if the reaction is armed in advance, like `overwatch`.

### Tune detection

Change `stats.detection` per enemy, or `hearingRadius` and `engagedCap` in `js/data/rules.js`. Scamper preference lives in `scamperTile` (`detection.js`).
