---
name: kanban-work
description: Works the To Do tasks on the local Kanban board that are assigned to sub-agents or to Claude, by grouping related tasks, checking each is still valid and needed, planning each group, having a fresh sub-agent adversarially review the plan, recording plans on the tasks, implementing after one confirmation, verifying the result against the plan, the ask and the review findings, then committing and moving the tasks to Review with the user as reviewer. Use when the user asks to work, run, tackle or clear the agent tasks, the assigned to-do items, or the kanban backlog assigned to agents or Claude.
---
<!-- Created by Claude (claude-opus-5-5) -->
<!-- Date: 2026-09-30 -->

# Kanban: work assigned tasks

CLI: `node .kanban/tool/kanban.mjs` in the Bash tool, run from the repo root (below: `kanban`). If it is missing, follow the setup note in the `kanban-add` skill.

## 1. Select and group

```bash
kanban project                                   # lane ids; the first working lane is usually "todo"
kanban list --lane todo --json
```

- Keep tasks whose `assignee` is `claude` or `agent:<name>`. Narrow to the ids or `--sprint` the user gave.
- Group tasks with the same assignee that touch the same feature, files or plan (shared tag like `plan-0003`, one task blocking another). A task with nothing related is its own group. Keep groups small enough to review in one sitting.
- An assignee agent without write tools (for example `Explore` or `Plan`, see `kanban agents list`) cannot implement: flag the group for reassignment.

## 2. Validate (per task)

Read the task (`kanban show <id>`) and the code it names. Classify it:
- **Valid**: the problem still exists and the ask makes sense.
- **Done already**: the code already does it (name the file:line or commit).
- **Unclear or conflicting**: missing detail, contradicts another task or the code.

Only valid tasks go on to planning.

## 3. Plan (per group)

Write a short plan inline (no plan document): files to change, the approach, how to verify (tests, CLI run, browser check, screenshot when `screenshot` is true), and the acceptance items it covers. Keep to the smallest change that meets the task.

## 4. Adversarial review (per group)

Launch the Agent tool with `subagent_type` = `general-purpose`, `run_in_background: false`, groups in parallel. Pass the task JSON(s), the plan and the repo path, and say: "Argue against this plan. Find over-complexity (steps, abstractions or files the task does not need), logical errors, missed acceptance items, and edge cases it breaks. Reply with a Markdown list, most severe first, each marked Blocker or Minor, or 'No findings'." Revise the plan for every Blocker you agree with; note the ones you reject and why.

## 5. Confirm once

Reviewer: the user's board name (a person value already used as assignee or reviewer on the board, else `git config user.name`).

Show one table: `Group | Ids | Assignee | Verdict | Plan summary | Review findings`, plus the reviewer name. Ask once with AskUserQuestion: ⭐ run all valid groups (Recommended), pick groups, or record plans only.

For tasks that are **done already** or **unclear**, comment the finding and leave them in `todo`; never close them without the user.

## 6. Record and start (per group, as confirmed)

```bash
kanban comment <id> --text "**Plan**

- <step>

**Plan review**

- <finding> (applied | rejected: <why>)"
kanban update <id> <id> ... --lane in-progress   # the whole group at once
```

## 7. Implement (groups one at a time)

- Assignee `claude`: do the work yourself in this session.
- Assignee `agent:<name>`: Agent tool with `subagent_type` = `<name>`, `run_in_background: false`. Pass the task JSON(s), the final plan, the review findings and the repo path, and say: "Implement this plan. Report what you changed (file:line), how you verified it, and anything left open." Add the screenshot instruction from `kanban-assign` when `screenshot` is true.

## 8. Verify

Before committing, read the diff (`git diff`) and check it against:
1. the plan: every step done, nothing extra;
2. the ask: each acceptance item met;
3. the review findings: each applied Blocker handled.

Run the verification from the plan. Fix gaps (or send them back to the agent once). If a gap remains, comment it, keep the task `in-progress` and tell the user.

## 9. Commit and hand off

Commit the group's changes (the user's commit message conventions apply), with the ids in the subject (`T-0007, T-0008: Add CSV export`). Never push. Then per task:

```bash
kanban commit <id>
kanban attach <id> --file <scratchpad>/<id>-result.png --name result.png   # when screenshot is true
kanban log <id> --minutes <n> --tokens <n> --by <assignee> --note "<one line>"
kanban comment <id> --author <assignee> --text "**Work done**

- <change> (file)
- Verified: <how>
- Open: <anything left, or none>"
kanban update <id> --lane review --reviewer "<user's board name>"
```

`<assignee>` is `Claude` for your own work, else `agent:<name>`. Log the agent's reported duration and tokens; for your own work, the elapsed time and an estimate (say so in the note).

## Report

One line per task: id, verdict, new lane, commit. Then the tasks left in `todo` or `in-progress` and why.
