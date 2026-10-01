---
name: kanban-add
description: Adds or edits tasks on the local Kanban board through its Node CLI, including title, Markdown description, lane, priority, tags, due date, sprint, assignee, reviewer and screenshot requirement. Use when the user asks to add, create, log, capture or edit a task, ticket, card, bug or todo on the kanban board.
---
<!-- Created by Claude (claude-opus-5-5) -->
<!-- Date: 2026-09-28 -->

# Kanban: add and edit tasks

CLI: `node .kanban/tool/kanban.mjs` in the Bash tool, run from the repo root (below: `kanban`). The board is `<repo>/.kanban`, one project per folder, and this copy of the CLI always uses the board it sits in (`--root` points elsewhere). If `.kanban/tool/kanban.mjs` is missing, tell the user to run the global `setup-kanban` skill in this repo.

## Quick start

```bash
kanban project                                    # lane ids, sprints, tags in use
kanban add --title "Fix login redirect" --lane todo --priority high --labels bug,auth
kanban update T-0007 --description "Steps: ..." --due 2026-10-10
```

## Workflow

1. Run `kanban project`: it prints lane ids, sprint ids with their status, and the tags in use. Pass these ids to `--lane` and `--sprint`.
2. Build the task:
   - Title: short imperative ("Add CSV export"). Put details and acceptance criteria in `--description`, written in Markdown: a `- [ ]` checklist for acceptance criteria and fenced code blocks with a language (```` ```js ````) for code.
   - Lane: `backlog` unless the user says otherwise.
   - Priority: `critical | high | medium | low` (default `medium`).
   - Tags: reuse the tags in use before inventing new ones.
   - Sprint: the `active` sprint when the work belongs to it.
   - `--screenshot true` when the result is visual (UI, layout, chart) or the user asks for proof.
   - Assignee: for "me", use the name the user shows on the board (the "You" button). If you don't know it, ask once; a recent comment by the user is a good suggestion. Use `claude` for you (the main session, no sub-agent) and `agent:<name>` from `kanban agents list` for sub-agents (see the `kanban-assign` skill).
   - Reviewer (`--reviewer`): same values as the assignee. `claude` or an `agent:` reviewer is picked up by the `kanban-review` skill.
3. Run `add` once per task. For more than three tasks, write a spec and use `kanban bulk --file spec.json` (format in the `kanban-plan` skill).
4. Report the created ids in one line each.

## Editing

- `kanban show <id>` before editing, so you change only what was asked.
- `kanban update <id> --field value`. A lane change puts the task at the top of the new lane (`--bottom` for the end).
- Add new context as a comment (`kanban comment <id> --text "..."`) and keep the description for the task definition.
- Clear a field with an empty value: `--due ""`, `--sprint ""`, `--assignee ""`, `--reviewer ""`.
- Values may start with dashes (`--description "--- notes"`); every flag except `--json --bottom --force --yes --dry-run` takes the next argument as its value.

## Rules

- Make every change through the CLI; it keeps ids, order and JSON format consistent.
- If the CLI returns an error (unknown lane, sprint or agent), fix the input; use `--force` only when the user asks.
- Deleting is a `kanban-manage` action and needs the user's confirmation.
