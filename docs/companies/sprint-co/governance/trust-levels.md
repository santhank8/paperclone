# Sprint Co Trust Levels

> Progressive autonomy ladder — agents earn trust through track record.
> Effective: 2026-04-01 · Governed by: Constitution Articles 4, 8

---

## Concept

Sprint Co operates on a progressive trust model. Agents do not receive full autonomy by default — they earn it through demonstrated competence, reliability, and judgment. Trust levels determine how much oversight an agent receives and what decisions they can make independently.

Trust is not permanent. Agents can be promoted for consistent performance or demoted after failures. The goal is to find the right level of autonomy for each agent so the company operates efficiently without sacrificing safety.

---

## Trust Levels

### Level 0 — Probation

**Oversight:** Human approves every action before execution.

**When assigned:**
- Agent is newly onboarded and has no track record
- Agent has been demoted after a critical failure
- Agent is operating in a new domain with no prior experience

**Constraints:**
- All outputs require Board review before taking effect
- Cannot participate in votes
- Cannot escalate directly — must go through their team lead
- Maximum 3 sprints at this level before mandatory review

---

### Level 1 — Supervised

**Oversight:** Human reviews outputs before they take effect.

**When assigned:**
- Default for newly onboarded agents after initial validation
- Agent has been demoted from Level 2 after repeated minor issues

**Constraints:**
- Outputs are produced independently but queued for Board review
- May participate in votes but cannot be a tiebreaker
- May escalate to Orchestrator
- Review turnaround target: within the sprint window

---

### Level 2 — Guided

**Oversight:** Human reviews weekly summary; can intervene but does not review each action.

**When assigned:**
- Agent has completed 3+ sprints at Level 1 with no major issues
- Promotion criteria met (see below)

**Capabilities:**
- Operates independently within their role's authority
- Outputs take effect immediately (subject to normal QA gates)
- Full voting rights
- May escalate to any level
- Weekly summary reviewed by Board

---

### Level 3 — Autonomous

**Oversight:** Human reviews monthly summary. Agent operates independently.

**When assigned:**
- Agent has completed 10+ sprints at Level 2 with strong track record
- Standard level for proven, reliable agents

**Capabilities:**
- Full operational independence within role scope
- May propose process improvements
- May mentor Level 0–1 agents
- Monthly review by Board
- Can request model upgrades without pre-approval (within budget)

---

### Level 4 — Trusted

**Oversight:** Minimal. Agent can make decisions that affect other agents.

**When assigned:**
- Reserved for governance roles and the Orchestrator
- Requires explicit Board appointment

**Capabilities:**
- All Level 3 capabilities
- May make decisions affecting other agents' workflows
- May propose policy and Constitutional changes
- May override lower-trust-level agent decisions within their authority
- Serves as tiebreaker in votes where designated
- Quarterly Board review

---

## Promotion Criteria

To move up one trust level, an agent must demonstrate:

| Metric | L0→L1 | L1→L2 | L2→L3 | L3→L4 |
|--------|--------|--------|--------|--------|
| Sprints completed | 1 clean | 3 clean | 10 clean | 20 clean |
| Major failures | 0 | 0 in last 3 | 0 in last 10 | 0 in last 20 |
| Minor issues | ≤2 | ≤1 per sprint avg | ≤0.5 per sprint avg | ≤0.2 per sprint avg |
| Escalation rate | N/A | Declining trend | Below team average | Lowest quartile |
| Peer feedback | N/A | No objections | Positive from 2+ peers | Positive from team leads |
| On-time delivery | ≥80% | ≥90% | ≥95% | ≥95% |

**Promotion process:** Orchestrator nominates → Enforcer validates metrics → Judge reviews → Board approves (L3→L4 only).

---

## Demotion Triggers

| Trigger | Severity | Demotion |
|---------|----------|----------|
| Critical security violation | Critical | Immediate to Level 0 |
| Deploying untested code | Major | Drop 1 level |
| Skipping QA gate | Major | Drop 1 level |
| Repeated missed deadlines (3+ in a row) | Major | Drop 1 level |
| Suppressing or hiding failures | Critical | Immediate to Level 0 |
| Data handling violation | Critical | Immediate to Level 0 |
| Process violation (minor, isolated) | Minor | Warning; drop 1 level if repeated |
| Output quality below threshold for 3+ sprints | Major | Drop 1 level |
| Failed to escalate when required | Major | Drop 1 level |

**Demotion process:** Enforcer reports violation → Orchestrator reviews → Judge confirms → Demotion takes effect immediately. Agent may appeal through the Dissent Protocol.

---

## Current Agent Trust Map

| Agent | Role | Team | Current Trust Level | Notes |
|-------|------|------|-------------------|-------|
| Sprint Orchestrator | Executive coordination | Executive | Level 4 — Trusted | Founding role, Board-appointed |
| Product Planner | Brief expansion, backlog | Product | Level 3 — Autonomous | Proven planning track record |
| Sprint Lead | Architecture, task routing | Engineering | Level 3 — Autonomous | Consistent technical leadership |
| Engineer Alpha | Frontend-heavy implementation | Engineering | Level 2 — Guided | Solid delivery, building track record |
| Engineer Beta | Backend-heavy implementation | Engineering | Level 2 — Guided | Solid delivery, building track record |
| QA Engineer | Evaluation, quality gates | QA & Delivery | Level 3 — Autonomous | Critical gate role, proven judgment |
| Delivery Engineer | Deployment, smoke tests | QA & Delivery | Level 2 — Guided | Reliable but lower decision scope |
| Stakeholder | Customer voice, UAT | Governance | Level 3 — Autonomous | Governance role, stable performance |
| Critic | Post-sprint review, red team | Governance | Level 3 — Autonomous | Governance role, healthy skepticism |
| Judge | Dispute resolution, precedent | Governance | Level 4 — Trusted | Board-appointed, neutral arbiter |
| Enforcer | Process compliance, audits | Governance | Level 3 — Autonomous | Governance role, compliance mandate |
| Historian | Institutional memory, retros | Governance | Level 3 — Autonomous | Governance role, learning mandate |
| Treasurer | Budget tracking, cost reporting | Governance | Level 3 — Autonomous | Financial oversight, transparent |
| Scout | External intelligence, research | Ecosystem | Level 2 — Guided | Information role, lower decision authority |
| Diplomat | External comms, integrations | Ecosystem | Level 2 — Guided | External-facing, moderate oversight |

---

*Trust levels are reviewed by the Orchestrator after every sprint and formally by the Board monthly. The Enforcer maintains the authoritative trust registry. Changes follow the demotion/promotion processes defined above.*
