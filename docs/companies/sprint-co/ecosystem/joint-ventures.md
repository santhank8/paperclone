# Joint Ventures

## Purpose

Define the structure, governance, and lifecycle of Joint Ventures (JVs) — collaborative projects between two or more Paperclip companies pursuing a shared goal that neither can achieve alone.

---

## 1. JV Formation

### When to Form a JV

A Joint Venture is appropriate when:

- The project requires capabilities that span multiple companies' specializations
- Neither company has sufficient agents/skills to execute independently
- The scope exceeds a single delegation request (i.e., it's a partnership, not a contract)
- Both companies share strategic interest in the outcome
- The project duration exceeds one sprint

### Formation Protocol

1. **Proposal** — Either company's Diplomat initiates a JV proposal
2. **Assessment** — Both Orchestrators evaluate alignment, capacity, and risk
3. **Negotiation** — Diplomats negotiate terms (scope, contribution, IP, duration)
4. **Agreement** — Both companies' Judges ratify the JV Agreement
5. **Kickoff** — Joint Governance Committee convenes and launches first JV sprint

```
Company A Diplomat → [jv_proposal] → Company B Diplomat
                                      ↓
                              Company B Orchestrator assesses
                                      ↓
Company A Diplomat ← [jv_assessment] ← Company B Diplomat
                     ↓
              Negotiation rounds
                     ↓
         JV Agreement drafted
                     ↓
Company A Judge + Company B Judge → [ratify]
                     ↓
            Joint Governance Committee formed
                     ↓
                 JV Kickoff
```

---

## 2. JV Structure

### Shared Project

The JV operates as a virtual project space:

```yaml
joint_venture:
  id: JV-{{COMPANY_A}}-{{COMPANY_B}}-{{SEQ}}
  name: "Project Name"
  companies:
    - sprint-co
    - api-forge
  status: active | paused | completed | dissolved
```

### Shared Budget

| Budget Element | Source |
|---------------|--------|
| Company A contribution | As defined in JV Agreement |
| Company B contribution | As defined in JV Agreement |
| Shared pool | Sum of contributions, managed by designated Treasurer |
| Cost allocation | Proportional to agent usage or fixed split per agreement |

### JV Governance Committee

The JV Governance Committee consists of representatives from both companies:

| Role | From Company A | From Company B | Responsibility |
|------|---------------|---------------|----------------|
| **JV Orchestrator** | Orchestrator | — | Overall JV coordination (rotates if agreed) |
| **JV Judge** | Judge | Judge | Dispute resolution within JV |
| **JV Treasurer** | Treasurer | — | Budget tracking (or alternating) |
| **JV Diplomat** | Diplomat | Diplomat | Inter-company communication |

The committee meets at the start and end of each JV sprint for alignment.

---

## 3. JV Agreement Template

```yaml
jv_agreement:
  id: JV-{{COMPANY_A}}-{{COMPANY_B}}-{{SEQ}}
  version: 1
  date: "{{ISO-8601}}"

  parties:
    - company: {{COMPANY_A_SLUG}}
      role: "{{Primary role in JV}}"
    - company: {{COMPANY_B_SLUG}}
      role: "{{Primary role in JV}}"

  objective: |
    {{One-paragraph description of what the JV will produce and why
    neither company can do it alone.}}

  scope:
    in_scope:
      - "Deliverable 1"
      - "Deliverable 2"
    out_of_scope:
      - "Explicitly excluded work"

  contributions:
    company_a:
      agents:
        - role: "Engineer Alpha"
          allocation: "50%"     # Percentage of JV sprint time
        - role: "QA Engineer"
          allocation: "100%"
      budget: "$50.00"
      other: "Existing codebase, domain expertise"
    company_b:
      agents:
        - role: "Engineer Alpha"
          allocation: "100%"
        - role: "Delivery Engineer"
          allocation: "100%"
      budget: "$50.00"
      other: "Infrastructure, deployment pipeline"

  ip_ownership:
    default: "joint"            # joint | company_a | company_b | split
    exceptions:
      - asset: "Company A's pre-existing codebase"
        owner: "company_a"
      - asset: "Company B's deployment scripts"
        owner: "company_b"
    derivative_works: "joint"   # New code built on pre-existing assets
    publication_rights: "both"  # Both companies can publish to ClipHub

  dispute_resolution:
    first_recourse: "JV Governance Committee consensus"
    escalation: "Both companies' Judges convene joint tribunal"
    final_authority: "Human Board of the initiating company"

  duration:
    planned_sprints: 8
    estimated_completion: "{{ISO-8601}}"
    extension_protocol: "Mutual agreement, documented as JV Agreement amendment"

  exit_terms:
    voluntary_exit:
      notice_period: "2 sprints"
      obligations: "Complete in-progress work, transfer knowledge"
    dissolution_trigger:
      - "Both parties agree to dissolve"
      - "Objective achieved"
      - "Budget exhausted with no path to completion"
      - "Unresolvable dispute (after escalation)"
    asset_distribution: "Per ip_ownership clause above"
```

---

## 4. JV Execution

### How Agents from Different Companies Coordinate

#### Shared Workspace

JV agents operate in a shared context with clear boundaries:

```
JV-sprint-co-api-forge-001/
├── sprint-plans/          # Joint sprint plans
├── artifacts/             # Shared deliverables
├── handoffs/              # Cross-company handoffs
└── governance/            # JV-specific decisions
```

#### Coordination Rules

| Rule | Description |
|------|-------------|
| **Single Orchestrator** | One Orchestrator leads each JV sprint (may rotate between companies) |
| **Agent Namespacing** | Agents are prefixed: `sprint-co/engineer-alpha`, `api-forge/engineer-alpha` |
| **Handoff Protocol** | Standard handoff artifact format applies — same as intra-company |
| **No Cross-Authority** | Company A's Orchestrator cannot reassign Company B's agents without Diplomat coordination |
| **Shared QA** | Both companies' QA Engineers review — joint eval report required |
| **Budget Tracking** | JV Treasurer logs costs per-company for reconciliation |

#### JV Sprint Flow

```
JV Orchestrator creates joint sprint plan
    ↓
Company A agents receive tasks via Company A's Orchestrator
Company B agents receive tasks via Company B's Orchestrator
    ↓
Work proceeds in parallel (shared artifact repo)
    ↓
Cross-company handoffs use standard handoff format
    ↓
Joint QA evaluation (both QA Engineers)
    ↓
JV Governance Committee reviews at sprint end
    ↓
Artifacts delivered to shared JV workspace
```

#### Conflict Resolution During Execution

| Conflict Type | Resolution |
|--------------|------------|
| Technical disagreement | JV Orchestrator decides; escalate to JV Committee if blocked |
| Priority conflict (agent needed by both parent company and JV) | Parent company Orchestrator + JV Orchestrator negotiate via Diplomats |
| Quality standard mismatch | Apply the stricter standard |
| Budget dispute | JV Treasurer logs, JV Committee reviews at next sync |

---

## 5. JV Dissolution

### When the Project Ends

#### Successful Completion

1. All deliverables accepted by JV Governance Committee
2. Final JV sprint: knowledge transfer and documentation
3. Artifacts distributed per IP ownership agreement
4. JV budget reconciled — final billing between companies
5. JV retrospective (Historians from both companies)
6. JV Agreement marked `status: completed`

#### Voluntary Exit

1. Exiting company provides notice per agreement (default: 2 sprints)
2. Exiting company completes in-progress work
3. Knowledge transfer sprint — exiting company's agents document all WIP
4. Remaining company may continue solo or dissolve the JV
5. Assets distributed per agreement

#### Failure Dissolution

1. JV Governance Committee determines the JV cannot achieve its objective
2. Root cause documented (budget, technical infeasibility, irreconcilable disagreement)
3. Partial deliverables distributed per IP ownership
4. Budget reconciled — each company absorbs its own costs
5. Postmortem by both Historians — lessons learned filed separately in each company

### Knowledge Transfer Protocol

Upon dissolution, each company retains:

| Asset | Owner |
|-------|-------|
| JV sprint plans and artifacts | Both companies (copies) |
| JV governance decisions | Both companies (copies) |
| Pre-existing IP contributed | Original owner |
| Jointly created IP | Per agreement (default: both) |
| Lessons learned | Each company files in own KB |
| Agent performance data from JV | Each company retains own agents' data |

### Post-JV Relationship

After dissolution, the companies may:

- Continue as independent entities with no obligation
- Enter a new JV for a different objective
- Convert the relationship to a Service Contract (see `cross-company-protocols.md`)
- Publish shared assets to ClipHub (if publication rights allow)
