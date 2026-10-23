---
created_by: Claude (claude-opus-5-5)
date: 2026-10-23
---

# Units, loadout and roster

## Purpose

Soldier classes and enemy types are data templates that `createUnit` turns into units. Before each mission the loadout screen lets the player give each soldier one utility item (Frag Grenade or Rocket). The roster remembers each squad slot's name and item across missions, and supplies each slot's colour. Roster and loadout are view-side preferences; the battle only sees the resulting `unit.utility`.

## Where it lives

| File | Role |
| --- | --- |
| `js/data/classes.js` | `CLASSES`: ranger, sharpshooter, grenadier, specialist (stats, weapon, abilities) |
| `js/data/enemies.js` | `ENEMIES`: trooper, officer, stunLancer, sectoid (stats incl. `detection`, weapon, abilities, `ai`) |
| `js/data/rules.js` | `RULES.loadout`: `items`, per-squad `caps`, `defaultItem` |
| `js/sim/loadout.js` | `SQUAD_SLOTS`, `defaultLoadout`, `normalizeLoadout`, `itemAllowed` (pure) |
| `js/sim/map-builder.js` | `DEFAULT_SQUAD` (slot order of classes), `DEFAULT_ENEMY_POOL` |
| `js/view/roster.js` | `Roster`: names, utility per slot, slot colours; localStorage key `ROSTER_KEY` |
| `js/view/loadout-screen.js` | `LoadoutScreen`: pre-mission overlay in `#loadout` |
| Tests | `tests/loadout.test.mjs`, `tests/roster.test.mjs`, `tests/data.test.mjs` |

## How it works

- A loadout is `{ x1: itemId, x2: ..., x3: ..., x4: ... }`. `normalizeLoadout` replaces unknown items with `defaultItem` and enforces caps in slot order (one Rocket per squad, which slot `x3` holds by default).
- `buildMission(seed, { loadout })` passes each slot's item to `createUnit` as `unit.utility`. `abilitiesFor` merges class abilities and utility, so loadout items behave like any ability.
- Flow in `main.js`: a new mission builds the map and opens `LoadoutScreen` over it with input locked. Launch saves the draft to the Roster, rebuilds the same seed with the chosen loadout, and deploys. There is no cancel.
- `Roster` stores `{ name, utility }` per slot. Names start as random picks from `NAME_POOL`, are capped at `NAME_MAX`, and can be renamed by clicking the rail name plate. Colours come from CSS tokens `--slot-1`..`--slot-4` in `style.css`.
- Aliens have no roster entry; the HUD names them by their `ENEMIES` name.

## How to interact

```js
vigil.roster.loadout();              // { x1: 'fragGrenade', ..., x3: 'rocket', ... }
vigil.roster.nameOf(unit);           // display name
vigil.roster.colorOf(unit);          // slot colour hex, null for aliens
itemAllowed(loadout, 'x2', 'rocket');  // false while x3 holds the only rocket
```

## Extend

### Add a soldier class

1. Add it to `CLASSES` in `js/data/classes.js` (copy an existing entry's stat keys).
2. Put it in the squad: change `DEFAULT_SQUAD` in `js/sim/map-builder.js` (one entry per `SQUAD_SLOTS` slot).
3. Add a look in `UNIT_LOOKS` (`js/data/looks.js`, see [unit-models.md](unit-models.md#extend)) and a rail icon in `CLASS_ICON` (`js/view/hud.js`).
4. Update the class list asserted in `tests/data.test.mjs`.

### Add an enemy type

1. Add it to `ENEMIES` in `js/data/enemies.js` with an `ai` profile name and `stats.detection`.
2. Add it to `DEFAULT_ENEMY_POOL` in `js/sim/map-builder.js` (repeat an id to weight it).
3. Add a look in `UNIT_LOOKS`; unknown ids fall back to the trooper look.
4. Update the enemy list asserted in `tests/data.test.mjs`.

### Add a loadout item

1. Define the ability in `js/data/abilities.js` (usually with `charges`).
2. Add its id to `RULES.loadout.items`, and to `RULES.loadout.caps` when the squad may carry only a few.
3. The loadout screen renders a button per item automatically; add a `ABILITY_ICON` entry in `js/view/hud.js` if the default icon does not fit.

### Change squad size

`SQUAD_SLOTS` (`sim/loadout.js`), `DEFAULT_SQUAD`, the `S` markers in spawn parcels, the `--slot-N` tokens and `FALLBACK_COLORS` in `roster.js` all assume 4. Change them together.
