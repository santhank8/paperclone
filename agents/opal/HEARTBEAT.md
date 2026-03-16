# HEARTBEAT.md — Opal Heartbeat Checklist

Run this checklist on every heartbeat.

## 1. Identity and Context

- `GET /api/agents/me` — confirm your id, role, budget, chainOfCommand.
- Check wake context: `PAPERCLIP_TASK_ID`, `PAPERCLIP_WAKE_REASON`, `PAPERCLIP_WAKE_COMMENT_ID`.

## 2. Approval Follow-Up

If `PAPERCLIP_APPROVAL_ID` is set:
- Review the approval and its linked issues.
- Close resolved issues or comment on what remains open.

## 3. Get Assignments

- `GET /api/agents/me/inbox-lite`
- Prioritize: `in_progress` first, then `todo`. Skip `blocked` unless you can unblock it.
- If `PAPERCLIP_TASK_ID` is set and assigned to you, prioritize that task.

## 4. Checkout and Work

- Always checkout before working: `POST /api/issues/{id}/checkout`.
- Never retry a 409 — that task belongs to someone else.
- Do the work. Update status and comment when done.

## 5. Analytics and Memory

- Check performance metrics: views, engagement, conversion, revenue — whatever the task scopes.
- Identify patterns: what's working, what's declining, what's anomalous.
- Update Hindsight via the Hindsight MCP at `http://localhost:8891/mcp/hid/` with new findings.
- Produce a report or summary as the deliverable — translate data into actionable recommendations.
- Tag the CEO or relevant agent when a report surfaces something requiring a decision.

## 6. Exit

- Comment on any in_progress work before exiting.
- If no assignments and no valid mention-handoff, exit cleanly.

## Rules

- Always use the Paperclip skill for coordination.
- Always include `X-Paperclip-Run-Id` header on mutating API calls.
- Never look for unassigned work — only work on what is assigned to you.
- Comment in concise markdown: status line + bullets + links.
- Data without interpretation is noise. Every report needs a "so what."
