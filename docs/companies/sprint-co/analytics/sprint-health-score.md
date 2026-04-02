# Sprint Health Score

## What Is Sprint Health?

Sprint Health is a **single composite number from 0 to 100** that summarizes the overall performance of a sprint across multiple dimensions. It provides a quick, at-a-glance indicator for the Board to assess whether Sprint Co is operating well or needs intervention.

| Range | Rating | Meaning |
|-------|--------|---------|
| **80–100** | 🟢 Excellent | Sprint is performing at or above expectations |
| **60–79** | 🟡 Healthy | Sprint is on track with minor concerns |
| **40–59** | 🟠 Concern | Significant issues detected; Board review recommended |
| **0–39** | 🔴 Crisis | Sprint failed on multiple dimensions; immediate intervention required |

---

## Dimensions and Weights

| Dimension | Weight | Source | Description |
|-----------|--------|--------|-------------|
| **Quality** | 30% | Quality Dashboard | Avg QA score normalized to 0–100 |
| **Velocity** | 20% | Velocity Tracker | Ship rate: features shipped / features planned × 100 |
| **Efficiency** | 20% | Cost Analytics | Budget adherence score |
| **Scope Accuracy** | 15% | Sprint Records | % of planned features shipped without scope changes |
| **Process Compliance** | 15% | Enforcer Reports | Enforcer compliance score |

---

## Formula

### Step 1: Normalize Each Dimension to 0–100

**Quality Score:**
```
quality_normalized = (avg_qa_score / 10) × 100
```

**Velocity Score:**
```
velocity_normalized = min(100, (features_shipped / features_planned) × 100)
```

**Efficiency Score:**
```
budget_ratio = total_spent / total_budget

If budget_ratio ≤ 1.0:
  efficiency_normalized = 100
If budget_ratio > 1.0 and ≤ 1.2:
  efficiency_normalized = 100 - ((budget_ratio - 1.0) × 250)  # Linear penalty
If budget_ratio > 1.2:
  efficiency_normalized = max(0, 50 - ((budget_ratio - 1.2) × 250))
```

**Scope Accuracy Score:**
```
scope_normalized = (features_shipped_unchanged / features_planned) × 100
```

**Process Compliance Score:**
```
process_normalized = enforcer_compliance_percentage  # Already 0–100
```

### Step 2: Calculate Weighted Health Score

```
health = (quality_normalized × 0.30)
       + (velocity_normalized × 0.20)
       + (efficiency_normalized × 0.20)
       + (scope_normalized × 0.15)
       + (process_normalized × 0.15)
```

### Worked Example

Given:
- Avg QA Score: 7.5/10
- Features Planned: 5, Shipped: 4
- Budget: $5.00, Spent: $4.50
- Features shipped unchanged: 3 of 5 planned
- Enforcer compliance: 90%

```
quality_normalized      = (7.5 / 10) × 100       = 75
velocity_normalized     = (4 / 5) × 100           = 80
efficiency_normalized   = 100 (spent ≤ budget)     = 100
scope_normalized        = (3 / 5) × 100           = 60
process_normalized      = 90                       = 90

health = (75 × 0.30) + (80 × 0.20) + (100 × 0.20) + (60 × 0.15) + (90 × 0.15)
       = 22.5 + 16.0 + 20.0 + 9.0 + 13.5
       = 81.0
```

**Result: 81 — 🟢 Excellent**

### Another Example (Struggling Sprint)

Given:
- Avg QA Score: 5.0/10
- Features Planned: 6, Shipped: 3
- Budget: $5.00, Spent: $5.75
- Features shipped unchanged: 2 of 6 planned
- Enforcer compliance: 60%

```
quality_normalized      = (5.0 / 10) × 100               = 50
velocity_normalized     = (3 / 6) × 100                   = 50
efficiency_normalized   = 100 - ((1.15 - 1.0) × 250)      = 62.5
scope_normalized        = (2 / 6) × 100                   = 33.3
process_normalized      = 60                               = 60

health = (50 × 0.30) + (50 × 0.20) + (62.5 × 0.20) + (33.3 × 0.15) + (60 × 0.15)
       = 15.0 + 10.0 + 12.5 + 5.0 + 9.0
       = 51.5
```

**Result: 51.5 — 🟠 Concern**

---

## Sprint Health History Table

| Sprint ID | Quality (30%) | Velocity (20%) | Efficiency (20%) | Scope (15%) | Process (15%) | Overall Health | Rating |
|-----------|:------------:|:--------------:|:----------------:|:-----------:|:-------------:|:--------------:|--------|
| [SP-001] | [N] | [N] | [N] | [N] | [N] | [N] | [🟢🟡🟠🔴] |
| [SP-002] | [N] | [N] | [N] | [N] | [N] | [N] | [🟢🟡🟠🔴] |
| [SP-003] | [N] | [N] | [N] | [N] | [N] | [N] | [🟢🟡🟠🔴] |

---

## Health Alerts

### Alert Thresholds

| Condition | Alert Level | Action Required |
|----------|-------------|----------------|
| Overall Health ≥ 80 | 🟢 None | Continue as planned |
| Overall Health 60–79 | 🟡 Advisory | PM reviews; minor adjustments |
| Overall Health 40–59 | 🟠 Concern | Board review; root cause analysis; scope reduction next sprint |
| Overall Health < 40 | 🔴 Crisis | Halt sprint; full retrospective; do not start next sprint without Board approval |

### Dimension-Specific Alerts

| Dimension | Warning Threshold | Critical Threshold |
|-----------|------------------|-------------------|
| Quality | < 60 | < 40 |
| Velocity | < 50 | < 30 |
| Efficiency | < 60 | < 40 |
| Scope Accuracy | < 40 | < 20 |
| Process Compliance | < 70 | < 50 |

### Active Alerts

| Alert ID | Sprint | Dimension | Score | Level | Description | Resolution |
|----------|--------|-----------|-------|-------|-------------|-----------|
| [HA-001] | [SP-XXX] | [Dimension] | [N] | [🟡🟠🔴] | [Description] | [OPEN/RESOLVED] |

---

## Trend Analysis

### Health Score Over Time

| Sprint Pair | Health Δ | Direction | Key Driver |
|-------------|---------|-----------|-----------|
| [SP-001 → SP-002] | [+N / -N] | [↑↓→] | [Which dimension changed most] |
| [SP-002 → SP-003] | [+N / -N] | [↑↓→] | [Which dimension changed most] |

### Rolling 3-Sprint Average

| Window | Avg Health | Direction | Outlook |
|--------|-----------|-----------|---------|
| [Last 3 sprints] | [N] | [↑↓→] | [Positive / Neutral / Needs attention] |

### Predictive Signals

- If health has declined for **2 consecutive sprints** → flag as **Declining Trajectory**
- If health has improved for **3 consecutive sprints** → flag as **Sustained Improvement**
- If health variance > 20 points between consecutive sprints → flag as **Unstable Performance**
