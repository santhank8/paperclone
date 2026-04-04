# Quality Dashboard

## Purpose

Track quality trends across sprints to ensure Sprint Co's output meets or exceeds standards over time. Identifies systemic quality issues, per-agent strengths and weaknesses, and correlations between quality and other sprint variables.

---

## Metrics

| Metric | Definition | Target |
|--------|-----------|--------|
| **Avg QA Score** | Mean QA score across all features in a sprint (0-10 scale) | ≥ 7.0 |
| **Functionality** | Sub-score: Does the feature work correctly? | ≥ 7.5 |
| **UX** | Sub-score: Is the user experience polished? | ≥ 6.5 |
| **Code Quality** | Sub-score: Is the code clean, maintainable, tested? | ≥ 7.0 |
| **Product Depth** | Sub-score: Does the feature have real substance? | ≥ 6.5 |
| **First-Pass Rate** | % of features passing QA on the first review attempt | ≥ 70% |
| **Critic Grade** | Letter grade assigned by the Critic agent (A–F) | ≥ B |

---

## Sprint Quality Table

| Sprint ID | Overall QA | Functionality | UX | Code Quality | Product Depth | First-Pass Rate | Critic Grade |
|-----------|-----------|--------------|-----|-------------|--------------|----------------|-------------|
| [SP-001] | [N/10] | [N/10] | [N/10] | [N/10] | [N/10] | [N%] | [A-F] |
| [SP-002] | [N/10] | [N/10] | [N/10] | [N/10] | [N/10] | [N%] | [A-F] |
| [SP-003] | [N/10] | [N/10] | [N/10] | [N/10] | [N/10] | [N%] | [A-F] |

### Trend Indicators

| Dimension | 3-Sprint Avg | Direction | Notes |
|-----------|-------------|-----------|-------|
| Overall QA | [N/10] | [↑↓→] | — |
| Functionality | [N/10] | [↑↓→] | — |
| UX | [N/10] | [↑↓→] | — |
| Code Quality | [N/10] | [↑↓→] | — |
| Product Depth | [N/10] | [↑↓→] | — |
| First-Pass Rate | [N%] | [↑↓→] | — |

---

## Per-Agent Quality Table

| Agent | Avg Score | First-Pass Rate | Trend | Strengths | Improvement Areas |
|-------|----------|----------------|-------|-----------|-------------------|
| Engineer Alpha | [N/10] | [N%] | [↑↓→] | [e.g., Strong functionality] | [e.g., UX polish] |
| Engineer Beta | [N/10] | [N%] | [↑↓→] | [e.g., Clean code] | [e.g., Feature depth] |
| Designer | [N/10] | [N%] | [↑↓→] | [e.g., Visual quality] | [e.g., Accessibility] |
| [Agent Name] | [N/10] | [N%] | [↑↓→] | [Noted strengths] | [Noted gaps] |

### Agent Quality Distribution

```
Agent        │ Min │ Max │ Avg │ Std Dev │ Consistency
─────────────┼─────┼─────┼─────┼─────────┼───────────
Eng Alpha    │ [N] │ [N] │ [N] │ [N]     │ [HIGH/MED/LOW]
Eng Beta     │ [N] │ [N] │ [N] │ [N]     │ [HIGH/MED/LOW]
Designer     │ [N] │ [N] │ [N] │ [N]     │ [HIGH/MED/LOW]
```

---

## Quality Alerts

### Threshold Definitions

| Level | Condition | Action |
|-------|----------|--------|
| **🟢 GREEN** | Overall QA ≥ 7.0, First-Pass ≥ 70% | No action needed |
| **🟡 YELLOW** | Overall QA 5.0–6.9 OR First-Pass 50–69% | PM review; identify root cause |
| **🔴 RED** | Overall QA < 5.0 OR First-Pass < 50% | Halt sprint; quality retro required |
| **⚠️ AGENT ALERT** | Any agent's avg score drops 1.5+ points below team average | Skill gap analysis; consider reassignment |

### Active Alerts

| Alert ID | Level | Sprint | Description | Status |
|----------|-------|--------|-------------|--------|
| [QA-001] | [🔴/🟡] | [SP-XXX] | [Description of quality concern] | [OPEN/INVESTIGATING/RESOLVED] |

---

## Correlation Analysis

### Quality vs. Sprint Scope

| Sprint ID | Features Planned | Overall QA | Observation |
|-----------|-----------------|-----------|-------------|
| [SP-001] | [N] | [N/10] | — |
| [SP-002] | [N] | [N/10] | — |
| [SP-003] | [N] | [N/10] | — |

**Correlation coefficient (scope → quality):** [r = N.NN]
**Finding:** [e.g., "Moderate negative correlation — larger sprints produce lower quality scores"]

### Quality vs. Budget

| Sprint ID | Budget Used | Overall QA | Observation |
|-----------|-----------|-----------|-------------|
| [SP-001] | [$N.NN] | [N/10] | — |
| [SP-002] | [$N.NN] | [N/10] | — |

**Correlation coefficient (budget → quality):** [r = N.NN]
**Finding:** [e.g., "No significant correlation — quality is not budget-dependent"]

### Quality vs. Time Pressure

| Sprint ID | Time Accuracy % | Overall QA | Observation |
|-----------|----------------|-----------|-------------|
| [SP-001] | [N%] | [N/10] | — |
| [SP-002] | [N%] | [N/10] | — |

**Correlation coefficient (time pressure → quality):** [r = N.NN]
**Finding:** [e.g., "Strong negative correlation — rushed sprints produce lower quality"]

### Key Insights

1. [Insight about scope-quality relationship]
2. [Insight about budget-quality relationship]
3. [Insight about time-quality relationship]
4. [Recommendations based on correlations]
