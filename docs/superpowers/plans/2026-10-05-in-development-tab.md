# In Development Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** List apps changed by open PRs under an "In Development" tab on the Pages directory, each with a preview at `dev/pr-<n>/<slug>/`.

**Architecture:** The workflow writes the open PR list to `prs.json`; `build-directory.mjs --dev prs.json` fetches each PR head, finds changed app folders, extracts and validates them, and assembles them under `_site/dev/` with a `dev.json` index. The directory page loads `dev.json` and shows it in a second tab.

**Tech Stack:** Node 22 (no dependencies), `node:test`, GitHub Actions, `gh` CLI, vanilla ES modules.

**Spec:** `docs/superpowers/specs/2026-10-05-in-development-tab-design.md`

## Global Constraints

- No em dashes in any file.
- New files get the attribution header `Created by Claude (claude-opus-5-5)` / `Date: 2026-10-05`; new exported functions get `/** @created Claude (claude-opus-5-5) 2026-10-05 */`.
- No runtime or dev dependencies; tests run with `node --test scripts/*.test.mjs`.
- Dev preview URL: `dev/pr-<n>/<slug>/`. Index file: `dev.json`.
- Fork PRs (`isCrossRepository: true`) are skipped.
- PR app problems are warnings (`warning: PR #<n> apps/<slug>: <message>`), never a non-zero exit.
- DOM text set with `textContent` only.
- Delivery is one commit on `main` (user request): tasks do not commit; Task 4 commits everything including the spec and this plan.

## Review Focus

- PR that renames an app folder: old slug has only deletions and must be excluded, new slug included. Test in Task 1 (`changedSlugs` mixed case).
- PR whose head was force-pushed or deleted between `gh pr list` and fetch: `git fetch` fails; must warn and continue. Test in Task 2 (git failure stub).
- PR app with a bad `app.json`: warn and skip, main deploy proceeds. Test in Task 2.
- PR title containing HTML: rendered as text. Test in Task 3 (`renderList` dev row with `<b>` in title).
- `dev.json` missing (older deploy cached) or empty: dev tab stays hidden, Apps tab unaffected. Test in Task 3 (`tabLabel`/visibility helper) plus manual check in Task 4.

---

### Task 1: Pure dev helpers in the build script

**Files:**
- Modify: `scripts/build-directory.mjs`
- Test: `scripts/build-directory.test.mjs`

**Interfaces:**
- Produces: `changedSlugs(nameStatus: string): string[]`; `buildDevIndex(prs: Pr[], appsByPr: Map<number, App[]>): DevEntry[]` where `Pr = {number, title, url, updatedAt, headRefOid, isCrossRepository}`, `App` is the existing `collectApps` app shape, `DevEntry = App & {updated: string, url: string, pr: {number, title, url}}`.

- [ ] **Step 1: Write failing tests**

```js
test('changedSlugs keeps added and modified apps, drops delete-only and root files', () => {
  const out = [
    'A\tapps/new/index.html', 'M\tapps/edit/app.json', 'M\tapps/edit/js/a.js',
    'D\tapps/gone/index.html', 'M\tapps/.gitkeep',
    'R100\tapps/old/a.js\tapps/renamed/a.js', 'D\tapps/old/index.html',
  ].join('\n');
  assert.deepEqual(changedSlugs(out), ['edit', 'new', 'renamed']);
});

test('changedSlugs on empty output', () => {
  assert.deepEqual(changedSlugs(''), []);
});

test('buildDevIndex sorts by PR update then number then slug and shapes entries', () => {
  const pr = (number, updatedAt) => ({ number, title: `T${number}`, url: `u${number}`, updatedAt });
  const prs = [pr(1, '2026-10-01T00:00:00Z'), pr(2, '2026-10-03T00:00:00Z')];
  const appsByPr = new Map([[1, [meta('a')]], [2, [meta('c'), meta('b')]]]);
  const entries = buildDevIndex(prs, appsByPr);
  assert.deepEqual(entries.map((e) => `${e.pr.number}/${e.slug}`), ['2/b', '2/c', '1/a']);
  assert.deepEqual(entries[0], { ...meta('b'), updated: '2026-10-03T00:00:00Z', url: 'dev/pr-2/b/', pr: { number: 2, title: 'T2', url: 'u2' } });
});
```

- [ ] **Step 2: Run `node --test scripts/*.test.mjs`.** Expected: FAIL, `changedSlugs` / `buildDevIndex` not exported.

- [ ] **Step 3: Implement both functions.** `changedSlugs` parses `git diff --name-status` lines; for renames/copies (status starting `R` or `C`) the destination path counts as added and the source as deleted; a slug is kept when any of its paths has status other than `D`; paths with no folder under `apps/` are ignored; result sorted and unique. `buildDevIndex` sorts as tested.

- [ ] **Step 4: Run tests.** Expected: all PASS.

### Task 2: Collect, assemble and CLI wiring for dev apps

**Files:**
- Modify: `scripts/build-directory.mjs`
- Test: `scripts/build-directory.test.mjs`

**Interfaces:**
- Consumes: `changedSlugs`, `buildDevIndex`, `collectApps` (Task 1, existing).
- Produces:
  - `collectDev(prs: Pr[], run: (args: string[], opts?: {buffer?: boolean}) => string | Buffer, workDir: string): {entries: DevEntry[], warnings: string[]}`. For each non-fork PR: `run(['fetch', 'origin', `pull/${n}/head`])`, `run(['diff', '--name-status', `main...${headRefOid}`, '--', 'apps/'])`, then per changed slug `run(['archive', '--format=tar', headRefOid, `apps/${slug}`], { buffer: true })`, write the tar to `<workDir>/pr-<n>.tar` and extract into `<workDir>/pr-<n>/` with `execFileSync('tar', ['-xf', ...])`. Then `collectApps(<workDir>/pr-<n>/apps)` filtered to the changed slugs, and `buildDevIndex`. Dev app source dir is always `<workDir>/pr-<n>/apps/<slug>`.
  - `assembleSite(rootDir, outDir, entries, devEntries = [], workDir = null)` writes `dev.json` (always) and copies each dev app from `<workDir>/pr-<n>/apps/<slug>` to `<outDir>/dev/pr-<n>/<slug>` with the existing filter (extract the filter into a shared `copyApp(src, dest)` helper).
  - CLI `--dev <file>`: reads the JSON PR list, uses `fs.mkdtempSync(os.tmpdir())` as `workDir`, real `run` = `execFileSync('git', args, { cwd: rootDir, encoding: opts?.buffer ? 'buffer' : 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })`, prints warnings, prints `<n> in development`.

- [ ] **Step 1: Write failing tests** using a stubbed `run` and a real temp tree (archive stub returns a tar made with `tar -cf` from a fixture folder, or simpler: stub `run` for `archive` to throw and test only warnings; for the success path, build a real git repo in a temp dir with `git init`, commit a main app, branch, add `apps/new`, and use `ref` names in place of PR fetch by stubbing `fetch` to no-op).

```js
test('collectDev skips fork PRs without calling git', () => { /* run throws if called; entries [] warnings [] */ });
test('collectDev warns and continues when fetch fails', () => {
  // run throws on fetch for PR 1, succeeds for PR 2 (real repo); warnings[0] matches /^warning: PR #1: /
});
test('collectDev warns on invalid app.json in a PR', () => {
  // real repo branch adds apps/bad with app.json '{}' ; entries [] ; warnings[0] matches /PR #3 apps\/bad: app\.json needs a non-empty "name"/
});
test('collectDev returns changed valid apps from a PR branch', () => {
  // real repo branch adds apps/new; entries[0].url === 'dev/pr-4/new/'
});
test('assembleSite writes dev.json and filtered dev copies', () => {
  // dev/pr-4/new/index.html exists, dev/pr-4/new/docs absent, dev.json deep-equals devEntries
});
test('assembleSite writes empty dev.json without dev entries', () => { /* [] */ });
```

Warning format: `warning: PR #<n>: <git error first line>` for git failures; `warning: PR #<n> apps/<slug>: <collectApps message without the "apps/<slug>: " prefix>` for validation.

- [ ] **Step 2: Run tests.** Expected: FAIL.
- [ ] **Step 3: Implement `collectDev`, `copyApp`, extended `assembleSite`, and `--dev` CLI.** The real repo test helper creates commits with `git -c user.name=t -c user.email=t@t commit`.
- [ ] **Step 4: Run tests.** Expected: all PASS, existing 18 still PASS.
- [ ] **Step 5: Local smoke:** `node scripts/build-directory.mjs --out _site --dev <scratch>/prs.json` with `prs.json` = `[]` prints `0 in development` and writes `_site/dev.json` = `[]`.

### Task 3: Tabs and dev rows on the directory page

**Files:**
- Modify: `index.html`, `directory.js`, `directory.css`
- Test: `scripts/directory.test.mjs`

**Interfaces:**
- Consumes: `dev.json` entries shaped as `DevEntry` (Task 1).
- Produces: `tabLabel(count: number): string`, `renderList(entries, doc)` dev-row support.

- [ ] **Step 1: Write failing tests** with a minimal fake document in the test file (`createElement`/`createElementNS` return objects with `tagName`, `className`, `textContent`, `href`, `children`, `append(...)`, `setAttribute`).

```js
test('tabLabel', () => assert.equal(tabLabel(2), 'In Development (2)'));
test('renderList dev row shows PR line, preview link and separate PR link', () => {
  const entry = { slug: 'x', name: 'X', description: 'd', icon: null, color: 'gray', updated: '2026-10-03T12:00:00Z',
    url: 'dev/pr-7/x/', pr: { number: 7, title: '<b>Try</b>', url: 'https://github.com/abr-designs/web-apps/pull/7' } };
  const li = renderList([entry], fakeDoc()).children[0];
  const [row, prLink] = li.children;
  assert.equal(row.href, 'dev/pr-7/x/');
  assert.ok(texts(row).includes('PR #7 · <b>Try</b>'));
  assert.equal(prLink.href, entry.pr.url);
  assert.equal(prLink.textContent, '#7');
});
test('renderList published row has no PR link', () => { /* li.children.length === 1 */ });
```

- [ ] **Step 2: Run tests.** Expected: FAIL.
- [ ] **Step 3: Implement.**
  - `index.html`: between `<header>` and `#app-list` add `<nav class="tabs" role="tablist" hidden>` with `<button role="tab" id="tab-apps" aria-selected="true">Apps</button>` and `<button role="tab" id="tab-dev" aria-selected="false"></button>`.
  - `directory.js`: dev row = `li` with class `dev-item` holding the row anchor and `<a class="pr-link" href=pr.url>#n</a>`; description line text `PR #<n> · <title>`. `init()` fetches `apps.json` and `dev.json` in parallel; dev failure or empty array keeps the tab nav hidden; tab click sets `location.hash` (`#dev` or `''` via `history.replaceState`) and re-renders; `hashchange` and initial `#dev` select the dev tab when available; count line reads `N apps` / `1 app` or `N in development`.
  - `directory.css`: `.tabs` flex row with bottom border; tab buttons transparent, `min-height: 44px`, `font: inherit`, muted color; `[aria-selected="true"]` primary color with 2px bottom border in `--text-primary`; `:focus-visible` outline `--focus`; `.dev-item { display: flex; align-items: center; }` with the row `flex: 1; min-width: 0`; `.pr-link` muted 13px, padding 12px 14px, no underline.
- [ ] **Step 4: Run tests.** Expected: all PASS.
- [ ] **Step 5: Browser check:** build `_site` with a hand-written `dev.json` of one entry, serve via the `site` launch config, confirm both tabs, `#dev` deep link, 360px width with no horizontal scroll, dark mode. Then rebuild with `[]` and confirm the tab nav is hidden.

### Task 4: Workflow, environment rule and commit

**Files:**
- Modify: `.github/workflows/pages.yml`, `README.md` (add one short "In Development" section: open a PR that touches `apps/<slug>/` to get a preview at `/dev/pr-<n>/<slug>/`)

- [ ] **Step 1: Update `pages.yml`** per spec: triggers (`pull_request` types `opened, synchronize, reopened, closed`), workflow permissions `contents: read`, `pull-requests: read`, concurrency `group: pages`, `cancel-in-progress: false`; `test` job (default checkout, Node 22, tests); `build` job (`needs: test`; checkout `ref: main`, `fetch-depth: 0`; step `gh pr list ... > "$RUNNER_TEMP/prs.json"` with `GH_TOKEN: ${{ github.token }}`; build with `--dev "$RUNNER_TEMP/prs.json"`; upload artifact unconditionally); `deploy` unchanged except the `if` is removed. Update the header comment.
- [ ] **Step 2: Run tests and full local build** `node --test scripts/*.test.mjs` and `node scripts/build-directory.mjs --out _site --dev <scratch>/prs.json`. Expected: PASS, site written.
- [ ] **Step 3: Ask the user, then change the environment rule:** `gh api -X PUT repos/abr-designs/web-apps/environments/github-pages -F "deployment_branch_policy=null"` (allows all branches). Verify with `gh api repos/abr-designs/web-apps/environments/github-pages`.
- [ ] **Step 4: Commit on `main`** with spec, plan, scripts, tests, page and workflow. Ask before pushing.
- [ ] **Step 5: After push:** confirm the `main` run deploys and `https://abr-designs.github.io/web-apps/dev.json` returns `[]`. Manual PR check from the spec is offered to the user (Snackable PR is the natural candidate).
