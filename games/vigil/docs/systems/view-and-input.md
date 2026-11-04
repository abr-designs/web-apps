---
created_by: Claude (claude-opus-5-5)
date: 2026-10-23
---

# View and input

## Purpose

The view draws the battle in three.js, plays sim events back as animation, shows the HUD, and turns pointer and key input into commands. It reads `BattleState` but never writes it; every change goes through `execute`. `main.js` owns the mission loop that connects input, the sim, playback and the AI.

## Where it lives

| File | Class or role |
| --- | --- |
| `js/main.js` | Bootstrap and mission loop: `runCommand`, `runEnemyTurn`, `openLoadout`, `startBattle`, `frame`, `window.vigil` |
| `js/view/renderer.js` | `Renderer`: scene from the grid, units, props, overlays (move range, path, cover shields, detection, target line, fog, selection) |
| `js/view/camera.js` | `CameraRig`: pitched orbit camera, quarter-turn yaw, pan, zoom, `focusTile`, press and drag gestures; focus, yaw and zoom follow their targets through `smoothDamp` |
| `js/view/picker.js` | `Picker`: screen point to `{ unitId }` or `{ tile }` |
| `js/view/fog.js` | `Fog`: which tiles are lit and which aliens are shown |
| `js/view/event-player.js` | `EventPlayer`: animates `Event[]` in order, with speed and skip |
| `js/view/hud.js` | `Hud`: DOM rail, squad bar, banners, breakdown, confirm bar, unit bars, outcome |
| `js/view/input.js` | `InputController`: input mode state machine |
| `index.html`, `style.css` | DOM containers the HUD fills; palette tokens on `:root` |
| Tests | `tests/event-player.test.mjs` (fake DOM and renderer); the rest of the view is checked in the browser |

## Mission loop

```
input click -> InputController -> validate -> onCommand(cmd) = runCommand
runCommand: execute(state, cmd) -> input.lock() -> player.play(events) -> refresh HUD
            -> if phase is enemyTurn: runEnemyTurn (Ai.nextCommand until null, then endTurn, at speed 3)
            -> fog.refresh + input.unlock()
```

`missionId` increments on every new mission; async steps check it so a command still playing from an old mission stops touching the page. A rejected command shows its reason through `hud.showMessage` and changes nothing.

## Rendering

- World scale: 1 unit per tile horizontally, `HEIGHT_STEP` (0.5) per height level. Tile `i` spans `[x, x+1] x [z, z+1]`. `renderer.tileCenter(tile)` gives the standing point on top of the terrain.
- `renderer.build(state, { assets })` rebuilds the scene. With `assets` each unit gets a `UnitModel` (see [unit-models.md](unit-models.md)); without, a capsule. Both have a team ring.
- Overlays are separate layers cleared with `clearOverlays()`: `showMoveRange(reach)`, `showPath(tiles)`, `showCoverShields(state, tile, flanked)`, `showDetection(state)`, `showTargetLine(from, to)`, `showFog(visibleTiles)`, `setSelected(unitId)`.
- Colours come from CSS tokens through `readPalette()` (`--accent`, `--xcom`, `--alien`, `--move-blue`, ...), with `FALLBACK_PALETTE` when the stylesheet is missing.

## Event playback

`player.play(events)` queues a batch and resolves when it has finished. Each event type has an `_onX` handler that tweens, flashes, shows flyover text, and calls the HUD. `setSpeed(n)` scales time (enemy turns run at 3); `skip()` (Space) finishes everything instantly while still applying end states. During playback the player holds each unit's drawn HP and tile, which the HUD bars and fog read through `player.shownHp`, `player.shownTile` and the `Fog.refresh` callbacks, so bars and fog follow the animation instead of the already-final state.

## Fog

XCOM 2 style: terrain and props are always drawn, tiles outside squad sight are dimmed, and aliens no soldier can see are hidden. No memory of explored tiles. `fog.shows(unit)` is the single check for whether to draw or list a unit; the HUD and input use it so previews never leak hidden aliens.

## Input

Modes in `js/view/input.js`, each `{ enter, exit, pointerMove, click, key }`:

| Mode | Meaning |
| --- | --- |
| `idle` | nothing selected |
| `unitSelected` | soldier selected, move range shown |
| `movePreview` | hovering or armed on a destination tile |
| `targeting` | an ability is armed; cycling targets |
| `animating` | the player's own command is playing |
| `locked` | enemy turn, loadout screen or battle over |

Clicks arm a tile or target and show the confirm bar; the confirm button, Enter, or the same ability key executes. Keys: Tab / Shift+Tab next soldier or target, 1-9 abilities, Enter confirm, Esc or right-click back, Backspace end turn, Forfeit (rail footer, click twice) abandons the mission, Q / E rotate, WASD or mouse at a screen edge pan, wheel zoom, Space skip.

Press and drag (`CameraRig`): one finger or the left mouse button drags the map, two fingers twist to rotate and pinch to zoom, the middle button rotates. A rotation snaps to the nearest quarter turn on release. A press that travels under 8 px stays a tap, so a tap selects a soldier, arms a tile or picks a target like a click; a press that became a drag (`rig.dragged`) sends no click. Touch has no hover, so on touch the tap is the only pointer input the modes see. The camera follows a walking unit without jumps (the step tween moves the focus target and SmoothDamp keeps the velocity) and returns to the selected soldier when an enemy turn ends.

## HUD

The HUD panels (rail, squad, banners, objective, confirm bar, loadout and outcome cards) scale with CSS `zoom: var(--ui)`. `scaleUi` in `main.js` sets `--ui` on resize: the HUD is laid out for a 1280 x 760 window and shrinks to fit smaller ones, down to 0.55, or 0.75 on a coarse (touch) pointer, whose screens pack more CSS px per inch. The viewport's right inset is `--rail * --ui`. Touch screens also hide the key hints.

`Hud` only draws and reports clicks through `onAbility`, `onEndTurn`, `onForfeit`, `onSelectUnit` and `onRename`. Main entry points: `showUnit(state, unit, abilities)`, `showSquad`, `showObjective`, `showBreakdown(breakdown)` (from `compute`), `showConfirm(label, onConfirm)`, `updateUnitBars` (every frame), `showTurn`, `showConcealed`, `showMessage`, `showOutcome`. Line icons are an inline SVG sprite in `hud.js` mapped by `ABILITY_ICON`, `CLASS_ICON` and `STATUS_SHORT`.

## Extend

- **New event animation:** add the handler pair in `EventPlayer` (see [sim-core.md](sim-core.md#add-an-event)). Use `this._tween`, `this._wait`, `this._flyUnit`, `this._burst` and `this._focus`; check `this.skipping` before creating transient effects, and always apply the end state.
- **New overlay:** add a `showX` method on `Renderer` drawing into its own layer through `_clearLayer` and `_addQuads`, and call it from the relevant input mode's `enter` or `show`.
- **New input behaviour:** add or edit a mode object in `input.js` and register it in `MODES` (and in `INTERACTIVE` if it accepts clicks). Switch modes with `ic.setMode(name, data)`. Issue commands only through `ic.issue(cmd)`, which validates first.
- **New HUD panel:** add a container to `index.html`, style it in `style.css` with the palette tokens, and add a `showX` method to `Hud`. New UI follows the design workflow in the repo's CLAUDE.md (layout and palette options first), with mockups kept in `docs/mockups/`.
- **Every page keeps the shared logo** (`logo/logo.css` and `logo/senor_claude.png` in `index.html`); CI checks it with `node scripts/sync-logo.mjs --check`.
