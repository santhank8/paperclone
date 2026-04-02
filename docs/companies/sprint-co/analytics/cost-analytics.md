# Cost Analytics

## Purpose

Track cost-per-feature, model usage distribution, and budget efficiency across sprints. Identify optimization opportunities to maximize output per dollar spent.

---

## Metrics

| Metric | Definition |
|--------|-----------|
| **Total Cost per Sprint** | Sum of all API/model costs for one sprint |
| **Cost per Feature** | `Total Sprint Cost / Features Shipped` |
| **Cost per Agent** | Total tokens/cost attributed to each agent |
| **Model Usage Distribution** | Percentage of total cost allocated to each model tier |
| **Efficiency Score** | `(Features Shipped × Avg QA Score) / Total Cost × 100` — value delivered per dollar |

---

## Sprint Cost Table

| Sprint ID | Total Budget | Total Spent | Cost/Feature | Haiku % | Sonnet % | Opus % | Efficiency Score |
|-----------|-------------|-------------|-------------|---------|---------|--------|-----------------|
| [SP-001] | [$N.NN] | [$N.NN] | [$N.NN] | [N%] | [N%] | [N%] | [N] |
| [SP-002] | [$N.NN] | [$N.NN] | [$N.NN] | [N%] | [N%] | [N%] | [N] |
| [SP-003] | [$N.NN] | [$N.NN] | [$N.NN] | [N%] | [N%] | [N%] | [N] |

### Cost Trends

| Metric | 3-Sprint Avg | Direction | Notes |
|--------|-------------|-----------|-------|
| Total Spent | [$N.NN] | [↑↓→] | — |
| Cost/Feature | [$N.NN] | [↑↓→] | [Lower is better] |
| Efficiency Score | [N] | [↑↓→] | [Higher is better] |
| Budget Utilization | [N%] | [↑↓→] | [Target: 85-100%] |

---

## Feature Cost Detail

| Feature Name | Agent | Model Used | Tokens (in/out) | Cost | QA Score | Value Assessment | ROI |
|-------------|-------|-----------|-----------------|------|----------|-----------------|-----|
| [Feature A] | [Engineer Alpha] | [sonnet] | [Nk / Nk] | [$N.NN] | [N/10] | [HIGH/MED/LOW] | [N] |
| [Feature B] | [Engineer Beta] | [opus] | [Nk / Nk] | [$N.NN] | [N/10] | [HIGH/MED/LOW] | [N] |
| [Feature C] | [Designer] | [haiku] | [Nk / Nk] | [$N.NN] | [N/10] | [HIGH/MED/LOW] | [N] |

### Value Assessment Criteria

- **HIGH** — Core product feature, directly improves user experience or revenue
- **MEDIUM** — Supporting feature, improves product but not critical
- **LOW** — Nice-to-have, polish, or exploratory work

### ROI Calculation

```
ROI = (QA Score / 10) × Value Multiplier / Cost

Value Multiplier: HIGH = 3.0, MEDIUM = 2.0, LOW = 1.0
```

---

## Cost Optimization Opportunities

### Over-Modeled Tasks

Tasks where an expensive model was used but a cheaper model would likely suffice.

| Task Type | Current Model | Recommended Model | Est. Savings | Risk |
|-----------|--------------|-------------------|-------------|------|
| [Boilerplate code generation] | [sonnet] | [haiku] | [$N.NN/sprint] | LOW |
| [Documentation writing] | [sonnet] | [haiku] | [$N.NN/sprint] | LOW |
| [Simple bug fixes] | [opus] | [sonnet] | [$N.NN/sprint] | MEDIUM |
| [Test generation] | [sonnet] | [haiku] | [$N.NN/sprint] | LOW |

### Under-Modeled Tasks

Tasks where a cheaper model is used but quality suggests upgrading.

| Task Type | Current Model | Recommended Model | Add'l Cost | Quality Impact |
|-----------|--------------|-------------------|-----------|---------------|
| [Architecture decisions] | [sonnet] | [opus] | [+$N.NN/sprint] | HIGH improvement expected |
| [Complex debugging] | [haiku] | [sonnet] | [+$N.NN/sprint] | MEDIUM improvement expected |

### Token Waste Patterns

| Pattern | Description | Estimated Waste | Mitigation |
|---------|-----------|----------------|-----------|
| [Excessive context] | [Agent sends full file when snippet suffices] | [$N.NN/sprint] | [Implement context windowing] |
| [Retry loops] | [Agent retries same prompt on failure] | [$N.NN/sprint] | [Add failure analysis before retry] |
| [Verbose output] | [Agent generates unnecessary explanations] | [$N.NN/sprint] | [Tune system prompts for conciseness] |

---

## Model Efficiency Analysis

### Cost per Model Tier

| Model | Cost/1K Input Tokens | Cost/1K Output Tokens | Avg Tokens/Task | Avg Cost/Task |
|-------|---------------------|----------------------|----------------|---------------|
| Haiku | [$0.XXX] | [$0.XXX] | [Nk] | [$N.NN] |
| Sonnet | [$0.XXX] | [$0.XXX] | [Nk] | [$N.NN] |
| Opus | [$0.XXX] | [$0.XXX] | [Nk] | [$N.NN] |

### Model-Quality Relationship

| Model | Avg QA Score | Avg Cost | Quality per Dollar |
|-------|-------------|----------|-------------------|
| Haiku | [N/10] | [$N.NN] | [N] |
| Sonnet | [N/10] | [$N.NN] | [N] |
| Opus | [N/10] | [$N.NN] | [N] |

### Recommended Model Allocation

Based on historical data, the optimal model distribution for cost-quality balance:

| Task Category | Recommended Model | Rationale |
|--------------|-------------------|-----------|
| Planning & scoping | Sonnet | Needs reasoning but not maximum capability |
| Complex implementation | Opus | Quality-critical, justifies premium cost |
| Simple implementation | Sonnet | Good balance of quality and cost |
| Boilerplate & tests | Haiku | Repetitive tasks, minimal reasoning needed |
| QA & review | Sonnet | Needs judgment but benefits from consistency |
| Documentation | Haiku | Structured output, lower reasoning demand |

---

## Monthly Cost Projection

### Current Month

| Week | Sprints Run | Spend | Cumulative | Projected Monthly |
|------|-----------|-------|------------|------------------|
| Week 1 | [N] | [$N.NN] | [$N.NN] | [$N.NN] |
| Week 2 | [N] | [$N.NN] | [$N.NN] | [$N.NN] |
| Week 3 | [N] | [$N.NN] | [$N.NN] | [$N.NN] |
| Week 4 | [N] | [$N.NN] | [$N.NN] | [$N.NN] |

### Projection Model

```
Monthly Projection = (Cumulative Spend / Days Elapsed) × Days in Month

Budget Status:
  🟢 ON TRACK    — Projected ≤ 100% of monthly budget
  🟡 CAUTION     — Projected 100-115% of monthly budget
  🔴 OVER BUDGET — Projected > 115% of monthly budget
```

### Budget Guardrails

| Guardrail | Threshold | Action |
|-----------|----------|--------|
| Sprint budget warning | 80% of sprint budget consumed | Notify PM; assess remaining work |
| Sprint budget hard stop | 100% of sprint budget consumed | Pause non-critical agents |
| Monthly budget warning | 85% of monthly budget consumed | Reduce next sprint scope |
| Monthly budget hard stop | 100% of monthly budget consumed | Suspend sprints until next period |
