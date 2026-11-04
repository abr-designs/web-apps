# Miyuki Pattern Generator Implementation Plan

Created by Claude (claude-opus-5-5), 2026-10-30

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `apps/miyuki-pattern/`, a client-side app that turns a photo into an even or odd count peyote pattern of Miyuki Delica 11/0 colours with a lettered PNG, a legend with counts and cost, and per-row quantities.

**Architecture:** Pure ES modules (`peyote-grid`, `color`, `quantize`, `pattern`, `persist`, `catalog` parsing) hold all logic and run under `node --test`. DOM modules (`image-stage`, `export`, `main`) render layout C and wire controls. One state object in `main.js` drives a debounced pipeline: sample, quantize, build pattern, render.

**Tech Stack:** HTML, CSS, ES modules, Canvas 2D, localStorage, `node --test` (Node 25).

**Spec:** `docs/superpowers/specs/2026-10-30-miyuki-pattern-design.md`

## Global Constraints

- No dependencies, no build step, no server. Relative asset paths only.
- Every new `.js`, `.css`, `.html` file starts with the attribution header: `// Created by Claude (claude-opus-5-5)` / `// Date: 2026-10-30` (CSS `/* */`, HTML `<!-- -->`). New functions get a JSDoc line.
- Every page has `<link rel="stylesheet" href="logo/logo.css">` in `<head>` and `<img class="app-logo" src="logo/senor_claude.png" alt="">` first in `<body>`; run `node scripts/sync-logo.mjs` after creating the app.
- Palette tokens on `:root`: `--bg #F7F3EC`, `--surface #FFFFFF`, `--border #E4DED3`, `--text #2B2A33`, `--muted #6F6A78`, `--accent #3B4C9B`. Light mode only.
- Defaults: 5 cm × 16.5 cm, 36 columns, 94 rows, even, pitch 50/36 mm × 165/94 mm, max colours 12, detail 50, pack 1000 beads = 5 g = $10 CAD.
- Max colours range 2 to 26. Columns clamp to 2 to 200, rows to 2 to 400.
- localStorage key `miyuki-pattern:v1`. Stored photo is JPEG, longest side 1600 px.
- No em dashes in UI copy or docs. Sentence case labels.
- Tests live in `apps/miyuki-pattern/tests/*.test.mjs` and run with `node --test apps/miyuki-pattern/tests/`.

## Review Focus

1. A flat image (logo, solid colour) with fewer distinct colours than max colours: k-means must not produce empty clusters or `NaN`; the pattern just has fewer colours. Test in Task 4.
2. Only one available colour ticked: the whole pattern is that colour with letter A. Test in Task 4.
3. Junk size inputs (blank, 0, 1, 9999, non-numeric cm): counts clamp to the documented range instead of breaking the grid. Test in Task 2.
4. A large photo that overflows localStorage: settings still save, the photo is dropped, a notice shows. Test in Task 6.
5. Pasted code lists in mixed formats (`db651`, `DB-0651`, `DB 651`, commas, newlines): all normalise to `DB-651`; unknown codes are reported, not silently ignored. Test in Task 7.

---

### Task 1: App scaffold and layout C shell

**Files:**
- Create: `apps/miyuki-pattern/index.html`, `apps/miyuki-pattern/style.css`, `apps/miyuki-pattern/app.json`, `apps/miyuki-pattern/js/main.js` (stub)
- Create via script: `apps/miyuki-pattern/logo/`

**Interfaces:**
- Produces DOM ids later tasks bind to: `#upload-input`, `#upload-error`, `#export-png`, `#print-btn`, `#stage-canvas`, `#fit-btn`, `#pattern-canvas`, `#width-cm`, `#height-cm`, `#columns`, `#rows`, `#parity-even`, `#parity-odd`, `#size-readout`, `#detail`, `#zoom`, `#nudge-left`, `#nudge-right`, `#nudge-up`, `#nudge-down`, `#max-colors`, `#max-colors-out`, `#available-btn`, `#pitch-x`, `#pitch-y`, `#pack-beads`, `#pack-grams`, `#pack-price`, `#legend`, `#notice`, `#picker-dialog`, `#print-page`.

- [ ] **Step 1:** Write `app.json`: `{ "name": "Miyuki Pattern", "description": "Turn a photo into a Delica peyote bead pattern with counts and cost.", "color": "blue" }` (no `icon`, so the directory shows "M").
- [ ] **Step 2:** Write `index.html` with layout C from the spec: top bar (title, upload, Export PNG, Print), two panes (`#stage-canvas`, `#pattern-canvas`), settings strip with Size, Image, Colours groups and a collapsed `<details>` Advanced group, `#legend`, `#notice`, an empty `<dialog id="picker-dialog">`, and `<section id="print-page">` hidden on screen. Default input values from Global Constraints. `<script type="module" src="js/main.js">`.
- [ ] **Step 3:** Write `style.css` from `~/.claude/templates/html-page/base.css` with the P1 tokens replacing its palette. Panes side by side above 800 px, stacked below; settings groups wrap to one column below 800 px; no horizontal scroll at 375 px. `@media print` hides everything except `#print-page`.
- [ ] **Step 4:** Run `node scripts/sync-logo.mjs` then `node scripts/sync-logo.mjs --check`. Expected: check exits 0.
- [ ] **Step 5:** Run `node scripts/build-directory.mjs --out _site`. Expected: no validation error for `miyuki-pattern`.
- [ ] **Step 6:** Commit (`apps/miyuki-pattern/`), subject `Scaffold Miyuki pattern app`.

### Task 2: Peyote grid geometry

**Files:**
- Create: `apps/miyuki-pattern/js/peyote-grid.js`
- Test: `apps/miyuki-pattern/tests/peyote-grid.test.mjs`

**Interfaces:**
- Produces:
  - `DEFAULTS`: `{ widthCm: 5, heightCm: 16.5, columns: 36, rows: 94, pitchXmm: 50/36, pitchYmm: 165/94 }`
  - `clampCounts({ columns, rows }) -> { columns, rows }` (integers, 2 to 200 and 2 to 400; non-finite falls back to `DEFAULTS`)
  - `countsFromSize(widthCm, heightCm, pitchXmm, pitchYmm) -> { columns, rows }` (rounded, then clamped)
  - `sizeFromCounts(columns, rows, pitchXmm, pitchYmm) -> { widthCm, heightCm }` (`heightCm = rows * pitchYmm / 10`)
  - `parityOf(columns) -> 'even' | 'odd'`
  - `applyParity(columns, parity) -> number` (adds 1 when parity differs)
  - `frameSize(columns, rows) -> { w: columns, h: rows + 0.5 }` in bead units
  - `beadCells(columns, rows) -> Array<{ col, row, x, y }>`, row-major (`index = row * columns + col`), centre `x = col + 0.5`, `y = row + 0.5 + (col % 2) * 0.5`
  - `footprint(cell, detail) -> { x, y, w, h }`, a bead-unit rect centred on the cell, side scale `s = 1 - 0.7 * detail / 100`, `w = s`, `h = s`

- [ ] **Step 1: Write failing tests**
  - `countsFromSize(5, 16.5, 50/36, 165/94)` deep-equals `{ columns: 36, rows: 94 }`; `sizeFromCounts(36, 94, ...)` gives `{ widthCm: 5, heightCm: 16.5 }` within 1e-9.
  - `applyParity(36, 'odd') === 37`, `applyParity(37, 'odd') === 37`, `parityOf(36) === 'even'`.
  - `beadCells(36, 94).length === 3384`; cell index 1 has `y === 1`; cell index 0 has `y === 0.5`; cell index 36 is `{ col: 0, row: 1 }`.
  - `footprint(cell, 100)` has `w` 0.3 within 1e-9; `footprint(cell, 0)` has `w` 1.
  - Review focus 3: `clampCounts({ columns: 0, rows: 9999 })` gives `{ columns: 2, rows: 400 }`; `clampCounts({ columns: NaN, rows: 'x' })` gives `{ columns: 36, rows: 94 }`; `countsFromSize(0.01, 500, ...)` returns clamped values.
- [ ] **Step 2:** Run `node --test apps/miyuki-pattern/tests/peyote-grid.test.mjs`. Expected: FAIL, module not found.
- [ ] **Step 3:** Implement the functions in `js/peyote-grid.js`.
- [ ] **Step 4:** Rerun. Expected: PASS.
- [ ] **Step 5:** Commit, subject `Add peyote grid geometry`.

### Task 3: Colour science

**Files:**
- Create: `apps/miyuki-pattern/js/color.js`
- Test: `apps/miyuki-pattern/tests/color.test.mjs`

**Interfaces:**
- Produces:
  - `hexToRgb(hex) -> [r, g, b]` (0 to 255, accepts `#RRGGBB`)
  - `rgbToLab([r, g, b]) -> [L, a, b]` (sRGB D65, standard companding)
  - `hexToLab(hex) -> [L, a, b]`
  - `deltaE2000(lab1, lab2) -> number`
  - `textColorFor(lab) -> '#000000' | '#FFFFFF'` (black when `L > 55`)

- [ ] **Step 1: Write failing tests**
  - `rgbToLab([255, 255, 255])` is `[100, 0, 0]` within 0.01; `rgbToLab([0, 0, 0])` is `[0, 0, 0]`.
  - Sharma, Wu, Dalal (2005) pairs, each within 1e-4: `[50, 2.6772, -79.7751]` vs `[50, 0, -82.7485]` → `2.0425`; `[50, 2.5, 0]` vs `[50, 0, -2.5]` → `4.3065`; `[60.2574, -34.0099, 36.2677]` vs `[60.4626, -34.1751, 39.4387]` → `1.2644`; `[22.7233, 20.0904, -46.694]` vs `[23.0331, 14.973, -42.5619]` → `2.0373`.
  - `textColorFor([90, 0, 0]) === '#000000'`, `textColorFor([20, 0, 0]) === '#FFFFFF'`.
- [ ] **Step 2:** Run the test. Expected: FAIL.
- [ ] **Step 3:** Implement per the CIEDE2000 formula (kL = kC = kH = 1).
- [ ] **Step 4:** Rerun. Expected: PASS.
- [ ] **Step 5:** Commit, subject `Add Lab conversion and CIEDE2000`.

### Task 4: Quantize and snap to Delica

**Files:**
- Create: `apps/miyuki-pattern/js/quantize.js`
- Test: `apps/miyuki-pattern/tests/quantize.test.mjs`

**Interfaces:**
- Consumes: `deltaE2000` from Task 3.
- Produces:
  - `CatalogEntry`: `{ code: string, name: string, hex: string, lab: [L, a, b] }`
  - `kmeans(labs: number[][], k: number, seed = 1) -> { centroids: number[][], assignments: Int32Array }` (Euclidean in Lab, k-means++ init with a seeded PRNG such as mulberry32, max 20 iterations or until no assignment changes; `k` is capped at the number of distinct inputs; an empty cluster is dropped)
  - `matchPalette(labs, k, palette: CatalogEntry[], seed = 1) -> { colors: CatalogEntry[], assignments: Int32Array }` (snap each centroid to the palette entry with the lowest `deltaE2000`; centroids snapping to the same code merge; `assignments` indexes into `colors`)

- [ ] **Step 1: Write failing tests**
  - Determinism: two calls of `kmeans` with the same 200 random labs, `k = 5`, `seed = 7` give identical `assignments`.
  - Two well-separated clusters (50 labs near `[30,0,0]`, 50 near `[80,0,0]`) with `k = 2` split into exactly those groups.
  - Review focus 1: 100 identical labs with `k = 12` returns 1 centroid, no `NaN` in any centroid.
  - Merging: palette of two entries (black and white), labs from 6 grey levels, `k = 6`, gives `colors.length <= 2`.
  - Review focus 2: palette of one entry gives `colors.length === 1` and every assignment `0`.
- [ ] **Step 2:** Run the test. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Rerun. Expected: PASS.
- [ ] **Step 5:** Commit, subject `Add k-means quantizer and Delica snapping`.

### Task 5: Pattern, legend, and per-row quantities

**Files:**
- Create: `apps/miyuki-pattern/js/pattern.js`
- Test: `apps/miyuki-pattern/tests/pattern.test.mjs`

**Interfaces:**
- Consumes: `CatalogEntry` and `matchPalette` output from Task 4.
- Produces:
  - `letterFor(i) -> string` (`0 → 'A'` ... `25 → 'Z'`)
  - `buildPattern({ columns, rows, assignments, colors, pack: { beads, grams, price } }) -> Pattern`
  - `Pattern`: `{ columns, rows, cells: Uint8Array` (legend index per bead, row-major), `legend: Array<{ letter, code, name, hex, lab, count, grams, packs, cost }>` (sorted by count descending, letters assigned in that order), `totals: { count, grams, packs, cost }`, `rowCounts: Array<{ row, direction: '→' | '←', counts: Array<{ letter, count }> }>` (row 1 `'→'`, alternating; counts ordered by letter, zero counts omitted) `}`
  - `grams = count / pack.beads * pack.grams` rounded to 1 decimal; `packs = Math.ceil(count / pack.beads)`; `cost = packs * pack.price` rounded to 2 decimals.

- [ ] **Step 1: Write failing tests**
  - 4 × 3 grid, assignments `[0,1,1,1, 1,1,0,0, 1,1,1,1]`, two colours: legend letter A is colour index 1 with count 9, B count 3; `cells` remapped so A cells are `0`.
  - `rowCounts[0]` is `{ row: 1, direction: '→', counts: [{ letter: 'A', count: 3 }, { letter: 'B', count: 1 }] }`; `rowCounts[1].direction === '←'`; every row's counts sum to `columns`.
  - Pack maths with defaults: count 1000 → `{ grams: 5, packs: 1, cost: 10 }`; count 1001 → `{ grams: 5, packs: 2, cost: 20 }`; count 240 → `{ grams: 1.2, packs: 1, cost: 10 }`.
  - `totals.count === columns * rows`.
- [ ] **Step 2:** Run the test. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Rerun. Expected: PASS.
- [ ] **Step 5:** Commit, subject `Add pattern builder with legend and row counts`.

### Task 6: Persistence

**Files:**
- Create: `apps/miyuki-pattern/js/persist.js`
- Test: `apps/miyuki-pattern/tests/persist.test.mjs`

**Interfaces:**
- Produces:
  - `STORAGE_KEY = 'miyuki-pattern:v1'`
  - `saveState(storage, state) -> { photoSaved: boolean }` where `state = { settings, transform, available: string[], photo: string | null }`. Tries the full JSON; on any `setItem` error retries with `photo: null`; returns `photoSaved: false` in that case.
  - `loadState(storage) -> state | null` (`null` on missing key or invalid JSON)

- [ ] **Step 1: Write failing tests** with a fake storage object (`getItem`, `setItem`).
  - Round trip: `loadState` returns what `saveState` stored.
  - Review focus 4: fake `setItem` throws when the value length exceeds 1000; saving a state with a 5000-char photo returns `{ photoSaved: false }` and the stored JSON has `photo: null` with settings intact.
  - Invalid JSON under the key returns `null`.
- [ ] **Step 2:** Run the test. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Rerun. Expected: PASS.
- [ ] **Step 5:** Commit, subject `Add state persistence with photo fallback`.

### Task 7: Delica catalog data and picker

**Files:**
- Create: `apps/miyuki-pattern/data/delica.json`, `apps/miyuki-pattern/js/catalog.js`
- Create (one-off build script, not published): `apps/miyuki-pattern/tools/build-catalog.mjs`
- Test: `apps/miyuki-pattern/tests/catalog.test.mjs`

**Interfaces:**
- Consumes: `hexToLab` from Task 3, `CatalogEntry` from Task 4.
- Produces:
  - `delica.json`: `{ "source": "<url>", "license": "<licence>", "colors": [{ "code": "DB-651", "name": "...", "hex": "#RRGGBB" }] }`
  - `normalizeCode(text) -> string | null` (`'db651'`, `'DB-0651'`, `'DB 651'` → `'DB-651'`; non-matching → `null`)
  - `parseCodes(text, catalog) -> { codes: string[], unknown: string[] }` (split on commas, whitespace, newlines; dedupe)
  - `withLab(colors) -> CatalogEntry[]`
  - `filterAvailable(catalog, codes: Set<string>) -> CatalogEntry[]` (whole catalog when the set is empty)
  - `loadCatalog(url = 'data/delica.json') -> Promise<CatalogEntry[]>` (browser `fetch`)
  - `openPicker(dialog, catalog, available: Set<string>, onChange(Set<string>))` (search by code or name, swatch, checkbox, Select all, Clear, paste box using `parseCodes`, unknown codes listed under the paste box)

- [ ] **Step 1: Find the data source.** Search for a public Delica 11/0 colour dataset with code, name, and hex (GitHub datasets, bead design tool exports). Accept it only when it has at least 800 DB codes, includes DB-651, and its licence allows reuse. If none qualifies, stop and ask the user before continuing.
- [ ] **Step 2:** Write `tools/build-catalog.mjs` that converts the source into `data/delica.json` with normalised codes, sorted by number, and run it.
- [ ] **Step 3: Write failing tests**
  - `delica.json` has `source` and `license`, `colors.length >= 800`, unique codes, every hex matches `/^#[0-9A-F]{6}$/i`, and contains `DB-651`.
  - Review focus 5: `normalizeCode` cases above; `parseCodes('db651, DB-0010\nDB 999999 foo', catalog)` returns `codes` `['DB-651', 'DB-10']` and lists the rest as unknown.
  - `filterAvailable(catalog, new Set())` returns the full catalog; with `{'DB-651'}` returns one entry.
- [ ] **Step 4:** Run `node --test apps/miyuki-pattern/tests/catalog.test.mjs`. Expected: FAIL, then implement the pure functions and rerun. Expected: PASS.
- [ ] **Step 5:** Implement `loadCatalog` and `openPicker`; check in the browser that search, ticking, Select all, Clear, and paste work.
- [ ] **Step 6:** Commit, subject `Add Delica catalog and colour picker`.

### Task 8: Image stage

**Files:**
- Create: `apps/miyuki-pattern/js/image-stage.js`

**Interfaces:**
- Consumes: `frameSize`, `footprint` from Task 2; `rgbToLab` from Task 3.
- Produces: `createStage(canvas, { onChange }) -> Stage` with
  - `loadFile(file) -> Promise<void>` (rejects with `Error('Choose an image file')` for non-images or decode failure)
  - `loadDataUrl(url) -> Promise<void>`
  - `setFrame(columns, rows, pitchXmm, pitchYmm)` (crop frame aspect `columns * pitchX : (rows + 0.5) * pitchY`, centred in the canvas)
  - `getTransform() -> { offsetX, offsetY, scale }`, `setTransform(t)`, `fit()` (cover the frame), `nudge(dx, dy)` (1 bead per press)
  - `sampleCells(cells, detail) -> number[][]` (Lab per cell: average of the photo pixels under `footprint(cell, detail)` mapped through the transform; pixels outside the photo count as white)
  - `exportPhoto() -> string` (JPEG data URL, longest side 1600 px)
- Drag pans, wheel and `#zoom` scale around the frame centre; the overlay draws the frame and the staggered column outlines. Calls `onChange()` after any transform change.

- [ ] **Step 1:** Implement. Sample from an offscreen canvas `ImageData` read once per photo load.
- [ ] **Step 2:** Browser check through a temporary wiring in `main.js`: load a photo, pan, zoom, Fit, nudge; a PNG and a HEIC (or a `.txt`) file show `#upload-error` text.
- [ ] **Step 3:** Commit, subject `Add image stage with crop frame and sampling`.

### Task 9: Wiring, preview, legend, and export

**Files:**
- Modify: `apps/miyuki-pattern/js/main.js`
- Create: `apps/miyuki-pattern/js/export.js`

**Interfaces:**
- Consumes: everything above.
- Produces in `export.js`:
  - `renderPattern(canvas, pattern, { cellPx, letters: boolean, numbers: boolean, legend: boolean })` (staggered rects in `hex`, letter centred in `textColorFor(lab)`, row numbers left and column numbers top when `numbers`, legend block below when `legend`)
  - `downloadPng(pattern)` (renders at `cellPx = 24` with letters, numbers, legend; filename `miyuki-pattern-<columns>x<rows>.png`)
  - `fillPrintPage(section, pattern)` (diagram image, full legend table with grams, packs, cost, approximate-colour note, then one line per row: `Row 3 (←): A 12, C 9, B 15`)

- [ ] **Step 1:** In `main.js`, hold one `state` object initialised from `loadState` or defaults; bind every control from Task 1; cm inputs call `countsFromSize`, count inputs call `sizeFromCounts`, parity buttons call `applyParity`, a typed column count flips the parity toggle; `#size-readout` shows the beaded size to one decimal.
- [ ] **Step 2:** Debounced (150 ms) pipeline: `beadCells` → `stage.sampleCells` → `matchPalette` against `filterAvailable` → `buildPattern` → `renderPattern` on `#pattern-canvas` (letters only when `cellPx >= 14`) → legend table in `#legend` with totals and the approximate-colour note → `saveState`; show `#notice` when `photoSaved` is false.
- [ ] **Step 3:** Implement `export.js`; Export PNG calls `downloadPng`; Print calls `fillPrintPage` then `window.print()`.
- [ ] **Step 4:** Error states from the spec: catalog load failure message in the pattern pane, "All colours" label when none are ticked.
- [ ] **Step 5:** Run `node --test apps/miyuki-pattern/tests/`. Expected: all PASS.
- [ ] **Step 6:** Commit, subject `Wire pattern pipeline, legend, and exports`.

### Task 10: Browser verification

- [ ] **Step 1:** Add a `miyuki-pattern` static server entry to `.claude/launch.json` if none serves the repo, start it with `preview_start`.
- [ ] **Step 2:** Check: upload, pan, zoom, every slider, parity toggle (36 ↔ 37), cm ↔ count linking, picker filtering changes the pattern, Export PNG downloads and opens, print preview shows legend and row lines, reload restores state, 375 px width has no horizontal scroll, no console errors.
- [ ] **Step 3:** Run `node scripts/sync-logo.mjs --check` and `node scripts/build-directory.mjs --out _site`. Expected: both pass.
- [ ] **Step 4:** Fix anything found, rerun the tests, commit, subject `Polish Miyuki pattern app after browser check`.
