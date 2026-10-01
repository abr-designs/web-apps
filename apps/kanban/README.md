<!-- Created by Claude (claude-opus-5-5) -->
<!-- Date: 2026-09-28 -->

# Kanban

A local, Trello-like board in plain HTML, CSS and JavaScript. No build step, no server, no dependencies.

## Run it

1. Double-click `index.html` (Chrome or Edge).
2. Click **Open folder** and pick a project folder, for example `<repo>/.kanban` or the `example` folder next to `index.html`. An empty folder offers **Create board here**.
3. Each folder holds one project. The browser remembers every folder you open: the project dropdown in the top bar lists them, newest first, and **Open folder...** adds another. On the next visit the last one reopens on its own; if the browser asks for access again, pick it from the **Recent** list on the start screen.

Tick the box on a card to select it (Shift+click a second box to select the range in that lane; the lane header box selects every visible card in it). A bar then moves the selected tasks to a lane or sets their assignee or reviewer, saving on each pick. Dragging a selected card moves the whole selection. Esc or ✕ clears it. Cards hidden by a filter leave the selection.

**Work in memory** runs without a folder (or in browsers without folder access). Data lives only in the tab, so use **Export** before closing.

Enter your name on the start screen (or later with the **You** button in the top bar). This browser remembers it and uses it as the author of your comments.

The board checks the open project every 3 seconds and redraws when files change on disk, so edits made by Claude or a text editor appear on their own. **Reload** also rereads `agents.json`.

## Files

```
index.html            page and toolbar
style.css             all styling; theme variables at the top
js/util.js            DOM builder and small helpers
js/markdown.js        Markdown rendering and code highlighting for descriptions and comments
js/storage.js         folder and memory backends, project and task I/O, recent folders
js/board.js           lanes, cards, drag-drop
js/task-editor.js     task dialog
js/project-settings.js  project name, description, commit URL, lanes, sprints and tag colors
js/import-export.js   bundle export and import
js/app.js             wiring, state, polling
tools/kanban.mjs      command-line access for Claude and scripts (Node, no dependencies)
tools/setup.mjs       copies the skills and CLI into a project
skills/               Claude Code skills that drive the CLI
example/              sample project folder
```

Scripts are classic `<script>` files attached to `window.Kanban`, which lets the page run from `file://`.

## Data layout

A project folder, usually `<repo>/.kanban`:

```
project.json
agents.json
tasks/T-0001.json
media/T-0001-<filename>
```

`project.json`:

```json
{
  "name": "Example Project",
  "description": "",
  "lanes": [{ "id": "backlog", "name": "Backlog" }, { "id": "todo", "name": "To Do" }],
  "sprints": [{ "id": "sprint-1", "name": "Sprint 1", "start": "2026-09-28", "end": "2026-10-09", "status": "active" }],
  "labels": { "bug": "red" },
  "commitUrl": "https://github.com/owner/repo/commit/{sha}",
  "created": "2026-09-28T09:00:00.000Z"
}
```

`commitUrl` turns task commits into links: `{sha}` is replaced by each commit SHA. Leave it `""` to show plain SHAs. Only `http(s)` values containing `{sha}` are kept.

`labels` pins tag colors: `red`, `orange`, `yellow`, `green`, `teal`, `blue`, `indigo`, `purple`, `pink` or `gray`. Other tags get a stable color from their name. Change colors in **Project settings**.

Lane and sprint ids are set at creation and stay the same after a rename. A task whose `lane` is unknown shows in the first lane.

Sprints (also usable as milestones) have `status` `planned`, `active` or `closed`, and dates as `YYYY-MM-DD` or `""`. When a project opens, the board filters to the first active sprint; the toolbar's sprint filter switches between all tasks, tasks with no sprint, and each sprint. New tasks join the sprint being viewed. Manage sprints in **Project settings**.

Task file (`tasks/T-0002.json`), 2-space indent and a trailing newline:

```json
{
  "id": "T-0002",
  "title": "Sketch the board layout",
  "description": "",
  "lane": "in-progress",
  "priority": "high",
  "labels": ["design"],
  "due": "2026-10-03",
  "sprint": "sprint-1",
  "assignee": "agent:general-purpose",
  "reviewer": "claude",
  "screenshot": true,
  "order": 10,
  "created": "2026-09-28T09:05:00.000Z",
  "updated": "2026-09-28T10:00:00.000Z",
  "links": [{ "title": "Spec", "url": "https://example.com" }],
  "attachments": [{ "name": "layout.svg", "path": "media/T-0002-layout.svg", "type": "image/svg+xml" }],
  "comments": [{ "author": "Claude", "date": "2026-09-28T10:00:00.000Z", "text": "Added a sketch." }],
  "commits": [{ "sha": "7c1df7d", "subject": "T-0002: Add layout sketch", "date": "2026-09-28T10:00:00-07:00" }],
  "work": [{ "by": "agent:general-purpose", "date": "2026-09-28T10:00:00.000Z", "minutes": 18, "tokens": 52000, "note": "Layout sketch" }]
}
```

- `priority`: `critical`, `high`, `medium` or `low`.
- `due`: `YYYY-MM-DD` or `""`.
- `sprint`: a sprint id from `project.json`, or `""` for none. An unknown id counts as no sprint.
- `description` and comment `text`: Markdown. The editor shows the description rendered, with a **Write** tab and toolbar for editing. Supported: headings, bold, italic, strikethrough, inline code, fenced code blocks with a language (highlighted, with a Copy button), bullet, numbered and `- [ ]` checklists, quotes, rules and links (`http`, `https`, `mailto`). HTML shows as text.
- `assignee`: `""` (unassigned), a person's name (the **You** name counts as "Me"), `claude` (the main Claude session, working without a sub-agent), or `agent:<name>` with a name from `agents.json`.
- `reviewer`: same values as `assignee`. The `kanban-review` skill reviews tasks in `review` whose reviewer is `claude`, empty or an agent.
- `commits`: `{ sha, subject, date }` entries, added by `kanban commit`, `kanban commits sync` or the editor. A short and a full SHA of the same commit count as one.
- `screenshot`: `true` when the work must be shown with an image attachment. The card shows a red "needed" badge until one is attached, and the CLI refuses to move the task to `review` or the last lane without one.
- `work`: time and tokens spent, one entry per session or agent run. Cards show the totals.
- `order`: sorts cards inside a lane, lowest first. The board renumbers a lane 10, 20, 30... after a drag.
- Missing fields load with defaults. Extra fields are kept when the app saves the task.
- Only files named `T-<number>.json` in `tasks/` are read as tasks. A file with invalid JSON is listed in a warning banner and skipped.
- If a task file changes on disk while it is open in the editor, Save asks before overwriting it.

## Agents list

`agents.json` in the project folder lists the sub-agents offered in the editor's **Assignee** and **Reviewer** dropdowns:

```json
{ "generated": "2026-09-28T14:00:00.000Z", "agents": [{ "name": "Explore", "source": "built-in", "description": "..." }] }
```

The browser cannot read `~/.claude` on its own, so refresh the file after adding agents or plugins, then click **Reload**:

```bash
node tools/kanban.mjs agents refresh --root <project folder> --cwd <repo whose .claude/agents to include>
```

It collects the built-in agents, `~/.claude/agents`, `<cwd>/.claude/agents` and the agents of enabled plugins (named `plugin:agent`). Each `name` is the value to pass as the sub-agent type.

## Command line

`tools/kanban.mjs` reads and writes one project folder with the same rules as the board. Run it with no arguments for the full list.

```bash
node tools/kanban.mjs init --name "My repo"
node tools/kanban.mjs list --sprint sprint-1
node tools/kanban.mjs add --title "Fix login" --lane todo --labels bug --assignee agent:Explore --screenshot true
node tools/kanban.mjs update T-0005 --lane review
node tools/kanban.mjs update T-0005 T-0006 T-0009 --lane todo --assignee claude   # same fields on each, all or nothing
node tools/kanban.mjs attach T-0005 --file shot.png
node tools/kanban.mjs log T-0005 --minutes 12 --tokens 48000 --by agent:Explore
node tools/kanban.mjs update T-0005 --reviewer claude
node tools/kanban.mjs commit T-0005                  # record HEAD (or --sha <ref>)
node tools/kanban.mjs commits sync                   # add commits whose message names a task id
node tools/kanban.mjs project set --commit-url "https://github.com/owner/repo/commit/{sha}"
node tools/kanban.mjs bulk --file spec.json --dry-run
node tools/kanban.mjs validate --root example
```

The project folder is `--root`, else the board holding the CLI when it runs from a project copy (`<board>/tool/kanban.mjs`), else `KANBAN_ROOT`, else `.kanban` in the current directory. `init` creates it. `commit` and `commits sync` run git in `--cwd`, default the current directory.

## Set up a project

`tools/setup.mjs` gives a project its own board and Claude Code skills:

```bash
node tools/setup.mjs --target <repo> [--name "Project name"] [--update]
```

It copies:
- `skills/kanban-add`, `kanban-plan`, `kanban-manage`, `kanban-assign`, `kanban-work` and `kanban-review` to `<repo>/.claude/skills/`
- the CLI (`kanban.mjs`, `js/util.js`, `js/storage.js`) to `<repo>/.kanban/tool/`

Then it creates `project.json` and `agents.json` in `<repo>/.kanban` when they are missing. The skills run `node .kanban/tool/kanban.mjs` from the repo root. When copies already exist and differ from this app, nothing is written unless `--update` is passed. Tasks and media are never touched. The global `setup-kanban` skill (`~/.claude/skills/`) runs this script from inside a project.

## Import and export

**Export** saves `<project-name>.kanban.json`, one file holding the project, its tasks and its media as base64 data URLs:

```json
{ "format": "kanban-bundle", "version": 1, "project": {}, "tasks": [], "media": { "media/T-0002-layout.svg": "data:image/svg+xml;base64,..." } }
```

**Import** reads such a file into the open folder when it holds no project yet: open an empty folder first.

Copying a project folder elsewhere and opening it with **Open folder...** also works.

## Rules for agents

When Claude (or any tool) edits a project directly on disk:

1. Keep every file valid JSON, pretty-printed with 2 spaces and a trailing newline.
2. The filename equals the `id`: `tasks/T-0007.json` holds `"id": "T-0007"`.
3. New task id: the highest existing `T-` number in `tasks/` plus 1, zero-padded to 4 digits.
4. Timestamps are ISO 8601 UTC (`2026-09-28T14:05:00.000Z`). Set `created` on new tasks and update `updated` on every change.
5. Comments from Claude use `"author": "Claude"`. Append to `comments`; keep existing entries.
6. Put files in `media/` named `<task-id>-<name>` and reference them by relative path: `{ "name": "shot.png", "path": "media/T-0007-shot.png", "type": "image/png" }`.
7. New tasks go to the top of their lane: set `lane` to the lane id from `project.json` and `order` to the lowest `order` in that lane minus 10 (zero and negative values are fine), or `10` for an empty lane. To add at the bottom instead, use the highest `order` plus 10.
8. Use lane and sprint ids from `project.json`; their names are display text. Put a new task in the active sprint when the work belongs to it.
9. Prefer `tools/kanban.mjs` over hand edits; it applies rules 1 to 8.
10. A task with `"screenshot": true` gets an image attachment showing the result before it moves to `review` or the last lane.
11. After working on a task, append a `work` entry with the minutes and tokens spent; `by` is `agent:<name>` for a sub-agent or `Claude` for the main session.
12. Put the task id in commit messages (`T-0007: Add CSV export`) and record the commit with `kanban commit <id>`.

Grep examples (run inside the project folder):

```bash
grep -l '"lane": "in-progress"' tasks/*.json      # tasks in a lane
grep -l '"priority": "critical"' tasks/*.json      # critical tasks
grep -l '"sprint": "sprint-1"' tasks/*.json        # tasks in a sprint
grep -l '"assignee": "agent:' tasks/*.json         # tasks assigned to agents
grep -il 'drag' tasks/*.json                       # full-text search
grep -h '"title"' tasks/*.json                     # all titles
ls tasks | sort | tail -1                          # highest task id
```
