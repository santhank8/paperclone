# Sprint Compliance Report — Sprint Co Enforcer

## Sprint Metadata

| Field | Value |
|---|---|
| **Sprint ID** | [sprint-NNN] |
| **Date** | [YYYY-MM-DD] |
| **Enforcer** | Enforcer Agent |
| **Overall Compliance Score** | [XX]% |

---

## Phase Transition Checks

Each phase gate was evaluated against the [phase-transition-checklist.md](./phase-transition-checklist.md). Results below.

### Planning → Architecture

| # | Requirement | Status | Notes |
|---|---|---|---|
| 1 | sprint-plan.md exists | [PASS/FAIL/WARN] | [details] |
| 2 | Features list present with V-labels | [PASS/FAIL/WARN] | [details] |
| 3 | Time estimates per feature | [PASS/FAIL/WARN] | [details] |
| 4 | Stakeholder review received | [PASS/FAIL/WARN] | [details] |

**Gate Result**: [PASS / BLOCKED]

### Architecture → Build

| # | Requirement | Status | Notes |
|---|---|---|---|
| 1 | task-breakdown.md exists | [PASS/FAIL/WARN] | [details] |
| 2 | Paperclip issue IDs assigned | [PASS/FAIL/WARN] | [details] |
| 3 | Acceptance criteria per task | [PASS/FAIL/WARN] | [details] |
| 4 | Tech stack defined | [PASS/FAIL/WARN] | [details] |

**Gate Result**: [PASS / BLOCKED]

### Build → QA

| # | Requirement | Status | Notes |
|---|---|---|---|
| 1 | All assigned tasks have handoff artifacts | [PASS/FAIL/WARN] | [details] |
| 2 | Self-evaluation scores present | [PASS/FAIL/WARN] | [details] |
| 3 | Code committed and pushed | [PASS/FAIL/WARN] | [details] |

**Gate Result**: [PASS / BLOCKED]

### QA → Deploy

| # | Requirement | Status | Notes |
|---|---|---|---|
| 1 | eval-report.md exists | [PASS/FAIL/WARN] | [details] |
| 2 | All V1 features assessed | [PASS/FAIL/WARN] | [details] |
| 3 | Pass threshold met (≥3.0 avg) | [PASS/FAIL/WARN] | [details] |
| 4 | No CRITICAL bugs open | [PASS/FAIL/WARN] | [details] |

**Gate Result**: [PASS / BLOCKED]

---

## Artifact Completeness Audit

| Artifact | Required By Phase | Produced? | Correct Format? | Notes |
|---|---|---|---|---|
| sprint-plan.md | Planning | [Yes/No] | [Yes/No] | [details] |
| task-breakdown.md | Architecture | [Yes/No] | [Yes/No] | [details] |
| [engineer]-handoff.md | Build | [Yes/No] | [Yes/No] | [details] |
| self-eval scores | Build | [Yes/No] | [Yes/No] | [details] |
| eval-report.md | QA | [Yes/No] | [Yes/No] | [details] |
| deploy-receipt.md | Deploy | [Yes/No] | [Yes/No] | [details] |
| case-law.md (if disputes) | Any | [Yes/No/N/A] | [Yes/No/N/A] | [details] |

**Completeness Score**: [X/Y] artifacts produced, [X/Y] in correct format

---

## Budget Compliance

| Metric | Value |
|---|---|
| **Allocated Budget** | $[amount] |
| **Actual Spend** | $[amount] |
| **Variance** | [+/-]$[amount] ([XX]%) |
| **Threshold Status** | [WITHIN BUDGET / WARNING (10-20% over) / CRITICAL (>20% over)] |

**Budget Notes**: [Any context on overruns or savings — e.g., which phase consumed the most, what drove variance]

---

## Process Violations

| # | Violation | Severity | Phase | Agent Responsible | Remediation |
|---|---|---|---|---|---|
| 1 | [Description of what went wrong] | [CRITICAL/WARNING/INFO] | [Phase] | [Agent name] | [What was or should be done] |
| 2 | [Description] | [CRITICAL/WARNING/INFO] | [Phase] | [Agent name] | [Remediation] |
| 3 | [Description] | [CRITICAL/WARNING/INFO] | [Phase] | [Agent name] | [Remediation] |

*If no violations occurred, write: "No process violations recorded this sprint."*

---

## Sprint Close Gate Status

**Status**: [PASS / BLOCKED]

### Blockers (if BLOCKED)

| # | Blocker | Severity | Resolving Agent | Resolution Deadline |
|---|---|---|---|---|
| 1 | [What is blocking close] | CRITICAL | [Agent] | [Deadline] |

*If PASS, write: "All close gate criteria met. Sprint may be closed."*

---

## Recommendations

Process improvements for future sprints based on this sprint's compliance data:

1. [Recommendation based on observed issues — e.g., "Engineers should submit self-eval scores before handoff, not after QA flags the gap."]
2. [Second recommendation — e.g., "Budget tracking should be checked at phase midpoints, not only at transitions."]
3. [Third recommendation if applicable]
