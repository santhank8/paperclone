# Company Template Export

## Purpose

Define how Sprint Co can be exported as a reusable `agentcompanies/v1` template — allowing others to launch their own autonomous software companies based on proven structure, governance, and agent configurations.

---

## What Gets Exported

All structural and governance documents are exported with company-specific identifiers replaced by `{{COMPANY_NAME}}` / `{{COMPANY_SLUG}}` placeholders.

| Category | Files | Notes |
|----------|-------|-------|
| **Company Definition** | `COMPANY.md` | Mission, methodology, phase breakdown — all with placeholders |
| **Agent Definitions** | All `agents/*/AGENTS.md` | Role, model tier, budget, system prompt templates |
| **Team Definitions** | All `teams/*.md` | Team composition, coordination protocols |
| **Governance** | `governance/constitution.md`, `governance/voting-protocol.md`, `governance/dissent-protocol.md`, `governance/escalation-matrix.md`, `governance/trust-levels.md` | Full governance framework |
| **Artifact Templates** | `artifacts/*.md` (blank templates only) | Sprint plan, eval report, handoff templates |
| **Integration Specs** | `integrations/*.md` | API integration, signaling protocol, issue threading |
| **Analytics Templates** | `analytics/*.md` (with cleared data) | Dashboard structures, tracking tables — zeroed out |
| **Operations** | `operations/*.md` | Sprint types, incident response, OKR templates |
| **Ecosystem** | `ecosystem/*.md` | Cross-company protocols, forking guide |

### What Doesn't Get Exported

| Category | Reason |
|----------|--------|
| **Case Law / Precedent** | Company-specific judicial decisions — not transferable |
| **Lessons Learned KB** | Earned through actual sprints — would be misleading if copied |
| **Sprint Data** | Historical sprint plans, eval reports, costs — company-specific |
| **Agent Reputation/Trust Scores** | Earned, not inherited |
| **Board Minutes** | Specific to the originating company's governance |
| **Budget Actuals** | Historical spend data is company-specific |

---

## Export Format

The exported template follows the `agentcompanies/v1` package structure:

```
{{COMPANY_SLUG}}/
├── COMPANY.md                    # schema: agentcompanies/v1, kind: company
├── README.md                     # Getting started guide
├── agents/
│   ├── orchestrator/AGENTS.md    # schema: agentcompanies/v1, kind: agent
│   ├── product-planner/AGENTS.md
│   ├── sprint-lead/AGENTS.md
│   ├── engineer-alpha/AGENTS.md
│   ├── engineer-beta/AGENTS.md
│   ├── qa-engineer/AGENTS.md
│   ├── critic/AGENTS.md
│   ├── delivery-engineer/AGENTS.md
│   ├── treasurer/AGENTS.md
│   ├── historian/AGENTS.md
│   ├── scout/AGENTS.md
│   ├── stakeholder/AGENTS.md
│   ├── judge/AGENTS.md
│   ├── diplomat/AGENTS.md
│   └── security-auditor/AGENTS.md
├── teams/
│   ├── execution-team.md
│   ├── quality-team.md
│   ├── leadership-team.md
│   └── support-team.md
├── governance/
│   ├── constitution.md
│   ├── voting-protocol.md
│   ├── dissent-protocol.md
│   ├── escalation-matrix.md
│   └── trust-levels.md
├── artifacts/
│   ├── sprint-plan-template.md
│   ├── eval-report-template.md
│   └── handoff-template.md
├── operations/
│   ├── sprint-types.md
│   ├── incident-response.md
│   ├── okr-tracking.md
│   └── company-roadmap-template.md
└── integrations/
    ├── paperclip-api-integration.md
    └── signaling-protocol.md
```

---

## Template Customization Points

| Element | Can Change | Should Change | Must Remain |
|---------|-----------|---------------|-------------|
| Company name & slug | ✅ | ✅ Required | — |
| Company mission statement | ✅ | ✅ Recommended | — |
| Number of agents | ✅ | Optional | Minimum: Orchestrator + 1 Engineer + QA |
| Agent model tiers | ✅ | ✅ Per budget | — |
| Sprint duration | ✅ | Optional | — |
| Budget caps | ✅ | ✅ Per economics | — |
| Governance structure | ✅ Limited | — | Constitution must exist |
| Quality gate thresholds | ✅ | Optional | Must have QA gate |
| Phase breakdown | ✅ | Optional | Must have Plan → Build → Eval loop |
| `agentcompanies/v1` schema | — | — | ✅ Required for compatibility |
| Handoff artifact format | — | — | ✅ Required for agent coordination |
| Trust level framework | ✅ Thresholds | Optional | ✅ Framework must exist |
| Dissent protocol | ✅ Thresholds | Optional | ✅ Must have a dissent mechanism |

---

## Export Checklist

- [ ] All `{{COMPANY_NAME}}` and `{{COMPANY_SLUG}}` placeholders verified
- [ ] No company-specific sprint data in exported files
- [ ] No hardcoded budget amounts (replaced with `[$N.NN]` placeholders)
- [ ] No agent reputation/trust scores (reset to defaults)
- [ ] Case law and lessons-learned files excluded
- [ ] Board minutes files excluded
- [ ] All `schema: agentcompanies/v1` frontmatter present and valid
- [ ] README.md includes setup instructions for new company
- [ ] Package validates against `agentcompanies/v1` schema
- [ ] Template tested: fresh import → first sprint runs without errors

---

## Versioning

Templates follow **CalVer** aligned with the Paperclip release cadence:

```
v{YYYY}.{M}{DD}.{PATCH}
```

| Version Component | Meaning |
|-------------------|---------|
| `YYYY` | Year |
| `MDD` | Month + zero-padded day |
| `PATCH` | Incremental patch within the same day |

### Version Bumping Rules

| Change | Bump |
|--------|------|
| New agent added to template | New CalVer date release |
| Governance protocol updated | New CalVer date release |
| Bug fix in template placeholder | Patch increment |
| Schema version change (`agentcompanies/v2`) | Major template revision — new lineage |

### Template Changelog

Each template release includes a `CHANGELOG.md` at the root:

```markdown
## v2026.401.0

- Initial Sprint Co template export
- 15-agent configuration
- Full governance framework
- 6 sprint types
- OKR and roadmap templates
```
