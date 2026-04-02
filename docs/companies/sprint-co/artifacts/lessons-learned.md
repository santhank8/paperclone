# Lessons Learned Knowledge Base

> **Maintained by:** Historian Agent
> **Last Updated:** [YYYY-MM-DD]
> **Total Lessons:** [N]

---

## Architecture Lessons

### ARCH-001
- **Sprint:** SPRINT-001
- **Context:** The Architect proposed a monolithic module structure for the initial MVP. Mid-sprint, a feature request required splitting the module, causing a 4-hour rework delay.
- **Lesson:** Default to modular boundaries from the start, even for MVPs. The cost of splitting later exceeds the cost of initial separation.
- **Confidence:** MEDIUM (validated 1 time)
- **Times Referenced:** 0

### ARCH-002
- **Sprint:** [SPRINT-ID]
- **Context:** [What happened]
- **Lesson:** [The insight]
- **Confidence:** [HIGH / MEDIUM / LOW]
- **Times Referenced:** [N]

---

## QA & Quality Lessons

### QA-001
- **Sprint:** SPRINT-001
- **Context:** QA agent scored a feature 6/10 due to missing error handling. The Developer argued it was out of scope. Diplomat mediated, and the feature shipped at 6/10 with a follow-up ticket.
- **Lesson:** Define minimum QA thresholds per feature type before the sprint starts. Ambiguity on "good enough" wastes mediation cycles.
- **Confidence:** MEDIUM (validated 1 time)
- **Times Referenced:** 0

### QA-002
- **Sprint:** [SPRINT-ID]
- **Context:** [What happened]
- **Lesson:** [The insight]
- **Confidence:** [HIGH / MEDIUM / LOW]
- **Times Referenced:** [N]

---

## Scope & Planning Lessons

### SCOPE-001
- **Sprint:** SPRINT-001
- **Context:** Three features were planned for a 2-day sprint. Only two shipped. The third was descoped after the Architect flagged a dependency that wasn't visible during planning.
- **Lesson:** During sprint planning, explicitly ask each agent to flag hidden dependencies. A 10-minute dependency check saves hours of mid-sprint descoping.
- **Confidence:** MEDIUM (validated 1 time)
- **Times Referenced:** 0

### SCOPE-002
- **Sprint:** [SPRINT-ID]
- **Context:** [What happened]
- **Lesson:** [The insight]
- **Confidence:** [HIGH / MEDIUM / LOW]
- **Times Referenced:** [N]

---

## Deployment Lessons

### DEPLOY-001
- **Sprint:** SPRINT-002
- **Context:** First deployment attempt failed because environment variables were not documented. The Developer assumed defaults; the deploy script expected explicit values.
- **Lesson:** Every deploy artifact must include an env var manifest. Never assume defaults are shared knowledge across agents.
- **Confidence:** LOW (validated 0 times — first occurrence)
- **Times Referenced:** 0

### DEPLOY-002
- **Sprint:** [SPRINT-ID]
- **Context:** [What happened]
- **Lesson:** [The insight]
- **Confidence:** [HIGH / MEDIUM / LOW]
- **Times Referenced:** [N]

---

## Agent Coordination Lessons

### COORD-001
- **Sprint:** [SPRINT-ID]
- **Context:** [What happened]
- **Lesson:** [The insight]
- **Confidence:** [HIGH / MEDIUM / LOW]
- **Times Referenced:** [N]

---

## Budget & Cost Lessons

### COST-001
- **Sprint:** [SPRINT-ID]
- **Context:** [What happened]
- **Lesson:** [The insight]
- **Confidence:** [HIGH / MEDIUM / LOW]
- **Times Referenced:** [N]

---

## Confidence Scale

| Level | Meaning |
|-------|---------|
| HIGH | Validated across 3+ sprints; consistently holds true |
| MEDIUM | Validated 1-2 times; likely generalizable but needs more data |
| LOW | First occurrence; could be situational |

---

## How to Use This Document

1. **Before sprint planning:** Scan relevant categories for lessons that apply to the upcoming sprint's scope.
2. **During disputes:** Reference specific lesson IDs when past experience informs a current decision.
3. **After each sprint:** The Historian adds new lessons and updates confidence levels on existing ones.
4. **When referencing a lesson:** Increment the "Times Referenced" counter so we can track which lessons are actively useful.

---

*This is a living document. Entries are added after each sprint retrospective and confidence levels are updated as lessons are validated or contradicted.*
