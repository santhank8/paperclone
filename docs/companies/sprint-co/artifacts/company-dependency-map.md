# Sprint Co Inter-Company Dependency Map

**Maintained by:** Diplomat
**Last Updated:** [YYYY-MM-DD]

---

## Known Companies in Ecosystem

| Company | Focus | Size (Agents) | Relationship Status | Primary Contact Role |
|---|---|---|---|---|
| Sprint Co | Full-stack software delivery | [N] | SELF | — |
| [QA Guild] | [Quality assurance & testing] | [N] | [ALLIED / NEUTRAL / NO CONTACT] | [Diplomat / CEO] |
| [Design Bureau] | [UI/UX design systems] | [N] | [ALLIED / NEUTRAL / NO CONTACT] | [Diplomat / CEO] |
| [Infra Corp] | [Infrastructure & DevOps] | [N] | [ALLIED / NEUTRAL / NO CONTACT] | [Diplomat / CEO] |
| [Data Collective] | [Data pipelines & analytics] | [N] | [ALLIED / NEUTRAL / NO CONTACT] | [Diplomat / CEO] |

**Relationship statuses:**
- **ALLIED** — Active treaty in place, regular cooperation
- **NEUTRAL** — Aware of each other, no formal agreement
- **NO CONTACT** — Known to exist, no interaction yet
- **STRAINED** — Dispute or violation under review

---

## Dependency Graph

```
Sprint Co
├── CONSUMES FROM:
│   ├── [Design Bureau] ── design system components (TREATY-002)
│   ├── [QA Guild] ────── test infrastructure (TREATY-001)
│   └── [Infra Corp] ──── [deployment pipeline / not yet formalized]
│
├── PROVIDES TO:
│   ├── [QA Guild] ────── regression tests for shared components (TREATY-001)
│   ├── [Design Bureau] ── usage telemetry & bug reports (TREATY-002)
│   └── [Data Collective]─ [API integrations / not yet formalized]
│
└── NO DEPENDENCY:
    └── [other companies with no resource flow]
```

---

## Active Negotiations

| Negotiation | Counterparty | Subject | Status | Started | Target Close | Diplomat Notes |
|---|---|---|---|---|---|---|
| [NEG-001] | [Company] | [What's being negotiated] | [PROPOSED / IN PROGRESS / STALLED] | [YYYY-MM-DD] | [YYYY-MM-DD] | [Brief update] |

*If no active negotiations: "No negotiations in progress."*

---

## Resource Sharing Agreements

Summary of all active resource flows governed by treaties.

| Resource | Direction | Counterparty | Treaty | Limits | Utilization |
|---|---|---|---|---|---|
| [Test runner pool] | INBOUND | [QA Guild] | TREATY-001 | [N compute-hrs/wk] | [N% of limit] |
| [Regression tests] | OUTBOUND | [QA Guild] | TREATY-001 | [Within 48h of merge] | [Compliant / Overdue] |
| [Component library] | INBOUND | [Design Bureau] | TREATY-002 | [Full access] | [Active] |
| [Usage telemetry] | OUTBOUND | [Design Bureau] | TREATY-002 | [Per-sprint report] | [Compliant / Overdue] |

---

## Cross-Company Tasks In Progress

Tasks that involve agents or resources from multiple companies.

| Task | Sprint Co Agent | External Company | External Agent/Role | Status | Blockers |
|---|---|---|---|---|---|
| [e.g. Shared auth module] | [Backend Dev] | [Infra Corp] | [their agent] | [IN PROGRESS / BLOCKED / COMPLETE] | [Any blockers] |

*If none: "No cross-company tasks in progress."*

---

## Risk Assessment

What happens if a dependency company becomes unavailable?

| Company | Dependency Type | Impact if Unavailable | Severity | Mitigation |
|---|---|---|---|---|
| [QA Guild] | Test infrastructure | [Sprint QA phase runs on local tests only; slower, less coverage] | [HIGH / MED / LOW] | [Maintain local test fallback; never let shared tests be sole coverage] |
| [Design Bureau] | Design system | [UI work uses last-cached version of components; no updates until restored] | [HIGH / MED / LOW] | [Pin component versions; keep local copy of critical components] |
| [Infra Corp] | Deployment pipeline | [Manual deployment fallback; slower but functional] | [HIGH / MED / LOW] | [Document manual deploy procedure; test quarterly] |

### Single Points of Failure

- [List any dependency where no fallback exists]
- [Or state: "No single points of failure identified — all dependencies have documented fallbacks."]

### Cascading Risk Scenarios

| Scenario | Companies Affected | Sprint Co Impact | Response Plan |
|---|---|---|---|
| [e.g. Infra Corp + QA Guild both down] | [list] | [Severity and what breaks] | [What Sprint Co does] |

---

*Diplomat updates this map after every treaty change, new company contact, or cross-company task completion. Full review at post-sprint checkpoint.*
