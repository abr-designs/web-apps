---
created_by: Claude (claude-opus-5-5)
date: 2026-10-23
---

# Vigil systems

Vigil is a turn-based squad tactics game in plain ES modules with three.js r160 (vendored in `vendor/`) and no build step. These docs describe each implemented system: what it does, where it lives, how to call it, and how to extend it. Read this page first, then open the one system doc your task touches.

## Architecture in one picture

```
data/ (frozen tables)  ->  sim/ (pure rules, owns BattleState)  ->  Event[]  ->  view/ (three.js + DOM)
                                   ^                                              |
                                   +------------- command objects <---------------+
                                                  (InputController, EnemyAI)
```

- `js/data/` holds every tunable number and definition. Nothing in it runs logic.
- `js/sim/` holds the rules. It never touches the DOM or three.js, runs in Node, and is fully deterministic from `state.rngState`.
- `js/view/` draws the state and turns pointer and key input into commands. It never writes `BattleState`.
- `js/main.js` wires the two halves together and runs the mission loop.

The one rule that holds everything together: **only `execute(state, cmd)` in `js/sim/executor.js` writes `BattleState`**, and it returns an `Event[]` that the view plays back.

## System docs

| Doc | Covers | Main files |
| --- | --- | --- |
| [sim-core.md](sim-core.md) | BattleState, commands, the executor and its hooks, events, turns, RNG, autosave | `sim/state.js`, `sim/executor.js`, `sim/events.js`, `sim/turns.js`, `sim/rng.js`, `sim/save.js` |
| [abilities-and-combat.md](abilities-and-combat.md) | Ability definitions, targeting, effects, hit chance, damage, armor, explosions | `data/abilities.js`, `sim/abilities.js`, `sim/effects.js`, `sim/hit.js`, `sim/combat.js`, `data/weapons.js`, `data/rules.js` |
| [map-and-movement.md](map-and-movement.md) | Grid, props, parcels, mission generation, pathfinding, cover, line of sight | `sim/grid.js`, `sim/map-builder.js`, `sim/pathfinder.js`, `sim/cover.js`, `sim/visibility.js`, `data/parcels.js`, `data/props.js` |
| [detection-reactions-ai.md](detection-reactions-ai.md) | Concealment, pods, scamper, overwatch, enemy AI | `sim/detection.js`, `sim/reactions.js`, `sim/ai.js`, `data/enemies.js` |
| [units-and-loadout.md](units-and-loadout.md) | Soldier classes, enemy types, loadout rules, roster names and colours, loadout screen | `data/classes.js`, `data/enemies.js`, `sim/loadout.js`, `view/roster.js`, `view/loadout-screen.js` |
| [view-and-input.md](view-and-input.md) | Mission loop, renderer, camera, picker, fog, event playback, HUD, input modes | `main.js`, `view/renderer.js`, `view/camera.js`, `view/picker.js`, `view/fog.js`, `view/event-player.js`, `view/hud.js`, `view/input.js` |
| [unit-models.md](unit-models.md) | Rigged character models, gear, animation clips, tints | `data/looks.js`, `view/assets.js`, `view/unit-model.js`, `assets/models/` |

## Find the file for a task

| Task | Start in |
| --- | --- |
| Change a number (aim, damage, cover bonus, AP) | `js/data/rules.js`, `js/data/weapons.js`, `js/data/classes.js`, `js/data/enemies.js` |
| Add or change an ability | [abilities-and-combat.md](abilities-and-combat.md#extend) |
| Add a soldier class or enemy | [units-and-loadout.md](units-and-loadout.md#extend) |
| Add a new kind of event the view animates | [sim-core.md](sim-core.md#add-an-event) |
| Add a new command type | [sim-core.md](sim-core.md#add-a-command) |
| Change how aliens decide | [detection-reactions-ai.md](detection-reactions-ai.md#enemy-ai) |
| Add map pieces or props | [map-and-movement.md](map-and-movement.md#extend) |
| Change what a click or key does | [view-and-input.md](view-and-input.md#input) |
| Change a unit's model, gear or animation | [unit-models.md](unit-models.md#extend) |
| Change colours | CSS tokens on `:root` in `style.css`; the renderer reads them through `readPalette()` |

## Conventions every system follows

- **Ids:** soldiers are `x1`..`x4`, aliens `a01`.., pods `p1`... Sorting ids gives turn order, so sim loops iterate `Object.keys(state.units).sort()` or `livingUnits()`.
- **Tiles** are integer indices, `tile = z * width + x`, x east, z south. World space uses 1 unit per tile; see [map-and-movement.md](map-and-movement.md).
- **Determinism:** the sim draws randomness only through `sim/rng.js`, and ties always break on fixed keys (cost, then tile index or unit id). Never call `Math.random()` in `js/sim/`.
- **Data tables are deep-frozen** with `deepFreeze` from `data/freeze.js`. Copy a value before changing it at runtime.
- **Player-facing reasons:** validation returns short sentences such as `'No actions left'`, shown directly in the HUD.
- **Plans:** each feature has a design plan in `docs/plans/NNNN-*.md`. Code comments cite them ("plan 0003 Layout B"). The code is the source of truth when they disagree.
- **XCOM 2 reference numbers** live in `docs/reference/xcom2/`; nothing there is wired into the game.

## Run, test, inspect

- Serve the repo root with any static server (`npx http-server . -p 8087 -c-1` from the repo root) and open `/games/vigil/`.
- Tests: `node --test "games/vigil/tests/*.test.mjs"` from the repo root. Each sim module has a matching `tests/<module>.test.mjs`. Tests build small hand-made states (see `setup()` in `tests/executor.test.mjs`) rather than generated maps.
- `tests/data.test.mjs` validates every data table and lists the allowed targeting kinds and effect types; extend those lists when you add one.
- In the browser console, `window.vigil` exposes `state`, `renderer`, `rig`, `picker`, `player`, `hud`, `input`, `fog`, `roster`, `loadoutScreen`, `assets`, `runCommand(cmd)` and `newMission()`. Example: `vigil.runCommand({ type: 'move', unitId: 'x1', dest: 50 })`.
- Binary assets (`*.glb`, `*.png`) are stored in Git LFS. Run `git lfs install` once per clone.
