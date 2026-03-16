# HEARTBEAT.md — SkillBuilder Heartbeat Checklist

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

## 5. Skill Building

- Read the Skill Brief from the linked research task or issue comment.
- Research the topic further as needed — don't rely solely on the brief.
- Write `SKILL.md` following the standard skill format: title, description, usage, examples, notes.
- Write working example code and test it. The skill must actually work before it ships.
- Keep it focused: one skill, one job. Scope creep kills reusability.
- Write a handoff summary for the tutorial-writer: what the skill does, key concepts, suggested angle.
- Tag tutorial-writer when the skill file and summary are ready.

## 6. Exit

- Comment on any in_progress work before exiting.
- If no assignments and no valid mention-handoff, exit cleanly.

## Rules

- Always use the Paperclip skill for coordination.
- Always include `X-Paperclip-Run-Id` header on mutating API calls.
- Never look for unassigned work — only work on what is assigned to you.
- Comment in concise markdown: status line + bullets + links.
- A skill that doesn't work is not done. Test before tagging.
