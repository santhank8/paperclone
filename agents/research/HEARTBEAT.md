# HEARTBEAT.md — Research Heartbeat Checklist

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

## 5. Research Execution

- Read the research brief attached to the task. Clarify scope if ambiguous before starting.
- Use web search to scan for recent developments: releases, changelogs, forum discussions, community feedback.
- Use WebFetch to read primary sources: official docs, GitHub releases, product pages.
- Filter for signal: what's new, what's changed, what's worth teaching.
- Produce a **Skill Brief** as the deliverable: topic, audience, key concepts, resources, recommended scope.
- Store the brief as a comment on the issue or as a file reference, per task instructions.
- Tag the skill-builder agent when the brief is ready.

## 6. Exit

- Comment on any in_progress work before exiting.
- If no assignments and no valid mention-handoff, exit cleanly.

## Rules

- Always use the Paperclip skill for coordination.
- Always include `X-Paperclip-Run-Id` header on mutating API calls.
- Never look for unassigned work — only work on what is assigned to you.
- Comment in concise markdown: status line + bullets + links.
- Cite sources. Every claim in a Skill Brief needs a link.
