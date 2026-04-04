# Sprint Types

## Purpose

Not every sprint is the same. Sprint Co uses different sprint configurations depending on the goal. This catalog defines each sprint type, when to use it, and how it differs from the standard sprint.

---

## Sprint Type Catalog

### Standard Sprint

The default sprint type. Takes a brief and ships working software.

| Attribute | Value |
|-----------|-------|
| **Duration** | 3 hours |
| **Goal** | Deliver shippable software from a 1–4 sentence brief |
| **Team Configuration** | Full team: Orchestrator, Product Planner, Sprint Lead, Engineer Alpha, Engineer Beta, QA Engineer, Critic, Delivery Engineer. Intelligence & Governance on standby. |
| **Success Criteria** | QA eval ≥ C on all dimensions, deployed to live environment, acceptance criteria met |
| **When to Use** | Default for all feature work, product development, client deliverables |
| **Budget Allocation** | Standard model mix: 40% Haiku, 45% Sonnet, 15% Opus |

**Phase Breakdown:**

| Phase | Duration | Owner |
|-------|----------|-------|
| Planning | 0:00–0:20 | Product Planner |
| Architecture | 0:20–0:40 | Sprint Lead |
| Implementation | 0:40–2:20 | Engineers |
| QA / Eval Loop | 2:20–2:45 | QA Engineer + Critic |
| Deployment | 2:45–3:00 | Delivery Engineer |

---

### Maintenance Sprint

Focused on reducing tech debt, updating dependencies, and improving existing systems. No new features.

| Attribute | Value |
|-----------|-------|
| **Duration** | 3 hours |
| **Goal** | Reduce tech debt, update dependencies, improve reliability |
| **Team Configuration** | Orchestrator, Sprint Lead, Engineer Alpha, Engineer Beta, QA Engineer, Security Auditor. No Product Planner (no new features). Scout identifies priority items from tech debt register. |
| **Success Criteria** | Tech debt register items resolved, all tests pass, no regressions, dependency audit clean |
| **When to Use** | Every 4th sprint (cadence), or when tech debt register exceeds threshold |
| **Budget Allocation** | Heavy Haiku (60%) — routine tasks don't need expensive models. Sonnet (35%) for complex refactors. Opus (5%) for architectural decisions. |

**Phase Breakdown:**

| Phase | Duration | Owner |
|-------|----------|-------|
| Debt Triage | 0:00–0:20 | Sprint Lead + Scout |
| Dependency Audit | 0:20–0:40 | Security Auditor |
| Remediation | 0:40–2:20 | Engineers |
| Regression Testing | 2:20–2:50 | QA Engineer |
| Deployment | 2:50–3:00 | Delivery Engineer |

---

### Innovation Sprint

Exploration-driven sprint for testing new ideas, technologies, or approaches. Shipping is optional.

| Attribute | Value |
|-----------|-------|
| **Duration** | 3 hours |
| **Goal** | Explore new technology, prototype ideas, test hypotheses |
| **Team Configuration** | Orchestrator, Scout (lead), Engineer Alpha, Critic, Historian. Scout drives the agenda. Engineers prototype. Critic evaluates viability. Historian records findings. |
| **Success Criteria** | At least one hypothesis tested with documented results, findings report produced, viable ideas flagged for future sprints |
| **When to Use** | Every 8th sprint (cadence), or when Scout identifies a high-potential opportunity |
| **Budget Allocation** | Heavy Sonnet (60%) — exploration needs smart reasoning. Haiku (20%) for routine tasks. Opus (20%) for breakthrough analysis. |

**Phase Breakdown:**

| Phase | Duration | Owner |
|-------|----------|-------|
| Research Brief | 0:00–0:20 | Scout |
| Hypothesis Design | 0:20–0:40 | Scout + Engineer Alpha |
| Prototyping | 0:40–2:00 | Engineer Alpha |
| Evaluation | 2:00–2:30 | Critic |
| Findings Report | 2:30–3:00 | Historian |

---

### Hotfix Sprint

Emergency response sprint for critical production issues. Compressed timeline, focused team.

| Attribute | Value |
|-----------|-------|
| **Duration** | 1 hour |
| **Goal** | Fix a critical production issue and restore service |
| **Team Configuration** | Orchestrator, Engineer Alpha, QA Engineer, Delivery Engineer. Minimal team for maximum speed. Security Auditor on standby for security-related incidents. |
| **Success Criteria** | Production issue resolved, fix verified in production, no new issues introduced, incident report filed |
| **When to Use** | SEV-1 or SEV-2 incidents requiring immediate response |
| **Budget Allocation** | All Sonnet (80%) + Opus (20%) — speed and quality over cost. No Haiku — this is not the time for budget optimization. |

**Phase Breakdown:**

| Phase | Duration | Owner |
|-------|----------|-------|
| Incident Assessment | 0:00–0:10 | Orchestrator + Engineer Alpha |
| Fix Implementation | 0:10–0:35 | Engineer Alpha |
| Verification | 0:35–0:50 | QA Engineer |
| Emergency Deploy | 0:50–1:00 | Delivery Engineer |

**Post-Sprint:** Historian produces incident postmortem within 24 hours.

---

### Calibration Sprint

Internal alignment sprint focused on quality standards. QA and Critic recalibrate rubrics, review evaluation consistency, and update scoring criteria.

| Attribute | Value |
|-----------|-------|
| **Duration** | 2 hours |
| **Goal** | Align quality standards, update rubrics, ensure evaluation consistency |
| **Team Configuration** | Orchestrator, QA Engineer (lead), Critic, Historian, Scout. QA and Critic review past evaluations for consistency. Scout brings external quality benchmarks. Historian documents changes. |
| **Success Criteria** | Rubrics reviewed and updated, inter-rater reliability assessed, at least 3 past evaluations re-scored for consistency, calibration report produced |
| **When to Use** | After every 10 sprints, after QA score variance exceeds threshold, after model changes |
| **Budget Allocation** | Heavy Opus (40%) — calibration requires deep reasoning. Sonnet (40%) for analysis. Haiku (20%) for data gathering. |

**Phase Breakdown:**

| Phase | Duration | Owner |
|-------|----------|-------|
| Gather Past Evals | 0:00–0:20 | QA Engineer + Historian |
| Consistency Analysis | 0:20–0:50 | QA Engineer + Critic |
| Rubric Updates | 0:50–1:20 | QA Engineer |
| External Benchmark Review | 1:20–1:40 | Scout |
| Calibration Report | 1:40–2:00 | Historian |

---

### Onboarding Sprint

Training sprint for integrating new agents, testing new model versions, or validating configuration changes.

| Attribute | Value |
|-----------|-------|
| **Duration** | 2 hours |
| **Goal** | Validate new agent configurations, test model upgrades, verify integration |
| **Team Configuration** | Orchestrator, the new/updated agent(s), QA Engineer, Critic, Historian. Run the new agent through standard scenarios and evaluate performance. |
| **Success Criteria** | New agent passes all role-specific tests, integrates with signaling protocol, QA evaluation meets minimum threshold, no degradation in team performance |
| **When to Use** | When adding a new agent, upgrading a model, changing agent configuration, after a fork's initial setup |
| **Budget Allocation** | Balanced across tiers — need representative workload. Haiku (35%), Sonnet (40%), Opus (25%). |

**Phase Breakdown:**

| Phase | Duration | Owner |
|-------|----------|-------|
| Agent Configuration | 0:00–0:15 | Orchestrator |
| Integration Testing | 0:15–0:45 | QA Engineer |
| Scenario Execution | 0:45–1:20 | New Agent + Supporting Agents |
| Performance Evaluation | 1:20–1:45 | Critic + QA Engineer |
| Onboarding Report | 1:45–2:00 | Historian |

---

## Sprint Type Selection Matrix

| Trigger | Sprint Type |
|---------|------------|
| New feature brief received | Standard |
| Tech debt register > 10 items | Maintenance |
| Scout flags high-potential opportunity | Innovation |
| SEV-1 or SEV-2 incident | Hotfix |
| QA score variance > 0.5 across sprints | Calibration |
| New agent added or model upgraded | Onboarding |
| Every 4th sprint (cadence) | Maintenance |
| Every 8th sprint (cadence) | Innovation |
| Every 10th sprint (cadence) | Calibration |

---

## Sprint Type Budget Comparison

| Sprint Type | Duration | Haiku | Sonnet | Opus | Typical Cost |
|------------|----------|-------|--------|------|-------------|
| Standard | 3h | 40% | 45% | 15% | $5.00 |
| Maintenance | 3h | 60% | 35% | 5% | $3.50 |
| Innovation | 3h | 20% | 60% | 20% | $6.00 |
| Hotfix | 1h | 0% | 80% | 20% | $3.00 |
| Calibration | 2h | 20% | 40% | 40% | $4.50 |
| Onboarding | 2h | 35% | 40% | 25% | $4.00 |
