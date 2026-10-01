<!-- Created by Claude (claude-opus-5-5) -->
<!-- Date: 2026-09-28 -->

# Hiker

Local hikes as photo cards with a 7-day weather strip. Hikes with good weather on the chosen day come first as Good matches; each group is sorted by the hike Score (kept in the background, lower = more reasonable). Static HTML, CSS and JS; no server, no API keys. Weather comes from [Open-Meteo](https://open-meteo.com) and drive times from the public [OSRM](https://project-osrm.org) server, both cached in the browser.

Design: [docs/plans/0001-hiker-web-app.md](docs/plans/0001-hiker-web-app.md).

## Run

ES modules and `fetch` need http, so serve the folder:

```bash
npx serve .
```

VS Code Live Server works too. Opening `index.html` from disk does not.

## Test

```bash
node --test "tests/*.test.mjs"
```

`tests/hikeScore.test.mjs` checks the Score formula against every row of the sheet export in `data/source/Local.csv`.

## Add a hike

In the app, **Add hike** opens a form. The location search finds towns and parks; for a trailhead, paste "lat, lon" from a map into the search box. Added hikes are saved in this browser only and can be removed from their enlarged card. To keep them, click **Download hikes.json** and replace `data/hikes.json` with it; the browser copies are then ignored. Run `node tools/images.mjs` afterwards to look up photos.

With Claude Code, `/add-hike <name or AllTrails link>` researches the stats and trailhead, asks for your ratings and appends the hike with `node tools/add-hike.mjs --file hike.json` (add `--dry-run` to only check it). The tool applies the same checks as the form.

To add one by hand, append an object to `data/hikes.json`. The Score is computed on load, so leave it out.

```json
{
  "id": "mount-seymour",
  "name": "Mount Seymour",
  "allTrails": "https://www.alltrails.com/...",
  "lat": 49.3663, "lon": -122.9486,
  "lengthKm": 8, "timeHrs": 4, "gainM": 450,
  "difficulty": 2, "quality": 4, "accessibility": 2,
  "months": [6, 7, 8, 9, 10],
  "tags": ["MOUNTAIN_VIEWS"],
  "access": [],
  "country": "CA",
  "notes": "June-October"
}
```

| Field | Required | Notes |
|---|---|---|
| `id` | yes | Unique slug. |
| `name` | yes | |
| `lengthKm`, `timeHrs`, `gainM` | yes | Numbers. |
| `difficulty`, `quality`, `accessibility` | yes | Same 1 to 5 scales as the sheet. |
| `lat`, `lon` | no | Without them the hike gets no weather or drive time. |
| `months` | no | Month numbers, 1 = January. Leave out when unknown; the In season filter keeps such hikes. |
| `tags` | no | Any of `WATERFALLS`, `BIG_TREES`, `WILDFLOWERS`, `SWIMMING`, `COASTAL_VIEWS`, `MOUNTAIN_VIEWS`, `HISTORY`, `GEOLOGY`. |
| `access` | no | Any of `Ferry`, `4x4`, `Kayak`. |
| `country` | no | `CA` or `US`. |
| `allTrails`, `notes` | no | |

A missing required field stops the app with a message naming the hike.

## Re-import from the sheet

Export the `Local` and `Database` sheets as CSV into `data/source/`, then:

```bash
node tools/convert.mjs
```

This overwrites `data/hikes.json` (hand-added hikes included) and prints unmatched names and Local/Database conflicts. Local wins every conflict.

## Photos

`data/images.json` maps a hike id to one of:

| Entry | Meaning |
|---|---|
| `{url, page, credit, title}` | A photo, its source page, the credit shown on the card (linked to the page for attribution) and the source's own title. |
| `{rejected: [page, ...]}` | Photos turned down by hand. The card shows fallback art and lookups never pick these pages again. |
| `null` | Nothing found. |

To fill in new hikes:

```bash
node tools/images.mjs
```

Sources, most specific first: Wikimedia Commons (hike name near its coordinates), Flickr (hike name within 5 km of its coordinates), Wikipedia articles within 10 km whose title names the hike, then [Openverse](https://openverse.org) (openly licensed photos with no location, so it searches the name plus province or state and the title must also look scenic or regional). Every source needs the distinctive words of the hike name (not words like mount or lake) in the photo's title. The run paces itself around rate limits and retries failed requests; hikes that still fail are left out and tried again on the next run. Add `--retry-misses` to look up `null` and rejected entries again.

Flickr needs a free API key (create one at flickr.com/services/apps/create). Put it in an untracked `.env.local` file as `FLICKR_API_KEY=...`, or set it in the environment. Without a key the run skips Flickr.

Matching is by text, so the same name elsewhere can slip through. Check each new photo against the hike before committing. To reject one, replace the entry with `{"rejected": ["<its page>"]}` (keep earlier rejected pages in the list). To pick a photo yourself, write the entry by hand.

## Settings

`js/config.js` holds the forecast length, weather band thresholds, cache lifetimes and the default home (Vancouver). Drive times start from the saved home, then your location, then the default.
