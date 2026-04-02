# OKR Tracking

## Purpose

Define how Sprint Co uses Objectives and Key Results to align sprint-level execution with company-level goals. OKRs ensure that individual sprints contribute to larger strategic outcomes.

---

## OKR Framework

### Hierarchy

```
Company OKRs (quarterly)
  └── Team OKRs (quarterly, aligned to company OKRs)
       └── Sprint Objectives (per-sprint, mapped to team OKRs)
```

| Level | Set By | Cadence | Scope |
|-------|--------|---------|-------|
| Company OKRs | Board + Orchestrator | Quarterly | Strategic direction for Sprint Co |
| Team OKRs | Team leads (Sprint Lead, Scout, Judge) | Quarterly | Team-level contribution to company goals |
| Sprint Objectives | Product Planner | Per sprint | What this specific sprint achieves |

### OKR Rules

1. **3-5 Objectives per level.** More than 5 means nothing is prioritized.
2. **2-4 Key Results per Objective.** Measurable, time-bound, unambiguous.
3. **Key Results are outcomes, not tasks.** "Ship feature X" is a task. "First-pass rate ≥ 70%" is a key result.
4. **Stretch targets.** 70% achievement is considered successful. 100% means the target was too easy.
5. **Transparent.** All OKRs visible to all agents.

---

## Company OKRs — Example Set

### O1: Deliver Consistent High-Quality Software

| Key Result | Target | Current | Status |
|-----------|--------|---------|--------|
| KR1: Average QA evaluation score ≥ 4.0/5.0 | 4.0 | [N.N] | 🟢 / 🟡 / 🔴 |
| KR2: First-pass QA rate ≥ 70% (no rework needed) | 70% | [N%] | 🟢 / 🟡 / 🔴 |
| KR3: Zero SEV-1 incidents per quarter | 0 | [N] | 🟢 / 🟡 / 🔴 |

**Sprint Mapping:** Every Standard Sprint contributes to O1 through its QA gate.

### O2: Maximize Cost Efficiency

| Key Result | Target | Current | Status |
|-----------|--------|---------|--------|
| KR1: Cost per shipped feature ≤ $2.50 | $2.50 | [$N.NN] | 🟢 / 🟡 / 🔴 |
| KR2: Model routing optimization saves 30% vs all-Sonnet baseline | 30% | [N%] | 🟢 / 🟡 / 🔴 |
| KR3: Budget accuracy within ±10% (planned vs actual) | ±10% | [±N%] | 🟢 / 🟡 / 🔴 |

**Sprint Mapping:** Treasurer tracks per-sprint, Historian aggregates quarterly.

### O3: Build Institutional Knowledge

| Key Result | Target | Current | Status |
|-----------|--------|---------|--------|
| KR1: Lessons-learned KB grows by 5+ entries per month | 5/mo | [N] | 🟢 / 🟡 / 🔴 |
| KR2: Proactive context surfacing used 3+ times per sprint | 3/sprint | [N] | 🟢 / 🟡 / 🔴 |
| KR3: Historian trend predictions match outcomes 60%+ of time | 60% | [N%] | 🟢 / 🟡 / 🔴 |

**Sprint Mapping:** Historian tracks continuously, Scout contributes external knowledge.

### O4: Maintain Operational Excellence

| Key Result | Target | Current | Status |
|-----------|--------|---------|--------|
| KR1: Sprint completion rate ≥ 90% (deliver what was planned) | 90% | [N%] | 🟢 / 🟡 / 🔴 |
| KR2: Average sprint health score ≥ 80/100 | 80 | [N] | 🟢 / 🟡 / 🔴 |
| KR3: Escalation rate ≤ 10% (issues resolved at agent level) | ≤10% | [N%] | 🟢 / 🟡 / 🔴 |

**Sprint Mapping:** Orchestrator tracks per-sprint, analytics dashboards aggregate.

---

## Team OKRs — Examples

### Execution Team

| Objective | Key Results |
|-----------|------------|
| Ship features faster without quality loss | KR1: Avg implementation phase ≤ 1.5h · KR2: QA rework rate ≤ 30% · KR3: Zero rollbacks per quarter |

### Intelligence Team

| Objective | Key Results |
|-----------|------------|
| Surface insights that prevent issues | KR1: Scout alerts flagged 2+ actionable items/sprint · KR2: Historian context used in 80%+ sprint plans · KR3: 1+ trend prediction validated per month |

### Governance Team

| Objective | Key Results |
|-----------|------------|
| Ensure decisions are fair, fast, and auditable | KR1: Dispute resolution ≤ 1h avg · KR2: 100% decisions logged with rationale · KR3: Trust tier accuracy ≥ 90% (promotions match performance) |

---

## Sprint-to-OKR Mapping

Each sprint's plan includes an explicit OKR alignment section:

```markdown
## OKR Alignment

| Sprint Objective | Contributes To | Expected Impact |
|-----------------|---------------|----------------|
| Implement user auth | O1-KR1 (quality), O2-KR1 (cost) | +0.1 avg QA if clean pass |
| Reduce API latency | O4-KR2 (ops health) | +5 sprint health points |
| Add monitoring dashboards | O3-KR2 (context surfacing) | Enables proactive alerting |
```

---

## OKR Review Cadence

| Review | Frequency | Participants | Purpose |
|--------|-----------|-------------|---------|
| Sprint Check | Every sprint | Orchestrator + Product Planner | Map sprint results to OKR progress |
| Monthly Review | Monthly | Orchestrator + Historian | Assess trajectory, flag at-risk KRs |
| Quarterly Review | Quarterly | Board + Orchestrator + all team leads | Score OKRs, set next quarter |

### Monthly Review Protocol

1. **Historian** compiles OKR progress data from sprint reports and analytics
2. **Orchestrator** reviews trajectory for each KR:
   - 🟢 On track (≥ 60% of target with ≥ 50% of quarter elapsed)
   - 🟡 At risk (< 60% of target or trending downward)
   - 🔴 Off track (< 30% of target or blocked)
3. For 🟡 and 🔴 KRs: identify root cause and corrective action
4. Produce monthly OKR status report

### Quarterly Review Protocol

1. **Score each KR**: 0.0 (no progress) to 1.0 (fully achieved)
2. **Score each Objective**: average of its KR scores
3. **Assessment**:
   - 0.7–1.0: Objective achieved (green)
   - 0.4–0.6: Partial achievement (yellow) — investigate
   - 0.0–0.3: Failed (red) — root cause analysis required
4. **Set next quarter OKRs** based on what was learned

---

## OKR Adjustment Protocol

OKRs may be adjusted mid-quarter under these conditions:

| Condition | Action | Authority |
|----------|--------|-----------|
| External shift (market, tech, client need) | Revise objectives with Board approval | Board + Orchestrator |
| KR target discovered to be wrong metric | Replace KR, document rationale | Orchestrator + Historian |
| KR target too easy (100% by month 1) | Stretch target upward | Orchestrator |
| KR target impossible (blocked by external factor) | Defer or replace with achievable proxy | Board + Orchestrator |

Adjustments are logged in the OKR document with date and reason.

---

## OKR Dashboard Template

```markdown
# OKR Dashboard — Q{{N}} {{YEAR}}

## Company OKR Summary

| Objective | Score | Status | Notes |
|-----------|-------|--------|-------|
| O1: High-Quality Software | [N.N] | 🟢 / 🟡 / 🔴 | — |
| O2: Cost Efficiency | [N.N] | 🟢 / 🟡 / 🔴 | — |
| O3: Institutional Knowledge | [N.N] | 🟢 / 🟡 / 🔴 | — |
| O4: Operational Excellence | [N.N] | 🟢 / 🟡 / 🔴 | — |

## Detailed KR Progress

### O1: High-Quality Software
| KR | Target | Current | % | Trend | Sprint Contrib |
|----|--------|---------|---|-------|---------------|
| KR1 | 4.0 | [N.N] | [N%] | ↑↓→ | SP-{{last 3}} |
| KR2 | 70% | [N%] | [N%] | ↑↓→ | SP-{{last 3}} |
| KR3 | 0 | [N] | [N%] | ↑↓→ | — |

### O2: Cost Efficiency
| KR | Target | Current | % | Trend | Sprint Contrib |
|----|--------|---------|---|-------|---------------|
| KR1 | $2.50 | [$N.NN] | [N%] | ↑↓→ | SP-{{last 3}} |
| KR2 | 30% | [N%] | [N%] | ↑↓→ | — |
| KR3 | ±10% | [±N%] | [N%] | ↑↓→ | SP-{{last 3}} |

## At-Risk Items
| KR | Risk | Mitigation |
|----|------|-----------|
| — | — | — |

## Last Updated
- Date: {{ISO-8601}}
- By: Historian
- Next review: {{date}}
```
