# Cross-Company Protocols

## Purpose

Define standards for inter-company operations within the Paperclip ecosystem — task delegation, shared services, marketplace publishing, billing, and dependency management.

---

## 1. Task Delegation Protocol

How Company A asks Company B to perform work.

### Request Format

```yaml
delegation_request:
  id: DEL-{{REQUESTING_COMPANY}}-{{SEQ}}
  from:
    company: {{REQUESTING_COMPANY_SLUG}}
    agent: diplomat              # Always routed via Diplomat
  to:
    company: {{RECEIVING_COMPANY_SLUG}}
  task:
    summary: "One-line description"
    brief: |
      Full task brief (1-4 sentences, same format as sprint brief)
    acceptance_criteria:
      - "Criterion 1"
      - "Criterion 2"
    priority: P0 | P1 | P2 | P3
    deadline: "ISO-8601 timestamp or 'next available sprint'"
  sla:
    max_response_time: "30m"     # Time to acknowledge
    max_delivery_time: "4h"      # Time to deliver
  budget:
    offered: "$N.NN"             # Max the requester will pay
    currency: "USD"
  artifacts:
    - name: "supporting-doc.md"
      content: "..."
```

### SLA Negotiation

1. **Request** — Diplomat of Company A sends delegation request
2. **Acknowledge** — Diplomat of Company B acknowledges within `max_response_time`
3. **Assess** — Company B's Orchestrator estimates effort and cost
4. **Propose** — Company B returns proposed SLA (may differ from requested)
5. **Accept/Reject** — Company A accepts the proposal or negotiates
6. **Commit** — Both companies log the agreed SLA as a binding commitment

```
Company A Diplomat → [delegation_request] → Company B Diplomat
Company B Diplomat → [acknowledgment] → Company A Diplomat
Company B Orchestrator → [sla_proposal] → Company B Diplomat → Company A Diplomat
Company A Diplomat → [accept | counter | withdraw] → Company B Diplomat
```

### Delivery Verification

Upon task completion:

1. Company B delivers artifacts to Company A via the delegation channel
2. Company A's QA Engineer evaluates against acceptance criteria
3. If accepted: delegation marked `completed`, billing triggered
4. If rejected: Company A returns specific feedback, Company B has one remediation cycle
5. After remediation: accept or escalate to both companies' Judges

### Billing

On successful delivery, a billing event is emitted:

```yaml
billing_event:
  delegation_id: DEL-sprint-co-001
  from: sprint-co
  to: api-forge
  amount: "$4.50"
  description: "API endpoint implementation (3 endpoints)"
  status: "invoiced"
```

---

## 2. Shared Services Model

Utility companies that provide infrastructure services to others.

### Shared Service Types

| Service Company | Provides | Consumers |
|----------------|----------|-----------|
| **CI/CD Co** | Build pipelines, deployment infrastructure, release automation | Any company that ships software |
| **Testing Co** | Comprehensive test suites, load testing, security scanning | Any company needing QA augmentation |
| **Design Co** | UI/UX design, design systems, asset generation | Companies building user-facing products |
| **Infra Co** | Cloud provisioning, monitoring, alerting | Companies with production deployments |
| **Docs Co** | Technical writing, API documentation, user guides | Any company |

### Shared Service Contract

```yaml
service_contract:
  provider: {{SERVICE_COMPANY_SLUG}}
  consumer: {{CONSUMER_COMPANY_SLUG}}
  service: "CI/CD Pipeline Management"
  scope:
    included:
      - "Build pipeline configuration"
      - "Deployment automation"
      - "Release management"
    excluded:
      - "Application code"
      - "Test writing"
  sla:
    availability: "99%"
    response_time: "< 15m for pipeline failures"
  pricing:
    model: "per-invocation"
    rate: "$0.10 per build"
    monthly_cap: "$50.00"
  duration: "rolling monthly"
  termination_notice: "7 days"
```

---

## 3. ClipHub Publishing

How companies share skills, agents, and templates on the Paperclip marketplace.

### Package Format

```
my-skill/
├── SKILL.md              # schema: agentcompanies/v1, kind: skill
├── README.md             # Description, usage, examples
├── LICENSE               # MIT, Apache-2.0, or proprietary
├── CHANGELOG.md          # Version history
└── assets/               # Supporting files (prompts, configs)
```

### Quality Requirements

Before publishing to ClipHub:

| Requirement | Description |
|-------------|------------|
| **Schema Valid** | Must pass `agentcompanies/v1` schema validation |
| **README Present** | Clear description, usage instructions, examples |
| **Tested** | At least one documented test scenario with expected output |
| **Licensed** | Explicit license file |
| **Versioned** | CalVer version in frontmatter |
| **No Secrets** | No API keys, tokens, or credentials in package |
| **Scoped** | Single responsibility — one skill/agent per package |

### Pricing Models

| Model | Description | Use Case |
|-------|------------|----------|
| **Free** | Open source, no charge | Community tools, basic utilities |
| **Paid (One-Time)** | Single purchase | Specialized agents, premium skills |
| **Subscription** | Monthly fee, continuous updates | Maintained services, evolving capabilities |
| **Usage-Based** | Per-invocation pricing | API-backed skills, compute-heavy tasks |

### Publishing Workflow

```bash
# Validate package
paperclip cliphub validate ./my-skill

# Publish
paperclip cliphub publish ./my-skill --visibility public --pricing free

# Update
paperclip cliphub publish ./my-skill --update
```

---

## 4. Inter-Company Billing

Token-based accounting system for cross-company transactions.

### Accounting Principles

- All transactions denominated in **USD**
- Each company maintains a **ledger** of receivables and payables
- Billing events are immutable log entries
- Disputes are escalated to the involved companies' Judges

### Transaction Ledger

| TX ID | Date | From | To | Amount | Description | Delegation ID | Status |
|-------|------|------|-----|--------|-------------|--------------|--------|
| TX-001 | [Date] | sprint-co | api-forge | $4.50 | API implementation | DEL-sprint-co-001 | Settled |
| TX-002 | [Date] | api-forge | sprint-co | $2.00 | QA augmentation | DEL-api-forge-003 | Invoiced |

### Monthly Reconciliation Template

```yaml
reconciliation:
  period: "2026-04"
  company: sprint-co
  summary:
    total_receivable: "$12.50"
    total_payable: "$8.00"
    net_position: "+$4.50"
  transactions:
    receivable:
      - tx_id: TX-001
        from: api-forge
        amount: "$4.50"
        status: settled
    payable:
      - tx_id: TX-002
        to: testing-co
        amount: "$3.00"
        status: invoiced
  disputes:
    - tx_id: TX-005
      amount: "$2.00"
      reason: "Acceptance criteria not fully met"
      status: "under review by Judges"
  sign_off:
    treasurer: "{{COMPANY_SLUG}}-treasurer"
    date: "2026-04-30"
```

---

## 5. Dependency Management

How to handle upstream company changes affecting downstream consumers.

### Dependency Types

| Type | Example | Risk |
|------|---------|------|
| **Service Dependency** | Sprint Co depends on CI/CD Co for deployments | High — blocks delivery |
| **Skill Dependency** | Sprint Co uses a ClipHub skill published by another company | Medium — version pinned |
| **Template Dependency** | Fork inherits structure from source | Low — one-time copy |
| **Data Dependency** | Company B needs data produced by Company A | High — blocks analysis |

### Dependency Declaration

In `COMPANY.md`, companies declare external dependencies:

```yaml
dependencies:
  services:
    - company: ci-cd-co
      service: "build-pipeline"
      version: ">=v2026.301.0"
      criticality: high
  skills:
    - package: "cliphub/advanced-testing"
      version: "^v2026.315.0"
      criticality: medium
```

### Change Notification Protocol

When an upstream company makes a breaking change:

1. **Announce** — Upstream Diplomat notifies all dependent companies 48 hours before change
2. **Impact Assess** — Downstream Orchestrators evaluate impact
3. **Adapt** — Downstream companies adjust during next available Maintenance Sprint
4. **Confirm** — Downstream Diplomats confirm successful adaptation
5. **Log** — Both companies log the dependency change in their respective ledgers

### Versioning Compatibility

| Upstream Change | Downstream Impact | Required Action |
|----------------|-------------------|-----------------|
| Patch (bug fix) | None expected | Auto-accept |
| Minor (new feature, backward compatible) | None expected | Review and accept |
| Major (breaking change) | Likely breakage | Mandatory Maintenance Sprint |
| Deprecation | Future breakage | Plan migration within 2 sprints |
