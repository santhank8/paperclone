# Paperclip Agent Skills

This directory contains specialized agent skills for common Paperclip use cases. Each agent skill provides structured workflows, prompts, and API interaction patterns for specific operational domains.

## Available Agents

| Agent | Directory | Description |
| ----- | --------- | ----------- |
| Company Setup | `company-setup/` | Bootstraps new AI companies with org structures, budgets, and agent configurations |
| Task Manager | `task-manager/` | Manages task lifecycles including creation, delegation, tracking, and completion |
| Cost Analyst | `cost-analyst/` | Monitors and analyzes company spending, agent costs, and budget utilization |
| Agent Ops | `agent-ops/` | Handles agent lifecycle operations including hiring, configuration, monitoring, and troubleshooting |
| Cloud Ops | `cloud-ops/` | Manages cloud infrastructure: IaC changes, CI/CD deployments, incident triage, cost analysis, and security compliance |
| SRE Runbook | `sre-runbook/` | Executes SRE incident runbooks: SLO assessment, incident response by severity, PIR authoring, and error budget tracking |

## How Agent Skills Work

Each agent skill follows the same structure:

```
agent-name/
├── SKILL.md          # Skill definition with workflow steps and API patterns
└── references/       # Supporting documentation and templates (if needed)
```

### SKILL.md Format

Every skill file includes:

1. **Frontmatter** — name and description metadata
2. **Preconditions** — what access/permissions are required
3. **Workflow** — step-by-step instructions with API examples
4. **Quality Bar** — validation checklist before completing work

## Usage

These skills are designed to be used by AI agents running within Paperclip, or by operators interacting with the Paperclip API. They can be:

- **Installed as agent skills** via the company skill library
- **Referenced as runbooks** for manual operations
- **Used as prompt templates** for agent configuration

### Installing a Skill

Skills can be referenced by agents through the company skill library:

```bash
curl -X POST "$PAPERCLIP_API_URL/api/companies/$COMPANY_ID/skills" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"source": "local", "path": "agents/company-setup"}'
```

## Relationship to `/skills`

The root-level `/skills` directory contains core Paperclip platform skills (API interaction, agent creation, plugin creation). This `/agents` directory contains higher-level, use-case-oriented skills that build on those foundations.

## Contributing

When adding a new agent skill:

1. Create a new directory under `agents/`
2. Add a `SKILL.md` following the frontmatter format
3. Include complete API examples with `curl` commands
4. Add a quality bar section with validation steps
5. Update this README with the new agent entry
