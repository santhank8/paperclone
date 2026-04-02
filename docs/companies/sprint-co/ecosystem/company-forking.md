# Company Forking

## Purpose

Define the process for cloning Sprint Co — in whole or in part — to create new autonomous companies with proven structure and modified configurations.

---

## Fork Types

### 1. Full Fork

An identical copy of Sprint Co with a new identity.

| Attribute | Value |
|-----------|-------|
| **Agents** | All 15 |
| **Governance** | Complete constitution, voting, dissent, escalation |
| **Teams** | Execution, Quality, Leadership, Support |
| **Operations** | All sprint types, incident response, OKR, roadmap |
| **Use Case** | Standing up a second autonomous software company with identical capability |
| **Customization** | Name, budget caps, model tiers |

### 2. Slim Fork

Just the execution core — build and ship, skip the institutional overhead.

| Attribute | Value |
|-----------|-------|
| **Agents** | 7 — Orchestrator, Product Planner, Sprint Lead, Engineer Alpha, Engineer Beta, QA Engineer, Delivery Engineer |
| **Governance** | Minimal — escalation to human Board only |
| **Teams** | Execution only |
| **Operations** | Standard Sprint only |
| **Use Case** | Lightweight build team, embedded in a larger human organization |
| **Customization** | Name, budget, sprint duration, agent models |

### 3. Specialized Fork

A subset of agents optimized for a specific domain.

| Domain | Agents Included | Agents Excluded | Agents Added |
|--------|----------------|-----------------|--------------|
| **Backend API Shop** | Orchestrator, Planner, Sprint Lead, Engineer Alpha, QA, Delivery | Designer agents, Scout | Database Specialist |
| **Security Audit Firm** | Orchestrator, Security Auditor, QA, Critic, Judge | Engineers, Delivery | Compliance Analyst, Pen Tester |
| **Data Pipeline Studio** | Orchestrator, Planner, Engineer Alpha, Engineer Beta, QA | Diplomat, Scout, Stakeholder | Data Engineer, ML Engineer |
| **DevOps Company** | Orchestrator, Sprint Lead, Delivery Engineer, Security Auditor | Product Planner, Critic | Infra Engineer, SRE |

---

## Fork Process

### Step 1: Clone Template

```bash
paperclip company create --from-template sprint-co --name "{{NEW_COMPANY_NAME}}"
```

This creates a new directory with all template files, placeholders replaced with the new company name.

### Step 2: Customize COMPANY.md

Edit the new `COMPANY.md` to reflect:

- [ ] Company name and slug
- [ ] Mission statement (tailored to new domain)
- [ ] Sprint duration (if different from 3 hours)
- [ ] Phase breakdown timing (if adjusted)
- [ ] Delivery targets and SLAs

### Step 3: Adjust Agent Configurations

For each agent in `agents/*/AGENTS.md`:

- [ ] Set model tier appropriate to budget (`opus` / `sonnet` / `haiku`)
- [ ] Adjust token budgets per phase
- [ ] Remove agents not needed (Specialized Fork)
- [ ] Add new agent definitions if needed
- [ ] Update system prompt emphasis for domain

### Step 4: Calibrate Budgets

Update `governance/trust-levels.md` and agent budget caps:

| Parameter | Default (Sprint Co) | Adjustment Guidance |
|-----------|---------------------|-------------------|
| Sprint budget cap | $15.00 | Scale with agent count and model tiers |
| Per-agent per-phase cap | Varies by role | Keep Orchestrator ≤ 15% of total |
| Emergency reserve | 10% of sprint budget | Never lower than 5% |
| Escalation threshold | 80% budget consumed | Range: 70-90% |

### Step 5: Run Onboarding Sprint

Execute the first sprint as an **Onboarding Sprint** (see `operations/sprint-types.md`):

```bash
paperclip sprint start --company {{NEW_COMPANY_SLUG}} --type onboarding \
  --brief "Verify all agents can coordinate, produce artifacts, and pass quality gates"
```

**Onboarding Sprint Success Criteria:**
- [ ] All agents respond and produce expected artifacts
- [ ] Handoff chain completes without context loss
- [ ] QA gate executes and produces eval report
- [ ] Budget tracking records costs accurately
- [ ] Governance protocols (escalation, dissent) can be triggered

---

## What Forks Inherit

| Inherited | Description |
|-----------|-------------|
| **Organizational Structure** | Agent roles, team composition, reporting lines |
| **Protocols** | Sprint methodology, handoff format, signaling protocol |
| **Governance Framework** | Constitution, voting rules, dissent process, escalation matrix |
| **Quality Standards** | QA thresholds, eval rubrics, Definition of Done |
| **Artifact Templates** | Sprint plan, eval report, handoff, board minutes templates |
| **Operational Playbooks** | Sprint types, incident response, OKR framework |

## What Forks Don't Inherit

| Not Inherited | Reason |
|---------------|--------|
| **Sprint Data** | Historical performance belongs to the source company |
| **Agent Reputation** | Trust scores are earned through track record |
| **Case Law** | Judge precedent is company-specific context |
| **Lessons Learned** | Institutional knowledge is earned, not copied |
| **Budget Actuals** | Historical spend is irrelevant to the fork |
| **Client Relationships** | Stakeholder context doesn't transfer |
| **ClipHub Published Skills** | Must be explicitly imported if desired |

---

## Fork Registry Template

Track all forks derived from Sprint Co:

| Fork ID | Company Name | Fork Type | Created | Based On Version | Status | Notes |
|---------|-------------|-----------|---------|-----------------|--------|-------|
| FK-001 | [Name] | Full / Slim / Specialized | [Date] | v2026.401.0 | Active / Dormant / Archived | — |
| FK-002 | [Name] | [Type] | [Date] | [Version] | [Status] | — |

### Fork Lineage Tracking

```
sprint-co (v2026.401.0)
├── api-forge (Full Fork)
│   └── api-forge-lite (Slim Fork of fork)
├── security-sentinel (Specialized Fork: Security)
└── data-pipeline-co (Specialized Fork: Data)
```

### Fork Sync Policy

Forks do **not** automatically receive upstream changes. To incorporate improvements from the source template:

1. Review the source template changelog
2. Identify applicable changes
3. Cherry-pick structural/governance changes via diff
4. Run a Calibration Sprint to validate changes
5. Update the fork's `Based On Version` in the registry
