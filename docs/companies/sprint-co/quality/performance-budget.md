# Performance Budget

> Quantitative performance targets enforced on every deployment.

**Owner:** QA Engineer (measurement), Enforcer (enforcement)  
**Applies To:** All deployed artifacts  

---

## Performance Budgets

### Frontend Metrics

| Metric | Budget | Warning Threshold (90%) | Block Threshold (110%) | Source |
|---|---|---|---|---|
| **Lighthouse Performance Score** | ≥ 90 | < 90 (at budget) | < 82 | Lighthouse CI |
| **First Contentful Paint (FCP)** | < 1.5s | > 1.35s | > 1.65s | Lighthouse / WebPageTest |
| **Time to Interactive (TTI)** | < 3.5s | > 3.15s | > 3.85s | Lighthouse |
| **Total Bundle Size (gzipped)** | < 500 KB | > 450 KB | > 550 KB | Build output analysis |
| **Largest Contentful Paint (LCP)** | < 2.5s | > 2.25s | > 2.75s | Chrome UX Report / Lighthouse |
| **First Input Delay (FID)** | < 100ms | > 90ms | > 110ms | Chrome UX Report |
| **Cumulative Layout Shift (CLS)** | < 0.1 | > 0.09 | > 0.11 | Lighthouse |

### Backend Metrics

| Metric | Budget | Warning Threshold (90%) | Block Threshold (110%) | Source |
|---|---|---|---|---|
| **API Response P50** | < 100ms | > 90ms | > 110ms | Load testing / APM |
| **API Response P95** | < 200ms | > 180ms | > 220ms | Load testing / APM |
| **API Response P99** | < 500ms | > 450ms | > 550ms | Load testing / APM |
| **Server Startup Time** | < 5s | > 4.5s | > 5.5s | Deploy logs |
| **Memory Usage (idle)** | < 256 MB | > 230 MB | > 282 MB | Process monitoring |

### Core Web Vitals Summary

| Vital | Target | Good | Needs Improvement | Poor |
|---|---|---|---|---|
| **LCP** | < 2.5s | ≤ 2.5s | 2.5s – 4.0s | > 4.0s |
| **FID** | < 100ms | ≤ 100ms | 100ms – 300ms | > 300ms |
| **CLS** | < 0.1 | ≤ 0.1 | 0.1 – 0.25 | > 0.25 |

---

## Enforcement Rules

### Warning Zone (≥ 90% of budget consumed)

- QA flags metric in sprint report with ⚠️ WARNING.
- Dev team is notified; no deploy block.
- Optimization task added to next sprint backlog.

### Block Zone (≥ 110% of budget exceeded)

- **Deploy is blocked** until metric is brought within budget.
- QA Engineer reports violation to Enforcer.
- Enforcer may grant a one-sprint exemption with documented justification.
- Exemption requires a remediation plan with specific sprint commitment.

### Enforcement Flow

```
Measure → Compare to Budget → Within Budget? → DEPLOY
                              ↓
                         Warning Zone? → Flag + Deploy
                              ↓
                         Block Zone? → BLOCK DEPLOY → Exemption Request → Enforcer Decision
```

---

## Performance Regression Detection

Every sprint, compare current metrics against the previous sprint.

| Metric | Previous Sprint | Current Sprint | Delta | Status |
|---|---|---|---|---|
| Lighthouse Score | | | | |
| FCP | | | | |
| TTI | | | | |
| Bundle Size | | | | |
| LCP | | | | |
| FID | | | | |
| CLS | | | | |
| API P95 | | | | |

### Regression Rules

- **> 10% degradation** on any metric → automatic WARNING.
- **> 20% degradation** on any metric → investigation required before deploy.
- **3 consecutive sprints of degradation** on the same metric → Enforcer escalation.

---

## Report Template

```markdown
# Performance Report

**Date:** YYYY-MM-DD
**Sprint:** S-XX
**Measured By:** QA Engineer

## Frontend Metrics

| Metric | Budget | Actual | Status | vs Previous |
|---|---|---|---|---|
| Lighthouse Score | ≥ 90 | XX | ✅/⚠️/🚫 | +X / -X |
| FCP | < 1.5s | X.Xs | ✅/⚠️/🚫 | +Xms / -Xms |
| TTI | < 3.5s | X.Xs | ✅/⚠️/🚫 | +Xms / -Xms |
| Bundle Size | < 500KB | XXXKB | ✅/⚠️/🚫 | +XKB / -XKB |
| LCP | < 2.5s | X.Xs | ✅/⚠️/🚫 | +Xms / -Xms |
| FID | < 100ms | XXms | ✅/⚠️/🚫 | +Xms / -Xms |
| CLS | < 0.1 | X.XX | ✅/⚠️/🚫 | +X.XX / -X.XX |

## Backend Metrics

| Metric | Budget | Actual | Status | vs Previous |
|---|---|---|---|---|
| API P50 | < 100ms | XXms | ✅/⚠️/🚫 | |
| API P95 | < 200ms | XXms | ✅/⚠️/🚫 | |
| API P99 | < 500ms | XXms | ✅/⚠️/🚫 | |

## Regressions

[List any metrics that degraded > 10% from previous sprint]

## Deploy Decision

- **Metrics within budget:** X / Y
- **Warnings:** X
- **Blocked:** X
- **Decision:** GO / NO-GO
```

---

## Budget Adjustment Process

Performance budgets are not permanent. Adjust them when project context changes.

### When to Loosen Budgets

- Project adds significant new functionality that legitimately increases bundle size or response time.
- Target audience is on high-bandwidth connections (internal tools).
- Trade-off is justified and documented.

### When to Tighten Budgets

- Consistently beating budgets by > 30% for 5+ sprints (budgets are too loose).
- Industry standards shift (e.g., Core Web Vitals thresholds change).
- Moving to a performance-critical segment (e.g., mobile-first consumer app).

### Adjustment Process

1. **Proposer** (any agent) submits adjustment request with data justification.
2. **QA Engineer** validates the measurement methodology.
3. **Enforcer** approves or rejects.
4. **Record** in Budget Version History below.

### Budget Version History

| Version | Date | Changes | Rationale | Approved By |
|---|---|---|---|---|
| 1.0 | 2026-04-01 | Initial budgets established | Baseline | Enforcer |
| | | | | |
