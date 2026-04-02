# Cross-Sprint Velocity Tracker

## Purpose

Track Sprint Co's delivery velocity across sprints to identify trends, predict future capacity, and inform sprint planning decisions. Velocity is the primary indicator of how much work the team can reliably commit to.

---

## Metrics Tracked

| Metric | Definition |
|--------|-----------|
| **Features Planned** | Number of features in the sprint backlog at sprint start |
| **Features Shipped** | Number of features that passed QA and were marked complete |
| **Features Dropped** | Features removed mid-sprint or deferred to next sprint |
| **Ship Rate** | `Features Shipped / Features Planned × 100` |
| **Time Planned** | Estimated total time budget for the sprint |
| **Time Actual** | Actual time consumed by all agents |
| **Time Accuracy** | `min(Time Planned, Time Actual) / max(Time Planned, Time Actual) × 100` |
| **Deploy Success Rate** | `Successful Deployments / Total Deploy Attempts × 100` |

---

## Sprint-by-Sprint Velocity Table

| Sprint ID | Date | Features Planned | Features Shipped | Features Dropped | Ship Rate % | Time Planned | Time Actual | Accuracy % | Deploy Success |
|-----------|------|-----------------|-----------------|-----------------|-------------|-------------|-------------|------------|----------------|
| [SP-001] | [YYYY-MM-DD] | [N] | [N] | [N] | [N%] | [Nh] | [Nh] | [N%] | [N%] |
| [SP-002] | [YYYY-MM-DD] | [N] | [N] | [N] | [N%] | [Nh] | [Nh] | [N%] | [N%] |
| [SP-003] | [YYYY-MM-DD] | [N] | [N] | [N] | [N%] | [Nh] | [Nh] | [N%] | [N%] |

---

## Trend Analysis

### Rolling Averages (Last 3 Sprints)

| Metric | 3-Sprint Avg | Direction | Notes |
|--------|-------------|-----------|-------|
| Ship Rate | [N%] | [↑↓→] | [Improving / Declining / Stable] |
| Time Accuracy | [N%] | [↑↓→] | [Improving / Declining / Stable] |
| Features Shipped | [N] | [↑↓→] | [Improving / Declining / Stable] |
| Deploy Success | [N%] | [↑↓→] | [Improving / Declining / Stable] |
| Features Dropped | [N] | [↑↓→] | [Lower is better] |

### Direction Indicators

- **↑** — Metric improving over last 3 sprints (positive trend)
- **↓** — Metric declining over last 3 sprints (needs attention)
- **→** — Metric stable (within ±5% variance)

### Sprint-over-Sprint Delta

| Sprint Pair | Ship Rate Δ | Accuracy Δ | Notes |
|-------------|-------------|------------|-------|
| [SP-001 → SP-002] | [+N% / -N%] | [+N% / -N%] | [Context] |
| [SP-002 → SP-003] | [+N% / -N%] | [+N% / -N%] | [Context] |

---

## Velocity Predictions

### Methodology

Predictions use a **weighted moving average** of the last N sprints, with more recent sprints weighted higher:

- Last sprint: **50% weight**
- Sprint before: **30% weight**
- Two sprints ago: **20% weight**

### Next Sprint Capacity Estimate

| Metric | Predicted Value | Confidence | Basis |
|--------|----------------|------------|-------|
| Features Shippable | [N] | [HIGH/MEDIUM/LOW] | Last [N] sprints avg |
| Expected Ship Rate | [N%] | [HIGH/MEDIUM/LOW] | Weighted trend |
| Time Budget Needed | [Nh] | [HIGH/MEDIUM/LOW] | Avg time per feature × predicted count |
| Recommended Scope | [N features] | — | Conservative estimate (90% confidence) |

### Confidence Levels

- **HIGH** — 5+ sprints of data, low variance (σ < 10%)
- **MEDIUM** — 3-4 sprints of data, moderate variance (σ 10-25%)
- **LOW** — <3 sprints of data or high variance (σ > 25%)

---

## Guidance

### What Do Velocity Changes Mean?

| Signal | Interpretation | Recommended Action |
|--------|---------------|-------------------|
| Ship Rate declining over 2+ sprints | Team is overcommitting or complexity is rising | Reduce next sprint scope by 20% |
| Ship Rate improving | Team is hitting its stride or scope is too easy | Cautiously increase scope by 1 feature |
| Time Accuracy < 70% | Estimation is unreliable | Hold estimation retrospective; compare estimates vs actuals per feature |
| Features Dropped > 30% of planned | Sprint scope is consistently too ambitious | Cap features at last sprint's shipped count |
| Deploy Success < 90% | Infrastructure or process issues | Allocate time for deployment pipeline improvements |

### When to Adjust Sprint Scope

- **Increase scope** when Ship Rate > 90% for 3 consecutive sprints AND Time Accuracy > 85%
- **Decrease scope** when Ship Rate < 70% for 2 consecutive sprints OR Features Dropped > 2 per sprint
- **Hold scope** when velocity is stable and team is delivering consistently
- **Schedule a maintenance sprint** when Deploy Success rate drops below 80% or tech debt is accumulating

### Estimation Calibration

After each sprint, update estimation baselines:

```
Calibration Factor = Avg(Time Actual / Time Planned) over last 3 sprints

Next Sprint Estimate = Raw Estimate × Calibration Factor
```

If the calibration factor exceeds **1.3** (consistently underestimating by 30%+), flag for process review.
