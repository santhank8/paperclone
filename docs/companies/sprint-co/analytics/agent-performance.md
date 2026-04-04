# Agent Performance Tracker

## Purpose

Track each agent's contribution and effectiveness over time to identify strengths, detect skill gaps, inform model selection, and optimize team composition. Performance data drives decisions about agent upgrades, specialization, and trust level adjustments.

---

## Metrics per Agent

| Metric | Definition | Target |
|--------|-----------|--------|
| **Tasks Completed** | Number of tasks/features completed per sprint | Varies by role |
| **Quality Score** | Average QA score across all completed tasks (0-10) | ≥ 7.0 |
| **First-Pass Rate** | % of tasks passing QA without revision | ≥ 70% |
| **Time Utilization** | % of sprint time actively producing output | ≥ 80% |
| **Cost Efficiency** | Quality Score / Cost — value per dollar | Higher is better |
| **Escalation Rate** | % of tasks requiring escalation to PM or Board | ≤ 10% |
| **Feedback Response** | Quality of response to QA feedback (measured by re-review score improvement) | ≥ +1.5 points |
| **Trust Level** | Cumulative reliability indicator (FULL / HIGH / STANDARD / PROBATION) | FULL |

---

## Agent Performance Table

| Agent | Role | Sprints Active | Avg Quality | Tasks/Sprint | Cost Efficiency | Escalation Rate | Trust Level | Trend |
|-------|------|---------------|------------|-------------|----------------|----------------|-------------|-------|
| PM (Aria) | Project Manager | [N] | [N/10] | [N] | [N] | [N%] | [FULL] | [↑↓→] |
| Engineer Alpha | Implementation | [N] | [N/10] | [N] | [N] | [N%] | [HIGH] | [↑↓→] |
| Engineer Beta | Implementation | [N] | [N/10] | [N] | [N] | [N%] | [STANDARD] | [↑↓→] |
| Designer | UI/UX Design | [N] | [N/10] | [N] | [N] | [N%] | [HIGH] | [↑↓→] |
| QA Critic | Quality Assurance | [N] | [N/10] | [N] | [N] | [N%] | [FULL] | [↑↓→] |
| Scout | Research & Intel | [N] | [N/10] | [N] | [N] | [N%] | [HIGH] | [↑↓→] |
| Enforcer | Governance | [N] | [N/10] | [N] | [N] | [N%] | [FULL] | [↑↓→] |
| Judge | Dispute Resolution | [N] | [N/10] | [N] | [N] | [N%] | [FULL] | [↑↓→] |
| Diplomat | External Comms | [N] | [N/10] | [N] | [N] | [N%] | [HIGH] | [↑↓→] |

### Trust Level Definitions

| Level | Meaning | Criteria |
|-------|---------|---------|
| **FULL** | Maximum autonomy; minimal oversight needed | 5+ sprints, Avg Quality ≥ 8.0, Escalation Rate ≤ 5% |
| **HIGH** | Trusted for most tasks; spot-check review | 3+ sprints, Avg Quality ≥ 7.0, Escalation Rate ≤ 10% |
| **STANDARD** | Normal oversight; all work reviewed | Default for new agents |
| **PROBATION** | Increased oversight; paired with senior agent | Avg Quality < 5.0 for 2+ sprints OR Escalation Rate > 25% |

---

## Per-Agent Detail Cards

### Engineer Alpha

| Sprint | Tasks | Avg Quality | First-Pass Rate | Cost | Cost Efficiency | Notes |
|--------|-------|------------|----------------|------|----------------|-------|
| [SP-001] | [N] | [N/10] | [N%] | [$N.NN] | [N] | [Context] |
| [SP-002] | [N] | [N/10] | [N%] | [$N.NN] | [N] | [Context] |
| [SP-003] | [N] | [N/10] | [N%] | [$N.NN] | [N] | [Context] |

**Strengths:** [e.g., Consistent backend quality, fast implementation]
**Improvement Areas:** [e.g., Frontend polish, test coverage]
**Model Used:** [e.g., claude-sonnet-4-20250514]

### Engineer Beta

| Sprint | Tasks | Avg Quality | First-Pass Rate | Cost | Cost Efficiency | Notes |
|--------|-------|------------|----------------|------|----------------|-------|
| [SP-001] | [N] | [N/10] | [N%] | [$N.NN] | [N] | [Context] |
| [SP-002] | [N] | [N/10] | [N%] | [$N.NN] | [N] | [Context] |

**Strengths:** [e.g., Creative solutions, strong UX sense]
**Improvement Areas:** [e.g., Code structure, error handling]
**Model Used:** [e.g., claude-sonnet-4-20250514]

---

## Performance Comparisons

### Engineer Alpha vs Engineer Beta (Overlapping Task Types)

| Task Type | Alpha Avg Quality | Beta Avg Quality | Alpha Cost | Beta Cost | Better Value |
|-----------|------------------|-----------------|-----------|----------|-------------|
| [API endpoints] | [N/10] | [N/10] | [$N.NN] | [$N.NN] | [Alpha/Beta] |
| [UI components] | [N/10] | [N/10] | [$N.NN] | [$N.NN] | [Alpha/Beta] |
| [Database work] | [N/10] | [N/10] | [$N.NN] | [$N.NN] | [Alpha/Beta] |
| [Bug fixes] | [N/10] | [N/10] | [$N.NN] | [$N.NN] | [Alpha/Beta] |

### Specialization Matrix

| Agent | Best At | Worst At | Optimal Assignment |
|-------|---------|----------|-------------------|
| Engineer Alpha | [Task type] | [Task type] | [Recommendation] |
| Engineer Beta | [Task type] | [Task type] | [Recommendation] |
| Designer | [Task type] | [Task type] | [Recommendation] |

---

## Performance Alerts

### Alert Conditions

| Condition | Alert Level | Action |
|----------|-------------|--------|
| Agent's avg quality > 1.5 points below team average for 2+ sprints | ⚠️ Skill Gap | Trigger skill gap analysis |
| Agent's escalation rate > 2× team average | ⚠️ Autonomy Issue | Review task complexity assignments |
| Agent's cost efficiency < 50% of best peer | ⚠️ Efficiency | Evaluate model choice; consider specialization change |
| Agent's first-pass rate < 40% for 2+ sprints | 🔴 Quality Crisis | Move to PROBATION; pair with higher-performing agent |
| Agent consistently outperforms peers by > 2 points | 🟢 Star Performer | Increase trust level; consider for mentorship role |

### Active Alerts

| Alert ID | Agent | Condition | Sprint(s) | Status | Resolution Plan |
|----------|-------|----------|-----------|--------|----------------|
| [PA-001] | [Agent] | [Description] | [SP-XXX] | [OPEN/RESOLVED] | [Plan] |

---

## Recommendations

### Model Upgrades

| Agent | Current Model | Recommended Model | Rationale | Expected Impact |
|-------|--------------|-------------------|-----------|----------------|
| [Agent] | [haiku] | [sonnet] | [Quality consistently below target] | [+N quality points, +$N.NN cost] |
| [Agent] | [sonnet] | [haiku] | [Tasks don't require heavy reasoning] | [-$N.NN cost, minimal quality impact] |

### Specialization Adjustments

| Agent | Current Scope | Recommended Scope | Rationale |
|-------|--------------|-------------------|-----------|
| [Engineer Alpha] | [Full-stack] | [Backend focus] | [Backend quality is 2+ points higher than frontend] |
| [Engineer Beta] | [Full-stack] | [Frontend focus] | [Stronger UX scores; complements Alpha] |

### Training Needs

| Agent | Skill Gap | Recommended Training | Priority |
|-------|----------|---------------------|----------|
| [Agent] | [Testing practices] | [Add testing examples to system prompt] | [HIGH] |
| [Agent] | [Error handling] | [Include error handling patterns in context] | [MEDIUM] |
| [Agent] | [Accessibility] | [Add a11y checklist to task context] | [LOW] |
