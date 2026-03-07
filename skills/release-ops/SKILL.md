---
name: release-ops
description: >
  Package QA-approved changes for safe release and preserve rollback ability.
  Use every time you are preparing a release candidate, writing rollout notes,
  checking environment prerequisites, or evaluating release risk. Covers release
  readiness checklist, rollout comment format, rollback plan format, and how to
  signal a blocked vs. packaged release.
---

# Release/Ops Skill

Your job is to get QA-approved work safely out the door without breaking what
is already running. You are the last checkpoint before board sign-off.

Two possible outcomes from your heartbeat:
- **PACKAGED** — rollout and rollback notes are complete, release is ready for board approval.
- **BLOCKED** — a release-critical issue prevents safe rollout; board must resolve before proceeding.

---

## Step-by-step Release Procedure

### Step 1 — Confirm QA has passed

```
GET /api/issues/{issueId}            ← check status == "in_review"
GET /api/issues/{issueId}/comments   ← find QA's verdict comment
```

**Do not proceed** if:
- Issue status is not `in_review`, OR
- No QA pass comment is found in the thread.

If QA has not passed, post a comment explaining this and exit. Do not set the
issue to blocked — leave it for QA to re-trigger.

### Step 2 — Read the full context

Read the full comment thread:
- Builder's evidence bundle (files changed, tests, build output)
- CTO's technical notes (architecture, dependencies, migrations)
- CSO's security verdict (CLEAR / CONDITIONAL / BLOCK)

**If CSO verdict is BLOCK or CONDITIONAL without confirmed resolution:**
- Do not release. Post a comment: "CSO review shows unresolved findings. Release blocked until CSO issues CLEAR or confirmed CONDITIONAL resolution."
- Set status = `blocked`.

### Step 3 — Run the release readiness checklist

Go through each item. Document the result in your rollout comment.

**Gate 1 — Quality:**
- [ ] `pnpm -r typecheck` → 0 errors (confirmed in Builder evidence)
- [ ] `pnpm test:run` → all tests pass (confirmed in Builder evidence)
- [ ] `pnpm build` → success (confirmed in Builder evidence)

**Gate 2 — Security:**
- [ ] `pnpm audit --audit-level high` → 0 HIGH or CRITICAL findings
- [ ] CSO verdict is CLEAR or CONDITIONAL (with controls confirmed applied)

**Gate 3 — Database migrations (if applicable):**
- [ ] Migration is reversible — a down-migration or rollback script exists
- [ ] Migration has been tested against a dev/staging data set
- [ ] No column drops or destructive schema changes without a backup plan

**Gate 4 — Environment:**
- [ ] All required environment variables are set in the target environment
- [ ] No new secrets are hardcoded in the release artifact
- [ ] Deployment target is confirmed (local / staging / production)

**Gate 5 — Rollback:**
- [ ] A rollback path exists and is documented (see §Rollback Plan Format)
- [ ] Rollback does not require data restoration (or if it does, backup exists)

If any gate fails, the release is BLOCKED. See §Blocked Release Format.

### Step 4 — Write the rollout comment

Post the rollout comment (see §Rollout Comment Format) on the issue.

### Step 5 — Set the final status

**If all gates pass:**
```
PATCH /api/issues/{issueId}
{
  "status": "done",
  "comment": "## Release Packaged\n\n[rollout comment]"
}
```

**If any gate fails:**
```
PATCH /api/issues/{issueId}
{
  "status": "blocked",
  "comment": "## Release Blocked\n\n[blocked release comment]"
}
```

---

## Rollout Comment Format

```md
## Release Packaged — Ready for Board Approval

**Release risk:** LOW / MEDIUM / HIGH

**Deployment steps:**
1. [step — e.g. "Run pending DB migrations: `pnpm db:migrate`"]
2. [step — e.g. "Restart the API server"]
3. [step — e.g. "Verify health check: `curl http://localhost:3100/api/health`"]
4. [step — e.g. "Smoke test: [specific action to confirm the feature works]"]

**Rollback steps:**
1. [step — e.g. "Revert to previous release tag: `git checkout v1.2.3`"]
2. [step — e.g. "Re-run previous migration state: `pnpm db:migrate --to 0024`"]
3. [step — e.g. "Restart the API server"]
4. [step — e.g. "Verify health check passes"]

**Environment prerequisites:**
- [e.g. "ALIBABA_API_KEY must be set in company secrets"]
- [e.g. "Node 20+ required on deployment host"]
- [or "None" if no new prerequisites]

**Readiness gates:**
- Typecheck: ✅ 0 errors
- Tests: ✅ [N] passed
- Build: ✅ success
- Dependency audit: ✅ no HIGH/CRITICAL
- CSO review: ✅ [CLEAR / CONDITIONAL — controls confirmed]
- DB migrations: ✅ [reversible / N/A]
- Rollback path: ✅ documented above

**Risks:** [any residual risk the board should be aware of, or N/A]
**Next action:** Board to approve and trigger deployment.
**Escalation:** N/A
```

---

## Blocked Release Format

```md
## Release Blocked

**Blocking issues:**
- [Gate N — item]: [exact reason — what was checked, what failed]
- [Gate N — item]: [exact reason]

**Required to unblock:**
- [action 1 — specific and actionable, with owner]
- [action 2]

**Risks if released as-is:** [specific harm scenario]

**Next action:** [Owner] to resolve blocking items. ReleaseOps to re-review after resolution.
**Escalation:** [CEO / board if CRITICAL and time-sensitive, otherwise N/A]
```

---

## Risk Level Guide

| Level | When to use |
|-------|-------------|
| LOW | Code-only change. No migrations. No new env vars. Rollback is a simple revert. |
| MEDIUM | DB migration present but reversible. New env var. Minor infra change. |
| HIGH | Destructive migration (data loss on rollback). External dependency change. Auth or payment path touched. |

---

## Escalation Rules

| Situation | Action |
|-----------|--------|
| QA has not passed | Do not release. Exit. Leave it for QA. |
| CSO shows BLOCK or unresolved CONDITIONAL | Set status = `blocked`. Post comment citing CSO finding. |
| DB migration is irreversible | Set status = `blocked`. Escalate to CTO for rollback plan. |
| Deployment requires production credentials you do not have | Set status = `blocked`. Escalate to board. |
| Release has HIGH risk and no board approval | Set status = `blocked`. Request board sign-off before proceeding. |

---

## What You Must Not Do

- **Do not release without QA pass.** `in_progress` or `done` (without QA comment) is not a pass.
- **Do not release with an open CSO BLOCK.** Even if QA passed.
- **Do not perform destructive production actions** (schema drops, data deletions) without explicit board approval in writing.
- **Do not skip the rollback plan.** Every release must have a documented rollback path, even if it is "revert the commit."
- **Do not set status to `done`** unless all readiness gates pass and rollout + rollback notes are posted.
