---
name: kanban-review
description: Reviews the tasks waiting in the Review lane of the local Kanban board, either itself (reviewer Claude or empty) or by dispatching the task's reviewer sub-agent, checking the recorded commits against the description and acceptance criteria, then posts findings and, after one confirmation, moves each task to Done or back to In Progress. Use when the user asks to review the in-review items, review kanban tasks or tickets, do a board review pass, or approve or send back tasks in review.
---
<!-- Created by Claude (claude-opus-5-5) -->
<!-- Date: 2026-09-30 -->

# Kanban: review tasks

CLI: `node .kanban/tool/kanban.mjs` in the Bash tool, run from the repo root (below: `kanban`). If it is missing, follow the setup note in the `kanban-add` skill.

## Select

```bash
kanban project                            # lane ids; the last lane is "done"
kanban commits sync                       # pick up commits that name task ids
kanban list --lane review --json
```

Narrow to the ids or `--sprint` the user gave. Sort each task by its `reviewer`:

| Reviewer | Action |
|---|---|
| `claude` or empty | review it yourself; set `kanban update <id> --reviewer claude` when empty |
| `agent:<name>` | dispatch that sub-agent (below) |
| a person | skip; list it as skipped in the report |

## Gather evidence (per task)

1. `kanban show <id>`: description, acceptance checklist (`- [ ]`), comments, `commits`, attachments, `screenshot`.
2. For each commit: `git show --stat <sha>`, then `git show <sha>` for the diff. If `commits` is empty, review `git diff HEAD` instead and say in the review that no commits were recorded.
3. When `screenshot` is true, look at the image attachments (Read tool on `.kanban/<path>`). A required screenshot that is missing means changes are requested.

## Review

Check the change against the task, not against taste:
- Every acceptance item is met, or the gap is named.
- Correctness: bugs, edge cases, error handling, security issues in the diff.
- Scope: unrelated changes, leftover debug code, missing tests or docs the task asked for.

For an `agent:<name>` reviewer, launch the Agent tool with `subagent_type` = `<name>` and `run_in_background: false`, passing the task JSON, the diffs (or the commands to get them), and: "Review this change against the task and its acceptance criteria. Reply with a verdict (Approved or Changes requested) and findings as a Markdown list, most severe first, each with file:line." Run independent reviews in parallel.

## Confirm, then apply

1. Show one table: `Id | Title | Reviewer | Verdict | Top findings`. Ask once with AskUserQuestion: ⭐ apply all verdicts (Recommended), apply approvals only, or comment only without moving anything.
2. Per task, as confirmed:
   ```bash
   kanban comment <id> --author <reviewer> --text "**Review: Approved**

   - <finding or note>"
   kanban log <id> --minutes <n> --tokens <n> --by <reviewer> --note "review"
   kanban update <id> --lane done           # approved
   kanban update <id> --lane in-progress    # changes requested
   ```
   `<reviewer>` is `Claude` for your own reviews, else `agent:<name>`. Use `**Review: Changes requested**` for send-backs, with each finding as a list item and code in fenced blocks. Log the agent's reported duration and tokens, or your elapsed time with an estimate (say so in the note).
3. If the CLI refuses a move (missing screenshot), leave the task in `review`, comment why, and tell the user. Do not use `--force` unless the user asks.

## Report

One line per task: id, verdict, new lane. Then the skipped tasks and why.
