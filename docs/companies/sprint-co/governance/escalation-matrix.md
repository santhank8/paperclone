# Sprint Co Escalation Matrix

> When and how to escalate — clear paths, clear timelines.
> Effective: 2026-04-01 · Governed by: Constitution Articles 3, 4

---

## Escalation Triggers

| Situation | First Responder | Escalation Target | Time Limit | Priority |
|-----------|----------------|-------------------|------------|----------|
| Bug found during build | Engineer (Alpha/Beta) | Sprint Lead | 15 min | Standard |
| QA fails once | QA Engineer | Sprint Lead | 15 min | Standard |
| QA fails twice on same item | QA Engineer | Sprint Lead + Orchestrator | Immediate | High |
| Scope dispute | Stakeholder vs Sprint Lead | Judge | 10 min | High |
| Scope creep detected | Product Planner | Orchestrator | 10 min | Standard |
| Budget at 80% | Treasurer | Orchestrator | Immediate | High |
| Budget at 95% | Treasurer | Orchestrator + Board | Immediate | Critical |
| Process violation detected | Enforcer | Orchestrator | 5 min | High |
| Critical process violation | Enforcer | Orchestrator + Board | Immediate | Critical |
| Agent stuck > 20 min | Any agent | Orchestrator | Automatic | High |
| Agent unresponsive | Any agent | Orchestrator | 5 min | High |
| Model failure / API error | Affected agent | Orchestrator | Immediate | High |
| Persistent model failure (3+) | Orchestrator | Board | Immediate | Critical |
| Security concern raised | Any agent | Orchestrator + Enforcer | Immediate | Critical |
| Deployment failure | Delivery Engineer | Sprint Lead | 10 min | High |
| Deployment failure (2nd attempt) | Sprint Lead | Orchestrator | Immediate | Critical |
| Dissent filed (Blocking) | Orchestrator | Judge (if unresolved 15 min) | See Dissent Protocol | High |
| Inter-team conflict | Team leads | Orchestrator | 10 min | Standard |
| Sprint clock at 85% | Orchestrator | All agents (awareness) | N/A | Standard |
| Sprint clock at 95% | Orchestrator | Board (if delivery at risk) | Immediate | High |

---

## Escalation Format

When escalating, use this structure:

```markdown
## Escalation

- **Escalation ID:** ESC-{SPRINT_ID}-{SEQ}
- **Date:** YYYY-MM-DD HH:MM UTC
- **Escalating Agent:** [Name and role]
- **Escalation Target:** [Name and role]
- **Priority:** Standard | High | Critical

### Situation
[What is happening? 2-3 sentences. Be specific.]

### Impact
[What is blocked or at risk if this isn't resolved?]

### Actions Already Taken
[What has the first responder already tried?]

### Requested Action
[What do you need the escalation target to do?]

### Time Constraint
[When does this need to be resolved by? Reference sprint clock if relevant.]
```

---

## Resolution Recording

Every escalation must be closed with a resolution record:

```markdown
### Resolution

- **Resolved By:** [Agent name and role]
- **Resolution Date:** YYYY-MM-DD HH:MM UTC
- **Resolution:** [What was done to resolve the situation?]
- **Root Cause:** [Why did this happen?]
- **Prevention:** [What should be done to prevent recurrence?]
- **Decision Record:** DEC-{ID} (if a decision record was created)
```

The Enforcer checks that all escalations are properly closed before the sprint ends. Unclosed escalations are flagged in the retrospective.

---

## Escalation Paths

### Standard Path
```
First Responder → Team Lead → Orchestrator → Board
```
Used for most operational issues. Each level has a defined time window before automatic escalation.

### Governance Path
```
Any Agent → Orchestrator → Judge → Board
```
Used for disputes, process questions, and Constitutional interpretation.

### Emergency Path
```
Any Agent → Orchestrator + Board (simultaneously)
```
Used for security incidents, data breaches, or system-wide failures. Skip intermediate levels.

---

## Anti-Escalation: When NOT to Escalate

Not everything is an escalation. Do **not** escalate when:

| Situation | Instead Do This |
|-----------|----------------|
| Routine technical question | Ask the relevant team lead |
| Need a code review | Request directly from the designated reviewer |
| Disagree with a style choice | Accept it or discuss in retro |
| Want a different task assignment | Request through Orchestrator (normal channel, not escalation) |
| Something is slow but not stuck | Wait. Escalate only if stuck > 20 min |
| You're curious about a decision | Ask the decision-maker directly, read the decision record |
| Minor process deviation (no harm) | Log it, mention in retro |

**Over-escalation wastes the Orchestrator's attention and slows the sprint.** Agents who consistently over-escalate may receive coaching from the Orchestrator.

**Under-escalation is worse.** Sitting on a blocking problem to avoid escalation is a process violation. When in doubt, escalate — but use the right priority level.

---

## Automatic Escalation Triggers

The following escalations happen automatically without agent intervention:

| Trigger | Automatic Action |
|---------|-----------------|
| Agent produces no output for 20 minutes | Orchestrator notified |
| Budget threshold reached (80%, 95%) | Treasurer auto-alerts Orchestrator |
| Sprint clock at 85%, 95% | Orchestrator auto-alerts all agents, Board |
| QA gate fails 3 times on same item | Sprint Lead + Orchestrator auto-notified |
| Build fails 3 consecutive times | Sprint Lead auto-notified |

---

*Maintained by the Enforcer (process compliance) and the Orchestrator (operational response). The Historian reviews escalation patterns during retrospectives to identify systemic issues. Changes follow the Constitutional amendment process (Article 6).*
