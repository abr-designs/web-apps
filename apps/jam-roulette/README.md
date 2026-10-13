<!-- Created by Claude (claude-opus-5-5) -->
<!-- Date: 2026-10-13 -->

# Jam Roulette

Spin slot-machine reels for a game jam prompt: Mechanic, Art Style, Input, Character, Setting and a Lospec colour palette. Lock a reel to keep it on the next spin, toggle reels on or off, and copy a link that reproduces the result. Static HTML, CSS and JS; settings live in `localStorage`, the result lives in the URL hash.

## Run

ES modules need http, so serve the folder:

```bash
npx --yes http-server . -p 8082 -c-1
```

## Files

| File | What it holds |
|---|---|
| `index.html` | Page shell: reel toggles, reel grid, Spin, Copy link, colour slider |
| `css/style.css` | Theme tokens on `:root` (Color Hunt palette) and all styles |
| `js/main.js` | Spin animation, locks, toggles, share link, `localStorage` |
| `js/reels.js` | Curated reel entries. Edit by hand |
| `js/links.js` | Steam or Wikipedia page per reference game. Generated |
| `js/palettes.js` | Lospec palettes. Generated |
| `tools/resolve-links.mjs` | Builds `js/links.js` |
| `tools/fetch-palettes.mjs` | Builds `js/palettes.js` |

`tools/` is not published.

## Edit entries

Each entry in `js/reels.js` is `[name, ...referenceGames]`; references are optional. The URL key is the slugified name, so renaming an entry breaks share links that point at it (the reel just re-rolls).

After adding or renaming a reference game on any reel except Art Style, run:

```bash
node tools/resolve-links.mjs
```

It links each game to its Steam page on an exact title match. If it reports `MISSING`, or matches the wrong game, pin the URL in its `OVERRIDES` list (a Steam app page, else Wikipedia) and run it again. Generic titles can match an unrelated game, so check the developer of any new automatic match.

## Add a reel

Add an object to `REELS` in `js/reels.js`:

```js
{ id: "theme", label: "Theme", entries: [["Loss"], ["It's spreading"]] }
```

`id` is the URL key. Add `visual: true` to make its references open an image search instead of a game page. Toggles, locks, sharing and saving pick it up with no other changes.

## Palettes

```bash
node tools/fetch-palettes.mjs --top 200
```

Pulls the most-downloaded Lospec palettes of up to 64 colours (the slider's max) plus the `KEEP` list in the tool. Add a slug from a `lospec.com/palette-list/<slug>` URL to `KEEP` to force it in; leave existing slugs there so old share links keep working.
