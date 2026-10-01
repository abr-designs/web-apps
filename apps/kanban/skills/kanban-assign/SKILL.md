---
name: kanban-assign
description: Assigns tasks on the local Kanban board to the user, to Claude (the main session) or to a sub-agent picked from agents.json by matching task requirements to agent descriptions, and on request works the task (inline for Claude, through the sub-agent otherwise), recording its result, commits, screenshot, time and tokens. Use when the user asks to assign, delegate, dispatch or hand off a task or ticket, asks which agent should do a task, or says to run or work a kanban task with an agent.
---
<!-- Created by Claude (claude-opus-5-5) -->
<!-- Date: 2026-09-28 -->

# Kanban: assign and run

CLI: `node .kanban/tool/kanban.mjs` in the Bash tool, run from the repo root (below: `kanban`). If it is missing, follow the setup note in the `kanban-add` skill.

## Assign

1. Refresh the agent list when it may be stale (new plugins or agents), then read it:
   ```bash
   kanban agents refresh --cwd <current repo>
   kanban agents list
   ```
2. `kanban show <id>`. Match the task's requirements (read, write code, review, research, plan, test, UI) against each agent's description and tools. Suggest one agent with a one-line reason, plus "Claude (main session)" and "Me" as the other options, via AskUserQuestion. Suggest Claude first when the task needs the conversation's context or close back-and-forth with the user. Skip the question when the user already named the assignee.
3. Set it:
   ```bash
   kanban update <id> --assignee agent:<name>   # or claude, or the user's board name for "Me" (ask if unknown), or "" to unassign
   ```
   `<name>` is exactly the `name` in `agents.json` (plugin agents look like `plugin:agent`). `claude` means you, in the current session, with no sub-agent.

## Run (only when the user asks)

1. Move it and note the start:
   ```bash
   kanban update <id> --lane in-progress
   kanban comment <id> --text "Started by agent:<name>"
   ```
2. Launch the Agent tool with `subagent_type` = the agent `name` and `run_in_background: false`. Prompt:
   - the task JSON (title, description, links) and the repo path;
   - "Report: what you changed, how you verified it, and anything left open";
   - when `screenshot` is true: "Save a PNG screenshot showing the result to <scratchpad>/<id>-result.png and give its path". If the agent cannot capture screens (no browser or screenshot tool), capture it yourself after it finishes (built-in browser, or headless Edge `--screenshot`).
3. From the agent's result, record:
   ```bash
   kanban attach <id> --file <scratchpad>/<id>-result.png --name result.png   # when required or useful
   kanban log <id> --minutes <duration_ms / 60000, 1 decimal> --tokens <total_tokens> --by agent:<name> --note "<one line>"
   kanban comment <id> --author agent:<name> --text "<summary of the report>"
   kanban update <id> --lane review
   ```
   Use the duration and token usage reported with the agent's result; if one is missing, log the other and say so in the note.
4. If the agent failed or left the task incomplete: comment with the reason, keep the lane `in-progress`, and tell the user.

## Run as Claude (assignee `claude`)

Do the work yourself in this session, without the Agent tool: move the task to `in-progress`, implement and verify it, attach a screenshot when required, then log, comment and move it to `review` as in step 3 above with `--by Claude` and `--author Claude`.

## Logging your own work

When you (the main session) complete a board task yourself, log it with `--by Claude`, using the elapsed time and your best token estimate, and say in the note that the tokens are estimated.

## Commits

When work on a task is committed (only when the user asks for a commit), put the task id in the commit message (`T-0007: Add CSV export`), then record it:
```bash
kanban commit <id>              # HEAD; --sha <ref> for another commit
```
`kanban commits sync` adds any commits whose message names a task id, so reviewers can find the changes.

## Rules

- Never run agents on several tasks without the user asking; assigning alone never starts work.
- Working several assigned To Do tasks as a batch (group, plan, review, implement, hand off) is the `kanban-work` skill.
- A task in `review` needs the user's check; moving to `done` is the user's call unless they say otherwise.
