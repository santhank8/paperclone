# Incident Response

## Purpose

Define how Sprint Co detects, triages, resolves, and learns from production incidents. Speed matters, but so does thoroughness — every incident makes the company smarter.

---

## Severity Levels

| Severity | Name | Definition | Examples |
|----------|------|-----------|---------|
| **SEV-1** | System Down | Complete service outage or data loss. No users can access the product. | Deployment failure taking down production, database corruption, total API failure |
| **SEV-2** | Major Feature Broken | Core functionality degraded or unavailable. Most users affected. | Authentication broken, payment processing failed, main workflow blocked |
| **SEV-3** | Minor Issue | Non-critical feature broken or degraded. Workaround exists. | Secondary page not loading, non-critical API returning stale data, UI glitch on one browser |
| **SEV-4** | Cosmetic | Visual or polish issue. No functional impact. | Typo in UI, misaligned element, wrong color on non-critical component |

---

## Response Times

| Severity | Response Action | Timeline | Sprint Allocation |
|----------|----------------|----------|------------------|
| **SEV-1** | Immediate hotfix sprint | Start within 15 minutes of detection | Hotfix Sprint (1 hour) — all other work paused |
| **SEV-2** | Next available sprint slot | Start within 4 hours | Hotfix Sprint (1 hour) or Standard Sprint with hotfix focus |
| **SEV-3** | Add to backlog | Prioritize in next sprint planning | Standard Sprint — included alongside other work |
| **SEV-4** | Add to tech debt register | Address in next Maintenance Sprint | Maintenance Sprint — bundled with other cleanup |

---

## Incident Response Protocol

### 1. Detect

**Who detects:** Any agent, monitoring system, or human stakeholder.

Detection sources:
- Delivery Engineer's deployment monitoring
- QA Engineer's post-deployment smoke tests
- Scout's external monitoring signals
- User/stakeholder reports via Board
- Automated health checks

**On detection**, the detecting agent immediately signals the Orchestrator:

```yaml
signal:
  type: incident-alert
  from: {{detecting-agent}}
  severity: SEV-{{N}}  # Initial assessment — may be reclassified
  summary: "{{One-line description}}"
  detected_at: {{ISO-8601}}
  evidence: "{{What was observed}}"
```

### 2. Assess

**Owner:** Orchestrator (within 5 minutes of alert)

- Confirm the incident is real (not a false alarm)
- Validate or reclassify severity
- Identify affected systems and users
- Determine if the issue is ongoing, resolved, or intermittent

### 3. Triage

**Owner:** Orchestrator + Sprint Lead

Based on severity:

| Severity | Triage Action |
|----------|--------------|
| SEV-1 | Halt all current work. Initiate Hotfix Sprint immediately. Page Board. |
| SEV-2 | Complete current sprint phase if < 15 min remaining, else pause. Initiate Hotfix Sprint. Notify Board. |
| SEV-3 | Log incident. Add to next sprint planning. No interruption. |
| SEV-4 | Log incident. Add to tech debt register. No action needed. |

### 4. Fix

**For SEV-1/SEV-2 — Hotfix Sprint:**

- Engineer Alpha identifies root cause
- Engineer Alpha implements fix (minimal, targeted change)
- No scope creep — fix the incident only
- Security Auditor reviews if security-related

**For SEV-3 — Standard Sprint:**

- Fix included in sprint backlog alongside other work
- Normal QA process applies

**For SEV-4 — Maintenance Sprint:**

- Bundled with other tech debt items
- Normal QA process applies

### 5. Verify

**Owner:** QA Engineer

- Fix deployed to staging (or production if SEV-1 requires immediate deploy)
- Smoke tests pass
- Regression tests pass (the fix doesn't break anything else)
- Original incident conditions no longer reproducible

### 6. Postmortem

**Owner:** Historian (within 24 hours for SEV-1/SEV-2, within 1 week for SEV-3)

SEV-4 incidents do not require postmortems.

---

## Incident Template

```markdown
---
schema: agentcompanies/v1
kind: incident
id: INC-{{SEQ}}
severity: SEV-{{N}}
status: detected | triaging | fixing | verifying | resolved | postmortem-complete
---

# Incident Report: INC-{{SEQ}}

## Summary
{{One-paragraph description of the incident}}

## Classification

| Field | Value |
|-------|-------|
| Incident ID | INC-{{SEQ}} |
| Severity | SEV-{{N}} |
| Reporter | {{agent or human who detected it}} |
| Detected | {{ISO-8601 datetime}} |
| Resolved | {{ISO-8601 datetime}} |
| Duration | {{time from detection to resolution}} |
| Sprint | {{sprint ID if fix was part of a sprint}} |

## Impact
- **Users affected**: {{number or percentage}}
- **Features affected**: {{list}}
- **Data impact**: {{none / read-only degraded / data loss}}
- **Revenue impact**: {{none / estimated $N}}

## Timeline

| Time | Event |
|------|-------|
| {{HH:MM}} | {{Event description}} |
| {{HH:MM}} | {{Event description}} |
| {{HH:MM}} | {{Event description}} |

## Root Cause
{{Detailed explanation of why the incident occurred}}

## Fix Applied
{{Description of the fix, including relevant code changes or configuration updates}}

## Verification
- [ ] Fix deployed
- [ ] Smoke tests pass
- [ ] Regression tests pass
- [ ] Original conditions no longer reproducible
- [ ] Monitoring confirms stable

## Action Items

| # | Action | Owner | Due | Status |
|---|--------|-------|-----|--------|
| 1 | {{Preventive action}} | {{agent}} | {{date}} | Open |
| 2 | {{Preventive action}} | {{agent}} | {{date}} | Open |
```

---

## Postmortem Protocol

### Principles

1. **Blameless.** Postmortems focus on systems, processes, and conditions — not individual agents. "Agent X made an error" becomes "The process allowed an error to reach production."
2. **Factual.** Timeline is based on logs and artifacts, not recollection.
3. **Actionable.** Every postmortem produces concrete action items with owners and deadlines.
4. **Public.** Postmortems are visible to the entire company. Transparency builds trust.

### Postmortem Template

```markdown
# Postmortem: INC-{{SEQ}} — {{Title}}

## Incident Summary
{{Brief recap from the incident report}}

## Root Cause Analysis

### What happened
{{Factual sequence of events}}

### Why it happened
{{Use 5 Whys or similar root cause analysis}}

1. Why? → {{Because...}}
2. Why? → {{Because...}}
3. Why? → {{Because...}}
4. Why? → {{Because...}}
5. Why? → {{Root cause}}

### Contributing Factors
- {{Factor 1: e.g., missing test coverage for edge case}}
- {{Factor 2: e.g., deployment didn't include rollback plan}}
- {{Factor 3: e.g., monitoring gap — no alert for this condition}}

## What Went Well
- {{Positive aspects of the response}}

## What Didn't Go Well
- {{Areas for improvement}}

## Action Items

| # | Action | Category | Owner | Due | Status |
|---|--------|----------|-------|-----|--------|
| 1 | {{Action}} | Prevention | {{agent}} | {{date}} | Open |
| 2 | {{Action}} | Detection | {{agent}} | {{date}} | Open |
| 3 | {{Action}} | Process | {{agent}} | {{date}} | Open |

## Lessons Learned
{{Entry to be added to the company knowledge base by Historian}}

## Review
- Postmortem author: Historian
- Reviewed by: Orchestrator, {{involved agents}}
- Date: {{date}}
```

### Postmortem Review

1. Historian drafts the postmortem from incident artifacts and logs
2. All involved agents review for factual accuracy
3. Orchestrator approves and ensures action items are assigned
4. Historian files the postmortem and creates a lessons-learned entry

---

## On-Call Rotation

Between sprints, a subset of agents monitors production systems.

### On-Call Team

| Role | Responsibility | Monitoring Scope |
|------|---------------|-----------------|
| **Delivery Engineer** | Primary on-call. Monitors deployment health, uptime, infrastructure. | Health checks, deployment status, server metrics |
| **QA Engineer** | Secondary on-call. Monitors product functionality. | Smoke test results, error rates, user-facing issues |
| **Security Auditor** | Security on-call. Monitors for security events. | Auth failures, suspicious access patterns, dependency vulnerabilities |

### Rotation Schedule

| Period | Primary | Secondary | Security |
|--------|---------|-----------|----------|
| Between Sprint N and N+1 | Delivery Engineer | QA Engineer | Security Auditor |

All three roles are on continuous standby. For SEV-1/SEV-2 incidents, the detecting agent escalates to the Orchestrator, who initiates a Hotfix Sprint.

### Monitoring Checklist (Between Sprints)

- [ ] Health endpoint returns 200
- [ ] Error rate < threshold
- [ ] No new critical dependency vulnerabilities
- [ ] Deployment artifacts accessible
- [ ] Monitoring dashboards functional
- [ ] No anomalous access patterns
