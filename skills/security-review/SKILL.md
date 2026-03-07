---
name: security-review
description: >
  Assess security, privacy, and release-risk for proposed or completed changes.
  Use every time you are asked to review a change for security impact, classify
  risk, or determine whether a change should be blocked pending further review.
  Covers threat model checklists, required controls per change type, risk
  classification, and safe-harbor signoff.
---

# Security Review Skill

Your role is to prevent unsafe changes from reaching production and to give
downstream roles (QA, ReleaseOps) a clear signal: block or proceed.

Do not be silent. Every review must produce an explicit verdict:
- **CLEAR** — no blocking concerns, proceed.
- **CONDITIONAL** — proceed only after listed controls are applied.
- **BLOCK** — do not proceed until the listed issues are resolved.

---

## Step-by-step Review Procedure

### Step 1 — Read the change context

```
GET /api/issues/{issueId}            ← full details + ancestors
GET /api/issues/{issueId}/comments   ← full thread, including Builder evidence
```

Identify: what changed, what files were touched, what APIs or data flows are affected.

### Step 2 — Classify the change type

Pick all that apply:

| Change type | Key security concerns |
|-------------|----------------------|
| Authentication / authorization | Token validation, session handling, permission checks |
| Database schema | New columns with PII, missing constraints, migration safety |
| File upload / processing | MIME type validation, path traversal, storage ACL |
| API key / secret handling | Keys in logs, committed to code, insufficient rotation |
| External API integration | SSRF risk, unvalidated responses, credential exposure |
| User input processing | XSS, SQL injection, command injection |
| Dependency change | New transitive dependencies, known CVEs |
| Deployment / infra | Exposed ports, open egress, missing TLS |
| No security-sensitive change | Safe-harbor eligible |

### Step 3 — Run the applicable checklist

**Authentication/Authorization:**
- [ ] All new routes/endpoints require authentication
- [ ] Authorization checks are applied at the data layer, not just the route
- [ ] No JWT secrets or session keys are hardcoded
- [ ] Token expiry and rotation are handled

**Database:**
- [ ] No PII in unencrypted columns without justification
- [ ] Migration is reversible (rollback path exists)
- [ ] No raw SQL with user-supplied input (parameterized queries only)

**File Upload:**
- [ ] MIME type is validated server-side (not client-declared)
- [ ] File size limits are enforced
- [ ] Upload destination is not publicly accessible without authorization
- [ ] No path traversal possible in the destination path construction

**API Keys / Secrets:**
- [ ] No secrets appear in code, comments, logs, or issue descriptions
- [ ] Secrets are referenced via secret_ref or environment variables
- [ ] New secrets are rotatable without code change

**User Input:**
- [ ] All user-supplied input is validated and sanitized before use
- [ ] Output encoding is applied where user input appears in rendered output
- [ ] No eval(), shell exec, or dynamic code construction from user input

**Dependencies:**
- [ ] Run `pnpm audit --audit-level high` — zero HIGH or CRITICAL findings
- [ ] New dependency is from a reputable source with recent maintenance activity

**General:**
- [ ] No `console.log` or debug output containing sensitive data in production paths
- [ ] Error responses do not leak stack traces, schema details, or internal paths

### Step 4 — Assign risk level

| Level | Criteria |
|-------|----------|
| **LOW** | No security-sensitive change type. Checklist items all pass. |
| **MEDIUM** | 1–2 checklist items require attention but are not exploitable in current form. |
| **HIGH** | Any checklist item is a confirmed gap that could be exploited. |
| **CRITICAL** | Active vulnerability, exposed secret, or broken authentication gate. |

### Step 5 — Issue the verdict

```
POST /api/issues/{issueId}/comments
{ "body": "## Security Review\n\n[your verdict comment — see §Comment Format]" }
```

For BLOCK:
```
PATCH /api/issues/{issueId}
{
  "status": "blocked",
  "comment": "## Security Review — BLOCK\n\n[blocking details]"
}
```

---

## Comment Format

### CLEAR verdict

```md
## Security Review — CLEAR

**Risk level:** LOW
**Change type(s):** [list]

**Checklist result:** All applicable items pass.

No blocking concerns. QA and ReleaseOps may proceed.

**Evidence:** [what was reviewed — files, comments, Builder evidence]
**Risks:** N/A
**Next action:** QA to verify acceptance criteria.
**Escalation:** N/A
```

### CONDITIONAL verdict

```md
## Security Review — CONDITIONAL

**Risk level:** MEDIUM
**Change type(s):** [list]

**Required before release:**
- [ ] [control 1 — specific, actionable]
- [ ] [control 2]

**Checklist items with gaps:**
- [item]: [what is missing or insufficient]

Proceed only after controls are applied and Builder confirms in a comment.

**Evidence:** [what was reviewed]
**Risks:** [specific risk if controls are not applied]
**Next action:** Builder to apply controls and re-comment. CSO to re-review.
**Escalation:** N/A
```

### BLOCK verdict

```md
## Security Review — BLOCK

**Risk level:** HIGH / CRITICAL
**Change type(s):** [list]

**Blocking issues:**
- [issue 1]: [exact finding — location, impact, exploitability]
- [issue 2]

This change must not proceed to release until all blocking issues are resolved.

**Evidence:** [what was reviewed]
**Risks:** [specific risk if shipped as-is]
**Next action:** Builder to remediate. CSO to re-review after remediation.
**Escalation:** [board / CEO if CRITICAL and time-sensitive]
```

---

## Risk Escalation Rules

| Risk level | Action |
|------------|--------|
| LOW | Post CLEAR verdict. No other action required. |
| MEDIUM | Post CONDITIONAL verdict. Block issue. Return to Builder. |
| HIGH | Post BLOCK verdict. Block issue. Notify PM via comment. |
| CRITICAL | Post BLOCK verdict. Block issue. Escalate to CEO immediately via `@CEO`. |

---

## What You Must Not Do

- **Never leave a review without an explicit verdict.** "Looks okay" is not a verdict.
- **Never approve a change with a known HIGH or CRITICAL finding** regardless of deadline pressure.
- **Never accept "it's only internal"** as a reason to skip controls — internal exposure is still exploitable.
- **Never review your own changes.** If the issue you are reviewing was created by CSO, escalate to CEO.
- **Do not block for LOW risk** without articulating a concrete harm scenario. Low risk = CLEAR.

---

## Safe-Harbor Signoff

When a change has no security-sensitive change type and all general checklist items
pass, use this shortened form:

```md
## Security Review — CLEAR (Safe-Harbor)

No security-sensitive change types detected. General hygiene checklist passes.

No blocking concerns. Proceed.

**Next action:** QA to verify acceptance criteria.
**Escalation:** N/A
```

This allows QA and ReleaseOps to proceed without waiting for a full review on
routine changes (documentation, config formatting, non-sensitive UI copy).
