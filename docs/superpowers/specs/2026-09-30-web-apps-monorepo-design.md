# Web Apps Monorepo Design

Created by Claude (claude-opus-5-5), 2026-09-30

## Goal

Consolidate five static web apps into `abr-designs/web-apps` and publish them on GitHub Pages behind a mobile-friendly directory page that updates itself whenever an app is added or changed.

Success criteria:

- `https://abr-designs.github.io/web-apps/` lists every app in `apps/`, newest update first.
- Each app is reachable at `https://abr-designs.github.io/web-apps/<slug>/`.
- Adding a folder `apps/<slug>/` with `index.html` and `app.json` and merging to `main` is the only step needed to list a new app.
- The directory is usable at 360px width with no horizontal scroll, and supports light and dark mode.
- Each app arrives in its own PR.

## Apps

| Slug | Display name | Source | Import method |
|------|--------------|--------|---------------|
| `hiker` | Hiker | `D:/Repos/Misc/Hiker` (repo `hiker-web`) | `git archive HEAD` |
| `kanban` | Kanban | `D:/Repos/Misc/kanban` | `git archive HEAD` |
| `vehicle-lease` | Vehicle Lease | `D:/Repos/Misc/car-deal` | file copy (no git) |
| `warhammer-paint` | Warhammer Paint Tool | `D:/Repos/Misc/warhammer-painter` | file copy (no git) |
| `epub-generator` | EPUB Generator | `D:/Repos/epub-generator` (repo `epub-generator`) | `git archive HEAD` |

`D:/Repos/Misc/car-lease-calculator` is out of scope.

Import rules:

- Repos are imported from their committed `HEAD`, so uncommitted working-tree edits are left behind. History stays in the original repos.
- `.git` is never copied. `.claude/`, `.kanban/`, and `.gitignore` are kept in the app folder.
- All five apps are plain HTML/CSS/JS with relative asset paths, so they run unchanged under a `/<slug>/` subpath.

## Repository layout

```
web-apps/
├── index.html                  directory page shell
├── directory.css               directory styles
├── directory.js                fetches apps.json, renders rows
├── apps/
│   └── <slug>/
│       ├── index.html          required app entry point
│       ├── app.json            required directory metadata
│       └── ...                 app files
├── scripts/
│   └── build-directory.mjs     validates apps, writes apps.json, assembles _site
├── .github/workflows/
│   └── pages.yml               check on PR, build and deploy on main
└── docs/superpowers/specs/     design docs
```

## app.json

```json
{
  "name": "Hiker",
  "description": "Plan and track hikes.",
  "icon": "mountain",
  "color": "teal"
}
```

| Field | Required | Rules |
|-------|----------|-------|
| `name` | yes | non-empty string |
| `description` | yes | non-empty string, one sentence |
| `icon` | no | name from a small inline SVG icon set shipped with the directory; unknown or missing falls back to the first letter of `name` |
| `color` | no | one of `teal`, `purple`, `coral`, `pink`, `amber`, `blue`, `gray`; default `gray` |

## Build script: `scripts/build-directory.mjs`

Node 20, no dependencies. Steps:

1. List directories in `apps/`.
2. For each, require `index.html` and a parseable `app.json` with `name` and `description`. Collect every error, print them all, exit 1 if any.
3. Read `updated` as the ISO date of `git log -1 --format=%cI -- apps/<slug>`.
4. Write `apps.json` as an array of `{ slug, name, description, icon, color, updated, url }`, sorted by `updated` descending, `url` = `<slug>/`.
5. With `--out <dir>`: assemble the site. Copy `index.html`, `directory.css`, `directory.js`, `apps.json` to `<dir>/`, and each `apps/<slug>/` to `<dir>/<slug>/`, skipping any path segment that starts with `.` plus top-level `docs/`, `tests/`, `tools/` inside each app. Write `<dir>/.nojekyll`.

Without `--out` the script only validates and prints the resulting list. This is the PR check and the local preview command.

## Workflow: `.github/workflows/pages.yml`

- Triggers: `push` to `main`, `pull_request` to `main`, `workflow_dispatch`.
- Job `build`: `actions/checkout` with `fetch-depth: 0` (needed for per-app dates), `actions/setup-node` v20, run `node scripts/build-directory.mjs --out _site`. On `push` and `workflow_dispatch`, upload `_site` with `actions/upload-pages-artifact`.
- Job `deploy`: runs only on `push` and `workflow_dispatch`, needs `build`, uses `actions/deploy-pages`, `environment: github-pages`, permissions `pages: write`, `id-token: write`.
- `concurrency: pages` with `cancel-in-progress: false`.
- One-time manual setup: repo Settings, Pages, Source = GitHub Actions.

## Directory page (layout 2: compact list)

- Header: title "Web apps" and app count.
- One row per app: 40px rounded icon tile tinted by `color`, name, description (one line, ellipsis), "Updated MMM D" date, chevron. The whole row is a link with a 48px minimum tap target.
- Sorted newest-updated first (order comes from `apps.json`).
- Max content width 640px, centered; 16px side gutter on phones.
- Colors as CSS custom properties on `:root`, overridden under `prefers-color-scheme: dark`; `body` sets an explicit background.
- Empty state when `apps.json` is an empty array: "No apps published yet." Fetch failure: "Couldn't load the app list. Refresh to try again."
- No framework, no external requests besides `apps.json`.

## Attribution

New `.js`, `.mjs`, and `.css` files get the standard two-line header. New `.html` and `.yml` files get the same header in `<!-- -->` and `#` comments. `app.json` files carry no header since JSON has no comments. Imported app files are left untouched.

## Pull requests

Each PR branches from the latest `main`.

1. `setup/monorepo-scaffold`: this spec, directory page, build script, workflow, empty `apps/.gitkeep`, README update. The directory deploys with the empty state.
2. `apps/hiker`
3. `apps/kanban`
4. `apps/vehicle-lease`
5. `apps/warhammer-paint`
6. `apps/epub-generator`

Each app PR adds `apps/<slug>/` with the imported files plus a new `app.json`, and nothing else. The PR check proves the app validates; merging deploys it and the directory picks it up automatically.

## Testing

- Build script: run locally against fixture folders covering a valid app, missing `index.html`, missing `app.json`, invalid JSON, and missing `name`, and confirm exit codes and messages. Run with `--out` and confirm `_site` contents exclude dot folders and app `docs/`, `tests/`, `tools/`.
- Directory page: serve `_site` locally and check it in the browser at 375px and desktop widths, in light and dark mode, with zero apps and with all five.
- Each app PR: open `_site/<slug>/` locally and confirm the app loads with no 404s in the network panel.
