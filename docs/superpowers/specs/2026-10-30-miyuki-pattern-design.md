# Miyuki Pattern Generator Design

Created by Claude (claude-opus-5-5), 2026-10-30

## Goal

A client-side app at `apps/miyuki-pattern/` that turns a photo into a peyote stitch pattern for Miyuki Delica 11/0 beads, with a lettered diagram, a colour legend with bead counts and cost, and per-row colour quantities.

Success criteria:

- Upload a photo, drag and zoom it under a grid overlay, and see the bead pattern update live beside it.
- The default piece is 5 cm × 16.5 cm, 36 columns × 94 rows, even-count peyote.
- Every colour in the pattern maps to a real Delica code (for example DB-651), limited to colours the user marks as available.
- Export a PNG of the lettered diagram and print a page with diagram, legend, and per-row quantities.
- Works offline once loaded, with no server and no account. The last project survives a reload.

## Decisions

| Topic | Decision |
|-------|----------|
| Stack | Plain HTML, CSS, ES modules, no build step, no dependencies |
| Colour catalog | Ship the full Delica 11/0 catalog as JSON. The user ticks owned/available colours; matching uses only those (all colours when none are ticked) |
| Colour matching | Approach A: k-means in CIELAB to N colours, then snap each centroid to the nearest available Delica by ΔE2000 |
| Output | PNG download of the diagram plus a printable page |
| Palette | P1 Linen and indigo |
| Layout | C, side-by-side live preview |

## Peyote geometry

- Beads sit with holes horizontal. The chart has `columns` vertical columns of `rows` beads each. Every odd-indexed column (0-based) is shifted down by half a bead; that shift is the peyote offset.
- Bead pitch defaults are derived from the default piece: 50 mm / 36 = 1.389 mm per column, 165 mm / 94 = 1.755 mm per row. Pitch is editable under Advanced.
- Width and height in cm and column and row counts are linked through pitch. Editing cm recomputes the counts (rounded); editing counts recomputes cm. The app shows the resulting beaded size.
- Even or odd count: the toggle sets column parity. Switching to the other parity adds one column (36 becomes 37). Typing a column count with the wrong parity flips the toggle to match.
- A chart row is the zig-zag line of beads with the same row index across all columns, so a row holds `columns` beads. Rows are numbered 1 to `rows` from the top. The word chart alternates reading direction per row (row 1 left to right, row 2 right to left).

## Colour palette (P1 Linen and indigo)

| Role | Hex |
|------|-----|
| Background | `#F7F3EC` |
| Surface | `#FFFFFF` |
| Border | `#E4DED3` |
| Text | `#2B2A33` |
| Muted text | `#6F6A78` |
| Accent | `#3B4C9B` |

These replace the `base.css` default palette tokens. The app ships light mode only, because bead colours must be judged against a neutral light background.

## Layout (C)

- Top bar: app name, Upload photo button, Export PNG button, Print button.
- Main area, two panes side by side:
  - Left, image stage: the photo on a canvas with the peyote grid outline drawn over the crop frame. Drag to pan, wheel or zoom slider to scale, a Fit button to reset. The crop frame has the beaded aspect ratio.
  - Right, pattern preview: the staggered bead grid rendered with Delica colours, letters shown when cells are large enough.
- Settings strip below the panes, grouped:
  - Size: width cm, height cm, columns, rows, even or odd toggle.
  - Image: detail slider, zoom slider, x and y offset nudges.
  - Colours: max colours slider (2 to 26), Available colours button that opens the catalog picker.
  - Advanced (collapsed): column and row pitch in mm, beads per pack (1000), grams per pack (5), price per pack ($10 CAD).
- Legend strip below settings: one entry per pattern colour with letter, swatch, DB code, name, bead count, grams, packs, cost; a total row.
- Logo fixed bottom-right per the repo rule.
- Below 800 px wide the panes stack vertically (stage, then pattern) and the settings strip becomes a single column.

## Architecture

```
apps/miyuki-pattern/
├── index.html
├── style.css
├── app.json
├── logo/                 synced by scripts/sync-logo.mjs
├── data/delica.json      [{ "code": "DB-651", "name": "...", "hex": "#RRGGBB" }]
├── js/
│   ├── main.js           wires controls, state, debounced re-render, localStorage save/load
│   ├── catalog.js        loads delica.json, available-colour set, picker dialog
│   ├── image-stage.js    upload, pan, zoom, crop frame, grid overlay
│   ├── peyote-grid.js    bead centres and footprints, parity, cm and count conversion
│   ├── color.js          sRGB to CIELAB, ΔE2000
│   ├── quantize.js       k-means in Lab, snap centroids to available Delicas
│   ├── pattern.js        cell assignment, letters, totals, grams, packs, cost, per-row quantities
│   └── export.js         PNG render, print page population
└── tests/                node:test unit tests (not published)
```

Unit boundaries:

- `peyote-grid.js`, `color.js`, `quantize.js`, and `pattern.js` are pure functions with no DOM access, so they run under `node --test`.
- `image-stage.js` owns the photo transform `{ offsetX, offsetY, scale }` and exposes `sampleCells(grid, detail)` returning one Lab colour per bead.
- `main.js` holds the single state object and is the only module that touches localStorage.

## Data flow

1. Photo loads into an offscreen canvas.
2. The stage transform maps the crop frame onto the photo.
3. Detail slider sets a sampling radius: each bead's colour is the average of the photo pixels under a footprint scaled from 30 percent (detail high, sharp) to 100 percent (detail low, soft) of the bead's area.
4. `quantize` runs k-means with k = max colours on the bead colours (seeded with k-means++ and a fixed seed so the same input gives the same pattern), then snaps each centroid to its nearest available Delica. Centroids that snap to the same Delica merge, so the pattern can end with fewer than k colours.
5. `pattern` assigns letters A, B, C in descending bead count and computes totals and per-row quantities.
6. The preview, legend, PNG, and print page all render from the same pattern object.

Re-rendering is debounced to 150 ms after the last control change. Sampling and k-means for 36 × 94 = 3,384 beads run on the main thread; a Web Worker is not needed at this size.

## Counts and cost

For each colour:

- Beads: count in the pattern.
- Grams: beads / beads per pack × grams per pack (5 g per 1000 beads by default), one decimal.
- Packs: ceil(beads / beads per pack).
- Cost: packs × price per pack, CAD, two decimals.

Totals sum beads, grams, packs, and cost.

## Outputs

PNG export:

- Each bead drawn as a staggered rectangle in its Delica colour with its letter centred, black or white text chosen by Lab lightness.
- Row numbers down the left, column numbers across the top.
- Legend under the grid: letter, swatch, DB code, name, bead count.
- Filename `miyuki-pattern-<columns>x<rows>.png`.

Print page (print stylesheet, triggered by the Print button):

- Page 1: diagram and full legend with grams, packs, and cost.
- Following pages: per-row quantities, one line per row in the form `Row 3 (←): A 12, C 9, B 15`, colours ordered by letter.

## Colour catalog

- `data/delica.json` holds the Delica 11/0 range with code, name, and an approximate hex value, built from a public dataset whose source and licence are recorded in a `source` field at the top of the file.
- Hex values approximate finishes (metallic, lined, AB) as a flat colour. The legend carries a note that screen colours are approximate.
- The picker lists all colours with search by code or name, a swatch per colour, a checkbox per colour, Select all, Clear, and a text box to paste a list of codes (`DB-651, DB-10, ...`).
- Available colours persist in localStorage.

## Persistence

localStorage key `miyuki-pattern:v1` stores settings, stage transform, available colours, and the photo as a downscaled JPEG data URL (longest side 1600 px). If storage is full, the app saves everything except the photo and shows a one-line notice.

## Error handling

- Non-image file: inline message under the Upload button.
- No available colours ticked: matching uses the full catalog and the Available colours button shows "All colours".
- Catalog fails to load: the pattern panel shows a message and the app stays usable for cropping.

## Testing

`node --test apps/miyuki-pattern/tests/` covers:

- `peyote-grid`: cm and count conversion round trip for the defaults, parity toggle, half-bead offset positions.
- `color`: ΔE2000 against the published Sharma test pairs.
- `quantize`: deterministic output for a fixed seed, centroid merging, respecting the available set.
- `pattern`: letters ordered by count, grams and pack maths for the 1000 bead / 5 g / $10 defaults, per-row quantities summing to `columns`.

Manual browser check: upload, pan, zoom, every slider, PNG export, print preview, reload restores state, 375 px width layout.

## Out of scope

- Brick stitch, loom, and two-drop peyote.
- Bead-along tracker and run-length (bead by bead) word charts.
- Seed beads other than Delica 11/0.
- Image editing beyond pan and zoom (no rotate, brightness, or contrast).
- Spare-bead percentage.
