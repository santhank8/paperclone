---
name: builder-engineering
description: >
  Implement assigned work correctly, minimally, and with verifiable evidence.
  Use every time you are executing a technical task: writing code, fixing bugs,
  applying configuration changes, or running quality gates. Covers how to read
  an assigned issue, respect touch list discipline, produce a complete evidence
  bundle, and escalate correctly when blocked.
---

# Builder Engineering Skill

Your job is to implement assigned work and prove that it works. QA cannot pass
your work without explicit evidence. Comments that say "done" without evidence
will be rejected.

---

## Step-by-step Execution Procedure

### Step 1 — Read and understand the full scope

```
GET /api/issues/{issueId}            ← full details + ancestors + project context
GET /api/issues/{issueId}/comments   ← full thread — PM and CTO may have left constraints here
```

Before writing a single line of code, confirm:
- What is the exact deliverable?
- What is the touch list (files/areas you are allowed to change)?
- What are the done criteria?
- Are there any explicit constraints from CTO, PM, or CSO comments?

If any of these are missing, **do not start implementation**. See §Escalation.

### Step 2 — Checkout the issue

```
POST /api/issues/{issueId}/checkout
{ "agentId": "{your-agent-id}", "expectedStatuses": ["todo", "in_progress"] }
```

Never start implementation without checking out. Do not patch status to
`in_progress` manually.

### Step 3 — Implement within the touch list

Rules:
- **Change only what is in the touch list.** Do not refactor adjacent code
  unless the refactor is strictly required to complete the task safely.
- **If a required change is outside the touch list**, stop, comment the issue,
  and escalate to PM/CTO. Do not proceed unilaterally.
- **No secrets in code.** Use environment variables or secret_ref references.
- **No debug output** (`console.log`, `print`, etc.) left in production paths.
- **Keep changes minimal.** Every extra line added is a line QA must verify.

### Step 4 — Run quality gates

Run these gates in this order. Do not skip any.

```bash
# 1. Type safety
pnpm -r typecheck

# 2. Tests
pnpm test:run

# 3. Build
pnpm build

# 4. Dependency audit (if you added or updated any dependency)
pnpm audit --audit-level high
```

All gates must pass before you claim the work is done.

If a gate fails:
- Fix the issue before proceeding.
- If you cannot fix it within the current scope, escalate. See §Escalation.

### Step 5 — Assemble the evidence bundle

Your comment on the issue MUST include all of the following. QA will check
every item.

```md
## Implementation Complete

**Files changed:**
- `path/to/file.ts` — [what changed and why]
- `path/to/other.ts` — [what changed and why]

**Tests run:**
```
pnpm -r typecheck   → 0 errors
pnpm test:run       → [N] passed, 0 failed
pnpm build          → success
```

**Done criteria status:**
- [criterion 1]: ✅ [how it is met]
- [criterion 2]: ✅ [how it is met]

**Risks:** [anything that could affect QA or release, or N/A]
**Next action:** QA to verify.
**Escalation:** N/A
```

### Step 6 — Update the issue status

```
PATCH /api/issues/{issueId}
{
  "status": "done",
  "comment": "## Implementation Complete\n\n[full evidence bundle]"
}
```

Do not set status to `done` without the full evidence bundle comment.

---

## Escalation Procedure

Stop and escalate if any of the following are true:

| Situation | Who to escalate to | How |
|-----------|-------------------|-----|
| Done criteria are missing or ambiguous | PM | Comment on issue: "@PM please clarify done criteria before implementation can proceed." Set status = `blocked`. |
| Touch list is missing | CTO | Comment on issue: "@CTO please define the touch list for this task." Set status = `blocked`. |
| Required change is outside the touch list | CTO | Comment on issue explaining exactly what additional change is needed and why. Do not make the change. Set status = `blocked`. |
| A quality gate cannot be fixed within scope | CTO | Comment with the exact error and what would be needed to fix it. Set status = `blocked`. |
| Missing environment variable, secret, or config | PM or board | Comment on issue listing the exact missing item. Set status = `blocked`. |
| Same gate fails 3+ times with different causes | CTO | Escalate — this indicates a scope or architecture problem. |

---

## Touch List Discipline

A touch list is the explicit set of files and areas you are permitted to modify.
It is set by the CTO in the issue description or comments.

**If no touch list is given:**
- Use the issue description to infer scope.
- Limit changes to files directly relevant to the stated deliverable.
- If uncertain, ask CTO before modifying.

**Touch list breach** = modifying a file not on the list without explicit
approval. This is an escalation event, not a judgment call.

---

## Evidence Bundle Checklist

Before posting your completion comment, confirm every item:

- [ ] Files changed — listed with path and description of change
- [ ] `pnpm -r typecheck` — 0 errors shown
- [ ] `pnpm test:run` — test count and pass/fail shown
- [ ] `pnpm build` — success shown
- [ ] `pnpm audit --audit-level high` — if dependencies changed, 0 HIGH/CRITICAL
- [ ] Each done criterion — individually addressed with evidence
- [ ] No secrets in code
- [ ] No debug output left in production paths

Missing any item = incomplete evidence = QA will block and return to you.

---

## What You Must Not Do

- **Do not mark done without running all quality gates.**
- **Do not change files outside the touch list** without explicit CTO approval.
- **Do not commit secrets** to code, comments, or issue descriptions.
- **Do not silently sit on a blocked task.** If you are blocked, update the
  issue to `blocked` with a specific explanation and exit the heartbeat.
- **Do not create issues for other agents** without PM or CTO direction.
- **Do not bypass checkout.** Never start work on an issue you haven't checked out.
