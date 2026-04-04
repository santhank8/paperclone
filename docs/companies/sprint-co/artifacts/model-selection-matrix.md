# Model Selection Matrix

> **Maintained by:** Treasurer Agent
> **Last Updated:** [YYYY-MM-DD]
> **Applies to:** All Sprint Co agents

---

## Decision Matrix

| Task Type | Recommended Model | Rationale | Est. Tokens | Cost Tier | When to Escalate |
|-----------|------------------|-----------|-------------|-----------|-----------------|
| Sprint planning | Haiku | Structured output, low complexity; follows templates | ~2,000 | LOW | Plan involves novel architecture or ambiguous requirements |
| Architecture decisions | Sonnet | Tradeoff reasoning between competing designs | ~4,000 | MED | Decision has irreversible consequences or touches >3 modules |
| Boilerplate code | Haiku | Template filling, repetitive patterns | ~1,500 | LOW | Code requires context-dependent customization |
| Complex algorithms | Sonnet | Deep reasoning, multi-step logic | ~6,000 | MED | Algorithm correctness is safety-critical or perf-sensitive |
| UI/design judgment | Opus | Aesthetic evaluation, subjective quality assessment | ~3,000 | HIGH | N/A — already at highest tier |
| QA evaluation | Haiku | Rubric-based scoring, checklist validation | ~1,500 | LOW | Feature fails on >3 rubric items and needs root cause analysis |
| Dispute resolution | Sonnet | Nuanced reasoning, weighing competing perspectives | ~3,500 | MED | Dispute involves governance policy interpretation |
| Retrospectives | Haiku | Structured reporting, pattern matching against templates | ~2,500 | LOW | Sprint had anomalous outcomes requiring deep analysis |
| Budget analysis | Haiku | Numerical analysis, threshold comparison | ~1,500 | LOW | Budget anomaly detected; root cause unclear |
| Code review | Sonnet | Contextual understanding of code quality and patterns | ~5,000 | MED | Security-sensitive code or public API surface |

---

## Cost Comparison

> Prices per 1K tokens (input / output). Update when pricing changes.

| Model | Input (per 1K) | Output (per 1K) | Relative Cost | Best For |
|-------|----------------|-----------------|---------------|----------|
| Haiku | $0.00025 | $0.00125 | 1x (baseline) | High-volume structured tasks |
| Sonnet | $0.003 | $0.015 | ~12x Haiku | Reasoning-heavy decisions |
| Opus | $0.015 | $0.075 | ~60x Haiku | Judgment calls, subjective evaluation |

---

## Monthly Budget Projection

> Fill in planned sprint count and estimated task distribution to project costs.

| Task Type | Sprints/Month | Calls/Sprint | Tokens/Call | Model | Monthly Tokens | Monthly Cost |
|-----------|--------------|-------------|-------------|-------|---------------|-------------|
| Sprint planning | [N] | [N] | ~2,000 | Haiku | [N] | $[N] |
| Architecture | [N] | [N] | ~4,000 | Sonnet | [N] | $[N] |
| Development | [N] | [N] | ~3,000 | Haiku/Sonnet | [N] | $[N] |
| QA evaluation | [N] | [N] | ~1,500 | Haiku | [N] | $[N] |
| Dispute resolution | [N] | [N] | ~3,500 | Sonnet | [N] | $[N] |
| Retrospectives | [N] | [N] | ~2,500 | Haiku | [N] | $[N] |
| Budget review | [N] | [N] | ~1,500 | Haiku | [N] | $[N] |
| **Projected Total** | — | — | — | — | **[N]** | **$[N]** |

---

## Budget Threshold Reference

| Utilization | Status | Action |
|-------------|--------|--------|
| 0–60% | ✅ NORMAL | No action required. Proceed as planned. |
| 60–80% | ⚠️ WARN | Treasurer reviews remaining scope. Consider downgrading non-critical tasks to cheaper models. |
| 80–95% | 🔶 ESCALATE | Treasurer alerts PM. Remaining tasks restricted to Haiku unless governance-critical. Scope reduction may be necessary. |
| 95%+ | 🔴 HARD ALERT | Sprint pause. PM and Treasurer evaluate whether to allocate emergency budget or descope remaining work. No Opus/Sonnet calls without explicit approval. |

---

## Escalation Protocol

When a task requires escalation to a more expensive model:

1. Agent requests escalation with justification
2. Treasurer evaluates budget headroom
3. If utilization < 80%: auto-approve, log the escalation
4. If utilization 80–95%: Treasurer decides, PM notified
5. If utilization > 95%: PM must approve

---

*Review and update this matrix after each sprint based on actual usage patterns from the budget review.*
