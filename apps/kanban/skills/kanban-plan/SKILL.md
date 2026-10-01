---
name: kanban-plan
description: Converts a plan document (arch-plan output, PRD, spec or checklist) into a sprint or milestone plus tasks on the local Kanban board, showing a preview table before writing. Use when the user asks to turn a plan, design doc, PRD, roadmap or list of steps into kanban tasks, tickets, a sprint or a milestone.
---
<!-- Created by Claude (claude-opus-5-5) -->
<!-- Date: 2026-09-28 -->

# Kanban: plan to sprint and tasks

CLI: `node .kanban/tool/kanban.mjs` in the Bash tool, run from the repo root (below: `kanban`). If it is missing, follow the setup note in the `kanban-add` skill.

## Workflow

1. Read the plan file in full. Run `kanban project` (lane ids, sprints, tags in use) and `kanban agents list`.
2. Choose the target: a new sprint named after the plan (status `planned`), or an existing sprint the user names.
3. Split the plan into tasks:
   - One task per component, flow or implementation step that can be finished and reviewed on its own. Merge trivial steps; split anything bigger than about a day.
   - Title: imperative, under 70 characters.
   - Description (Markdown): what to build, the acceptance criteria as a `- [ ]` checklist, and the plan section it comes from (`From docs/plans/0003-x.md, section "Components > storage.js"`).
   - Priority: `high` for blocking or core work, `medium` by default, `low` for polish and docs.
   - Tags: reuse existing tags; add the plan slug as a tag (`plan-0003`).
   - Assignee: suggest an agent only when its description clearly fits, `claude` for work that needs this conversation; otherwise leave empty.
   - Reviewer: `claude` or a reviewing agent when the user wants reviews; otherwise leave empty.
   - `screenshot: true` for UI-visible work.
   - Order the list so dependencies come first.
4. Show a preview table: `# | Title | Lane | Priority | Tags | Assignee | Reviewer | Shot`. Then ask the user to confirm or edit, using AskUserQuestion. Do not write before confirmation.
5. Write the spec to the scratchpad and run a dry run, then the real run:

```bash
kanban bulk --file <scratchpad>/plan-spec.json --dry-run
kanban bulk --file <scratchpad>/plan-spec.json
```

6. Report the sprint id and task ids. If the plan file has a status table, offer to add a line linking the sprint.

## Spec format

```json
{
  "sprint": { "name": "Tags and assignees", "start": "2026-10-01", "end": "2026-10-14", "status": "planned" },
  "tasks": [
    { "title": "Add tag palette and tagColor()", "description": "...", "lane": "todo", "priority": "high",
      "labels": ["plan-0002", "ui"], "assignee": "", "reviewer": "claude", "screenshot": false }
  ]
}
```

- `sprint` is an object for a new sprint, or a string id of an existing one. Omit it for no sprint. A new sprint whose name matches an existing one is refused; on a re-run, pass the existing id.
- Tasks keep the listed order: the first lands highest in its lane. `lane` defaults to the first lane.
- The CLI validates everything before writing; nothing is written on error.
