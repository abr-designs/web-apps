---
created_by: Claude (claude-opus-5-5)
date: 2026-10-23
---

# Unit models

## Purpose

Units are drawn as rigged, animated KayKit characters with weapons in hand, tinted by team and squad slot, so each class and enemy reads at a glance. Every asset name is mapped in one data file, so swapping the art pack means editing `looks.js` alone. When the models fail to load, the game falls back to capsules and stays playable. Design decisions are in `docs/plans/0004-character-visuals.md`.

## Where it lives

| File | Role |
| --- | --- |
| `js/data/looks.js` | `CLIPS` (logical to asset clip names), `SOCKETS` (logical to bone names), `MATERIAL_ROLES`, `MODEL_FILES`, `CODE_GEAR`, `UNIT_LOOKS`, `lookFor`, `clipName` |
| `js/view/assets.js` | `AssetLibrary`: loads every glb once; `cloneRig(model)`, `cloneGear(id)`, `clip(name, model)` |
| `js/view/unit-model.js` | `UnitModel`: one unit's skinned clone, gear, tints, mixer, facing; code-built gear meshes at the bottom |
| `js/view/renderer.js` | `_addUnit` creates a `UnitModel` per unit; `unitModel(id)`, `setUnitColor`, `update(dt)` advances mixers |
| `js/view/event-player.js` | Drives clips from events: `SHOT_CLIPS`, `BLAST_CLIPS`, `_playClip`, `_refreshPose` |
| `assets/models/` | `clips.glb` (shared animations), character glbs, `gear/*.glb`, `CREDITS.md` (licences) |
| Tests | `tests/looks.test.mjs` (data and files), `tests/event-player.test.mjs` (clip wiring with fake models) |

## How it works

- All models share the KayKit `Rig_Medium` skeleton, so every character plays the clips in `clips.glb`.
- A **look** (`UNIT_LOOKS[defId]`) is `{ model, scale, clips?, tints, gear }`. `model` names a `MODEL_FILES.characters` key. `clips` overrides logical clips for that look (skeletons use their own idle and walk). `tints` map material roles (`body`, `trim`, `visor`) to palette keys; a soldier's `trim` becomes its roster slot colour.
- **Gear** entries mount on a socket bone with an optional offset and rotation (model units, before scale). `asset` loads a glb from `MODEL_FILES.gear`; `mesh` builds a primitive from `CODE_GEAR` in `unit-model.js`. `muzzle: true` marks the piece tracers leave from.
- **Animation slots** in `UnitModel`: a looping base pose from statuses (`idle`, `aim` on overwatch, `crouch` when hunkered), a walk loop while stepping, and one one-shot slot (`fire`, `hit`, `throw`, `death`, ...) that returns to walk or base. Death clamps on its last frame. Missing clips fall back through `FALLBACK` (for example `throw` to `fire`).
- **Event wiring:** steps call `face` and `walk`, then `settle`; shots face the target and play `SHOT_CLIPS[abilityId] ?? 'fire'`; ability explosions play `BLAST_CLIPS[abilityId] ?? 'fire'` on the source; damage plays `hit`; kills play `death`; status events and each batch end call `setBasePose`. Hidden units turn instantly and play nothing.
- The renderer advances mixers by `dt * player.speed` during playback, so clips keep pace with fast enemy turns.

## How to interact

```js
const model = vigil.renderer.unitModel('x1');  // UnitModel or null (capsule mode)
model.play('throw');                            // one-shot by logical name
model.face(vigil.renderer.tileCenter(200));
model.setBasePose([{ id: 'hunkered' }]);
vigil.assets.clip('Throw');                     // raw AnimationClip
```

## Extend

### Change a unit's look or gear

Edit its `UNIT_LOOKS` entry in `js/data/looks.js`. `tests/looks.test.mjs` checks that models, sockets, gear and clips exist. Remember the mannequin has no `handslot.r` bone, so squad gear mounts on `handR` with the `HAND_SLOT` offset.

### Add a model or gear file

1. Put the glb under `assets/models/` (or `assets/models/gear/`). It is tracked by Git LFS through the repo's `.gitattributes`.
2. Add it to `MODEL_FILES` in `js/data/looks.js` and reference it from a look.
3. Add its source and licence to `assets/models/CREDITS.md`.
4. If its materials use other names, add them to `MATERIAL_ROLES`. A new skeleton needs its clips in `clips.glb` or a `clips` override per look.

### Add a code-built gear mesh

Add a builder at the bottom of `js/view/unit-model.js`, register the id in `CODE_GEAR` (`looks.js`), and add it to `GUNS` when it should point along the hand slot like a firearm.

### Add or remap an animation

1. Map a logical name to the asset clip in `CLIPS` (`looks.js`), or override it per look in `clips`.
2. Add a fallback in `FALLBACK` (`unit-model.js`) if some looks lack it.
3. Trigger it: per ability in `SHOT_CLIPS` or `BLAST_CLIPS` (`event-player.js`), or from a new event handler with `this._playClip(model, name)`.
4. Add a case to `tests/event-player.test.mjs`.
