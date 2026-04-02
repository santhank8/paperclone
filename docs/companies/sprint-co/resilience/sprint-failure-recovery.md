# Sprint Failure Recovery Protocol

> Sprint Co Resilience — Phase 12: Resilience & Recovery

## Failure Modes

| Failure Mode | Likelihood | Impact | Detection |
|-------------|-----------|--------|-----------|
| Time expired with incomplete work | Medium | Medium | Sprint timer |
| Critical bug discovered post-deploy | Medium | High | Monitoring / user reports |
| Budget exhausted mid-sprint | Low | High | Budget tracking |
| Agent crash mid-task | Low | Medium | Heartbeat monitor |
| External dependency failure | Medium | Variable | Circuit breaker (see circuit-breaker.md) |

## Recovery Protocols

### 1. Time Expired — Incomplete Work

**Trigger:** Sprint timer reaches 0 with tasks still in progress.

**Protocol: Partial Delivery**
1. Orchestrator calls `SPRINT-HALT` — all agents stop current work
2. QA assesses all completed tasks for shippability
3. Tasks that pass QA → ship as partial delivery
4. Incomplete tasks → defer to next sprint with full context preserved
5. Historian creates sprint report noting partial delivery and reasons

**Artifact:**
```markdown
## Partial Delivery Report
- **Sprint:** <id>
- **Planned Tasks:** <count>
- **Shipped Tasks:** <count> (<list>)
- **Deferred Tasks:** <count> (<list with context snapshots>)
- **Reason:** Time expired
- **Carry-over Context:** <links to artifacts for deferred tasks>
```

### 2. Post-Deploy Critical Bug

**Trigger:** Error rate spike, user report, or monitoring alert after deployment.

**Protocol: Immediate Rollback + Hotfix Sprint**
1. DevOps executes rollback (see rollback-protocol.md)
2. Orchestrator pauses current sprint (if active)
3. Orchestrator creates emergency hotfix sprint
4. QA reproduces the bug and documents reproduction steps
5. Engineer assigned to fix — highest priority
6. Hotfix goes through abbreviated QA (focused on the fix + regression)
7. Re-deploy after hotfix passes
8. Original sprint resumes after hotfix ships

### 3. Budget Exhausted Mid-Sprint

**Trigger:** Token/cost budget reaches limit with work remaining.

**Protocol: Emergency Budget or Graceful Stop**
```
Budget exhausted
  ├── Is remaining work critical?
  │   ├── YES → Request emergency budget extension from Board
  │   │         └── Board approves → resume with extended budget
  │   │         └── Board denies → graceful stop (below)
  │   └── NO → Graceful stop
  │
  Graceful Stop:
  ├── Complete current in-progress task if <10% budget overage projected
  ├── Save all agent contexts as artifacts
  ├── Ship whatever passes QA
  ├── Defer remainder to next sprint
  └── Historian records budget analysis
```

**Emergency Budget Request:**
```markdown
## Emergency Budget Extension Request

- **Sprint:** <id>
- **Original Budget:** <amount>
- **Spent:** <amount>
- **Extension Requested:** <amount>
- **Remaining Tasks:** <list with estimated cost>
- **Justification:** <why this can't wait for next sprint>
- **Risk of NOT extending:** <what happens if we stop now>
```

### 4. Agent Crash Mid-Task

**Trigger:** Agent process dies, heartbeat stops, or unrecoverable error.

**Protocol: Reassign + Context Recovery**
1. Orchestrator detects crashed agent (heartbeat timeout: 60s)
2. Orchestrator identifies the task the agent was working on
3. Orchestrator loads context from last artifact (see context-recovery.md)
4. Orchestrator assigns task to backup agent (same role, or nearest capable)
5. Backup agent reads recovery context and resumes
6. Historian logs the crash with diagnostics

**Backup Agent Assignment Priority:**
1. Idle agent with same role
2. Idle agent with closest skill match
3. Agent on lower-priority task (preempt)
4. If no agents available → queue task, alert Board

### 5. External Dependency Failure

**Trigger:** GitHub, Cloudflare, Paperclip API, or model provider unavailable.

**Protocol: Circuit Breaker + Fallback**
1. Circuit breaker trips (see circuit-breaker.md)
2. Agent switches to fallback mode for that dependency
3. Work continues with degraded capability
4. When dependency recovers, replay queued operations
5. If dependency is down >30 min → Orchestrator reassesses sprint plan

## Recovery Decision Tree

```
FAILURE DETECTED
       │
       ▼
  What type of failure?
       │
       ├── Time expired?
       │     └── Ship what passes QA → defer rest → partial delivery report
       │
       ├── Post-deploy bug?
       │     └── Rollback → hotfix sprint → re-deploy → resume
       │
       ├── Budget exhausted?
       │     ├── Critical work remaining?
       │     │     ├── Yes → request extension from Board
       │     │     └── No → graceful stop, ship what's ready
       │     └── Save all contexts as artifacts
       │
       ├── Agent crash?
       │     └── Load last context → assign backup agent → resume
       │
       └── External dependency?
             └── Circuit breaker → fallback mode → queue ops → retry on recovery
```

## Post-Failure Retrospective Template

The Historian captures a retrospective for every failure event:

```markdown
# Failure Retrospective

- **Sprint:** <id>
- **Failure Type:** <type from list above>
- **Date/Time:** <timestamp>
- **Duration of Impact:** <minutes>
- **Recorded By:** Historian

## What Happened
<Chronological description of the failure>

## Root Cause
<Why did this fail? Dig to the underlying cause, not just the symptom.>

## Impact
- **Tasks affected:** <list>
- **Time lost:** <minutes>
- **Budget impact:** <cost>
- **Delivery impact:** <what was delayed or dropped>

## Recovery Actions Taken
1. <what was done, by whom, when>
2. ...

## Recovery Effectiveness
- **Time to detect:** <minutes>
- **Time to recover:** <minutes>
- **Data/work lost:** <what couldn't be recovered>

## Prevention Measures
1. <what to do differently to prevent this failure>
2. <process change, monitoring addition, etc.>

## Lessons Learned
- <insight for future sprints>
```
