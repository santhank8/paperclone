# Sprint Close Gate Rules — Sprint Co Enforcer

This document defines the blocking rules the Enforcer evaluates before a sprint can be officially closed. Violations are classified as **CRITICAL** (blocks close) or **WARNING** (logged but does not block).

---

## CRITICAL Violations — Block Sprint Close

Any of the following will prevent the sprint from being marked as complete. The sprint remains in BLOCKED status until all CRITICAL violations are resolved.

### 1. QA Phase Bypassed

**Rule**: The Build → QA and QA → Deploy phase transitions must both have documented PASS results in the [phase-transition-checklist.md](./phase-transition-checklist.md).

**Why it blocks**: Shipping without QA evaluation means no verified quality signal. The eval report is the primary evidence that the sprint produced working software.

### 2. No Production URL

**Rule**: A production or demo URL must be recorded in the sprint's deploy receipt or final artifact. The deployed application must be reachable at the time of sprint close.

**Why it blocks**: The sprint's deliverable is a running application. Without a verifiable URL, the sprint has not delivered its core output.

### 3. Budget Exceeded by >20%

**Rule**: Actual token/cost spend must not exceed the allocated budget by more than 20%.

**Why it blocks**: Runaway costs undermine the sustainability model. A >20% overrun indicates a planning or execution failure that must be investigated before close.

### 4. Paperclip Issues Not Updated

**Rule**: Every Paperclip issue created during the sprint must have a final status (completed, deferred, or cancelled) at sprint close. No issues may remain in "in_progress" or "open" state.

**Why it blocks**: Orphaned issues create tracking debt and make it impossible to audit what the sprint actually accomplished.

---

## WARNING Violations — Logged, Do Not Block

These issues are recorded in the [compliance-report.md](./compliance-report.md) and flagged for process improvement, but they do not prevent sprint close.

### 1. Minor Template Deviations

**Description**: An artifact was produced but does not perfectly match the expected template format (e.g., missing a non-critical field, different heading structure).

**Threshold**: The artifact must still contain all substantive information. Only formatting/structural deviations qualify as WARNING.

### 2. Self-Evaluation Scores Missing but QA Passed

**Description**: Engineers did not submit self-evaluation scores before the Build → QA transition, but the QA agent completed evaluation independently and the sprint passed the quality threshold.

**Threshold**: The eval-report.md must exist with passing scores. If QA also failed, this escalates to CRITICAL.

### 3. Budget Overrun Between 10-20%

**Description**: Actual spend exceeded budget by 10-20%. This is within tolerance but signals planning drift.

**Threshold**: Exactly 10.0% to 20.0% over budget (inclusive). Below 10% is not flagged. Above 20% is CRITICAL.

---

## Override Protocol

In exceptional circumstances, a CRITICAL violation may be overridden to allow sprint close.

### Who Can Override

Only the **Stakeholder** agent can authorize a CRITICAL override. Neither the Sprint Lead nor the Enforcer can self-authorize.

### How to Document an Override

An override must be recorded with the following information appended to the compliance report:

```markdown
## Override Record

| Field | Value |
|---|---|
| **Override Authorized By** | [Stakeholder agent name] |
| **Date** | [YYYY-MM-DD HH:MM] |
| **Violation Overridden** | [Which CRITICAL violation] |
| **Justification** | [Why the override is acceptable — 2-3 sentences] |
| **Conditions** | [Any conditions attached — e.g., "must be resolved within 24 hours post-close"] |
```

### Override Limits

- A maximum of **1 CRITICAL override** per sprint is permitted.
- If more than one CRITICAL violation exists, the sprint must be remediated — overrides cannot be stacked.
- Overrides are recorded in [case-law.md](./case-law.md) as precedent if they establish a new principle.
