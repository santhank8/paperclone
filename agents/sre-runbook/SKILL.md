---
name: sre-runbook
description: >
  Execute SRE incident runbooks and SLO management workflows in Paperclip.
  Use when responding to alerts, assessing SLO breach risk, running post-incident
  reviews, managing error budgets, or authoring new runbooks for failure modes.
---

# SRE Runbook Skill

Use this skill when you need to respond to infrastructure incidents, manage SLOs, track error budgets, or author automated runbooks for known failure modes.

## Preconditions

You need:

- Agent API key (`$PAPERCLIP_API_KEY`) with company access
- Observability platform access (Datadog, Prometheus, CloudWatch — via secrets)
- PagerDuty API key for P1/P2 escalation (optional: `$PAGERDUTY_API_KEY`)
- Slack webhook for notifications (optional: `$SLACK_WEBHOOK_URL`)

## Workflow

### 1. SLO Assessment

Check the current SLA health before any significant action:

```bash
# Get company dashboard (includes agent status, recent activity)
curl -sS "$PAPERCLIP_API_URL/api/companies/$PAPERCLIP_COMPANY_ID/dashboard" \
  -H "Authorization: Bearer $PAPERCLIP_API_KEY"

# Check for open incidents
curl -sS "$PAPERCLIP_API_URL/api/companies/$PAPERCLIP_COMPANY_ID/issues?status=open" \
  -H "Authorization: Bearer $PAPERCLIP_API_KEY"
```

From the observability platform, calculate:
- **30-day rolling availability %** = uptime minutes / total minutes × 100
- **Error budget remaining %** = (actual errors − allowed errors) / allowed errors × 100
- **Burn rate** = error budget consumed per hour / (1 / 30-day budget hours)

### 2. Incident Response Protocol

#### P4 (No user impact) — Automated
```
1. Identify runbook → execute → verify → close
2. Log: POST /api/companies/{id}/issues with status=done and runbook reference
```

#### P3 (Minor degradation < 50%) — Automated with notification
```
1. Execute runbook
2. Verify remediation
3. Notify SLAPilot (create issue comment)
4. Close incident
```

#### P2 (Partial degradation > 50%) — Escalate within 15 minutes
```bash
# 1. Assemble impact report
IMPACT_REPORT='{
  "title": "[P2] {service} degraded — {start_time}",
  "body": "## Impact\n{description}\n\n## Affected clients\n{list}\n\n## Error rate\n{rate}%\n\n## Recommended action\n{action}",
  "assigneeId": "{cto-agent-id}"
}'

# 2. Escalate in Paperclip
curl -sS -X POST "$PAPERCLIP_API_URL/api/companies/$PAPERCLIP_COMPANY_ID/issues" \
  -H "Authorization: Bearer $PAPERCLIP_API_KEY" \
  -H "Content-Type: application/json" \
  -d "$IMPACT_REPORT"

# 3. Page CTO via PagerDuty (if configured)
curl -sS -X POST "https://events.pagerduty.com/v2/enqueue" \
  -H "Authorization: Token token=$PAGERDUTY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "routing_key": "{service-integration-key}",
    "event_action": "trigger",
    "payload": {
      "summary": "[P2] {service} partial degradation",
      "severity": "warning",
      "source": "cloudops-pro-sre"
    }
  }'
```

#### P1 (Full outage / SLA breach) — Escalate within 5 minutes
```
1. Immediately create P1 issue and assign to CTO
2. After 15 minutes if unresolved: escalate to CEO
3. After 30 minutes if unresolved: notify client via SLAPilot
```

### 3. Post-Incident Review (PIR)

Every P1/P2 must have a PIR created within 48 hours of resolution:

```bash
PIR_BODY='## Post-Incident Review

**Incident:** [P{sev}] {title}
**Date:** {date}
**Duration:** {duration}
**Impact:** {affected users / services}

## Timeline
| Time | Event |
|------|-------|
| HH:MM | Alert fired |
| HH:MM | SRE acknowledged |
| HH:MM | Root cause identified |
| HH:MM | Mitigation applied |
| HH:MM | Incident resolved |

## Root Cause
{root cause analysis}

## What Went Well
- {item}

## What Could Be Improved
- {item}

## Action Items
| Action | Owner | Due Date |
|--------|-------|----------|
| {item} | {agent} | {date} |
'

curl -sS -X POST "$PAPERCLIP_API_URL/api/companies/$PAPERCLIP_COMPANY_ID/issues" \
  -H "Authorization: Bearer $PAPERCLIP_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"title\": \"PIR: [P{sev}] {incident-title}\", \"body\": \"$PIR_BODY\"}"
```

### 4. Runbook Authoring

When a failure mode has no automated runbook, create one before closing the incident:

```bash
# Create a runbook task in Paperclip for future automation
curl -sS -X POST "$PAPERCLIP_API_URL/api/companies/$PAPERCLIP_COMPANY_ID/issues" \
  -H "Authorization: Bearer $PAPERCLIP_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Author runbook: {failure-mode}",
    "body": "## Failure Mode\n{description}\n\n## Steps to Reproduce\n{steps}\n\n## Proposed Automated Remediation\n{steps}",
    "assigneeId": "{sre-agent-id}"
  }'
```

A good runbook must specify:
1. **Trigger condition**: exact alert that fires this runbook
2. **Diagnosis steps**: how to confirm the root cause
3. **Remediation steps**: ordered, idempotent commands to resolve
4. **Verification steps**: how to confirm the issue is resolved
5. **Escalation criteria**: when to escalate vs close automatically

## SLO Thresholds Reference

| SLI | Warning | Critical | SLA Breach |
|-----|---------|---------|------------|
| 30-day availability | < 99.95% | < 99.9% | < 99.9% (breach) |
| Error budget burn rate | > 2x normal | > 5x normal | Budget exhausted |
| p99 latency | > 300ms | > 500ms | > 1000ms |

## Quality Bar

When completing an incident response:

- [ ] Incident severity correctly classified (P1/P2/P3/P4)
- [ ] Root cause identified and documented
- [ ] Remediation applied and verified
- [ ] Incident issue closed in Paperclip with resolution summary
- [ ] Cost event reported if AI tokens were consumed during response
- [ ] PIR created for P1/P2 within 48 hours
- [ ] Action items assigned to responsible agents with due dates
- [ ] Runbook created or updated if failure mode was new
- [ ] SLO dashboard updated with incident window
