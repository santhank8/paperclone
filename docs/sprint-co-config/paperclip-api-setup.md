# Paperclip API Setup Notes
Generated: 2026-03-30

## Server
- URL: http://127.0.0.1:3100
- Dashboard: http://127.0.0.1:3100/JER/dashboard
- No auth required (local_implicit mode)

---

## Companies

### JeremySarda.com (existing)
- **ID**: `22266d4d-5326-4501-ad12-f181b4330d95`
- **Issue Prefix**: JER

### Sprint Co (created)
- **ID**: `6319e2ce-0011-4ebf-8438-75ab95d831d6`
- **Issue Prefix**: SPR
- **Budget**: $50/month (5000000 cents)
- **Dashboard**: http://127.0.0.1:3100/SPR/dashboard

---

## Sprint Co Agents

| Name | ID | Role | Adapter |
|------|----|------|---------|
| Sprint Orchestrator | `a5a3d758-4bb9-4a73-9d86-6e901c190126` | ceo | claude_local |
| Product Planner | `50502ee0-ce45-465e-aeb5-2c3d90808d5b` | pm | claude_local |
| Sprint Lead | `ef2f10b2-47cc-4c06-b1c8-08286e801179` | cto | claude_local |
| Engineer Alpha | `2022f764-cc8d-4b70-bb84-a223825a7679` | engineer | claude_local |
| Engineer Beta | `26f821f9-2806-44c4-bf9d-d2116a094735` | engineer | claude_local |
| QA Engineer | `d238f336-0e0c-4bde-b3be-2db3efa600af` | qa | claude_local |
| Delivery Engineer | `f8edf974-bb00-4f75-b8d5-39b495e24378` | devops | claude_local |

**Note**: Role names `product` and `engineering_lead` are not valid in the Paperclip schema.
Mapped to: `pm` (Product Planner) and `cto` (Sprint Lead).

All agents use `adapterConfig: { model: "anthropic/claude-haiku-4-5" }`.
systemPrompt stored in `metadata.systemPrompt` field.

---

## Sprint Co Projects

| Name | ID | Status |
|------|----|--------|
| Sprint 001 — First Autonomous Sprint | `8e3ed2cc-88d4-4275-9725-2195643804e6` | backlog |

---

## Paused Agents in JeremySarda.com

| Name | ID | Status |
|------|----|--------|
| Flash-MoE 397B | `69f00596-f3f9-444d-b60e-a6f1210c1526` | paused |
| LM Studio Qwen (native) | `abade644-bc33-4db7-8b06-1ec2f468a3ca` | paused |

---

## API Endpoints Used

```bash
# List companies
GET /api/companies

# Create company
POST /api/companies
{ name, description, budgetMonthlyCents }

# List agents
GET /api/companies/:companyId/agents

# Create agent
POST /api/companies/:companyId/agents
{ name, role, title, capabilities, adapterType, adapterConfig, runtimeConfig, budgetMonthlyCents, metadata }

# Update agent
PATCH /api/agents/:agentId
{ status: "paused" | "idle" | ... }

# Create project
POST /api/companies/:companyId/projects
{ name, description, status }
```

## Valid Agent Roles
`ceo`, `cto`, `cmo`, `cfo`, `engineer`, `designer`, `pm`, `qa`, `devops`, `researcher`, `general`

## Valid Adapter Types
`process`, `http`, `claude_local`, `codex_local`, `opencode_local`, `openclaw_gateway`

## Notes
- No authentication needed for local server (uses local_implicit actor mode)
- `requireBoardApprovalForNewAgents` defaults to true on new companies — no effect on API creation
- systemPrompt is not a top-level field; store in `metadata.systemPrompt` or use the instructions file API
- To set system prompt properly via file: PATCH /api/agents/:id/instructions with file content
