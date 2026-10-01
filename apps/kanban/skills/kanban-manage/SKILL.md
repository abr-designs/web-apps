---
name: kanban-manage
description: Manages items on the local Kanban board: lists and filters tasks, moves them between lanes, comments, attaches files, logs time and tokens, manages sprints and milestones, validates the data and deletes tasks with confirmation. Use when the user asks what is on the board, for a status or standup summary, to move, close, triage, comment on, attach to or delete tasks, or to start, close or edit a sprint.
---
<!-- Created by Claude (claude-opus-5-5) -->
<!-- Date: 2026-09-28 -->

# Kanban: manage items

CLI: `node .kanban/tool/kanban.mjs` in the Bash tool, run from the repo root (below: `kanban`). If it is missing, follow the setup note in the `kanban-add` skill. Add `--json` for machine-readable output.

## Reading

```bash
kanban list                                  # every task, by lane then order
kanban list --sprint sprint-1 --lane review  # filters: --lane --sprint --assignee --reviewer --label
kanban show T-0007
kanban validate                                     # bad files, unknown ids, missing media or screenshots
```

For a status summary, group by lane and name blockers (critical or overdue tasks, missing screenshots). Keep it short.

## Changing tasks

| Goal | Command |
|---|---|
| Move | `kanban update <id> --lane in-progress` (goes to the top; `--bottom` for the end) |
| Bulk edit | `kanban update <id> <id> ... --lane todo --assignee claude` (same fields on each, in board order; one error writes nothing) |
| Close | `kanban update <id> --lane done` |
| Comment | `kanban comment <id> --text "..."` (author `Claude`; `--author` to change) |
| Attach | `kanban attach <id> --file <path>` |
| Log work | `kanban log <id> --minutes 20 --tokens 35000 --by Claude --note "..."` |
| Record a commit | `kanban commit <id>` (HEAD, or `--sha <ref>`) |
| Sync commits | `kanban commits sync` (adds commits whose message names a task id; `--dry-run`, `--since <ref or date>`, `--all`) |
| Commit links | `kanban project set --commit-url "https://github.com/owner/repo/commit/{sha}"` |
| Delete | `kanban delete <id> --yes` |

- The CLI refuses to move a task with `screenshot: true` into `review` or the last lane without an image. Attach one first; do not use `--force` unless the user asks.
- Moving work into `done`: add a short result comment first.
- Comments and descriptions are Markdown; use fenced code blocks with a language for code.
- Reviewing tasks in `review` is the `kanban-review` skill.
- Delete: always confirm with the user (AskUserQuestion) naming the id and title, since the task file and its media are removed.

## Sprints and milestones

```bash
kanban sprint add --name "Sprint 3" --start 2026-10-12 --end 2026-10-23
kanban sprint set sprint-3 --status active     # planned | active | closed
```

- The board filters to the first `active` sprint, so keep one active at a time: when starting a new sprint, ask whether to close the current one.
- Before closing a sprint, list its tasks outside `done` and ask whether to move them to the next sprint (`update --sprint <id>`).

## Triage

1. `kanban list --lane backlog`.
2. Propose, per task: priority, sprint, tags and, where an agent fits, an assignee (see `kanban-assign`).
3. Apply after the user confirms.
