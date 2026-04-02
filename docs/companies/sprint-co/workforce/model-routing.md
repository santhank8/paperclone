# Model-Per-Task Routing Protocol

> Phase 6 — Adaptive Workforce & Dynamic Teams

Assigns the right model tier to each task based on complexity scoring, reducing costs without sacrificing quality.

---

## Routing Decision Tree

```
Task arrives
  │
  ├─ Is there an override rule? ──── Yes ──→ Apply override (see Override Rules)
  │
  No
  │
  ├─ Score task complexity (4 factors, each 1–3)
  │
  ├─ Sum score
  │    │
  │    ├─ 4–5   ──→ Haiku
  │    ├─ 6–8   ──→ Haiku (with escalation trigger)
  │    ├─ 9–10  ──→ Sonnet
  │    └─ 11–12 ──→ Opus
  │
  └─ Execute task with assigned model
       │
       ├─ Success ──→ Log result, update routing stats
       └─ Failure ──→ Escalate to next model tier, flag for threshold review
```

---

## Task Complexity Scoring

Each task is scored on 4 factors, rated 1–3:

### Factor 1: Reasoning Depth

| Score | Description | Examples |
|:-----:|-------------|----------|
| 1 | Mechanical / template-based | Boilerplate generation, simple CRUD, changelog formatting |
| 2 | Moderate logic / conditional reasoning | Bug fixes with known root cause, standard API endpoints, test writing |
| 3 | Deep multi-step reasoning | Architecture decisions, complex debugging, cross-system integration |

### Factor 2: Creative Judgment

| Score | Description | Examples |
|:-----:|-------------|----------|
| 1 | No judgment needed — clear spec | Rename variables, update config values, fix typos |
| 2 | Some judgment within constraints | Choose between 2–3 implementation approaches, write user-facing copy |
| 3 | Significant creative/strategic judgment | Design new API surface, propose architecture, write governance rules |

### Factor 3: Output Length

| Score | Description | Examples |
|:-----:|-------------|----------|
| 1 | Short (<100 lines) | Single function, small config change, brief comment |
| 2 | Medium (100–500 lines) | Feature module, test suite, documentation page |
| 3 | Long (>500 lines) | Multi-file feature, comprehensive spec, full system design |

### Factor 4: Domain Specificity

| Score | Description | Examples |
|:-----:|-------------|----------|
| 1 | General programming | Standard library usage, common patterns |
| 2 | Project-specific knowledge | Paperclip schema conventions, Sprint Co team structure |
| 3 | Specialized domain expertise | Security audit, performance optimization, compliance review |

### Scoring Worksheet

```
Task: ___________________________________

Reasoning Depth:     [ ] 1  [ ] 2  [ ] 3
Creative Judgment:   [ ] 1  [ ] 2  [ ] 3
Output Length:       [ ] 1  [ ] 2  [ ] 3
Domain Specificity:  [ ] 1  [ ] 2  [ ] 3

Total Score: _____ / 12
```

---

## Model Assignment Rules

| Total Score | Model | Rationale |
|:-----------:|-------|-----------|
| **4–5** | Haiku | Simple, structured tasks with clear specs. Maximum cost efficiency. |
| **6–8** | Haiku + Escalation | Start with Haiku. If output fails quality check or agent self-reports low confidence, auto-escalate to Sonnet. |
| **9–10** | Sonnet | Moderate complexity requiring reliable reasoning and judgment. |
| **11–12** | Opus | High complexity demanding deep reasoning, creativity, or architectural vision. |

### Override Rules

These overrides apply regardless of complexity score:

| Condition | Forced Model | Reason |
|-----------|:------------:|--------|
| Agent is Judge | Sonnet (min) | Governance decisions require consistent, thorough reasoning |
| Agent is Evaluator scoring quality | Sonnet (min) | Evaluation accuracy is critical for system integrity |
| Task type is architecture/design | Opus | Creative judgment and long-horizon thinking required |
| Task type is constitution amendment | Opus | Highest-stakes governance decisions |
| Task is security-sensitive | Sonnet (min) | Security reasoning must not be compromised by cost |
| Task failed on current model | Next tier up | Automatic escalation after failure |
| Budget remaining < 20% | Haiku (max) | Preserve budget for remaining sprint work |

### Escalation Trigger (Score 6–8)

When Haiku handles a score 6–8 task, monitor for:

```
Escalation triggers:
  - Agent explicitly reports low confidence
  - Output fails QA Lead review (quality score < 3/5)
  - Task requires >3 revision cycles
  - Agent produces output that contradicts established patterns

On trigger:
  1. Re-run task with Sonnet
  2. Log escalation event for routing threshold analysis
  3. If >30% of score-range tasks escalate: adjust threshold downward
```

---

## Cost Comparison Table

| Model | Input (per 1M tokens) | Output (per 1M tokens) | Relative Cost | Typical Task Cost |
|-------|:---------------------:|:----------------------:|:-------------:|:-----------------:|
| Haiku | $0.25 | $1.25 | 1× (baseline) | $0.01–$0.05 |
| Sonnet | $3.00 | $15.00 | ~12× | $0.10–$0.50 |
| Opus | $15.00 | $75.00 | ~60× | $0.50–$3.00 |

### Cost Per Task Type (Estimated)

| Task Type | Without Routing (all Sonnet) | With Routing | Savings |
|-----------|:----------------------------:|:------------:|:-------:|
| Boilerplate / config | $0.15 | $0.02 (Haiku) | 87% |
| Standard feature | $0.30 | $0.30 (Sonnet) | 0% |
| Test writing | $0.20 | $0.03 (Haiku) | 85% |
| Documentation | $0.15 | $0.02 (Haiku) | 87% |
| Architecture design | $0.40 | $1.50 (Opus) | –275%* |
| Bug fix (simple) | $0.15 | $0.02 (Haiku) | 87% |
| Bug fix (complex) | $0.35 | $0.35 (Sonnet) | 0% |
| Code review | $0.20 | $0.20 (Sonnet) | 0% |

*Architecture tasks cost more per-task with Opus but produce higher quality, reducing rework costs.

---

## Expected Savings

### Sprint-Level Projection

```
Typical sprint task distribution:
  30% simple/structured tasks    → Haiku     (was Sonnet)
  40% moderate tasks             → Haiku+esc (70% stay Haiku, 30% escalate)
  20% complex tasks              → Sonnet    (unchanged)
  10% high-complexity tasks      → Opus      (upgraded from Sonnet)

Estimated per-sprint savings:
  Without routing: ~$15.00 (all Sonnet)
  With routing:    ~$8.50

  Savings: ~43% reduction in model costs
```

### Break-Even Analysis

Routing adds overhead (complexity scoring, escalation retries). The system pays for itself when:
- Sprint has ≥10 tasks (enough volume for Haiku savings to offset Opus upgrades)
- At least 25% of tasks score ≤ 8 (Haiku-eligible)

---

## Monitoring & Threshold Adjustment

### Metrics to Track

| Metric | Target | Action if Missed |
|--------|--------|-----------------|
| Haiku task success rate | ≥ 80% | Lower Haiku ceiling (e.g., 4–5 only) |
| Escalation rate (score 6–8) | ≤ 30% | Narrow Haiku+esc range to 6–7 |
| Opus task quality score | ≥ 4.5/5 | Confirm Opus is being used for right tasks |
| Overall sprint cost vs. baseline | ≤ 70% of all-Sonnet | Routing is delivering value |
| Rework rate by model tier | Track per tier | Identify if cheaper models cause rework |

### Threshold Adjustment Process

```
Every 5 sprints, Historian analyzes:
  1. Escalation frequency per score range
  2. Quality scores per model tier
  3. Cost savings achieved vs. projected

Adjustments:
  - If Haiku failure rate > 25% for score 6–8:
      Move score 6 tasks to "Sonnet" tier
  - If Sonnet handles score 9 tasks with 95%+ success:
      Consider allowing Haiku+esc for score 9
  - If Opus tasks show no quality improvement over Sonnet:
      Downgrade score 11 to Sonnet, keep 12 as Opus
```
