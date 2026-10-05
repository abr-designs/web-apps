# In Development Tab Design

Created by Claude (claude-opus-5-5), 2026-10-05

## Goal

Show apps that are still in open pull requests on the Pages directory, under an "In Development" tab, each with a working preview.

Success criteria:

- Opening or pushing to a PR against `main` that adds or edits `apps/<slug>/` makes that app appear under "In Development" with a preview at `https://abr-designs.github.io/web-apps/dev/pr-<n>/<slug>/`.
- Merging or closing the PR removes its rows and preview on the next deploy.
- An invalid app in a PR never blocks the deploy of `main`.
- The published "Apps" list behaves exactly as today.
- The tab is hidden when no open PR changes an app.

## Decisions

| Topic | Decision |
|-------|----------|
| Source | Open PRs into `main` from this repository. Fork PRs are skipped. Branches without a PR do not appear. |
| Content | One row per app the PR adds or edits. PRs touching only scripts, workflow or directory files add no rows. Deleted apps are skipped. |
| Trigger | Deploy directly from the PR workflow run. The `github-pages` environment deployment branch rule is changed to allow all branches. |
| Layout | Two tabs, "Apps" and "In Development (n)", using the existing compact rows. |

## Workflow

`.github/workflows/pages.yml` triggers:

- `push` to `main`
- `pull_request` against `main` with types `opened`, `synchronize`, `reopened`, `closed`
- `workflow_dispatch`

Jobs:

- `test`: checks out the triggering ref (the PR merge ref on PR events) and runs `node --test scripts/*.test.mjs`. A PR that breaks the scripts fails here and never deploys.
- `build` (needs `test`): checks out `main` with `fetch-depth: 0`, so scripts and published apps always come from `main`. Writes the open PR list with `gh pr list --base main --state open --limit 100 --json number,title,url,updatedAt,headRefOid,isCrossRepository > prs.json`, then runs `node scripts/build-directory.mjs --out _site --dev prs.json` and uploads `_site`.
- `deploy` (needs `build`): unchanged `actions/deploy-pages@v4`.

Every run, whatever triggered it, rebuilds `main` plus every PR open at that moment. A closed PR is already absent from the list, so its preview disappears. All runs share one concurrency group `pages` with `cancel-in-progress: false`, so a newer run queues behind the active one.

Permissions: `contents: read` and `pull-requests: read` at workflow level; `pages: write` and `id-token: write` on `deploy`. `GH_TOKEN` is set from `github.token` for the `gh` step.

One-time settings change: the `github-pages` environment deployment branch policy is switched to allow all branches through `gh api`. Effect: a workflow on any branch of this repository can publish to Pages. Accepted because the repository has a single owner and every deploy rebuilds from `main` plus open PRs.

## Build script

`scripts/build-directory.mjs` gains an optional `--dev <prs.json>` argument. Without it, behavior and output match today except that `dev.json` is written as `[]` when `--out` is given.

New exported functions:

- `changedSlugs(diffOutput)`: takes `git diff --name-status` output limited to `apps/`, returns the sorted unique slugs that have at least one added or modified file. A slug whose files are all deleted is excluded. Files directly under `apps/` (such as `.gitkeep`) are ignored.
- `collectDev(prs, run, workDir)`: for each PR with `isCrossRepository` false, fetches `pull/<n>/head`, diffs `main...<headRefOid>`, extracts each changed slug with `git archive <sha> apps/<slug>` into a temp folder, and validates it with `collectApps`. Returns `{entries, warnings}`. `run(args)` executes a git command and returns stdout, injected so tests can stub it. Invalid apps and git failures produce a warning naming the PR and slug and are skipped.
- `buildDevIndex(prs, appsByPr)`: pure. Returns entries sorted by PR `updatedAt` descending, then PR number, then slug. Each entry is the app fields plus `updated` (PR `updatedAt`), `url` (`dev/pr-<n>/<slug>/`) and `pr: {number, title, url}`.

`assembleSite` gains a `devEntries` argument: writes `dev.json` and copies each dev app from its temp folder to `_site/dev/pr-<n>/<slug>/` with the existing file filter (no dot paths, no top-level `docs`, `tests`, `tools`).

Warnings print to stdout as `warning: PR #<n> apps/<slug>: <message>` and do not change the exit code. Errors in `main` apps still exit 1 as today.

## Directory page

`index.html` adds a tab list between the heading and the list container:

- `role="tablist"` with two `role="tab"` buttons: "Apps" and "In Development (n)". The second is hidden until `dev.json` loads with at least one entry.
- The active tab is reflected in `location.hash` (`#dev` for In Development, empty for Apps), so `https://abr-designs.github.io/web-apps/#dev` opens the dev tab.
- The count line under the heading reflects the active tab ("5 apps" or "2 in development").
- If `dev.json` fails to load, the dev tab stays hidden and the Apps tab works as today.

`directory.js` changes:

- `renderList(entries, doc)` renders a dev row when an entry has `pr`: the second line reads `PR #<n> · <title>` (the separator is a middle dot), the date line shows the PR's last update, the row links to the preview, and a small `#<n>` link to the PR on GitHub sits at the end of the row as a sibling of the row link (no nested anchors).
- New exported `tabLabel(count)` returns `In Development (<count>)`.
- Text is set with `textContent` only.

`directory.css` adds tab styles using the existing tokens: underline indicator for the active tab, 44px minimum touch height, focus ring with `--focus`, works at 360px with no horizontal scroll.

## Testing

`node:test` cases:

- `changedSlugs`: added, modified, deleted-only, mixed, root-level files ignored, duplicates collapsed.
- `buildDevIndex`: sort order, URL and `pr` shape.
- `collectDev` with a stubbed `run`: fork PR skipped, invalid app produces a warning and no entry, git failure produces a warning.
- `assembleSite`: writes `dev.json` and copies dev apps with the filter applied.
- `renderList` with a dev entry: PR line text, preview href, GitHub link outside the row link.

Manual check after merge: open a draft PR touching one app, confirm the row and preview appear, close it, confirm they disappear.

## Out of scope

- Branches without a PR.
- Previews for directory or script changes.
- Comments on the PR with the preview link.
