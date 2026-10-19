# web-apps

Static web apps and games by abr-designs, published together on GitHub Pages at https://abr-designs.github.io/web-apps/. The root page is a directory that lists every app in `apps/` and, under a Games tab, every game in `games/`, newest update first. It rebuilds on every push to `main` and whenever a PR into `main` is opened, updated, or closed.

## Add an app

1. Create `apps/<slug>/` where `<slug>` is lowercase letters, digits, and dashes, other than the reserved `dev` and `games`. The app is served at `https://abr-designs.github.io/web-apps/<slug>/`.
2. Put the app's `index.html` at the folder root. Use relative paths for assets.
3. Add `apps/<slug>/app.json`:

   ```json
   {
     "name": "Hiker",
     "description": "Find and rank local hikes by season and drive time.",
     "icon": "mountain",
     "color": "teal"
   }
   ```

   | Field | Required | Values |
   |-------|----------|--------|
   | `name` | yes | display name |
   | `description` | yes | one sentence |
   | `icon` | no | `mountain`, `layout-kanban`, `car`, `brush`, `book` (anything else shows the first letter of `name`) |
   | `color` | no | `teal`, `purple`, `coral`, `pink`, `amber`, `blue`, `gray` (default `gray`) |

4. Open a PR. The `Pages` workflow validates every app and publishes a preview under In Development. Merging deploys it.

Folders starting with `.` and an app's top-level `docs/`, `tests/`, and `tools/` stay in the repo but are not published.

## Add a game

Games follow the same steps as apps, with three differences:

- The folder is `games/<slug>/` and the game is served at `https://abr-designs.github.io/web-apps/games/<slug>/`.
- The metadata file is `games/<slug>/game.json`, with the same fields as `app.json` plus a required `tags` array of lowercase-with-dashes strings, for example `"tags": ["puzzle", "arcade"]`. Tags are lowercased, trimmed, and deduplicated at build time.
- PR previews are served at `https://abr-designs.github.io/web-apps/dev/pr-<n>/games/<slug>/` and appear in an In development section of the Games tab, not the In Development tab.

The Games tab shows each game's tags and a chip bar built from every tag. Selecting chips shows games with any selected tag. The selection is kept in the URL, so `https://abr-designs.github.io/web-apps/#games/puzzle,arcade` opens the tab with both chips selected. The tab is hidden until the first game exists.

## In Development

Every open PR into `main` from this repo that adds or edits `apps/<slug>/` gets a row under the In Development tab and a preview at `https://abr-designs.github.io/web-apps/dev/pr-<n>/<slug>/`. Link straight to the tab with `https://abr-designs.github.io/web-apps/#dev`. Closing or merging the PR removes the preview on the next deploy. An invalid app in a PR is skipped with a warning in the workflow log and never blocks the main deploy.

Previews run on the same origin as the published apps, so they share localStorage and IndexedDB with them. A preview that changes a storage key or schema can change the saved data the published app reads.

## Preview locally

```bash
node scripts/build-directory.mjs --out _site
npx http-server _site -p 8080
```

Run the build script tests with `node --test scripts/*.test.mjs` (Node 22 or newer).

## License

The code in this repository is MIT licensed; see [LICENSE](LICENSE). Third-party content shown by the apps is not covered: the games in Snackable, with their titles and cover art, belong to their creators and are embedded from itch.io and Lexaloffle, not redistributed.

Test test test
