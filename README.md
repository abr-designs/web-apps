# web-apps

Static web apps by abr-designs, published together on GitHub Pages at https://abr-designs.github.io/web-apps/. The root page is a directory that lists every app in `apps/`, newest update first. It rebuilds on every push to `main`.

## Add an app

1. Create `apps/<slug>/` where `<slug>` is lowercase letters, digits, and dashes. The app is served at `https://abr-designs.github.io/web-apps/<slug>/`.
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

4. Open a PR. The `Pages` workflow validates every app. Merging deploys it.

Folders starting with `.` and an app's top-level `docs/`, `tests/`, and `tools/` stay in the repo but are not published.

## Preview locally

```bash
node scripts/build-directory.mjs --out _site
npx http-server _site -p 8080
```

Run the build script tests with `node --test scripts/*.test.mjs` (Node 22 or newer).

Test test test
