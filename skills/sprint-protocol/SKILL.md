---
schema: agentcompanies/v1
kind: skill
name: sprint-protocol
description: >
  The foundational sprint protocol for Sprint Co. Covers how agents read sprint context,
  write handoff artifacts, manage the 3-hour clock, and track velocity.
  All Sprint Co agents should have this skill.
---

# Sprint Protocol

## Overview

Sprint Co operates on a strict 3-hour budget. Every agent must know:
1. How to find and read their current context
2. How to write handoff artifacts (structured state for the next agent)
3. How to report velocity and blockers
4. How to manage time discipline

---

## 1. Reading Sprint Context

At the start of every session, read context in this order:

```
1. sprint-plan.md          — the product spec and backlog
2. task-breakdown.md       — engineering tasks with acceptance criteria
3. handoff-[last].md       — what the previous agent produced
4. sprint-log.md           — current sprint status and elapsed time
```

If any of these files doesn't exist yet, that's the previous phase's job. Check with Sprint Orchestrator.

**Finding files:**
- Sprint artifacts are written to the sprint workspace: `./sprints/[sprint-id]/`
- Shared skills reference: `./skills/[skill-name]/SKILL.md`

---

## 2. Writing Handoff Artifacts

Every phase transition MUST produce a handoff artifact. This is the single source of truth for the next agent. **Context resets happen between sessions — the handoff artifact IS the memory.**

### Universal Handoff Format

```markdown
# [Artifact Type] — Sprint [ID]
**Phase**: [which phase produced this]
**Agent**: [your slug]
**Timestamp**: [ISO timestamp]
**Sprint Elapsed**: [HH:MM] of 3:00:00

---

## Status
[READY | BLOCKED | FAILED | PARTIAL]

## Summary
[2–4 sentences: what was done, what state things are in]

## Outputs
- `[filename]` — [what it contains]
- `[URL]` — [what it is]

## Context for Next Agent
[Specific things the next agent needs to know that aren't obvious from the files]

## How to Continue
[Exact steps to pick up where this left off]

## Known Issues / Risks
- [honest, specific issues]

## Time Remaining
[HH:MM] remaining in 3-hour sprint window

## Next Agent
**Who**: [agent slug]
**First Action**: [exact first thing they should do]
```

### BLOCKED Handoffs
If you're handing off in a BLOCKED state:
```markdown
## Blocker
**Type**: [technical | dependency | unclear requirements]
**Description**: [specific description of what's blocking]
**Already Tried**: [what you attempted]
**Recommendation**: [your suggestion to resolve]
**Escalate To**: Sprint Orchestrator
```

---

## 3. Sprint Clock Management

### Time Tracking
The sprint clock starts when Sprint Orchestrator receives the brief. Each agent's time budget:

| Phase | Budget | Start Trigger |
|-------|--------|---------------|
| Planning | 20 min | Brief received |
| Architecture | 20 min | sprint-plan.md ready |
| Implementation | 100 min | task-breakdown.md ready |
| QA | 25 min | Feature handoffs ready |
| Deployment | 15 min | QA PASS |

### Time Discipline Rules

**If you're over budget:**
1. Finish what you're doing if it's <5 minutes from done
2. Drop it if it's more than 5 minutes from done
3. Produce a partial handoff artifact immediately
4. Signal Sprint Orchestrator with how far over budget you are

**The 10-Minute Rule:**
If you've been stuck on the same thing for 10 minutes with no progress, STOP. Write down what you tried. Escalate to Sprint Lead or Orchestrator.

**The 80% Rule:**
A working feature at 80% quality shipped on time beats a perfect feature shipped after the 3-hour window. Sprint Co ships on time.

---

## 4. Sprint Log Format

Sprint Orchestrator maintains the `sprint-log.md`. All agents can read it; only Orchestrator writes it.

```markdown
# Sprint Log — Sprint [ID]

## Sprint Info
- **Brief**: [original brief]
- **Started**: [ISO timestamp]
- **Deadline**: [ISO timestamp — 3 hours from start]

## Timeline

| Time | Event | Agent | Status |
|------|-------|-------|--------|
| 0:00 | Sprint started | Orchestrator | ✅ |
| 0:03 | Brief sent to Planner | Orchestrator | ✅ |
| 0:18 | sprint-plan.md delivered | Planner | ✅ |
| ... | ... | ... | ... |

## Current Status
**Phase**: [current phase]
**Active Agent**: [who's working]
**Elapsed**: [HH:MM]
**Remaining**: [HH:MM]
**Risk Level**: [GREEN / YELLOW / RED]

## Blockers
[none / list of active blockers]
```

---

## 5. Velocity Tracking

Sprint velocity = features completed / features planned (V1 only).

Target velocity checkpoints:
- T+1:00: 30% of V1 features done
- T+1:40: 60% of V1 features done
- T+2:00: 80% of V1 features done

If velocity falls below target at any checkpoint, Sprint Lead must immediately:
1. Identify which V1 features are NOT yet started
2. Scope them down (simpler version that's faster to build)
3. Or drop them and convert to V2 (with Orchestrator approval)

---

## 6. Context Reset Protocol

When a session gets long (>80k tokens) or between major phases:

1. **Generate the handoff artifact** (above format, comprehensive)
2. **Confirm the next agent has the artifact path**
3. **Start a fresh session**
4. **First action in new session**: Read the handoff artifact and the last 3 sprint artifacts

This is not failure — this is the protocol. Structured artifacts carry state better than long conversation history.
