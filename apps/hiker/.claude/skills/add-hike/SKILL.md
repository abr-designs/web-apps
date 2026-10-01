---
name: add-hike
description: Adds one or more hikes to data/hikes.json from a name, an AllTrails link or pasted details, researching the stats and coordinates, asking for the personal ratings, then validating and appending with tools/add-hike.mjs. Use when the user asks to add, import or include a hike or trail in the Hiker list.
---
<!-- Created by Claude (claude-opus-5-5) -->
<!-- Date: 2026-09-28 -->

# Add a hike

CLI: `node tools/add-hike.mjs --file <spec.json> [--dry-run]`, run from the repo root. It applies the same checks as the in-app form (`buildHike` in `js/customHikes.js`) and appends to `data/hikes.json`.

## Workflow

Repeat per hike when the user gives several.

1. **Gather facts.** Start from what the user gave (name, AllTrails link, stats).
   - AllTrails link: WebFetch it for length, elevation gain, estimated time, trailhead coordinates and season notes. If it is blocked, WebSearch the trail name and read one or two trail pages.
   - Coordinates are the trailhead. Never guess them: take them from a source page, or ask the user to paste "lat, lon" from a map. Leave them out only if the user agrees (the hike then gets no weather or drive time).
   - Convert units: miles x 1.609 = km, feet x 0.3048 = m. Time in decimal hours.
2. **Ask for the ratings** with AskUserQuestion (one question per rating, all in one call). Put the value the research suggests first, marked ⭐ (Recommended):
   - Difficulty: 1 Easy, 2 Moderate, 3 Challenging, 4 Hard, 5 Extreme.
   - Quality: 1 Poor, 2 Fair, 3 Good, 4 Great, 5 Outstanding. This is the user's opinion; default to their answer, not a site's star rating.
   - Accessibility from Vancouver: 1 Easy to reach, 2 Short detour, 3 Long drive, 4 Remote, 5 Expedition.
3. **Fill the optional fields** from the research: `months` (1 = January; leave out when unknown), `tags` (`WATERFALLS`, `BIG_TREES`, `WILDFLOWERS`, `SWIMMING`, `COASTAL_VIEWS`, `MOUNTAIN_VIEWS`, `HISTORY`, `GEOLOGY`), `access` (`Ferry`, `4x4`, `Kayak`), `country` (`CA` or `US`), `allTrails`, `notes` (short season or permit note).
4. **Preview** as a table (field, value, source) and confirm with AskUserQuestion before writing. Flag any value that came from a guess or a conversion.
5. **Write** the spec to the scratchpad, dry-run, then run for real:

```bash
node tools/add-hike.mjs --file <scratchpad>/hike.json --dry-run
node tools/add-hike.mjs --file <scratchpad>/hike.json
```

   A non-zero exit prints every problem in one line; fix the spec and re-run. A duplicate name means the hike is already in the list: tell the user instead of renaming it.
6. **Photo:** run `node tools/images.mjs`, then show the new `data/images.json` entry and ask the user to check that the photo matches the hike (README "Photos" explains rejecting one).
7. Run `node --test "tests/*.test.mjs"`. Do not commit unless asked.

## Spec format

```json
{
  "name": "Mount Seymour", "allTrails": "https://www.alltrails.com/...",
  "lat": 49.3663, "lon": -122.9486,
  "lengthKm": 8, "timeHrs": 4, "gainM": 450,
  "difficulty": 2, "quality": 4, "accessibility": 2,
  "months": [6, 7, 8, 9, 10], "tags": ["MOUNTAIN_VIEWS"], "access": [],
  "country": "CA", "notes": "June-October"
}
```

The `id` is made from the name. `tools/convert.mjs` rebuilds `data/hikes.json` from the sheet and drops hikes added this way, so remind the user to add the hike to the sheet too if they still re-import from it.
