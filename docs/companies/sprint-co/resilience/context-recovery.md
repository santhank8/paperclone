# Context Recovery Protocol

> Sprint Co Resilience — Phase 12: Resilience & Recovery

## Problem

If an agent crashes mid-task — process dies, model API fails, token limit exceeded, or unrecoverable error — the replacement agent must pick up where the crashed agent left off. Without a recovery protocol, the replacement starts from scratch, wasting budget and time.

## Context Sources

When recovering a crashed agent's state, the replacement draws from these sources, in priority order:

| Priority | Source | What It Contains | Reliability |
|----------|--------|-----------------|-------------|
| 1 | **Last handoff artifact** | Structured state of work in progress | High |
| 2 | **Paperclip task status** | Task assignment, status, agent history | High |
| 3 | **Git commit history** | Code changes, commit messages, branches | High |
| 4 | **Sprint log** | Timeline of sprint events and decisions | High |
| 5 | **Historian's records** | Comprehensive sprint narrative | Medium |
| 6 | **Agent's last output** | Partial work, logs, or messages before crash | Low |

## Recovery Protocol

```
AGENT CRASH DETECTED (heartbeat timeout: 60s)
  │
  ▼
Step 1: IDENTIFY LAST KNOWN GOOD STATE
  │  ├── Check Paperclip task status
  │  ├── Find latest artifact for the task
  │  └── Check git log for recent commits by crashed agent
  │
  ▼
Step 2: LOAD CONTEXT FROM ARTIFACTS
  │  ├── Read last handoff artifact
  │  ├── Read sprint log entries since task assignment
  │  ├── Read relevant Historian records
  │  └── Read git diff (committed vs uncommitted changes)
  │
  ▼
Step 3: VERIFY UNDERSTANDING
  │  Replacement agent produces a context summary:
  │  ├── "I understand the task is: <X>"
  │  ├── "Work completed so far: <Y>"
  │  ├── "Remaining work: <Z>"
  │  └── "I will resume from: <checkpoint>"
  │  Orchestrator validates the summary before proceeding
  │
  ▼
Step 4: RESUME FROM LAST CHECKPOINT
     Replacement agent continues work
     └── First action: verify existing work is in good state
         (compile, test, sanity check)
```

## Context Reconstruction Template

The replacement agent fills out this template before resuming work:

```markdown
# Context Recovery Report

- **Crashed Agent:** <name>
- **Replacement Agent:** <name>
- **Task:** <task-id> — <title>
- **Crash Time:** <timestamp>
- **Recovery Time:** <timestamp>

## What Was the Agent Doing?
<Description of the task and agent's objective>

## Where Did It Stop?
- **Last artifact:** <artifact-name> at <timestamp>
- **Last commit:** <commit-sha> — "<message>"
- **Last status update:** <status at crash time>
- **Estimated completion at crash:** <X%>

## What Artifacts Exist?
| Artifact | Status | Usable |
|----------|--------|--------|
| <artifact-1> | complete / partial | yes / no |
| <artifact-2> | complete / partial | yes / no |

## What's Missing?
- <List of information gaps that can't be recovered>
- <Any partial work that may be inconsistent>

## Recovery Plan
1. <First action to take>
2. <Second action>
3. ...

## Verification Before Resuming
- [ ] Existing code compiles
- [ ] Existing tests pass
- [ ] Artifact state is consistent
- [ ] No conflicting changes in progress
```

## Prevention: Frequent Checkpointing

Agents reduce recovery risk by checkpointing frequently:

### Intermediate Artifacts

| Checkpoint Type | When | What to Save |
|----------------|------|--------------|
| **Progress artifact** | Every 30 min of active work | Current state, decisions made, next steps |
| **Git commit** | Every logical unit of work | Code changes with descriptive message |
| **Status update** | Every task state change | Paperclip task status + comment |
| **Heartbeat** | Every 60 seconds | Alive signal + current action summary |

### Progress Artifact Template

```markdown
## Checkpoint: <task-id>

- **Agent:** <name>
- **Timestamp:** <ISO-8601>
- **Task Progress:** <X%>

### Completed Since Last Checkpoint
- <what was done>

### Current State
- <what's in progress right now>

### Decisions Made
- <any decisions and rationale>

### Next Steps
- <what the agent plans to do next>

### Blockers
- <anything blocking progress>
```

### Heartbeat Protocol

```
HEARTBEAT:
  agent: <name>
  task: <task-id>
  timestamp: <ISO-8601>
  status: working | blocked | idle
  current_action: <brief description>
  last_artifact: <artifact-name>
  tokens_used_since_last: <count>
```

Orchestrator expects a heartbeat every 60 seconds. Two missed heartbeats trigger crash detection.

## Recovery Time Target

| Metric | Target | Maximum |
|--------|--------|---------|
| Crash detection | <2 min | 3 min (2 missed heartbeats) |
| Context loading | <2 min | 3 min |
| Verification | <1 min | 2 min |
| **Total recovery** | **<5 min** | **8 min** |

## Edge Cases

| Scenario | Handling |
|----------|---------|
| Agent crashed with uncommitted code | Check working directory if accessible; otherwise, treat as lost |
| Agent crashed during a handoff | Previous agent's completed work is safe; redo the handoff |
| Agent crashed after artifact but before status update | Artifact is source of truth; update status from artifact |
| Multiple agents crash simultaneously | Recover highest-priority task first; sequence others |
| Replacement agent also crashes | Escalate to Orchestrator; consider pausing sprint |
| No artifacts exist for the task | Start task from scratch; log as data loss incident |
