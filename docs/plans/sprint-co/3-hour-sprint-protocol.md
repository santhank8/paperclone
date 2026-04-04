# 3-Hour Sprint Protocol

## Overview

This document defines the complete timeline, handoff sequence, context reset protocol, and failure recovery procedures for a Sprint Co 3-hour sprint session.

---

## Timeline Diagram

```
HOUR 0                    HOUR 1                    HOUR 2                    HOUR 3
│                         │                         │                         │
├─── PLANNING ────────────┤                         │                         │
│  [0:00] Brief received  │                         │                         │
│  [0:03] Planner starts  │                         │                         │
│  [0:18] sprint-plan.md  │                         │                         │
│         → Sprint Lead   │                         │                         │
│                         │                         │                         │
├─── ARCHITECTURE ────────┤                         │                         │
│  [0:20] Lead starts     │                         │                         │
│  [0:35] Repo scaffolded │                         │                         │
│  [0:40] task-breakdown  │                         │                         │
│         → Alpha + Beta  │                         │                         │
│                         │                         │                         │
├─── IMPLEMENTATION ──────────────────────────────┤                         │
│  [0:40] Alpha starts F1 │                         │                         │
│  [0:40] Beta starts F2  │                         │                         │
│  [1:10] F1 → QA         │                         │                         │
│  [1:25] F1 PASS → Alpha │                         │                         │
│  [1:30] Alpha starts F3 │                         │                         │
│         ...             │                         │                         │
│                         │         [2:20] FEATURE FREEZE                     │
│                         │                         │                         │
├─── QA ──────────────────────────────────────────┤                         │
│                         │         [2:20] QA final │                         │
│                         │         [2:40] QA PASS  │                         │
│                         │                         │                         │
├─── DEPLOYMENT ─────────────────────────────────────────────────────────────┤
│                         │                         [2:45] Deploy starts      │
│                         │                         [2:55] Smoke tests pass   │
│                         │                         [3:00] Report to Jeremy ✅ │
```

---

## Phase-by-Phase Protocol

### Phase 1: Planning (0:00 – 0:20)

**Owner**: Product Planner  
**Input**: Raw brief from Sprint Orchestrator  
**Output**: `sprint-plan.md`  
**Budget**: 20 minutes

**Steps**:
1. Receive brief
2. Decompose: core user action, product type, data entities
3. Write product spec (name, value prop, user flow, data model, tech stack)
4. Create sprint backlog with V1/V2/V3 labels
5. Verify V1 tasks sum to ≤100 minutes
6. Write `sprint-plan.md`
7. Signal Sprint Orchestrator

**Checkpoint (15 min mark)**:
- If not 80% done → drop non-essential spec sections, go with simpler plan
- If stuck on scope → default to the minimal interpretation of the brief

---

### Phase 2: Architecture (0:20 – 0:40)

**Owner**: Sprint Lead  
**Input**: `sprint-plan.md`  
**Output**: `task-breakdown.md` + scaffolded repo  
**Budget**: 20 minutes

**Steps**:
1. Read `sprint-plan.md` fully
2. Identify parallel vs sequential tasks
3. Scaffold repo (create-vite for frontend, mkdir for backend)
4. Create `.env.example`, `README.md`, `Makefile`
5. Write `task-breakdown.md` with owner, estimate, acceptance criteria
6. Signal Engineer Alpha (frontend tasks) and Engineer Beta (backend tasks) simultaneously

**Checkpoint (10 min mark)**:
- If scaffold is failing → use a simpler template
- If task breakdown is complex → reduce to fewer, bigger tasks

---

### Phase 3: Implementation (0:40 – 2:20)

**Owners**: Engineer Alpha + Engineer Beta (parallel)  
**Input**: `task-breakdown.md`  
**Output**: Feature commits + `handoff-[feature-id].md` per feature  
**Budget**: 100 minutes

**Sprint Lead Velocity Checkpoints**:

| Time | Check | If Behind |
|------|-------|-----------|
| T+1:00 | 30% V1 done | Drop lowest-priority V1 to V2 |
| T+1:40 | 60% V1 done | Drop anything not started |
| T+2:00 | 80% V1 done | Freeze all incomplete features |
| T+2:20 | Feature freeze | All remaining work goes to QA as-is |

**Alpha/Beta Protocol** (per feature):
1. Pick first incomplete task assigned to you
2. Plan (2–3 sentences)
3. Implement
4. Self-evaluate
5. Write handoff
6. Signal QA

**Parallelism rules**:
- Alpha and Beta can work simultaneously on independent tasks
- If Alpha finishes early and Beta is stuck → Alpha helps Beta (not starts new feature)
- Never have two engineers on the same task simultaneously

---

### Phase 4: QA (2:20 – 2:45)

**Owner**: QA Engineer  
**Input**: `handoff-[feature-id].md` files  
**Output**: `eval-report.md` per feature  
**Budget**: 25 minutes (total across all features)

**Protocol**:
1. Receive all handoffs
2. Process highest-priority feature first
3. Run app
4. Playwright test
5. Grade 4 criteria
6. Write eval report
7. PASS → signal Delivery | FAIL → signal engineer + wait for fix

**Time allocation** (for typical 2-3 feature sprint):
- Each feature evaluation: ~8 minutes
- Each re-test after fix: ~5 minutes

**Hard rule**: At T+2:40, stop evaluating. Whatever has passed, ship it. Don't let perfectionism delay deployment.

---

### Phase 5: Deployment (2:45 – 3:00)

**Owner**: Delivery Engineer  
**Input**: `eval-report.md` (PASS)  
**Output**: Live production URL + `sprint-report.md`  
**Budget**: 15 minutes

**Steps**:
1. Confirm QA PASS
2. `npm run build`
3. `wrangler deploy` (or fallback)
4. Smoke tests (5 checks)
5. Git tag + push
6. Write sprint report
7. Signal Sprint Orchestrator

---

## Handoff Artifact Chain

```
Brief (Jeremy)
    ↓
sprint-plan.md (Product Planner → Sprint Lead)
    ↓
task-breakdown.md (Sprint Lead → Alpha + Beta)
    ↓
handoff-[feature-id].md (Alpha/Beta → QA Engineer)
    ↓
eval-report.md (QA Engineer → Delivery/Alpha/Beta)
    ↓
sprint-report.md (Delivery Engineer → Sprint Orchestrator → Jeremy)
```

Every artifact must contain enough state for the receiving agent to start immediately without asking questions.

---

## Context Reset Protocol

### When to Reset
- Session exceeds ~80k tokens
- Major phase transition (Planning → Architecture, Implementation → QA)
- Agent is losing coherence or repeating earlier mistakes

### How to Reset
1. **Before resetting**, produce the full handoff artifact for the current phase
2. Confirm the artifact is written to disk
3. Start fresh session
4. **First thing in new session**: Read the handoff artifact + `sprint-plan.md` + `sprint-log.md`
5. Continue from where the artifact left off

### Reset Artifact Template
```markdown
# Context Reset Artifact — Sprint [ID]

## Why This Reset Happened
[reason]

## State as of Reset
**Phase**: [current phase]
**Sprint Elapsed**: [HH:MM]
**Remaining**: [HH:MM]

## What Was Done
[complete list of completed tasks]

## What Is In Progress
[exact state of current work — where files are, what's working]

## What Remains
[ordered list of remaining tasks]

## First Action After Reset
[exact next step — no ambiguity]

## Critical Context
[anything that would be lost if not captured here]
```

---

## Failure Modes and Recovery

### Failure Mode 1: Feature Takes Too Long
**Symptoms**: Task estimate was 30 min, now at 45 min, still not done.
**Recovery**:
1. Sprint Lead notes the overrun at the next velocity checkpoint
2. Feature is scope-reduced (implement the simplest working version)
3. If still not done: mark as incomplete, move on
4. QA evaluates what was completed

### Failure Mode 2: QA Keeps Failing
**Symptoms**: Feature fails QA twice in a row.
**Recovery**:
1. After 2nd fail: Signal Sprint Orchestrator
2. Orchestrator decision: continue (3rd attempt) or drop feature
3. Default: drop feature if it's not a core V1
4. Deploy everything that passed

### Failure Mode 3: Build Fails at Deployment
**Symptoms**: `npm run build` exits with error.
**Recovery**:
1. Read the error message
2. Fix the specific import/type/build error (this is usually fast)
3. If can't fix in 5 min: try `npm run build -- --emptyOutDir` or check tsconfig
4. If still failing: build in dev mode and do a dev deployment (less ideal but shipping something is better than nothing)

### Failure Mode 4: Cloudflare Deployment Fails
**Symptoms**: `wrangler deploy` fails or returns error.
**Recovery**:
1. Check auth: `wrangler whoami` — are you logged in?
2. Check project name: does it exist in Cloudflare dashboard?
3. Try: `wrangler pages deploy dist/ --project-name [name]` (creates project if needed)
4. If Cloudflare is down: fall back to Vercel (`npx vercel --prod`)

### Failure Mode 5: Agent is Stuck and Not Reporting
**Symptoms**: Sprint Orchestrator heartbeat shows an agent has been "active" for >20 min with no handoff.
**Recovery**:
1. Orchestrator sends direct message to the stuck agent
2. If no response in 5 min: Orchestrator takes over the stuck task
3. Orchestrator either completes the task (if simple) or drops it and reassigns

### Failure Mode 6: The Brief is Too Ambitious
**Symptoms**: Product Planner cannot fit V1 features in 100 min budget.
**Recovery**:
1. Planner reduces V1 to the single core user flow
2. Everything else becomes V2
3. Planner notes the reduction in the sprint plan
4. Orchestrator may optionally ask Jeremy for confirmation before proceeding

### Failure Mode 7: Sprint Runs Out of Time
**Symptoms**: Clock hits 3:00 with features incomplete.
**Recovery**:
1. Immediately stop all implementation work
2. QA evaluates what IS complete
3. Deploy whatever passes QA
4. Report to Jeremy: what shipped, what didn't, why
5. Suggest continuation brief for a follow-up sprint

---

## Orchestrator Heartbeat Protocol

Every 15 minutes during active sprint:
```
[HH:MM] HEARTBEAT #[N] — Sprint [ID]
Phase: [current]
Active: [agent names]
Done: [completed tasks]
Behind: [any velocity risks]
Action: [what orchestrator is doing]
```

Heartbeat thresholds:
- **GREEN**: On pace, no blockers
- **YELLOW**: 1 agent blocked, velocity slightly below target
- **RED**: Multiple blockers, significant velocity risk, may need to drop features
