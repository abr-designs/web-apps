---
name: painting-guide
description: Builds a miniature painting guide as a claude.ai Artifact from a video tutorial (with its transcript) or a written scheme, with phases, paint sub-steps, Paint mode slideshow, shared reference photos, optional conversion to a target paint brand, and optional Paint Rack backup data for owned paints. Use when the user wants a painting guide, a paint scheme turned into steps, a tutorial converted to their paints or another brand, or mentions "painting guide", "paint guide" or "Paint mode".
---

<!-- Created by Claude (claude-opus-5-5) - 2026-10-25 -->

# Painting guide

Every guide is the same frozen page (`template.html` + `store.js`) filled with one guide JSON file. Claude writes only the JSON; `build.mjs` produces the page. Example of the full shape: `example-guide.json`.

Files here (`<skill>` = this folder, `<repo>` = the web-apps repo root):

- `template.html`: the page (stepper layout, paint list, Paint mode, swatch-card fallback). Don't edit it per guide.
- `store.js`: image store and prefs, reusable by any page. Its header documents the API and how to move off Artifacts.
- `build.mjs`: `node <skill>/build.mjs <guide.json> <outDir>` validates the JSON and writes `<outDir>/<id>.html` plus `<outDir>/logo/senor_claude.png`.
- `paints.mjs`: catalogue lookups and brand conversion over Paint Rack's `apps/warhammer-paint/paints.js`.

## 1. Intake

Ask one question at a time with AskUserQuestion, recommended option first. Skip what the user already gave.

1. **Source.** A video URL plus its transcript (ask the user to paste it or give a file; don't try to fetch it), or a written scheme (article, step list, or one the user describes). Without a video, leave `source.timecodes` false and omit every `t`, `start` and `end`.
2. **Target brand.** Keep the source paints, or convert to one brand. Brands come from `paints.js` (Citadel, Vallejo, Army Painter, AK).
3. **Paint Rack.** Optional backup JSON (Paint Rack's Backup copy, shaped `{owned, projects, custom}`). With one, run `node <skill>/paints.mjs projects <backup>` and ask: use an existing project's paints, or build the list and give the user a paste list for Paint Rack's "Paste a list".

## 2. Breakdown

Read the transcript and split it into phases (a stretch of the video with one goal) and sub-steps (one paint action on one area).

- Sub-step: `title` (imperative, short), `area` (where on the model), `paints` (keys into `paints`, in order; `mix: true` for equal parts), `t` (seconds into the video), optional `tips` (short how-to lines) and `note`.
- Phase: `short` (nav label), `title`, `summary` (one sentence), `start`/`end` in seconds, optional `general` tips (`{n, t, p}`) that apply to the whole phase.
- Write everything in your own words. Summarize the creator's advice; never copy transcript sentences.
- No em dashes anywhere in guide text.

## 3. Paints

Collect every paint the scheme uses, then resolve them:

```bash
node <skill>/paints.mjs match --from Citadel --to Vallejo --backup <backup.json> "Nuln Oil" "Stegadon Scale Green"
```

Use `--in <file>` for one name per line, or `--project "<name>"` to take a Paint Rack project's paints. Stdout is JSON (`paints[]` with `from`, `to`, `deltaE`, `final.owned`, `flag`, plus `pasteList`); stderr is a readable table.

- The script only matches like with like: metallic to metallic, wash/shade/ink to each other, contrast/speedpaint to each other, everything else as standard. It always takes the closest colour (CIEDE2000), owned or not.
- `flag: "no <brand> <type> paint, kept original"`: keep the source paint and say so in the sub-step's `note`.
- `flag: "weak match"` (deltaE over 10): keep the match, tell the user, and add a `note` on what looks different.
- `flag: "not found"` or `guess: true`: confirm the paint with the user before using it.
- Paint entry: `{name, code, hex (6 digits, no #), src, metal?, was?, swap?}`. `src` is `project` (in the Paint Rack project or the new list), `owned` (owned but not in the project), or `need` (not owned). `was` names the source paint a conversion replaced; `swap` suggests a substitute for a paint the user lacks.
- Notes allow `**bold**` and nothing else.

After building, give the user `pasteList` when they chose a new Paint Rack list.

## 4. Palette

The layout is fixed. Run only the palette step of the UI design workflow: show 3 palettes with `show_widget`, each drawn from the scheme's own paints, as swatches with hex and role beside a small mockup of the stepper, with `Pick P1` buttons. Wait for the pick. Each palette needs light and dark sets of: `bg, surface, text, muted, accent, line, accentSoft, warn, warnSoft, onAccent`. Keep text on `bg` and `surface`, and `onAccent` on `accent`, at 4.5:1 contrast or better.

## 5. Build and publish

1. Write `<scratchpad>/<id>/guide.json` (`id`: lowercase letters, digits and dashes; it prefixes local storage keys).
2. `node <skill>/build.mjs <scratchpad>/<id>/guide.json <scratchpad>/<id>/out`. Fix every `error:` it prints. If it reports a Git LFS pointer, run `git lfs pull` in the repo.
3. Publish with the Artifact tool (load `artifact-design` first if the session hasn't):
   - `file_path`: `<out>/<id>.html`, `icon`: `brush`
   - `files`: `{"logo/senor_claude.png": "<out>/logo/senor_claude.png"}`
   - `capabilities`: `{"assets": {}, "db": {"rules": [{"path": "photos", "read": "view", "write": "admin"}]}}`
4. Check: `ArtifactData` `list` of collection `photos` (empty on a new guide).

Tell the user:

- Images they add as the artifact's owner or an editor are shared with everyone they give the link to. Images added before sharing existed, or in another browser, upload with the sidebar's "Share N photos with the link" button.
- The artifact is private until they share it from its Share menu. Viewers must be signed in to see the shared images.
- Uploads accept PNG, JPEG, GIF and WebP (photos are downscaled to 2000px WebP first). iPhone HEIC must be converted first.

## Changing a guide later

Edit its `guide.json`, rebuild, and republish the same `file_path` (omit `icon` and `capabilities` to keep them). Phase ids (`step2`) and sub-step ids (`2.3` = phase 2, sub-step 3) come from position and are the image keys, so append new phases at the end of the guide and new sub-steps at the end of a phase. Inserting, reordering or deleting either after photos are added moves photos onto the wrong steps.

Template fixes don't reach guides that are already published; rebuild and republish a guide to pick them up.
