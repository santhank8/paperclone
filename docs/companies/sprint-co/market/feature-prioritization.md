# Feature Prioritization Framework

> Impact × Effort × Alignment engine for deciding what Sprint Co builds next.

**Owner:** Stakeholder (scoring) + Sprint Lead (effort estimation)
**Updated:** Every sprint planning
**Status:** Active

---

## Prioritization Framework

Sprint Co uses a **RICE+A** scoring model — an adaptation of RICE (Reach, Impact, Confidence, Effort) extended with an Alignment dimension that weights mission-fit.

```
Priority Score = (Reach × Impact × Confidence × Alignment) ÷ Effort
```

Higher scores indicate higher priority. Features are ranked by score and pulled into sprints top-down until the sprint budget is exhausted.

---

## Scoring Guide

### Reach (1–5): How many users does this affect?

| Score | Definition |
|-------|-----------|
| 1 | Single user or edge case |
| 2 | Small subset of users (<10%) |
| 3 | Moderate user segment (10–40%) |
| 4 | Most users (40–80%) |
| 5 | All or nearly all users (>80%) |

### Impact (1–5): How much does this improve their experience?

| Score | Definition |
|-------|-----------|
| 1 | Minimal — barely noticeable improvement |
| 2 | Low — slight convenience gain |
| 3 | Medium — meaningful workflow improvement |
| 4 | High — significant pain point resolved |
| 5 | Critical — unblocks entirely new capability or fixes showstopper |

### Confidence (1–3): How sure are we about reach and impact?

| Score | Definition |
|-------|-----------|
| 1 | Gut feeling — no data, just intuition |
| 2 | Some evidence — a few user reports or partial analytics |
| 3 | High confidence — multiple data points, clear user demand |

### Effort (1–5T): T-shirt sizes mapped to sprint hours

| Score | T-Shirt | Sprint Hours | Examples |
|-------|---------|-------------|---------|
| 1 | XS | 30 min | Config change, copy fix, flag toggle |
| 2 | S | 1 hr | Small bug fix, minor UI tweak |
| 3 | M | 2 hr | New endpoint, moderate feature, refactor |
| 4 | L | 4 hr | Significant feature, multi-file change |
| 5 | XL | 8 hr+ | Major feature, architecture change, new subsystem |

### Alignment (1–3): How well does this serve the company mission?

Sprint Co's mission: *Demonstrate that autonomous AI agents can ship real software through structured collaboration.*

| Score | Definition |
|-------|-----------|
| 1 | Tangential — useful but doesn't advance the core mission |
| 2 | Supporting — strengthens an existing mission-critical capability |
| 3 | Core — directly advances the primary mission |

---

## Priority Score Formula

```
Score = (Reach × Impact × Confidence × Alignment) ÷ Effort
```

**Score range:** 0.2 (lowest) to 67.5 (highest)

**Example calculations:**

| Feature | R | I | C | E | A | Score |
|---------|---|---|---|---|---|-------|
| Fix CLI crash on empty config | 4 | 5 | 3 | 2 | 2 | 60 ÷ 2 = **30.0** |
| Add PDF export for reports | 2 | 2 | 1 | 4 | 1 | 4 ÷ 4 = **1.0** |
| Dashboard load time optimization | 5 | 4 | 3 | 3 | 2 | 120 ÷ 3 = **40.0** |
| Webhook notifications | 3 | 4 | 2 | 3 | 3 | 72 ÷ 3 = **24.0** |

---

## Priority Matrix Template

| # | Feature | Reach | Impact | Confidence | Effort | Alignment | Score | Rank |
|---|---------|-------|--------|------------|--------|-----------|-------|------|
| 1 | Dashboard perf optimization | 5 | 4 | 3 | 3 | 2 | 40.0 | 1 |
| 2 | Fix CLI crash on empty config | 4 | 5 | 3 | 2 | 2 | 30.0 | 2 |
| 3 | Webhook notifications | 3 | 4 | 2 | 3 | 3 | 24.0 | 3 |
| 4 | Better error messages | 4 | 3 | 2 | 2 | 2 | 24.0 | 4 |
| 5 | PDF export for reports | 2 | 2 | 1 | 4 | 1 | 1.0 | 5 |

---

## Sprint Backlog Generation

### Process

1. **Score all triaged feedback items** using the RICE+A formula
2. **Rank by score** descending
3. **Pull features top-down** until the sprint's hour budget is filled
4. **Respect constraints:**
   - No single feature may consume more than 50% of the sprint budget unless Board-approved
   - At least one `BUG` fix must be included per sprint if any `BUG` items exist
   - HIGH-urgency items get an automatic 1.5× score multiplier
5. **Output:** Sprint backlog with estimated hours summing to ≤ budget

### Example Sprint Backlog (4-hour budget)

| Feature | Effort | Cumulative | In Sprint? |
|---------|--------|-----------|------------|
| Dashboard perf optimization | 2 hr (M) | 2 hr | Yes |
| Fix CLI crash on empty config | 1 hr (S) | 3 hr | Yes |
| Webhook notifications | 2 hr (M) | 5 hr | No — exceeds budget |

**Sprint capacity used:** 3 hr / 4 hr (75%)
**Remaining budget:** 1 hr — pull next highest-scoring XS/S item.

---

## Stakeholder Review

Before the sprint begins, Stakeholder performs a final validation:

1. **Sanity check:** Does this sprint backlog feel right from a customer perspective?
2. **Persona test:** Run the [Persona Evaluation Protocol](customer-personas.md) on the top 3 items
3. **Balance check:** Are we serving multiple personas or just one?
4. **Urgency override:** Can Stakeholder override scores for time-sensitive items? **Yes**, with documented justification
5. **Sign-off:** Stakeholder marks the sprint backlog as approved

### Override Rules

- Stakeholder can bump any item by up to +10 score points with written justification
- Stakeholder can block any item with written justification (e.g., "users explicitly said they don't want this")
- Overrides are logged in the sprint record for retrospective review

---

## Feedback to Requestor

After prioritization, Stakeholder communicates outcomes:

### Prioritized Items
```
Feature: [name]
Status: Scheduled for Sprint [N]
Estimated delivery: [date]
Why: [brief justification referencing score]
```

### Deferred Items
```
Feature: [name]
Status: Backlog — not scheduled yet
Reason: [scored below sprint cutoff / blocked by dependency / needs more research]
What would change this: [higher user demand / reduced effort / strategic shift]
```

### Rejected Items
```
Feature: [name]
Status: Won't do
Reason: [doesn't align with mission / infeasible / superseded by alternative]
Alternative: [if applicable]
```

Stakeholder publishes the prioritization summary to the sprint record so all agents have visibility.
