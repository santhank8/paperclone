---
title: Adapter-Level Approval Interception
type: feat
date: 2026-03-09
builds_on: 2026-03-09-general-action-approvals-brainstorm.md
---

# Adapter-Level Approval Interception

## What We're Building

Config-driven approval checkpoints that agents follow automatically, without rewriting individual agent code. The platform injects approval rules into the agent's execution context via `adapterConfig`. Agents see both structured JSON (for code agents) and human-readable instructions (for LLM agents) describing which actions require approval.

**The flow:**

1. Agent config defines `approvalRequiredActions` in `adapterConfig` (e.g., `["publish", "send_email", "delete"]`)
2. Platform injects approval policy into `AdapterExecutionContext.context` at run start
3. Agent encounters a gated action during execution
4. Agent creates an approval via `POST /api/companies/:companyId/approvals` with the action payload
5. If autonomous + `autoApproveIfTrusted` + company allows it → auto-approved, agent continues
6. If not → approval returns `pending`, agent exits run gracefully
7. Human approves/rejects via UI
8. Platform wakes agent with approval result in wakeup context
9. Agent resumes in new run, sees the decision, and continues or adjusts

## Why This Approach

### Problem

~100 agents across multiple businesses. Agents call external services directly (MCP, CLI, SSH, APIs). Paperclip can't intercept those calls at the platform level. Requiring each agent to manually code approval logic doesn't scale.

### Solution: Context Injection

The platform already passes an `AdapterExecutionContext` to every adapter on every run. By injecting approval rules into this context, agents receive their approval policy as part of their normal execution context — no code changes, just config.

- **LLM agents** read the human-readable instructions and follow them naturally
- **Code agents** parse the structured JSON and use the Paperclip API
- **Both** use the same approval API and wakeup mechanism already built

### Why not platform-level interception?

Agents call external services directly (SendGrid, Slack, SSH, etc.). Paperclip never sees these calls, so it can't intercept them. The agent must participate — the question was how to make participation zero-effort. Context injection makes it config-driven.

### Why not an MCP approval proxy?

Good future evolution (Paperclip as an MCP server with a `request_approval` tool), but requires agents to connect to Paperclip's MCP server. Context injection works with any agent architecture today.

## Key Decisions

1. **Config location:** `adapterConfig.approvalRequiredActions` array on the agent. Already per-agent, adapter-aware, and editable via the UI's agent config form.

2. **Injected context format:** Both structured JSON and human-readable instructions. Belt and suspenders — LLM agents read the text, code agents parse the JSON.

3. **Wait strategy:** Exit and wake. Agent creates approval, exits run gracefully. Platform wakes agent when approval is decided (infrastructure already exists from the general action approvals work). No polling, no wasted compute.

4. **Builds on existing infrastructure:**
   - `action` approval type (already implemented)
   - `autoApproveIfTrusted` per-request flag (already implemented)
   - Trust-based auto-approval (already implemented on fork)
   - Company-wide `requireHumanApprovalForAllActions` toggle (already implemented)
   - Agent wakeup on approval decisions (already implemented)

## Injected Context Shape

```json
{
  "approvalPolicy": {
    "requiredActions": ["publish", "send_email", "delete_data"],
    "approvalEndpoint": "/api/companies/{companyId}/approvals",
    "agentId": "{agentId}",
    "companyId": "{companyId}",
    "autoApproveIfTrusted": true,
    "instructions": "Before performing any of the following actions, you MUST create an approval request and wait for it to be resolved:\n- publish\n- send_email\n- delete_data\n\nTo request approval:\n1. POST to /api/companies/{companyId}/approvals with:\n   { \"type\": \"action\", \"requestedByAgentId\": \"{agentId}\", \"autoApproveIfTrusted\": true, \"payload\": { \"title\": \"<action name>\", ... } }\n2. If the response status is \"approved\", proceed.\n3. If the response status is \"pending\", stop your current run. You will be woken up when the approval is decided.\n4. If you are woken with reason \"approval_rejected\" or \"approval_revision_requested\", adjust your approach accordingly."
  }
}
```

## What's Already Built vs What's New

| Component | Status |
|---|---|
| `action` approval type | Done |
| `autoApproveIfTrusted` flag | Done |
| Trust-based auto-approval logic | Done (fork) |
| Company toggle `requireHumanApprovalForAllActions` | Done |
| Agent wakeup on approve/reject/revision | Done |
| Generic payload renderer in UI | Done |
| Auto-approved badge in UI | Done |
| **`approvalRequiredActions` in adapterConfig** | **New** |
| **Context injection in executeRun()** | **New** |
| **UI for configuring approval actions** | **New** |
| **Wakeup context includes approval result** | **Partially done** (wakeup fires, needs approval details in context) |

## Open Questions

1. **Action name taxonomy:** Should we define a standard set of action names (publish, send_email, delete, etc.) or let users define arbitrary strings? Arbitrary is more flexible but less consistent.

2. **Default policy for new agents:** Should new agents start with an empty `approvalRequiredActions` (no gates) or with a sensible default set? Empty is safer from an adoption standpoint.

3. **UI for configuring actions:** Where in the agent config form should this appear? A dedicated "Approval Policy" section or inline with existing adapter config?

4. **Approval context on wakeup:** The wakeup payload already includes `approvalId` and `approvalStatus`. Should it also include the full approval payload so the agent can see what was approved/rejected without an extra API call?
