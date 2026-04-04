# Tech Debt Register

## Purpose

Track known shortcuts, workarounds, and deferred improvements across sprints. Tech debt that is visible, measured, and prioritized can be managed; invisible debt compounds silently until it cripples velocity.

This register is the single source of truth for Sprint Co's accumulated technical debt.

---

## Debt Entry Format

Each debt item is tracked with the following fields:

| Field | Description |
|-------|-----------|
| **Debt ID** | Unique identifier: `TD-NNN` |
| **Sprint Introduced** | Sprint ID where the debt was incurred |
| **Description** | Clear description of the shortcut or deferral |
| **Category** | Architecture · Testing · Security · Performance · Documentation |
| **Severity** | HIGH · MEDIUM · LOW |
| **Estimated Cost to Fix** | Approximate effort/cost to properly resolve |
| **Interest Rate** | How much this debt slows the team per sprint (qualitative or quantitative) |
| **Status** | OPEN · SCHEDULED · IN-PROGRESS · RESOLVED |
| **Resolved In** | Sprint ID where debt was resolved (if applicable) |

### Severity Definitions

| Severity | Impact | Urgency |
|----------|--------|---------|
| **HIGH** | Actively impeding velocity or creating risk; will get worse | Fix within 1-2 sprints |
| **MEDIUM** | Noticeable drag on quality or speed; stable for now | Schedule within 3-5 sprints |
| **LOW** | Minor inconvenience; best practice violation | Address opportunistically |

### Category Definitions

| Category | Examples |
|----------|---------|
| **Architecture** | Tight coupling, missing abstractions, monolith patterns, hardcoded values |
| **Testing** | Missing tests, flaky tests, inadequate coverage, manual QA workarounds |
| **Security** | Hardcoded credentials, missing auth checks, unvalidated inputs |
| **Performance** | N+1 queries, missing caching, unoptimized builds, memory leaks |
| **Documentation** | Missing API docs, outdated READMEs, undocumented config, tribal knowledge |

---

## Active Debt Table

| Debt ID | Sprint Introduced | Description | Category | Severity | Est. Cost | Interest Rate | Status |
|---------|------------------|-------------|----------|----------|-----------|---------------|--------|
| [TD-001] | [SP-001] | [e.g., No error boundaries in UI — crashes propagate to full page] | [Architecture] | [HIGH] | [$N.NN / Nh] | [~N% velocity drag/sprint] | [OPEN] |
| [TD-002] | [SP-001] | [e.g., Auth flow has no refresh token — sessions expire abruptly] | [Security] | [HIGH] | [$N.NN / Nh] | [Blocks feature X, Y] | [SCHEDULED] |
| [TD-003] | [SP-002] | [e.g., No integration tests for API endpoints] | [Testing] | [MEDIUM] | [$N.NN / Nh] | [~N% rework on changes] | [OPEN] |
| [TD-004] | [SP-002] | [e.g., CSS is all inline styles, no design system tokens] | [Architecture] | [MEDIUM] | [$N.NN / Nh] | [Slows UI changes by ~N%] | [OPEN] |
| [TD-005] | [SP-003] | [e.g., README still references v0.1 setup steps] | [Documentation] | [LOW] | [$N.NN / Nh] | [Minimal] | [OPEN] |

### Summary Statistics

| Metric | Value |
|--------|-------|
| Total Active Debt Items | [N] |
| HIGH severity | [N] |
| MEDIUM severity | [N] |
| LOW severity | [N] |
| Total Estimated Fix Cost | [$N.NN / Nh] |
| Sprints Without Debt Reduction | [N] |

---

## Resolved Debt Table

| Debt ID | Sprint Introduced | Sprint Resolved | Description | Category | Actual Fix Cost | Notes |
|---------|------------------|----------------|-------------|----------|----------------|-------|
| [TD-XXX] | [SP-001] | [SP-003] | [Description] | [Category] | [$N.NN / Nh] | [How it was resolved] |

---

## Debt Trends

### Accumulation Over Time

| Sprint ID | New Debt Items | Resolved Debt Items | Net Change | Total Active Debt |
|-----------|---------------|--------------------|-----------:|------------------:|
| [SP-001] | [N] | [N] | [+N / -N] | [N] |
| [SP-002] | [N] | [N] | [+N / -N] | [N] |
| [SP-003] | [N] | [N] | [+N / -N] | [N] |

### Debt Direction Indicator

```
Debt Trajectory = Net Change averaged over last 3 sprints

  Positive net change → ⚠️ ACCUMULATING — debt is growing
  Zero net change     → → STABLE — debt is being managed
  Negative net change → ✅ REDUCING — team is paying down debt
```

### Debt by Category Over Time

| Category | SP-001 | SP-002 | SP-003 | Trend |
|----------|--------|--------|--------|-------|
| Architecture | [N] | [N] | [N] | [↑↓→] |
| Testing | [N] | [N] | [N] | [↑↓→] |
| Security | [N] | [N] | [N] | [↑↓→] |
| Performance | [N] | [N] | [N] | [↑↓→] |
| Documentation | [N] | [N] | [N] | [↑↓→] |

---

## Recommendations

### Maintenance Sprint Triggers

A **maintenance sprint** should be scheduled when ANY of the following conditions are met:

| Trigger | Threshold | Rationale |
|---------|----------|-----------|
| Total HIGH-severity debt | ≥ 5 items | Active blockers accumulating |
| Consecutive sprints with net debt increase | ≥ 3 sprints | Debt trajectory is unsustainable |
| Estimated total fix cost | > 2× average sprint budget | Debt is becoming expensive to carry |
| Velocity decline correlated with debt | Ship Rate dropped ≥ 15% while debt grew | Debt is measurably impacting output |
| Security debt exists | Any item | Security debt has compounding risk |

### Maintenance Sprint Guidelines

- Dedicate **100% of sprint capacity** to debt reduction (no new features)
- Prioritize: Security → HIGH Architecture → HIGH Testing → rest by severity
- Target resolving at minimum **50% of active HIGH-severity debt**
- Update this register as items are resolved
- Post-maintenance: verify velocity recovery in the following sprint

### Debt Prevention Practices

- Each sprint should allocate **10-15% of capacity** to debt reduction ("boy scout rule")
- QA Critic should flag new debt creation during code review
- Enforcer should track debt-creating patterns and warn agents
- Any feature shipped with known shortcuts must file a debt entry before sprint close
