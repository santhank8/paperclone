---
title: "feat: Adapter-level approval interception via context injection"
type: feat
date: 2026-03-09
brainstorm: docs/brainstorms/2026-03-09-adapter-approval-interception-brainstorm.md
builds_on: docs/plans/2026-03-09-feat-general-action-approvals-plan.md
---

# feat: Adapter-level approval interception via context injection

## Overview

Inject approval policy into every agent's execution context so agents automatically know which actions require approval — zero code changes per agent, just config. Users configure `approvalRequiredActions` (freeform string array) in the agent's `adapterConfig`. At run start, `executeRun()` builds an `approvalPolicy` object with structured JSON + human-readable instructions and injects it into the context. Agents read the policy and use the existing approval API.

Also: enrich the wakeup context to include the redacted approval payload + decisionNote so agents don't need an extra API call after being woken, and fix an existing gap where reject/revision wakeups lack linked issue IDs.

## Problem Statement

~100 agents across multiple businesses call external services directly (MCP, CLI, SSH, APIs). Paperclip can't intercept those calls at the platform level. Requiring each agent to manually code approval logic doesn't scale. The approval infrastructure is built (from the general action approvals feature), but agents have no way to discover their approval policy without hardcoding it.

## Proposed Solution

1. Store `approvalRequiredActions: string[]` in the agent's `adapterConfig` (no migration — already freeform JSONB)
2. In `executeRun()`, build and inject `context.approvalPolicy` with both structured data and LLM-readable instructions
3. All local adapters propagate the policy to agents (env vars for claude-local and siblings, wake text for openclaw-gateway)
4. Enrich approval wakeup context with redacted payload + decisionNote + linked issue IDs (all decision types)
5. Add "Approval Policy" section to the agent config form

## Technical Approach

### Phase 1: Context Injection in `executeRun()`

#### 1a. Build approval policy object (`server/src/services/heartbeat.ts:~1136`)

After workspace enrichment (line 1136) and before adapter execution (line 1286), build the approval policy. Read from `agent.adapterConfig` directly (not the `config` variable, which isn't defined until line 1248, and not the merged config which could be overridden by issue-level settings):

```ts
// After context.paperclipWorkspaces enrichment (line 1136):

const rawAdapterConfig = parseObject(agent.adapterConfig);
const approvalRequiredActions = parseUniqueStringArray(rawAdapterConfig.approvalRequiredActions);
if (approvalRequiredActions.length > 0) {
  const actionList = approvalRequiredActions.map((a) => `- ${a}`).join("\n");
  context.approvalPolicy = {
    requiredActions: approvalRequiredActions,
    approvalEndpoint: `/api/companies/${agent.companyId}/approvals`,
    agentId: agent.id,
    companyId: agent.companyId,
    autoApproveIfTrusted: true,
    instructions: [
      `Before performing any of the following actions, you MUST create an approval request and wait for it to be resolved:`,
      actionList,
      ``,
      `To request approval:`,
      `1. POST to /api/companies/${agent.companyId}/approvals with:`,
      `   { "type": "action", "requestedByAgentId": "${agent.id}", "autoApproveIfTrusted": true, "payload": { "title": "<action name>", "description": "<what you intend to do>", ... } }`,
      `2. If the response status is "approved", proceed with the action.`,
      `3. If the response status is "pending", STOP your current run. You will be woken up when the approval is decided.`,
      `4. If you are woken with reason "approval_rejected" or "approval_revision_requested", read the decisionNote and adjust your approach.`,
      `5. If the approval request fails (non-2xx response), do NOT proceed with the action. Report the error and stop.`,
      `6. If you need multiple gated actions in sequence, request approval for each one separately. After being woken for one approval, continue your task and request the next as needed.`,
    ].join("\n"),
  };
}
```

**Why `agent.adapterConfig` instead of `config` or `mergedConfig`:**
- `config` (line 1248) isn't defined yet at the injection point
- `mergedConfig` (line 1249) includes issue-level `assigneeAdapterOverrides` — an issue-level override could silently disable approval gates by setting `approvalRequiredActions: []`, which undermines the security purpose
- Reading directly from `agent.adapterConfig` ensures the approval policy is always the agent-level policy, immune to issue-level overrides

**Helper function** — add to the module-level utility functions:

```ts
function parseUniqueStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const filtered = value.filter(
    (v): v is string => typeof v === "string" && v.trim().length > 0,
  );
  return Array.from(new Set(filtered));
}
```

#### 1b. Key behaviors

- Empty `approvalRequiredActions` (or absent) → no `approvalPolicy` injected, agent runs normally
- Policy is injected on every run, not just wakeups — agent always has its policy available
- `autoApproveIfTrusted: true` is set by default in the policy so agents opt into auto-approval; the company toggle and trust level still gate whether it actually resolves
- Duplicate action names are deduplicated via `Set`
- Issue-level `assigneeAdapterOverrides` cannot override the approval policy

### Phase 2: Adapter Propagation

#### 2a. All local adapters — env var injection

The following adapters all share the same env-var injection pattern for `PAPERCLIP_APPROVAL_ID` and `PAPERCLIP_APPROVAL_STATUS`. Add the same approval policy + decision env vars to each:

| Adapter | File |
|---------|------|
| `claude-local` | `packages/adapters/claude-local/src/server/execute.ts:~176` |
| `codex-local` | `packages/adapters/codex-local/src/server/execute.ts` |
| `cursor-local` | `packages/adapters/cursor-local/src/server/execute.ts` |
| `opencode-local` | `packages/adapters/opencode-local/src/server/execute.ts` |
| `pi-local` | `packages/adapters/pi-local/src/server/execute.ts` |

After the existing approval env vars, add in each adapter:

```ts
// Approval policy (injected on every run when configured)
const approvalPolicy = context.approvalPolicy;
if (approvalPolicy && typeof approvalPolicy === "object") {
  env.PAPERCLIP_APPROVAL_POLICY = JSON.stringify(approvalPolicy);
  const policy = approvalPolicy as Record<string, unknown>;
  if (typeof policy.instructions === "string") {
    env.PAPERCLIP_APPROVAL_POLICY_INSTRUCTIONS = policy.instructions;
  }
}

// Approval decision context (present on wakeup from approval decision)
if (typeof context.approvalDecisionNote === "string" && context.approvalDecisionNote.trim().length > 0) {
  env.PAPERCLIP_APPROVAL_DECISION_NOTE = context.approvalDecisionNote.trim();
}
if (context.approvalPayload && typeof context.approvalPayload === "object") {
  env.PAPERCLIP_APPROVAL_PAYLOAD = JSON.stringify(context.approvalPayload);
}
```

Agents using these adapters read `PAPERCLIP_APPROVAL_POLICY` and `PAPERCLIP_APPROVAL_POLICY_INSTRUCTIONS` from their environment. Their AGENTS.md or prompt template can reference it:

```handlebars
{{#if env.PAPERCLIP_APPROVAL_POLICY_INSTRUCTIONS}}
## Approval Policy
{{{ env.PAPERCLIP_APPROVAL_POLICY_INSTRUCTIONS }}}
{{/if}}
```

#### 2b. OpenClaw gateway adapter (`packages/adapters/openclaw-gateway/src/server/execute.ts`)

The gateway's `buildWakeText()` takes `(payload: WakePayload, paperclipEnv)` — it does NOT have access to `context`. Handle the injection at the call site (~line 914-926) where the message is composed, appending after the `buildWakeText()` result:

```ts
// At the call site where message is composed (~line 914-926):
let wakeText = buildWakeText(wakePayload, paperclipEnv);

// Append approval policy if present
const approvalPolicy = context.approvalPolicy;
if (approvalPolicy && typeof approvalPolicy === "object") {
  const policy = approvalPolicy as Record<string, unknown>;
  wakeText += `\nPAPERCLIP_APPROVAL_POLICY=${JSON.stringify(policy)}`;
  if (typeof policy.instructions === "string") {
    wakeText += `\n\n## Approval Policy\n${policy.instructions}`;
  }
}

// Append approval decision context if present (wakeup from approval decision)
if (typeof context.approvalDecisionNote === "string" && context.approvalDecisionNote.trim().length > 0) {
  wakeText += `\nPAPERCLIP_APPROVAL_DECISION_NOTE=${context.approvalDecisionNote.trim()}`;
}
if (context.approvalPayload && typeof context.approvalPayload === "object") {
  wakeText += `\nPAPERCLIP_APPROVAL_PAYLOAD=${JSON.stringify(context.approvalPayload)}`;
}
```

### Phase 3: Enriched Wakeup Context

#### 3a. Include redacted approval payload + decisionNote in wakeup (`server/src/routes/approvals.ts`)

In the approve handler (line 157), add `approvalPayload` (redacted) and `approvalDecisionNote` to the contextSnapshot:

```ts
contextSnapshot: {
  source: "approval.approved",
  approvalId: approval.id,
  approvalStatus: approval.status,
  approvalPayload: redactEventPayload(approval.payload),  // NEW — redacted to avoid leaking secrets
  approvalDecisionNote: approval.decisionNote,             // NEW
  issueId: primaryIssueId,
  issueIds: linkedIssueIds,
  taskId: primaryIssueId,
  wakeReason: "approval_approved",
},
```

**Redaction:** Use the existing `redactEventPayload()` from `server/src/redaction.ts` (same function used by `redactApprovalPayload()` in the HTTP response path). This prevents sensitive data in approval payloads from leaking into run context storage, activity logs, or live events.

#### 3b. Fix reject + revision wakeups: add linked issue IDs + decision context

**Existing gap:** The reject handler (line ~236) and revision-request handler (line ~288) do NOT include `issueId`, `issueIds`, or `taskId` in their wakeup contextSnapshot, unlike the approve handler. This means agents woken after rejection have no way to know which issue the approval was linked to.

For both handlers, add the linked issue lookup (same pattern as the approve handler's `getLinkedIssueIds`):

```ts
// In reject handler, before the wakeup call:
const linkedIssueIds = await getLinkedIssueIds(approval.id);
const primaryIssueId = linkedIssueIds[0] ?? null;

// In the wakeup contextSnapshot:
contextSnapshot: {
  source: "approval.rejected",
  approvalId: approval.id,
  approvalStatus: approval.status,
  approvalPayload: redactEventPayload(approval.payload),    // NEW
  approvalDecisionNote: approval.decisionNote,               // NEW
  issueId: primaryIssueId,                                   // FIX — was missing
  issueIds: linkedIssueIds,                                  // FIX — was missing
  taskId: primaryIssueId,                                    // FIX — was missing
  wakeReason: "approval_rejected",
},
```

Same pattern for the revision-requested handler, with `source: "approval.revision_requested"` and `wakeReason: "approval_revision_requested"`.

**Helper:** If `getLinkedIssueIds` is not already extracted as a helper in the approve handler, extract the linked-issue query into a shared function at the top of the routes file:

```ts
async function getLinkedIssueIds(approvalId: string): Promise<string[]> {
  const rows = await db
    .select({ issueId: issueApprovals.issueId })
    .from(issueApprovals)
    .where(eq(issueApprovals.approvalId, approvalId));
  return rows.map((r) => r.issueId);
}
```

### Phase 4: Agent Config UI

#### 4a. Approval Policy section (`ui/src/components/AgentConfigForm.tsx:~773`)

Add a new section between "Permissions & Configuration" (ends ~line 773) and "Run Policy" (starts ~line 776). Follow the existing section pattern:

```tsx
{/* ---- Approval Policy ---- */}
{!isCreate && (
  <div className={cn(!cards && "border-b border-border")}>
    {cards
      ? <h3 className="text-sm font-medium flex items-center gap-2 mb-3">
          <ShieldCheck className="h-3 w-3" /> Approval Policy
        </h3>
      : <div className="px-4 py-2 text-xs font-medium text-muted-foreground flex items-center gap-2">
          <ShieldCheck className="h-3 w-3" /> Approval Policy
        </div>
    }
    <div className={cn(cards ? "border border-border rounded-lg p-4 space-y-3" : "px-4 pb-3 space-y-3")}>
      <Field
        label="Actions requiring approval"
        hint="Comma-separated action names that require approval before the agent can proceed (e.g. publish, send_email, delete_data). Leave empty to disable."
      >
        <DraftInput
          value={eff("adapterConfig", "approvalRequiredActions",
            formatArgList(config.approvalRequiredActions))}
          onCommit={(v) =>
            mark("adapterConfig", "approvalRequiredActions",
              v ? parseCommaArgs(v) : undefined)
          }
          immediate
          className={inputClass}
          placeholder="e.g. publish, send_email, delete_data"
        />
      </Field>
    </div>
  </div>
)}
```

This reuses the existing `DraftInput`, `parseCommaArgs`, and `formatArgList` helpers already used for "Extra args" (line 704-720). `ShieldCheck` from lucide-react matches the approval theme.

**Edit-mode only** (`!isCreate`): approval policy is a tuning concern, not needed during agent creation. New agents start with an empty policy.

## Acceptance Criteria

### Functional Requirements

- [x] `adapterConfig.approvalRequiredActions` accepts freeform string array via agent config UI
- [x] `context.approvalPolicy` is injected on every run when `approvalRequiredActions` is non-empty
- [x] Policy includes both structured JSON and human-readable instructions
- [x] Empty or absent `approvalRequiredActions` → no policy injected, agent runs normally
- [x] Duplicate action names are deduplicated
- [x] All local adapters (claude-local, codex-local, cursor-local, opencode-local, pi-local) expose `PAPERCLIP_APPROVAL_POLICY` (JSON) and `PAPERCLIP_APPROVAL_POLICY_INSTRUCTIONS` (text) env vars
- [x] OpenClaw gateway includes approval policy in wake text
- [x] Wakeup context includes redacted `approvalPayload` and `approvalDecisionNote` for all decision types (approve, reject, revision)
- [x] Wakeup context includes `issueId`, `issueIds`, `taskId` for reject and revision (fix existing gap)
- [x] All local adapters expose `PAPERCLIP_APPROVAL_DECISION_NOTE` and `PAPERCLIP_APPROVAL_PAYLOAD` env vars on wakeup
- [x] Agent config form shows "Approval Policy" section with comma-separated input (edit mode only)
- [x] Existing approval flows (hire_agent, approve_ceo_strategy) are unaffected (wakeup enrichment is additive — new fields only)
- [x] Issue-level `assigneeAdapterOverrides` cannot override the approval policy
- [x] Instructions include error handling guidance and multi-action sequence guidance

### Non-Functional Requirements

- [x] No database migration needed (adapterConfig is freeform JSONB)
- [x] No new API endpoints needed (uses existing approval API)
- [x] Policy injection adds negligible overhead to `executeRun()`
- [x] Approval payloads in wakeup context are redacted via `redactEventPayload()`

## Files to Modify

| File | Change |
|------|--------|
| `server/src/services/heartbeat.ts` | Add `parseUniqueStringArray` helper; inject `context.approvalPolicy` in `executeRun()` (~line 1136) |
| `server/src/routes/approvals.ts` | Add `approvalPayload` (redacted) + `approvalDecisionNote` + linked issue IDs to wakeup contextSnapshot (all 3 decision handlers); extract `getLinkedIssueIds` helper |
| `packages/adapters/claude-local/src/server/execute.ts` | Propagate approval policy + decision context as env vars |
| `packages/adapters/codex-local/src/server/execute.ts` | Same env var propagation |
| `packages/adapters/cursor-local/src/server/execute.ts` | Same env var propagation |
| `packages/adapters/opencode-local/src/server/execute.ts` | Same env var propagation |
| `packages/adapters/pi-local/src/server/execute.ts` | Same env var propagation |
| `packages/adapters/openclaw-gateway/src/server/execute.ts` | Append approval policy + decision context to wake text at call site |
| `ui/src/components/AgentConfigForm.tsx` | Add "Approval Policy" section (~line 773) |

**No new files.** No migration. No new shared types or constants.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Action name format | Freeform strings, deduplicated | Maximum flexibility; no taxonomy to maintain |
| Config source | `agent.adapterConfig` directly (not merged config) | Immune to issue-level override interference — approval policy is always agent-level |
| Injection point | `context.approvalPolicy` at ~line 1136 | Same mechanism as workspace context; available to all adapters; before config merge |
| Instructions format | Structured JSON + human-readable text | Belt and suspenders — code agents parse JSON, LLM agents read text |
| Wakeup enrichment | Redacted payload + decisionNote | Agent doesn't need extra API call; redaction prevents secret leakage |
| Reject/revision wakeup | Add linked issue IDs (fix existing gap) | Agents need issue context regardless of approval outcome |
| Adapter coverage | All 5 local adapters + openclaw-gateway | Silent failure if policy injected but adapter doesn't propagate it |
| UI section | Dedicated "Approval Policy", edit-mode only | Clear separation; new agents start with no policy |
| Default `autoApproveIfTrusted` in policy | `true` | Agents opt in by default; company toggle + trust level still gate actual resolution |
| Enforcement model | Context injection, no platform-level enforcement | Agents are trusted to follow policy; platform can't intercept external API calls |

## Dependencies

- **Requires:** General action approvals feature (already implemented on `feat/general-action-approvals`)
- **No external dependencies**

## References

- Brainstorm: `docs/brainstorms/2026-03-09-adapter-approval-interception-brainstorm.md`
- Foundation plan: `docs/plans/2026-03-09-feat-general-action-approvals-plan.md`
- Context injection point: `server/src/services/heartbeat.ts:1128-1139`
- Existing approval wakeup: `server/src/routes/approvals.ts:143-204`
- Claude-local env injection: `packages/adapters/claude-local/src/server/execute.ts:130-185`
- Agent config form: `ui/src/components/AgentConfigForm.tsx:560-773`
- Redaction utility: `server/src/redaction.ts`
