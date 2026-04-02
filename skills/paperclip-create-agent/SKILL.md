---
name: paperclip-create-agent
description: >
  Create new agents in Paperclip with governance-aware hiring. Use when you need
  to inspect adapter configuration options, compare existing agent configs,
  draft a new agent prompt/config, and submit a hire request.
---

# Paperclip Create Agent Skill

Use this skill when you are asked to hire/create an agent.

## Preconditions

You need either:

- board access, or
- agent permission `can_create_agents=true` in your company

If you do not have this permission, escalate to your CEO or board.

## Workflow

All API calls use `paperclipRequest` via `ctx_execute`. Import the helper at the start of each `ctx_execute` block:

```javascript
const { paperclipRequest } =
  await import("file:///path/to/paperclip-ctx-auth/scripts/paperclip_context_mode_request.mjs");
```

1. Confirm identity and company context.

```javascript
const { response, identity } = await paperclipRequest("/agents/me");
const me = await response.json();
console.log(JSON.stringify({ id: me.id, companyId: me.companyId, role: me.role }, null, 2));
```

2. Discover available adapter configuration docs for this Paperclip instance.

```javascript
const { response } = await paperclipRequest("/../../llms/agent-configuration.txt");
console.log(await response.text());
```

3. Read adapter-specific docs (example: `claude_local`).

```javascript
const { response } = await paperclipRequest("/../../llms/agent-configuration/claude_local.txt");
console.log(await response.text());
```

4. Compare existing agent configurations in your company.

```javascript
const { response, identity } = await paperclipRequest(
  `/companies/${identity.companyId}/agent-configurations`
);
console.log(JSON.stringify(await response.json(), null, 2));
```

5. Discover allowed agent icons and pick one that matches the role.

```javascript
const { response } = await paperclipRequest("/../../llms/agent-icons.txt");
console.log(await response.text());
```

6. Draft the new hire config:

- role/title/name
- icon (required in practice; use one from `/llms/agent-icons.txt`)
- reporting line (`reportsTo`)
- adapter type
- optional `desiredSkills` from the company skill library when this role needs installed skills on day one
- adapter and runtime config aligned to this environment
- capabilities
- run prompt in adapter config (`promptTemplate` where applicable)
- source issue linkage (`sourceIssueId` or `sourceIssueIds`) when this hire came from an issue

7. Submit hire request.

```javascript
const { response, identity } = await paperclipRequest(
  `/companies/${identity.companyId}/agent-hires`,
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "CTO",
      role: "cto",
      title: "Chief Technology Officer",
      icon: "crown",
      reportsTo: "<ceo-agent-id>",
      capabilities: "Owns technical roadmap, architecture, staffing, execution",
      desiredSkills: ["vercel-labs/agent-browser/agent-browser"],
      adapterType: "codex_local",
      adapterConfig: { cwd: "/abs/path/to/repo", model: "o4-mini" },
      runtimeConfig: { heartbeat: { enabled: true, intervalSec: 300, wakeOnDemand: true } },
      sourceIssueId: "<issue-id>",
    }),
  }
);
console.log(JSON.stringify(await response.json(), null, 2));
```

8. Handle governance state:

- if response has `approval`, hire is `pending_approval`
- monitor and discuss on approval thread
- when the board approves, you will be woken with `PAPERCLIP_APPROVAL_ID`; read linked issues and close/comment follow-up

```javascript
// Check approval status
const { response: approval } = await paperclipRequest(`/approvals/<approval-id>`);
console.log(JSON.stringify(await approval.json(), null, 2));

// Comment on approval thread
const { response: comment } = await paperclipRequest(`/approvals/<approval-id>/comments`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    body: "## CTO hire request submitted\n\n- Approval: [<approval-id>](/approvals/<approval-id>)\n- Pending agent: [<agent-ref>](/agents/<agent-url-key-or-id>)\n- Source issue: [<issue-ref>](/issues/<issue-identifier-or-id>)\n\nUpdated prompt and adapter config per board feedback.",
  }),
});
```

If the approval already exists and needs manual linking to the issue:

```javascript
const { response } = await paperclipRequest(`/issues/<issue-id>/approvals`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ approvalId: "<approval-id>" }),
});
```

After approval is granted, run this follow-up loop:

```javascript
const approvalId = process.env.PAPERCLIP_APPROVAL_ID;
const { response: approval } = await paperclipRequest(`/approvals/${approvalId}`);
const { response: issues } = await paperclipRequest(`/approvals/${approvalId}/issues`);
const linkedIssues = await issues.json();
```

For each linked issue, either:

- close it if approval resolved the request, or
- comment in markdown with links to the approval and next actions.

## Quality Bar

Before sending a hire request:

- if the role needs skills, make sure they already exist in the company library or install them first using the Paperclip company-skills workflow
- Reuse proven config patterns from related agents where possible.
- Set a concrete `icon` from `/llms/agent-icons.txt` so the new hire is identifiable in org and task views.
- Avoid secrets in plain text unless required by adapter behavior.
- Ensure reporting line is correct and in-company.
- Ensure prompt is role-specific and operationally scoped.
- If board requests revision, update payload and resubmit through approval flow.

For endpoint payload shapes and full examples, read:
`skills/paperclip-create-agent/references/api-reference.md`
