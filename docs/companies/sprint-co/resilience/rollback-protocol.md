# Deployment Rollback Protocol

> Sprint Co Resilience — Phase 12: Resilience & Recovery

## Rollback Triggers

A rollback is initiated when any of the following conditions are detected post-deployment:

| Trigger | Threshold | Detection Method |
|---------|-----------|-----------------|
| Error rate spike | >5% of requests returning errors | Application monitoring |
| Performance degradation | >50% increase in response time (p95) | APM metrics |
| User-reported critical bug | Any P0 bug report | Support channel / issue tracker |
| Security vulnerability | Any exploitable vulnerability discovered | Security scan / report |
| Data integrity issue | Any data corruption or loss | Data validation checks |

## Rollback Process

### 5-Step Rollback

```
Step 1: DETECT
  │  Monitoring alert, user report, or agent observation
  │
  ▼
Step 2: ASSESS SEVERITY
  │  Is this a rollback-worthy issue?
  │  ├── P0 (critical): Rollback immediately
  │  ├── P1 (major): Rollback within 15 min if no quick fix
  │  └── P2 (minor): Monitor, fix forward if possible
  │
  ▼
Step 3: ROLLBACK DECISION
  │  Orchestrator + DevOps decide:
  │  ├── ROLLBACK: proceed to Step 4
  │  └── FIX FORWARD: only if fix is <10 min and low risk
  │
  ▼
Step 4: EXECUTE ROLLBACK
  │  DevOps executes rollback (checklist below)
  │
  ▼
Step 5: VERIFY ROLLBACK
     Confirm system is stable on previous version
```

## Rollback Execution Checklist

DevOps executes the following checklist:

```markdown
## Rollback Execution Checklist

- [ ] **1. Revert deployment** — deploy previous known-good version
  - Platform: <deployment target>
  - Previous version: <version/commit>
  - Command: <rollback command>

- [ ] **2. Verify rollback succeeded**
  - [ ] Application is responding (health check passes)
  - [ ] Error rate returned to baseline
  - [ ] Performance metrics returned to baseline
  - [ ] Core user flows tested and working

- [ ] **3. Notify stakeholders**
  - [ ] Orchestrator notified
  - [ ] Sprint Lead notified
  - [ ] Stakeholder notified (if user-facing impact)
  - [ ] Incident channel updated

- [ ] **4. Log incident**
  - [ ] Incident logged with timestamp, trigger, and rollback details
  - [ ] Historian creates incident record

- [ ] **5. Preserve evidence**
  - [ ] Logs from failed deployment saved
  - [ ] Error traces captured
  - [ ] Deployment artifacts preserved for analysis
```

## Post-Rollback Actions

After a successful rollback:

| # | Action | Owner | Timing |
|---|--------|-------|--------|
| 1 | Trigger hotfix sprint | Orchestrator | Immediately |
| 2 | Root cause analysis | Engineer + QA | Within 1 hour |
| 3 | Historian postmortem | Historian | Within 2 hours |
| 4 | Update incident log | DevOps | Within 30 min |
| 5 | Stakeholder communication | Stakeholder Lead | Within 1 hour |
| 6 | Fix + re-deploy | Engineer → QA → DevOps | ASAP |
| 7 | Verify fix in production | QA | After re-deploy |

### Postmortem Template

```markdown
# Rollback Postmortem

- **Date:** <YYYY-MM-DD>
- **Sprint:** <id>
- **Trigger:** <what caused the rollback>
- **Severity:** P0 / P1 / P2
- **Time to Detect:** <minutes from deploy to detection>
- **Time to Rollback:** <minutes from detection to rollback complete>
- **User Impact:** <description and duration>

## Timeline
| Time | Event |
|------|-------|
| HH:MM | Deployment completed |
| HH:MM | Issue detected |
| HH:MM | Rollback decision made |
| HH:MM | Rollback executed |
| HH:MM | Rollback verified |

## Root Cause
<What specifically caused the issue>

## Why It Wasn't Caught
<Why didn't QA/review/testing catch this before deploy?>

## Fix
<What was done to fix the root cause>

## Prevention
1. <What to add to QA/review/testing to catch this in the future>
2. <Process change if needed>
```

## Prevention

To reduce the need for rollbacks:

| Prevention Measure | Description |
|-------------------|-------------|
| **Staged rollout** | Deploy to a canary/staging environment first |
| **Feature flags** | Ship features behind flags, enable gradually |
| **Pre-deploy smoke tests** | Automated smoke tests run before going live |
| **QA sign-off** | No deploy without QA approval |
| **Code review** | No deploy without code review approval |
| **Automated regression** | Run full regression suite before deploy |
| **Deploy window** | Prefer deploying during low-traffic periods |

## Rollback Testing

Rollback capability must be periodically verified:

| Test | Frequency | Description |
|------|-----------|-------------|
| Rollback drill | Monthly | Practice rollback on staging environment |
| Rollback timing | Monthly | Measure actual rollback execution time |
| Data integrity check | Monthly | Verify data is intact after rollback |
| Runbook review | Per sprint | Ensure rollback commands and docs are current |

### Rollback Drill Template

```markdown
# Rollback Drill Report

- **Date:** <YYYY-MM-DD>
- **Environment:** staging
- **Drill Conductor:** <agent>

## Steps Executed
1. Deployed current version to staging
2. Deployed known-broken version (intentional)
3. Detected issue via <method>
4. Executed rollback
5. Verified rollback

## Results
- **Rollback time:** <seconds/minutes>
- **Issues encountered:** <any>
- **All checks passed:** [yes/no]

## Action Items
- <any improvements needed to rollback process>
```
