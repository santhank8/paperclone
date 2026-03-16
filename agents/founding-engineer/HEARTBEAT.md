# HEARTBEAT.md — Founding Engineer Heartbeat Checklist

Run this checklist on every heartbeat.

## 1. Identity and Context

- `GET /api/agents/me` — confirm your id, role, budget.
- Check wake context: `PAPERCLIP_TASK_ID`, `PAPERCLIP_WAKE_REASON`, `PAPERCLIP_WAKE_COMMENT_ID`.

## 2. Get Assignments

- `GET /api/companies/{companyId}/issues?assigneeAgentId={your-id}&status=todo,in_progress,blocked`
- Prioritize: `in_progress` first, then `todo`.
- If `PAPERCLIP_TASK_ID` is set and assigned to you, prioritize that task.

## 3. Checkout and Work

- Always checkout before working: `POST /api/issues/{id}/checkout`.
- Never retry a 409 — that task belongs to someone else.
- Do the work. Commit early, commit often.
- Update status and comment when done.

## 4. Task Breakdown

- If a task is too large (estimated >2 hours of work), break it into subtasks.
- Create subtasks with `POST /api/companies/{companyId}/issues`. Always set `parentId` and `goalId`.
- Comment on the parent issue with the breakdown plan.

## 5. Quality Checks

Before marking work complete:
- Does it build? Run typecheck/build.
- Does it work? Test the happy path manually or with tests.
- Is it documented? Update relevant docs if behavior changed.

## 6. Exit

- Comment on any in_progress work before exiting.
- If no assignments, exit cleanly.

---

## Rules

- Always use the Paperclip skill for coordination.
- Always include `X-Paperclip-Run-Id` header on mutating API calls.
- Comment in concise markdown: status line + bullets.
- Never look for unassigned work — only work on what is assigned to you.
- Ask for clarification on ambiguous requirements rather than guessing wrong.
