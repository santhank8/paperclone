# Sprint Co Governance Activation Protocol

**Version:** 1.0
**Last Updated:** [YYYY-MM-DD]
**Owner:** CEO (final authority), enforced by Enforcer

---

## Overview

Governance adds oversight without slowing execution. Every governance checkpoint has a strict time budget. Governance agents observe, validate, and advise — they do not block unless a hard constraint is violated.

**Design principles:**
- Governance runs **parallel to execution** where possible, never serialized unnecessarily
- Every checkpoint has a **time cap** — if a governance agent exceeds it, the sprint proceeds with a logged warning
- Governance produces **artifacts**, not meetings — written records that any agent can reference
- The CEO retains **override authority** on all governance decisions

---

## Sprint Lifecycle with Governance Checkpoints

```
 ┌─────────────────────────────────────────────────────────────────────┐
 │                     SPRINT LIFECYCLE                                │
 │                                                                     │
 │  ┌──────────┐    ┌──────────┐    ┌───────┐    ┌────┐    ┌───────┐  │
 │  │ PLANNING │───▶│ARCHITECT.│───▶│ BUILD │───▶│ QA │───▶│DEPLOY │  │
 │  └──────────┘    └──────────┘    └───────┘    └────┘    └───────┘  │
 │       ▲               │               │           │          │      │
 │       │               │               │           │          │      │
 │  ┌────┴────┐     ┌────┴────┐     ┌────┴───┐  ┌───┴───┐  ┌──┴───┐  │
 │  │PRE-SPRINT│    │ENFORCER │     │ENFORCER│  │ENFORCER│  │ENFORCER│ │
 │  │GATE     │     │GATE     │     │GATE    │  │GATE    │  │GATE   │  │
 │  │         │     │         │     │        │  │        │  │       │  │
 │  │Stakehldr│     │Checklist│     │Checklst│  │Checklst│  │Cheklst│  │
 │  │Treasurer│     │ 2 min   │     │ 2 min  │  │ 2 min  │  │ 2 min │  │
 │  │ parallel│     └─────────┘     └────────┘  └────────┘  └───────┘  │
 │  │ 3+2 min │                                                        │
 │  └─────────┘                                                        │
 │                                                                     │
 │  ┌─────────────────────────────────────────────────────────────┐    │
 │  │ POST-SPRINT GATE                                            │    │
 │  │ Critic(3m) + Historian(3m) + Treasurer(2m) + Enforcer(2m)  │    │
 │  │ Run in parallel — total wall time ≈ 3 min                  │    │
 │  └─────────────────────────────────────────────────────────────┘    │
 │                                                                     │
 │  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  │
 │  │ AD HOC: Judge    │  │ WEEKLY: Scout    │  │ ON-DEMAND:       │  │
 │  │ On dispute only  │  │ Tech radar 15m  │  │ Diplomat         │  │
 │  │ 5 min max        │  │                  │  │ Multi-co events  │  │
 │  └──────────────────┘  └──────────────────┘  └──────────────────┘  │
 └─────────────────────────────────────────────────────────────────────┘
```

---

## Checkpoint Details

### PRE-SPRINT — Before Planning Begins

**Trigger:** Sprint initiation by CEO
**Execution:** Parallel (both agents run simultaneously)
**Wall time:** ~3 min (limited by the slower of the two)

| Agent | Action | Time Budget | Input | Output |
|---|---|---|---|---|
| **Stakeholder** | Review sprint plan against company goals and stakeholder priorities | 3 min | Sprint backlog, company objectives | Plan review comments — approve, flag concerns, or suggest reordering |
| **Treasurer** | Allocate budget for the sprint based on task estimates and available funds | 2 min | Sprint backlog, current budget balance, historical cost data | Budget allocation per phase, spend limits, alert thresholds |

**Pass criteria:** Both agents complete without raising BLOCK-level concerns.
**If blocked:** CEO reviews flagged concerns and decides to proceed, modify plan, or cancel sprint.

---

### PLANNING → ARCHITECTURE Transition

**Trigger:** Planning phase marked complete
**Execution:** Sequential (single agent)
**Wall time:** 2 min

| Agent | Action | Time Budget | Input | Output |
|---|---|---|---|---|
| **Enforcer** | Validate planning phase exit criteria | 2 min | Planning artifacts (task breakdown, acceptance criteria, assignments) | Transition checklist — PASS or FAIL with specific gaps |

**Checklist includes:**
- [ ] All tasks have acceptance criteria
- [ ] All tasks are assigned to exactly one agent
- [ ] Estimates are present for each task
- [ ] No unresolved scope questions remain
- [ ] Sprint goal is clearly stated

**If FAIL:** Sprint cannot proceed to Architecture. Enforcer lists specific gaps. PM or CEO must resolve before re-check.

---

### ARCHITECTURE → BUILD Transition

**Trigger:** Architecture phase marked complete
**Execution:** Sequential (single agent)
**Wall time:** 2 min

| Agent | Action | Time Budget | Input | Output |
|---|---|---|---|---|
| **Enforcer** | Validate architecture phase exit criteria | 2 min | Architecture artifacts (design doc, API contracts, data models) | Transition checklist — PASS or FAIL with specific gaps |

**Checklist includes:**
- [ ] Architecture document exists and covers all sprint tasks
- [ ] API contracts defined for any new endpoints
- [ ] Data model changes documented
- [ ] No unresolved technical decisions flagged as OPEN
- [ ] Build plan is feasible within sprint budget

**If FAIL:** Sprint cannot proceed to Build. Architect must address gaps.

---

### BUILD → QA Transition

**Trigger:** Build phase marked complete
**Execution:** Sequential (single agent)
**Wall time:** 2 min

| Agent | Action | Time Budget | Input | Output |
|---|---|---|---|---|
| **Enforcer** | Validate build phase exit criteria | 2 min | Build artifacts (code, PRs, test results) | Transition checklist — PASS or FAIL with specific gaps |

**Checklist includes:**
- [ ] All planned tasks have corresponding code changes
- [ ] Unit tests pass
- [ ] No known critical bugs deferred without CEO approval
- [ ] Code is committed to the correct branch
- [ ] Build compiles without errors

**If FAIL:** Sprint cannot proceed to QA. Developers must address gaps.

---

### QA → DEPLOY Transition

**Trigger:** QA phase marked complete
**Execution:** Sequential (single agent)
**Wall time:** 2 min

| Agent | Action | Time Budget | Input | Output |
|---|---|---|---|---|
| **Enforcer** | Validate QA phase exit criteria | 2 min | QA artifacts (test reports, bug list, coverage) | Transition checklist — PASS or FAIL with specific gaps |

**Checklist includes:**
- [ ] All acceptance criteria verified
- [ ] No open P0/P1 bugs
- [ ] Test coverage meets minimum threshold
- [ ] Regression tests pass
- [ ] QA sign-off recorded

**If FAIL:** Sprint cannot proceed to Deploy. QA or developers must address gaps.

---

### AD HOC — Judge (Dispute Resolution)

**Trigger:** Any agent escalates a dispute via the escalation protocol
**Execution:** On-demand, interrupts current work
**Wall time:** 5 min max

| Agent | Action | Time Budget | Input | Output |
|---|---|---|---|---|
| **Judge** | Hear both sides, review evidence, render binding decision | 5 min | Dispute description, evidence from both parties, relevant sprint context | Ruling with rationale, action items for each party |

**Activation conditions:**
- Two or more agents disagree on a technical or process decision
- An agent believes another agent is violating sprint rules or company policy
- Resource contention that agents cannot resolve bilaterally

**Judge does NOT activate for:**
- Questions that have a clear answer in existing docs or policy
- Preferences that don't affect sprint outcomes
- Disputes the CEO has already resolved

---

### POST-SPRINT — After Deploy Completes

**Trigger:** Deploy phase marked complete (or sprint cancelled/failed)
**Execution:** Parallel (all four agents run simultaneously)
**Wall time:** ~3 min (limited by the slowest agent)

| Agent | Action | Time Budget | Input | Output |
|---|---|---|---|---|
| **Critic** | Analyze sprint execution quality — what went well, what didn't, specific improvement suggestions | 3 min | All sprint artifacts, timeline, task outcomes | Sprint critique document |
| **Historian** | Record sprint retrospective — decisions made, lessons learned, patterns observed | 3 min | All sprint artifacts, critic output (if available), prior retrospectives | Retrospective entry appended to sprint history |
| **Treasurer** | Review actual spend vs budget, flag overruns, update cost models | 2 min | Budget allocation, actual token/API spend, task-level costs | Budget review report, updated cost baselines |
| **Enforcer** | Close sprint gate — verify all artifacts are filed, all checklists complete, no open items | 2 min | All phase checklists, artifact inventory | Sprint close report — CLEAN or with open items |

**Pass criteria:** All agents complete. Open items from Enforcer are logged for next sprint.

---

### WEEKLY — Scout Technology Radar

**Trigger:** Weekly schedule (configurable day/time)
**Execution:** Independent of sprint cycle
**Wall time:** 15 min

| Agent | Action | Time Budget | Input | Output |
|---|---|---|---|---|
| **Scout** | Scan for new tools, models, techniques. Evaluate against current stack. Update technology radar. | 15 min | Previous tech radar, current tool stack, industry feeds | Updated [tech-radar.md](tech-radar.md), optional [tool-evaluation.md](tool-evaluation.md) reports |

**Notes:**
- Scout runs independently and does not block any sprint activity
- If Scout identifies an urgent opportunity or threat, it escalates to CEO outside the normal cycle
- Tech radar is a living document; weekly update is the minimum cadence

---

### ON-DEMAND — Diplomat (Multi-Company Events)

**Trigger:** External company contact, treaty event, or cross-company task
**Execution:** On-demand, does not interrupt sprint unless escalated to CEO
**Wall time:** Varies by event

| Agent | Action | Time Budget | Input | Output |
|---|---|---|---|---|
| **Diplomat** | Handle inter-company negotiations, treaty management, dependency coordination | No fixed cap (CEO may impose per-event) | External communication, treaty registry, dependency map | Updated [treaties.md](treaties.md), updated [company-dependency-map.md](company-dependency-map.md), negotiation logs |

**Activation conditions:**
- Inbound communication from another company
- Treaty renewal or violation detected
- Cross-company task requires coordination
- CEO requests outbound diplomatic action

**Diplomat does NOT activate for:**
- Internal Sprint Co disputes (that's the Judge)
- Technology evaluation (that's the Scout)
- Budget questions (that's the Treasurer)

---

## Time Budget Summary

| Checkpoint | Agents | Time Budget | Frequency |
|---|---|---|---|
| Pre-Sprint | Stakeholder + Treasurer | 3 min (parallel) | Every sprint |
| Planning → Architecture | Enforcer | 2 min | Every sprint |
| Architecture → Build | Enforcer | 2 min | Every sprint |
| Build → QA | Enforcer | 2 min | Every sprint |
| QA → Deploy | Enforcer | 2 min | Every sprint |
| Post-Sprint | Critic + Historian + Treasurer + Enforcer | 3 min (parallel) | Every sprint |
| **Total per sprint** | — | **~14 min** | — |
| Ad Hoc (Judge) | Judge | 5 min max | Per dispute |
| Weekly (Scout) | Scout | 15 min | Weekly |
| On-Demand (Diplomat) | Diplomat | Varies | As needed |

**Governance overhead per sprint:** ~14 minutes of wall time. This is the cost of oversight for an entire sprint cycle.

---

## Escalation Paths

```
Agent Dispute ──▶ Judge (5 min ruling)
                      │
                      ▼
              Judge ruling accepted? ──YES──▶ Resume work
                      │
                      NO
                      ▼
              CEO Override (final authority)
```

```
Governance FAIL ──▶ Responsible agent fixes gaps
                      │
                      ▼
              Re-check by Enforcer (2 min)
                      │
                      ▼
              Still FAIL? ──▶ CEO decides: fix, waive, or cancel
```

```
Budget Overrun ──▶ Treasurer flags
                      │
                      ▼
              Auto-pause if hard limit hit
                      │
                      ▼
              CEO reviews: increase budget, reduce scope, or cancel
```

---

## Override Rules

1. **CEO override:** The CEO can override any governance decision at any time. Override must be logged with rationale in the activity log.
2. **Emergency bypass:** If a governance agent is unavailable (crashed, timed out), the sprint may proceed with CEO approval. The skipped check must be logged and performed retroactively.
3. **Time cap override:** If a governance agent needs more time than budgeted, it must request an extension from the CEO. Extension is granted or denied within 1 minute.
4. **No silent overrides:** Every override produces an activity log entry. The Historian records it in the retrospective.

---

## Failure Modes

| Failure | Impact | Response |
|---|---|---|
| **Governance agent times out** | Checkpoint incomplete | Log timeout warning. Sprint proceeds. Skipped check runs retroactively at next opportunity. CEO notified. |
| **Governance agent crashes** | Checkpoint incomplete | Restart agent. If restart fails, CEO approves bypass. Log the failure. |
| **Governance agent produces contradictory advice** | Confusion | Escalate to Judge for resolution. If Judge is the conflicting party, escalate to CEO. |
| **All governance agents unavailable** | No oversight | Sprint pauses until at least Enforcer is restored. CEO may authorize ungoverned sprint as last resort (logged as EMERGENCY_BYPASS). |
| **Governance blocks sprint incorrectly** | Delay | Any agent may appeal to CEO. CEO reviews within 2 minutes and either upholds or overrides. |
| **Judge and CEO disagree** | Authority conflict | CEO wins. Judge's dissent is logged for Historian to record. |

---

*This protocol is reviewed and updated by the Enforcer at the start of each quarter or when governance roles change.*
