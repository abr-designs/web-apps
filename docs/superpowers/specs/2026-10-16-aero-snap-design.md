# Aero Snap Design

Created by Claude (claude-opus-5-5), 2026-10-16

## Goal

A cozy third-person photography game in a Frutiger Aero / Y2K world. The player walks a floating island over the shoulder of their character, photographs critters and landmarks to fulfil photo requests, and collects the results in a scrapbook. There is no fail state; the reward is a full, personal scrapbook.

Success criteria:

- The island loads and runs at 60 fps on a mid-range laptop in a current desktop browser.
- The player can walk, aim the camera over the shoulder, zoom, and take a photo with keyboard and mouse.
- Each of the 10 requests can be completed, and each photo is graded 1 to 3 stars by visible rules.
- Completed requests fill their scrapbook slots, the player can add stickers and captions, and all of it survives a page reload.
- Finishing all 10 requests unlocks the ending page.

## Decisions

| Topic | Decision |
|-------|----------|
| Slug | `apps/aero-snap/` (working title "Aero Snap") |
| Scope | One floating island, about 120 m across |
| Platform | Desktop, keyboard and mouse. Touch and gamepad are out of scope. |
| Stack | Plain HTML, CSS and ES modules. Three.js loaded through an import map from jsdelivr at a pinned version, including its `examples/jsm` addons. No build step, no npm dependencies. |
| Art | Built in code from Three.js primitives with shared glossy, glass and chrome materials. No model or texture files. |
| Palette | A, Aero daylight (below) |
| HUD | Layout 3, pocket gadget (below) |
| Grading | A photo passes a request when the subject is in frame. It also earns 1 to 3 stars. |
| Scrapbook | Auto-filled request slots plus draggable stickers and short captions |
| Storage | Photos in IndexedDB, progress and scrapbook layout in localStorage |

### Palette: Aero daylight

| Role | Hex |
|------|-----|
| Sky top | `#1E6FE8` |
| Sky horizon | `#8FD3FF` |
| Chrome, UI panels | `#F4F8FB` |
| Glass | `#BFF3FF` |
| Grass, lime trim | `#7ED957` |
| Accent, water | `#00B8D9` |
| Highlight, shutter | `#FF6B6B` |
| UI text | `#0B2A4A` |

### HUD: pocket gadget

- Exploring shows a clean screen with only a compass strip at top center naming the nearest landmark in view direction.
- `Tab` flips up a Y2K handheld from the bottom left. It shows the request list with check marks and stars, the film counter, and buttons for the list and the scrapbook. The game keeps running behind it; the mouse is released while it is open.
- Aiming (hold right mouse) shows viewfinder corners, a center reticle and a zoom readout.
- The shared logo sits in its standard bottom-right placement. No fixed bottom bar exists, so `--logo-floor` stays at its default.

## Controls

| Input | Action |
|-------|--------|
| `W` `A` `S` `D` | Move relative to camera |
| Mouse | Orbit camera (pointer lock) |
| `Space` | Jump |
| `Shift` | Walk slowly |
| Right mouse (hold) | Aim: camera moves in over the right shoulder, FOV narrows |
| Mouse wheel while aiming | Zoom lens, 1x to 4x |
| Left mouse while aiming | Take photo |
| `Tab` | Toggle gadget |
| `B` | Open scrapbook |
| `Esc` | Close gadget or scrapbook, release pointer |

## Architecture

```
apps/aero-snap/
  app.json
  index.html          import map, canvas, HUD and scrapbook DOM, logo lines
  css/style.css
  js/
    main.js           boot, renderer, post-processing, game loop, state machine
    palette.js        palette constants
    world/
      materials.js    shared glossy, glass, chrome, grass, water materials
      sky.js          gradient sky dome, clouds, sun, day cycle
      island.js       island mesh, heightmap sampler, lagoon, paths, instanced grass
      landmarks.js    rocket sign, diner, tower, fountain, hover car, specials sign
    critters/
      critter.js      shared behavior state machine (wander, idle, special)
      bubble-fish.js, chrome-sparrow.js, jelly-drone.js, cloud-sheep.js
    player/
      controller.js   movement, jump, ground and edge collision
      camera-rig.js   shoulder orbit camera, aim transition, zoom
    photo/
      capture.js      offscreen render to JPEG blob
      analyze.js      per-subject visibility, size, centering, current action
    requests.js       request definitions, matching and star grading (pure)
    save.js           IndexedDB photo store, localStorage progress
    ui/
      gadget.js       handheld HUD
      polaroid.js     post-snap result card, keep new / keep old prompt
      scrapbook.js    pages, slots, stickers, captions
  tests/
    requests.test.js
    analyze.test.js
```

`tests/` is excluded from the Pages build by the existing site script.

### Game states

`main.js` holds one state value: `explore`, `aim`, `gadget`, `scrapbook`. Input routing depends on state: `explore` and `aim` drive the player and camera, `gadget` and `scrapbook` release the pointer and route input to the DOM. The world and critters keep updating in every state except `scrapbook`, which pauses the simulation.

### Subjects

Every photographable thing registers a subject record:

```js
{ id: 'rocket-sign', kind: 'landmark', object3d, samplePoints: Vector3[], getAction: () => null | 'leaping' | ... }
```

`samplePoints` are 8 to 12 local-space points spread over the subject's surface, used for visibility rays. Critters return their current special action from `getAction()`; landmarks return `null`.

## Island content

The island is a single floating disc with a lagoon, a central plaza and grassy terraces, surrounded by sky and drifting clouds. Edges have a low chrome rail; the player cannot fall off. A day cycle loops every 8 minutes through day (5 min), golden hour (1.5 min) and dusk (1.5 min). `sky.js` exposes the current phase.

### Landmarks

| Id | Description |
|----|-------------|
| `rocket-sign` | Retro rocket on a pole above the diner |
| `diner` | Glass-bubble diner with a red front door (`diner-door` sub-subject) |
| `tower` | Glass tower with lime trim |
| `fountain` | Plaza fountain with animated water arcs |
| `hover-car` | Chrome hover car bobbing beside the diner |
| `specials-sign` | Rounded menu sign on a post |

### Critters

| Id | Count | Behavior | Special action |
|----|-------|----------|----------------|
| `bubble-fish` | 3 | Swims in the lagoon | `leaping`: arcs out of the water, about every 20 to 40 s each |
| `chrome-sparrow` | 3 | Hops along rails and paths | `perched-rocket`: flies to the rocket and stays 10 s, about every 60 s each |
| `jelly-drone` | 2 | Floats above the terraces | `glowing`: pulses light, only during dusk |
| `cloud-sheep` | 3 | Grazes on terraces | `sleeping`: curls up for 20 s, about every 45 s each |

Critters flee gently (speed up away) when the player runs within 3 m, and ignore a player who is walking slowly or aiming. This gives a reason to approach carefully.

## Requests

| # | Request | Match rule |
|---|---------|------------|
| 1 | The rocket sign | `rocket-sign` visible |
| 2 | The diner's front door | `diner-door` visible |
| 3 | Fountain and tower together | `fountain` and `tower` both visible |
| 4 | A bubble fish leaping | `bubble-fish` visible with action `leaping` |
| 5 | A sparrow on the rocket | `chrome-sparrow` visible with action `perched-rocket` |
| 6 | A glowing jelly drone | `jelly-drone` visible with action `glowing` |
| 7 | A sleeping cloud sheep | `cloud-sheep` visible with action `sleeping` |
| 8 | The diner at golden hour | `diner` visible and day phase `golden` |
| 9 | Two critters in one photo | any 2 critter subjects visible |
| 10 | Your favorite shot | any photo the player picks; graded at 3 stars by design |

Request 10 is completed from the scrapbook by choosing a cover photo from the camera roll.

## Photo pipeline

1. **Capture.** On left click while aiming, `capture.js` renders the scene from the aim camera into a 640×360 render target, reads it to a canvas and encodes a JPEG blob at quality 0.85. A shutter flash and sound play.
2. **Analyze.** For each subject, `analyze.js` transforms its sample points to world space, projects them to normalized device coordinates, and counts a point as visible when it lies inside the frame and a raycast from the camera reaches it without hitting another mesh first (tolerance 0.05 m). It returns, per subject:
   - `visibleRatio` = visible points / total points
   - `heightRatio` = projected bounding box height / frame height
   - `centerOffset` = distance of projected bounding box center from frame center, divided by half the frame diagonal (0 at center, 1 at a corner)
   - `action` = `getAction()` at capture time
3. **In frame.** A subject counts as in frame when `visibleRatio >= 0.4`.
4. **Match.** `requests.js` checks each incomplete and complete request against the analyzed list and the day phase.
5. **Grade.** For a matched request, score each required subject and use the lowest:
   - `size` = 1 when `heightRatio` is between 0.15 and 0.45, falling off linearly to 0 at 0.03 and at 0.9
   - `center` = `1 - centerOffset`
   - `vis` = `visibleRatio`
   - `score = 0.4 * size + 0.3 * center + 0.3 * vis`
   - Stars: 1 when `score >= 0.3`, 2 when `>= 0.6`, 3 when `>= 0.85`. A matched photo with `score < 0.3` still completes the request at 1 star.
6. **Result.** A Polaroid card slides out of the gadget showing the photo, each matched request and its stars. When a request already has a photo, the card offers "Keep new" or "Keep old"; the default is the higher-star photo. Every photo also goes to the camera roll, capped at 60 with the oldest unslotted photo dropped first.

Film counter shows 24 per roll and refills automatically when empty. It is flavor only.

## Scrapbook

- Opens full screen over a paused world. Pages turn with arrows or `A` / `D`.
- Page 1 is the cover (request 10's favorite shot). Pages 2 to 6 hold two request slots each, in request order. A final ending page unlocks when all 10 are complete.
- Empty slots show a dashed outline with the request text.
- A sticker tray holds about 12 Y2K stickers built as inline SVG (bubbles, stars, sparkles, globe, chrome hearts, swooshes). Stickers drag onto a page, rotate with the mouse wheel while held, and delete by dragging back to the tray.
- Each slot has a caption field, up to 60 characters.
- The camera roll is a strip at the bottom of the scrapbook, used to choose the cover photo.

## Persistence

| Store | Key | Content |
|-------|-----|---------|
| IndexedDB `aero-snap`, store `photos` | photo id | `{ id, blob, takenAt, matches: [{ requestId, stars }] }` |
| localStorage | `aero-snap:progress` | `{ version: 1, requests: { [id]: { photoId, stars } }, roll: [photoId], coverPhotoId }` |
| localStorage | `aero-snap:scrapbook` | `{ version: 1, stickers: [{ page, type, x, y, rot, scale }], captions: { [requestId]: string } }` |

All reads and writes are wrapped in try/catch. If IndexedDB fails to open, the game runs normally, photos live in memory for the session, and the gadget shows "Photos won't be kept after you close this tab". Unknown `version` values reset that store.

## Rendering and performance

- `WebGLRenderer` with ACES tone mapping and sRGB output.
- One directional sun with a 2048 shadow map covering the island, plus hemisphere fill light tinted by the day cycle.
- `EffectComposer` with `UnrealBloomPass` at half resolution for chrome and glass highlights.
- Grass uses `InstancedMesh`. Shared materials and geometries are reused across instances.
- If the average frame time over 3 seconds exceeds 22 ms, bloom is disabled for the session.
- Pixel ratio capped at 2.

## Testing

- `requests.js` and the pure scoring helpers in `analyze.js` (`sizeScore`, `centerScore`, `starsFor`, `isInFrame`) take plain objects, with no Three.js imports, and are unit-tested with `node --test apps/aero-snap/tests/`.
- Test cases cover each request's match rule, golden-hour gating, the two-critter rule, the lowest-subject rule for multi-subject requests, star thresholds at their boundaries, and the size falloff edges.
- Movement, camera, critter behaviors, capture, HUD and scrapbook are verified in the browser preview: take one photo per request, reload, and confirm the scrapbook restores.

## Out of scope

- Additional islands, touch controls, gamepad support
- Downloaded models, textures or audio files (shutter and ambient sounds are synthesized with Web Audio)
- Exporting or sharing the scrapbook
- Accounts or server storage
