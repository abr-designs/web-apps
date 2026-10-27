<!-- Created by Claude (claude-opus-5-5) -->
<!-- Date: 2026-10-26 -->

# Stroke Plotter

Builds single-stroke versions of an outline font's letters for pen plotters such as a Cricut in Pen (Draw) mode. A normal font stores each letter as a filled outline, so a pen traces both edges of every stroke and draws hollow letters. Here you place the centerline of each stroke yourself, in pen order, over a faded copy of the real glyph, and the app smooths those points into curves and exports SVG in millimetres.

One static page (`index.html`), no build step and no server. The font, the strokes and the settings never leave the browser.

## Run

Open `index.html` directly from disk, or serve the folder:

```bash
npx serve .
```

## Workflow

1. **Load font** (or drop an `.otf`, `.ttf`, `.woff` or `.woff2` file on the canvas). Until then the page shows Georgia with auto-traced example strokes for `a`, `b` and `c`.
2. Pick a glyph in the grid. A dot marks glyphs that already have strokes.
3. Click points along a stroke in the order the pen should travel. Press **N** wherever the pen lifts to start the next stroke. Use **Closed loop** for strokes that end where they began, such as `o`.
4. Optionally press **Auto trace** first to seed the glyph with machine-made strokes, then fix them.
5. Type text under **Write text**, set **Em size** (the font's em square in millimetres) and **Pen width**, then **Export text SVG**. In Design Space, upload the SVG and set the layer operation to Pen.
6. Or click **Export font (.otf)** under **Single-line font** to get a font you can type with. Install it in Windows (right-click the file, Install), restart Design Space, pick it under System fonts, and set the text layer's operation to Pen.

### Controls

| Input | Action |
|-------|--------|
| Click | Add a point to the end of the selected stroke |
| Drag a point | Move it |
| Ctrl+click on the curve (Cmd on macOS) | Insert a point between its neighbours on the selected stroke |
| Shift+click a point | Delete it |
| Alt+click a point | Toggle a sharp corner |
| Delete or Backspace | Remove the last point of the selected stroke |
| N or Enter | New stroke |
| C | Toggle closed loop |
| Ctrl+Z | Undo (200 steps, per edit) |
| [ and ] | Previous and next glyph |
| Mouse wheel | Zoom at the cursor |
| Space+drag or middle drag | Pan |
| 0 | Fit the glyph to the canvas |

## How it works

### Font rendering

The loaded file is registered with the browser through the `FontFace` API and drawn with canvas `fillText`, so no font-parsing library is needed. Advance widths come from `measureText`, measured at 100 px and divided by 100 to get em units. The view fits the glyph's ink box (`actualBoundingBox*`) plus its advance width to about 70% of the canvas. Dashed guides mark the baseline and the advance width.

### Coordinates

Every point is stored as `[x, y, corner]` in em units: the origin is the glyph's pen position on the baseline, `x` grows right, `y` grows down (the canvas and SVG direction), and `corner` is `1` for a sharp point. Em units keep the strokes independent of zoom, canvas size and export size. The screen transform is `screen = origin + em * scale`, where scale is the font size in pixels.

### Smoothing

Each stroke is drawn as one cubic Bezier per pair of neighbouring points, using Catmull-Rom tangents:

- The tangent at point `i` is `(p[i+1] - p[i-1]) * k`, with `k = smoothing / 3`. The default smoothing of 0.5 gives `k = 1/6`, standard Catmull-Rom. Smoothing 0 gives straight lines.
- The control points of the segment from `a` to `b` are `a + tangent(a)` and `b - tangent(b)`.
- Open strokes repeat their end points as the missing neighbours. Closed strokes wrap around, and the path ends with `Z`.
- A corner point gets a zero tangent, so the curve meets it at an angle.

The canvas and the exported SVG use the same `segments()` function, so the export matches what you see.

### Auto trace

**Auto trace** builds a starting set of strokes from the glyph:

1. Render the glyph at 360 px on an offscreen canvas and threshold alpha into a pixel mask.
2. Thin the mask to a one-pixel skeleton with Zhang-Suen thinning.
3. Classify skeleton pixels by their crossing number (the count of empty-to-filled transitions around the 8 neighbours): 1 is an endpoint, 2 is part of a line (staircase corners included), 3 or more is a junction.
4. Walk the skeleton from endpoints and junctions into polylines, then pick up any closed loops that touch no junction.
5. Prune spurs: branches running from a free end to a junction that are shorter than 1.2 times the estimated stroke width (filled pixels divided by skeleton pixels). Thinning leaves these at corners and stroke ends. Repeat up to 4 times.
6. Simplify each polyline with Ramer-Douglas-Peucker (tolerance 0.8% of the render size). A loop whose ends meet is split at its farthest point first, then marked closed.

Known limits: thinning shortens each free stroke end by about half the stroke width, and short real strokes can be pruned as spurs. Where strokes cross, the centerline bends toward the junction. Auto trace output is meant to be edited.

### Export

Both exports write SVG with `width` and `height` in `mm` and a viewBox in millimetres, so one user unit is 1 mm. Strokes are open paths with `fill="none"`, a black stroke of the chosen pen width, and round caps and joins.

- **Export text SVG** lays the text out with the font's advance widths. Spaces advance without drawing, lines are 1.25 em apart, and the first baseline is 0.9 em from the top. Characters with no strokes advance but draw nothing and are listed under the preview.
- **Export glyph SVG** writes the selected glyph alone, named after its hex code point (for example `glyph_61.svg` for `a`).

Pen width only affects the preview and the SVG stroke. The plotter draws with whichever pen is loaded.

### Single-line font export

Font formats store only closed outlines, and Design Space's Writing style is limited to Cricut's own hosted fonts. **Export font (.otf)** works around both: each stroke becomes a zero-area contour that runs along the smoothed curve and then back over the same curve to its start. A plotter in Pen mode traces the outline, which is the stroke drawn twice, so lines come out slightly darker than a single pass. Because the contours enclose no area, the letters can look faint or empty on the Design Space canvas while still drawing correctly.

Font construction uses [opentype.js](https://github.com/opentypejs/opentype.js) 1.3.4, loaded from jsDelivr, so this button needs a network connection on first load. The font uses 1000 units per em, with ascender and descender taken from the loaded font's `fontBoundingBox*` metrics. Every glyph keeps the source font's advance width, and a space glyph is always included. Glyphs with no strokes are left out, and a message says how many. Letters keep their own glyph names; every other character is named `uniXXXX`.

The family name defaults to the loaded font's file name with any `Regular` suffix removed, plus `Single Line` (for example `Alex2024 Single Line`), so it installs next to the original without replacing it. The style is always `Regular`. Windows and Design Space cache fonts by name, so before installing an updated export, uninstall the old one and restart Design Space, or give the new export a different name.

### Storage

The project autosaves to `localStorage` under `stroke-plotter:<font file name>`, 300 ms after the last change, so each font keeps its own strokes. The saved fields are `glyphs` (a map from character to `{ pts, closed }` strokes), `smooth`, `emMM`, `penMM`, `text` and `exportName` (the font name typed under Single-line font, empty for the default). The font file itself is not stored, so load it again after a reload.

**Save project** downloads the same data as JSON with a `font` field added. **Open project** (or dropping a `.json` on the canvas) loads it. If the file was saved with a different font, a message says to load that font so the guides line up.
