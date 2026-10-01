# Web Apps Monorepo Implementation Plan

Created by Claude (claude-opus-5-5), 2026-09-30

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish five static web apps from one repo on GitHub Pages behind a self-updating compact list directory, delivered as one scaffold PR plus one PR per app.

**Architecture:** A dependency-free Node script validates `apps/*/app.json`, stamps each app with its last git commit date, writes `apps.json`, and assembles `_site/`. A GitHub Actions workflow runs it as a check on PRs and deploys `_site/` to Pages on `main`. The directory page is static HTML plus an ES module that renders `apps.json`.

**Tech Stack:** Node 20 (`node:fs`, `node:path`, `node:child_process`, `node:test`), vanilla HTML/CSS/JS, GitHub Actions (`actions/checkout@v4`, `actions/setup-node@v4`, `actions/upload-pages-artifact@v3`, `actions/deploy-pages@v4`), `gh` CLI.

**Spec:** `docs/superpowers/specs/2026-09-30-web-apps-monorepo-design.md`

## Global Constraints

- Node 20, zero npm dependencies, no `package.json`.
- Slugs: `hiker`, `kanban`, `vehicle-lease`, `warhammer-paint`, `epub-generator`.
- `app.json` required fields `name`, `description`; optional `icon`, `color` in `teal | purple | coral | pink | amber | blue | gray`, default `gray`.
- `_site` excludes any path segment starting with `.` and top-level `docs/`, `tests/`, `tools/` inside each app; writes `.nojekyll`.
- Directory: max width 640px, 16px phone gutter, 48px min row height, light and dark via `prefers-color-scheme`, no external requests besides `apps.json`.
- Copy: empty state "No apps published yet." Fetch failure "Couldn't load the app list. Refresh to try again."
- New `.mjs/.js/.css` files start with `// Created by Claude (claude-opus-5-5)` / `// Date: 2026-09-30` (CSS uses `/* */`); `.html` uses `<!-- -->`; `.yml` uses `#`. No header in `app.json`. Imported app files untouched.
- No em dashes in any committed file. Commit messages follow `~/.claude/templates/commit-message.md` with footer `Co-Authored-By: Claude Opus 5.5 (1M context)`. PR bodies follow `~/.claude/templates/pull-request.md` and end with the Claude Code attribution line.

## Review Focus

1. A folder in `apps/` with an uppercase or spaced name (`apps/My App/`): build fails with a slug error instead of publishing a broken URL. Test in Task 1.
2. An app with no commits yet (untracked in a local run): `updated` is `null`, it sorts last, and the row shows no date instead of "Invalid Date". Tests in Task 2 and Task 3.
3. A `name` or `description` containing `<` or `&`: rendered as text, never as HTML. Test in Task 3.
4. A nested folder named `docs` or `tests` deeper than the app root (`apps/x/js/docs/`): kept in `_site`; only the app's top-level ones are stripped. Test in Task 2.
5. A stray file (not a directory) in `apps/`, such as `.gitkeep`: ignored, not reported as an app error. Test in Task 1.

---

### Task 1: App validation in the build script

**Files:**
- Create: `scripts/build-directory.mjs`
- Test: `scripts/build-directory.test.mjs`

**Interfaces:**
- Produces: `collectApps(appsDir: string) => { apps: AppMeta[], errors: string[] }` where `AppMeta = { slug, name, description, icon: string | null, color: string }`. Only directories are considered; each error string starts with `apps/<slug>: `.

- [ ] **Step 1: Write failing tests** using `node:test` and `node:assert/strict`. Each test builds a fixture tree under `fs.mkdtempSync(path.join(os.tmpdir(), 'wa-'))`.
  - `valid app is collected with defaults`: `ok/index.html` + `ok/app.json` `{ "name": "Ok", "description": "Fine." }` gives `apps` deep-equal `[{ slug: 'ok', name: 'Ok', description: 'Fine.', icon: null, color: 'gray' }]`, `errors` `[]`.
  - `missing index.html`: error matches `/apps\/a: missing index\.html/`.
  - `missing app.json`: error matches `/apps\/a: missing app\.json/`.
  - `invalid JSON`: error matches `/apps\/a: app\.json is not valid JSON/`.
  - `missing name`: error matches `/apps\/a: app\.json needs a non-empty "name"/`. Same pattern for `description`.
  - `unknown color`: `"color": "neon"` gives error matching `/apps\/a: "color" must be one of/`.
  - `bad slug`: folder `My App` gives error matching `/apps\/My App: folder name must match/`.
  - `files in apps are ignored`: a `.gitkeep` file alongside a valid app gives `errors` `[]` and one app.
  - `all errors are collected`: two broken apps give `errors.length === 2`.

- [ ] **Step 2: Run** `node --test scripts/` and confirm failures because `collectApps` is not exported.

- [ ] **Step 3: Implement `collectApps`** in `scripts/build-directory.mjs`. Slug rule `^[a-z0-9]+(-[a-z0-9]+)*$`. Export `COLORS` as the allowed list. Sort `apps` by slug for stable output.

- [ ] **Step 4: Run** `node --test scripts/`. Expected: all pass.

- [ ] **Step 5: Commit** `[ADD] build-directory collectApps() with tests` on branch `setup/monorepo-scaffold`.

### Task 2: Dates, apps.json, site assembly, CLI

**Files:**
- Modify: `scripts/build-directory.mjs`
- Modify: `scripts/build-directory.test.mjs`
- Create: `apps/.gitkeep`

**Interfaces:**
- Consumes: `collectApps` from Task 1.
- Produces:
  - `gitUpdated(slug: string, cwd: string) => string | null`: `git log -1 --format=%cI -- apps/<slug>` trimmed, `null` when empty.
  - `buildIndex(apps: AppMeta[], getUpdated: (slug) => string | null) => AppEntry[]`, `AppEntry = AppMeta & { updated: string | null, url: string }`, `url = '<slug>/'`, sorted `updated` descending with `null` last, ties by slug.
  - `assembleSite(rootDir: string, outDir: string, entries: AppEntry[]) => void`.
  - CLI: `node scripts/build-directory.mjs [--out <dir>]`. Prints one line per app (`slug  updated  name`). On errors prints each to stderr and exits 1. With `--out`, removes `<dir>` first, then assembles. `apps.json` is written into `<dir>` only (never into the repo root).

- [ ] **Step 1: Write failing tests**
  - `buildIndex sorts newest first, null last`: updates `{ a: '2026-09-01T00:00:00Z', b: null, c: '2026-09-20T00:00:00Z' }` give slug order `['c', 'a', 'b']` and `url` `'c/'`.
  - `assembleSite copies shell and apps`: fixture root with `index.html`, `directory.css`, `directory.js`, and `apps/x/{index.html, js/app.js, js/docs/keep.txt, docs/a.md, tests/t.js, tools/t.mjs, .claude/s.md, .kanban/b.json}`. After `assembleSite(root, out, [entry x])`: exists `out/index.html`, `out/apps.json`, `out/.nojekyll`, `out/x/index.html`, `out/x/js/app.js`, `out/x/js/docs/keep.txt`; does not exist `out/x/docs`, `out/x/tests`, `out/x/tools`, `out/x/.claude`, `out/x/.kanban`. `JSON.parse(out/apps.json)` deep-equals `[entry x]`.

- [ ] **Step 2: Run** `node --test scripts/`; confirm the new tests fail.

- [ ] **Step 3: Implement** `gitUpdated`, `buildIndex`, `assembleSite`, and the CLI entry guarded by `import.meta.url === pathToFileURL(process.argv[1]).href`. Use `fs.cpSync` with a `filter` that rejects dot segments and top-level `docs|tests|tools` relative to each app root.

- [ ] **Step 4: Run** `node --test scripts/` (all pass), then `node scripts/build-directory.mjs --out _site` with empty `apps/`. Expected: exit 0, `_site/apps.json` is `[]`. Add `_site/` to `.gitignore`.

- [ ] **Step 5: Commit** `Build script dates and site assembly` with bullets for the new functions, CLI, `.gitignore`, `apps/.gitkeep`.

### Task 3: Directory page

**Files:**
- Create: `index.html`, `directory.css`, `directory.js`
- Test: `scripts/directory.test.mjs`

**Interfaces:**
- Consumes: `apps.json` shape `AppEntry[]` from Task 2.
- Produces (exported from `directory.js`, an ES module loaded with `<script type="module">`):
  - `formatUpdated(iso: string | null) => string`: `'Updated Sep 28'` via `toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })`; `''` for `null`.
  - `renderList(entries: AppEntry[], doc: Document) => HTMLElement`: returns the list element, or a paragraph with the empty-state copy when `entries` is empty. All text set via `textContent`.
  - `ICONS`: map of icon name to inline SVG path data for `mountain`, `layout-kanban`, `car`, `brush`, `book`. Unknown icon renders the uppercase first letter of `name`.
  - Module side effect (only when `document` exists): fetch `apps.json`, render into `#app-list`, set `#app-count` to `"<n> apps"` (`"1 app"` singular), show fetch-failure copy on error.

- [ ] **Step 1: Write failing tests** in `scripts/directory.test.mjs` for the pure function only: `formatUpdated('2026-09-28T18:00:00-07:00') === 'Updated Sep 29'` (UTC), `formatUpdated(null) === ''`.

- [ ] **Step 2: Run** `node --test scripts/`; confirm failure.

- [ ] **Step 3: Implement** the three files per the spec's "Directory page" section and the chosen compact list mockup: row = 40px tinted icon tile, name (15px, weight 500), description (13px, one line, ellipsis), date, chevron; tint and text colors per `color` from tokens on `:root` with dark overrides. `index.html` has `<meta name="viewport" content="width=device-width, initial-scale=1">`, `<title>Web apps</title>`, `<main>` with `<h1>Web apps</h1>`, `<p id="app-count">`, `<div id="app-list">`.

- [ ] **Step 4: Run** `node --test scripts/` (pass). Then browser check: create a scratch fixture app `apps/demo-x/` with `app.json` `{ "name": "<b>Demo</b> & co", "description": "A very long description that keeps going well past the width of a phone screen to prove the ellipsis.", "icon": "car", "color": "coral" }` plus `index.html`, run `node scripts/build-directory.mjs --out _site`, serve `_site` with `npx --yes http-server _site -p 8080` via `preview_start`, and verify at 375px and desktop, light and dark: name shows literal `<b>Demo</b> & co`, description truncates, row with uncommitted app shows no date, no horizontal scroll. Then delete `apps/demo-x/` and confirm the empty state renders.

- [ ] **Step 5: Commit** `[ADD] Compact list directory page` plus test bullet.

### Task 4: Pages workflow and scaffold PR

**Files:**
- Create: `.github/workflows/pages.yml`
- Modify: `README.md`

**Interfaces:**
- Consumes: CLI from Task 2, tests from Tasks 1 to 3.

- [ ] **Step 1: Write** `pages.yml` per the spec's "Workflow" section. The `build` job runs `node --test scripts/` before `node scripts/build-directory.mjs --out _site`. `upload-pages-artifact` and `deploy` are gated on `github.event_name != 'pull_request'`. Top-level `permissions: contents: read`; `deploy` job adds `pages: write`, `id-token: write`.

- [ ] **Step 2: Update** `README.md`: one paragraph on what the repo is, the live URL, and "Add an app" steps (create `apps/<slug>/` with `index.html` and `app.json`, field table, local preview command `node scripts/build-directory.mjs --out _site`).

- [ ] **Step 3: Verify** locally: `node --test scripts/` passes and the build command exits 0.

- [ ] **Step 4: Commit** `[ADD] GitHub Pages workflow` and `[MOD] README add-an-app guide` as one multi-change commit.

- [ ] **Step 5: Push and open PR 1**: `git push -u origin setup/monorepo-scaffold`, `gh pr create --base main` with a body per the PR template. Bind with `ccd_pr`, confirm the `build` check passes. Tell the user to set Pages Source to GitHub Actions and merge.

### Task 5: App PRs (repeat per app, after PR 1 merges)

**Files (per app):**
- Create: `apps/<slug>/**` (imported), `apps/<slug>/app.json`

| Slug | Source | Import | app.json |
|------|--------|--------|----------|
| `hiker` | `D:/Repos/Misc/Hiker` | `git -C <src> archive HEAD \| tar -x -C apps/hiker` | `{"name":"Hiker","description":"Find and rank local hikes by season and drive time.","icon":"mountain","color":"teal"}` |
| `kanban` | `D:/Repos/Misc/kanban` | `git archive HEAD` | `{"name":"Kanban","description":"Local project board with a command-line companion.","icon":"layout-kanban","color":"purple"}` |
| `vehicle-lease` | `D:/Repos/Misc/car-deal` | `cp -r <src>/. apps/vehicle-lease/` | `{"name":"Vehicle Lease","description":"Compare vehicle lease and purchase options in BC.","icon":"car","color":"coral"}` |
| `warhammer-paint` | `D:/Repos/Misc/warhammer-painter` | `cp -r` | `{"name":"Warhammer Paint Tool","description":"Browse and track a Warhammer paint collection.","icon":"brush","color":"pink"}` |
| `epub-generator` | `D:/Repos/epub-generator` | `git archive HEAD` | `{"name":"EPUB Generator","description":"Build EPUB books in the browser.","icon":"book","color":"amber"}` |

Descriptions are drafts; confirm each against the app's README or UI during import and adjust.

- [ ] **Step 1:** `git checkout main && git pull && git checkout -b apps/<slug>`.
- [ ] **Step 2:** Import with the method above; write `app.json`.
- [ ] **Step 3: Verify** `node scripts/build-directory.mjs --out _site` exits 0 and lists the app; serve `_site`, open `/<slug>/`, confirm the app loads with no 404s in network requests.
- [ ] **Step 4: Commit** `[ADD] <Display name> app` with body `Imported from <source> at <short sha or "working copy">.`
- [ ] **Step 5:** Push, `gh pr create --base main`, bind, confirm `build` check passes.

App branches are independent of each other (each touches only `apps/<slug>/`), so all five PRs can be opened once PR 1 is merged.
