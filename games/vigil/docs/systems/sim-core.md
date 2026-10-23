---
created_by: Claude (claude-opus-5-5)
date: 2026-10-23
---

# Sim core: state, commands, events, turns

## Purpose

The sim core is the rules engine's spine. It holds the whole battle in one JSON-safe object (`BattleState`), accepts commands from the player and the AI, validates them, applies them, and reports what happened as a list of events. Keeping a single writer and a pure-data state makes battles deterministic, saveable, and testable in Node without a browser.

## Where it lives

| File | Role |
| --- | --- |
| `js/sim/state.js` | `BattleState` shape notes, `STATE_VERSION`, `PHASE`, `createUnit`, `livingUnits`, `unitAt`, `hasStatus`, `statValue` |
| `js/sim/executor.js` | `execute`, `validate`, `InvalidCommand`, hooks (`setHooks`, `resetHooks`, `getHooks`), `walkPath` |
| `js/sim/events.js` | `EVENT` names with payload comments, `createContext` |
| `js/sim/turns.js` | `beginDeploy`, `endSide`, `beginSide`, `check` (victory and defeat) |
| `js/sim/rng.js` | `seedState`, `next`, `nextInt`, `pick` (mulberry32 over `state.rngState`) |
| `js/sim/save.js` | `save`, `load`, `clear` against localStorage key `SAVE_KEY` |
| Tests | `tests/executor.test.mjs`, `tests/rng.test.mjs`, `tests/save.test.mjs` |

## BattleState

Built by `buildMission(seed, options)` in `sim/map-builder.js`:

```js
{
  version: STATE_VERSION, seed, rngState, turn, activeSide: 'xcom' | 'alien',
  phase: 'deploy' | 'playerTurn' | 'enemyTurn' | 'ended', outcome: null | 'victory' | 'defeat',
  grid: { width, depth, heights[], props[], edgeCover[] },   // see map-and-movement.md
  units: { [id]: Unit }, pods: [{ id, unitIds, alert, patrolRoute, patrolIndex }], squadConcealed,
}
```

A `Unit` (from `createUnit`) holds `id, team, defId, stats, tile, ap, hp, armor, shred, ammo, statuses, cooldowns, charges, utility, idleTurns`.

- `statuses` is `[{ id, turns, stat?, amount? }]`. `turns` counts the owner's side starts left; `null` means no timer. Read stat changes with `statValue(unit, stat)` and never write them into `unit.stats`.
- `cooldowns` is `{ abilityId: turns }`; a missing key means ready.
- `charges` is `{ abilityId: count }` for abilities with a `charges` field.

Phase flow: `deploy -> playerTurn <-> enemyTurn -> ended`.

## How to interact

**Issue a command.** All four command shapes go through `execute(state, cmd)`, which throws `InvalidCommand` (with a player-facing `reason`) before changing anything, or returns `Event[]`:

```js
{ type: 'deploy' }
{ type: 'move', unitId, dest }
{ type: 'ability', unitId, abilityId, targetId?, targetTile? }
{ type: 'endTurn', side? }
```

Use `validate(state, cmd)` for a side-effect-free `{ ok, reason }` (the HUD and input do this before arming a command). `execute(state, cmd, { autosave: false })` skips the save hook, which tests use.

After the handler runs, `execute` calls `check()` for victory or defeat, ends the xcom side automatically once no soldier has AP, and calls the save hook. The alien side only ends through an explicit `endTurn`, which `main.js` sends after the AI runs out of commands.

**Hooks.** The executor stays independent of the subsystems by calling them through hooks that `main.js` installs:

```js
setHooks({ detection: Detection, reactions: Reactions, abilities: { validate, use }, save: autosave });
```

| Hook | Called | Contract |
| --- | --- | --- |
| `detection.onStep(state, ctx, mover)` | after every step in `walkPath` | return `true` to stop the path |
| `detection.onNoise(state, ctx, tile)` | from `flushNoise` in effects | reveal pods that hear the tile |
| `reactions.onStep(state, ctx, mover)` | after detection on every step | return `true` to stop the path |
| `abilities.validate(state, cmd)` | inside `validate`/`execute` | `{ ok, reason? }`, no side effects |
| `abilities.use(state, ctx, cmd)` | ability command handler | runs only after validate passed |
| `save(state)` | end of every `execute` | persist or clear |

Defaults are no-ops (abilities reject with "Abilities are not implemented yet"). Tests call `resetHooks()` in `beforeEach` and install only what they need.

**Events.** Handlers report through `ctx.emit(EVENT.X, payload)`, where `ctx` comes from `createContext(state)`. `emit` throws on an unknown type. Payloads carry only ids, tiles and numbers so the view can replay them without the sim. The full list with payloads is the `EVENT` object in `js/sim/events.js`.

**Moving units outside a move command.** `walkPath(state, ctx, unit, path)` steps a unit along a path, firing detection and reaction hooks per step, without spending AP. Scamper and melee charges use it.

**Randomness.** Every random draw goes through `next(state)`, `nextInt(state, min, max)` or `pick(state, list)`, which advance `state.rngState`. A loaded save therefore continues the same sequence.

**Turns.** `beginSide` emits `TurnStarted` first, then for each living unit of that side: refreshes AP (`RULES.apPerTurn`, 0 when stunned), ticks statuses (overwatch and hunkered always clear), ticks cooldowns, and updates alien `idleTurns`.

**Saves.** `save()` writes JSON to localStorage; `load()` returns `null` for a missing, corrupt or wrong-version save and deletes a wrong-version one. Storage errors are swallowed.

## Extend

### Add a command

1. Add a handler to `HANDLERS` in `js/sim/executor.js`.
2. Add its validation to `rejectReason` (return a player-facing string, or `null` when valid). Validation must not write state.
3. Emit events for everything the view should show.
4. Document the shape in the executor's header comment and add tests to `tests/executor.test.mjs`.

Most new actions should be abilities instead (see [abilities-and-combat.md](abilities-and-combat.md#extend)), which reuse targeting, costs and the HUD automatically.

### Add an event

1. Add the name and a payload comment to `EVENT` in `js/sim/events.js`.
2. Emit it from the sim with `ctx.emit`.
3. Add a handler to `this._handlers` in `js/view/event-player.js` and an `async _onX(payload)` method. It must apply its end state even when `this.skipping` is true. Unknown events are logged and skipped, so the sim side can land first.

### Change BattleState's shape

1. Bump `STATE_VERSION` in `js/sim/state.js`. Older saves are then discarded on load, since there is no migration.
2. Update `buildMission` and `createUnit`, the header comment in `state.js`, and every test helper that builds a state by hand (search `tests/` for `version: STATE_VERSION`).
3. Keep the state JSON-safe: no `Infinity`, `Map`, `Set`, class instances or functions.

### Add a status

Apply it with the `applyStatus` or `modifyStat` effect. Add special turn behaviour in `beginSide` (`turns.js`), rules that read it (for example `hit.js` reads `hunkered`), and a short label in `STATUS_SHORT` in `js/view/hud.js`.
