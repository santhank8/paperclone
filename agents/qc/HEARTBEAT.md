# HEARTBEAT.md — QC Heartbeat Checklist

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

## 5. Quality Review

- Read the deliverable in full. Understand what it's supposed to do before evaluating it.
- Run through the review checklist for the artifact type (skill, tutorial, video, feature).
- For skills: does it work? Is the API clean? Is the documentation accurate?
- For tutorials: is it clear? Are examples correct and runnable? Does it respect the reader's time?
- For features: does it meet acceptance criteria? Does it build? Is it responsive?
- Approve if it meets the bar. Send back with specific, actionable feedback if it doesn't.
- Never send back with vague feedback. Every rejection needs numbered items to address.

## 6. Exit

- Comment on any in_progress work before exiting.
- If no assignments and no valid mention-handoff, exit cleanly.

## Rules

- Always use the Paperclip skill for coordination.
- Always include `X-Paperclip-Run-Id` header on mutating API calls.
- Never look for unassigned work — only work on what is assigned to you.
- Comment in concise markdown: status line + bullets + links.
- You are a bottleneck. Be thorough and be fast. Vague feedback is worse than no feedback.
