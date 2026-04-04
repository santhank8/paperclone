# Feedback Ingestion Protocol

> How Stakeholder processes user feedback into actionable backlog items.

**Owner:** Stakeholder
**Updated:** Every sprint
**Status:** Active

---

## Feedback Sources

| Source | Channel | Frequency | Priority Weight |
|--------|---------|-----------|----------------|
| Jeremy (Telegram) | Direct messages, voice notes | Real-time | 1.5× (founder signal) |
| GitHub Issues | Bug reports, feature requests | Continuous | 1.0× |
| Deployment Analytics | Error rates, usage patterns, perf metrics | Per-deploy | 1.0× |
| User Complaints | Support threads, frustrated feedback | As received | 1.2× (urgency bias) |
| Feature Requests | Structured proposals from any channel | As received | 1.0× |

### Source-Specific Handling

**Jeremy (Telegram):** Founder feedback gets priority weight 1.5× because it represents direct product vision. Stakeholder extracts actionable items from conversational messages — not every message is feedback; filter for explicit requests, complaints, or suggestions.

**GitHub Issues:** Already semi-structured. Stakeholder classifies and links to backlog within 1 sprint of creation.

**Deployment Analytics:** Scout or Delivery surfaces anomalies (error spike, slow endpoint, unused feature). Stakeholder translates into user-impact terms.

**User Complaints:** High-urgency by default. Stakeholder assesses whether the complaint represents a pattern or an edge case.

**Feature Requests:** May come from any source. Stakeholder deduplicates against existing backlog before creating new items.

---

## Ingestion Protocol

For **each feedback item**, Stakeholder performs these steps:

### Step 1: Classify Type

| Type | Definition | Example |
|------|-----------|---------|
| `BUG` | Something is broken or behaving incorrectly | "The deploy command fails on M1 Macs" |
| `FEATURE` | New capability that doesn't exist yet | "Add webhook support for task completion" |
| `IMPROVEMENT` | Enhancement to existing functionality | "Make the dashboard load faster" |
| `COMPLAINT` | Expression of dissatisfaction (may map to bug or improvement) | "This onboarding flow is confusing" |

### Step 2: Extract User Need

Translate the raw feedback into a user-need statement:

```
As a [persona/user type], I need [capability] so that [outcome].
```

Example: "The CLI is too slow" → "As a developer, I need CLI commands to complete in under 2 seconds so that my workflow isn't interrupted."

### Step 3: Assess Urgency

| Urgency | Criteria |
|---------|----------|
| **HIGH** | Blocks user workflows, causes data loss, security issue, or founder explicitly flags |
| **MED** | Degrades experience but workaround exists, or affects multiple users |
| **LOW** | Nice-to-have, cosmetic, or affects edge cases |

### Step 4: Link to Existing Backlog

Search existing backlog items for:
- Exact duplicates (same issue reported before)
- Related items (same feature area)
- Parent items (this feedback is a sub-case of a larger initiative)

If a link exists, annotate the existing item. If not, create a new backlog entry.

---

## Feedback Registry Template

| ID | Date | Source | Type | User Need | Urgency | Linked Issue | Status |
|----|------|--------|------|-----------|---------|-------------|--------|
| FB-001 | 2026-03-15 | Jeremy/Telegram | FEATURE | Webhook notifications on task completion | HIGH | SPRINT-042 | SCHEDULED |
| FB-002 | 2026-03-16 | GitHub Issue #23 | BUG | CLI crash on empty config file | HIGH | SPRINT-045 | ADDRESSED |
| FB-003 | 2026-03-17 | Analytics | IMPROVEMENT | Dashboard p95 latency > 3s | MED | — | TRIAGED |
| FB-004 | 2026-03-18 | Feature Request | FEATURE | Export sprint reports as PDF | LOW | — | NEW |

### Status Definitions

| Status | Meaning |
|--------|---------|
| `NEW` | Received but not yet reviewed by Stakeholder |
| `TRIAGED` | Classified, prioritized, but not yet scheduled for a sprint |
| `SCHEDULED` | Assigned to an upcoming sprint |
| `ADDRESSED` | Resolved — fix deployed or feature shipped |

---

## Deduplication Rules

1. **Exact match:** Same user, same issue, same channel → merge into single entry, note repeat count
2. **Semantic match:** Different users reporting the same root cause → link entries, increment reach count
3. **Partial overlap:** Related but distinct issues → keep separate entries, add cross-references
4. **Threshold rule:** If 3+ users report the same issue within 5 sprints, auto-escalate urgency by one level
5. **Staleness:** Feedback items in `NEW` status for more than 3 sprints get flagged for review

---

## Feedback Volume Tracking

Stakeholder maintains a per-sprint summary:

| Sprint | Total Items | BUG | FEATURE | IMPROVEMENT | COMPLAINT | Avg Urgency |
|--------|------------|-----|---------|-------------|-----------|-------------|
| S-010 | 8 | 3 | 2 | 2 | 1 | MED |
| S-011 | 5 | 1 | 3 | 1 | 0 | LOW |
| S-012 | 12 | 5 | 3 | 2 | 2 | HIGH |

### Volume Alerts

- **Spike:** If feedback volume doubles sprint-over-sprint, Stakeholder flags to Sprint Lead — something may be wrong.
- **Drought:** If feedback volume drops to zero for 2+ sprints, Stakeholder actively solicits feedback through Jeremy channel.
- **Type skew:** If >60% of feedback is `BUG` type, escalate to Critic for quality review.
