---
name: qa-review
tags: [testing, review]
description: >
  QA review workflow — review other agents' completed work and post actionable
  feedback directly on the reviewed issue, not just your own task. Use when your
  task involves reviewing, testing, or validating another agent's deliverables.
---

# QA Review Skill

## When to Use

Use this skill when your task involves reviewing, testing, or QA-ing work done
by another agent. Your task description will typically reference another issue
(e.g., "Review VIB-21", "QA the frontend implementation in VIB-15").

## Cross-Issue Feedback (Critical)

When you review another agent's work, you MUST post feedback on **their issue**,
not just your own. The agent who did the work needs to see your feedback in
their task's comment thread.

### Workflow

1. **Identify the target issue.** Extract the issue ID from your task description,
   parent chain, or linked issues. If unclear, search:
   ```
   GET $PAPERCLIP_API_URL/api/companies/$PAPERCLIP_COMPANY_ID/issues?q=<search terms>
   ```

2. **Fetch the target issue and its comments** to understand what was delivered:
   ```
   GET $PAPERCLIP_API_URL/api/issues/<target-issue-id>
   GET $PAPERCLIP_API_URL/api/issues/<target-issue-id>/comments
   ```

3. **Do your review.** Examine code, research output, deliverables, etc.

4. **Post feedback on the TARGET issue** (the one you're reviewing, NOT your own):
   ```
   POST $PAPERCLIP_API_URL/api/issues/<target-issue-id>/comments
   Headers: Authorization: Bearer $PAPERCLIP_API_KEY
            X-Paperclip-Run-Id: $PAPERCLIP_RUN_ID
   {
     "body": "## QA Review\n\n<your structured feedback>"
   }
   ```

5. **If the work needs changes**, also @-mention the responsible agent in your
   comment so they get woken up:
   ```json
   { "body": "## QA Review\n\nFound issues that need fixing. @FrontendEngineer please address:\n\n- ..." }
   ```

6. **Update YOUR task** with a summary of the review and link to the target issue:
   ```
   PATCH $PAPERCLIP_API_URL/api/issues/<your-task-id>
   { "status": "done", "comment": "Reviewed [VIB-21](/VIB/issues/VIB-21). Posted feedback. See [comment](/VIB/issues/VIB-21#comment-<id>)." }
   ```

### Feedback Structure

Use this template for review comments:

```markdown
## QA Review

**Verdict:** Approved / Needs Changes / Rejected

### What was reviewed
- Brief description of what you examined

### Findings
- Finding 1 (severity: critical/major/minor)
- Finding 2 ...

### Required Changes (if any)
- [ ] Specific actionable item 1
- [ ] Specific actionable item 2

### Notes
- Any additional context or suggestions
```

## Rules

- **Always post on the reviewed issue** — your feedback belongs where the
  implementer will see it, not buried in your own QA task.
- **@-mention the assignee** when changes are needed — this triggers their
  heartbeat so they can act on feedback promptly.
- **Link both ways** — your task should link to the reviewed issue, and your
  comment on the reviewed issue should reference your QA task for traceability.
- **Be specific and actionable** — "needs improvement" is not useful. Cite
  exact problems and suggest fixes.
- **Set appropriate status on the reviewed issue** if you have permission:
  - Work is good → leave status as-is (or suggest `done`)
  - Needs changes → set to `in_progress` or `blocked` with your comment
