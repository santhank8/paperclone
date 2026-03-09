# General Action Approvals — Brainstorm

**Date:** 2026-03-09
**Status:** Ready for planning
**Branch context:** `feat/notification-channels` (notification channels backend in progress)

## What We're Building

Expand the approval system so agents can request human approval for **any action** — not just hiring other agents. An agent wanting to send an email, publish a post, or execute a strategy creates an `action` approval. If the agent is trusted and opts in, the approval auto-resolves. Otherwise, the human reviews it.

This makes the existing trust infrastructure (auto-promote after consistent success, auto-demote after failures) useful day-to-day instead of gating only `hire_agent`.

## Why This Approach

The approval system already has the right bones: state machine with revision loops, JSONB payload, comments, issue linking, notification events. The trust system already evaluates agent reliability. They just aren't wired together broadly enough.

Adding a single `action` type to the enum — rather than opening up arbitrary strings or adding many specific types — keeps the type system meaningful. Existing types (`hire_agent`, `approve_ceo_strategy`) retain their special side-effect handlers. The new `action` type has no built-in side-effects beyond notifying the requester, which is correct for a general-purpose gate.

## Key Decisions

### 1. Trust-based auto-approval: agent decides urgency
- Each approval request includes `autoApproveIfTrusted: boolean`
- The agent opts in to auto-approval per-request — it knows its own action context
- System checks: agent is `autonomous` AND company doesn't force human review AND flag is `true` → auto-approve
- If any condition fails → approval stays `pending` for human review

### 2. Single `action` type added to enum
- `APPROVAL_TYPES = ["hire_agent", "approve_ceo_strategy", "action"]`
- Existing types keep their dedicated side-effect handlers (hire activates agent, etc.)
- `action` has no side-effects — just resolves and wakes the requester
- Future specific types can be added if they need dedicated handlers

### 3. Freeform JSONB payload
- No required structure for `action` payloads
- Agents structure data however makes sense for their domain
- PR #348's generic renderer handles display (introspects value types)

### 4. `autoApproveIfTrusted` as a column on the approvals table
- Boolean column, defaults to `false`
- First-class attribute: queryable, auditable, filterable
- One small migration

### 5. Company-level override toggle
- New company setting: `requireHumanApprovalForAllActions` (or similar)
- When enabled, overrides trust-level auto-approval for `action` type
- Consistent with existing `requireBoardApprovalForNewAgents` pattern
- Safety net for cautious operators

### 6. Absorb PR #348
- Pull in the generic payload renderer, fixing flagged bugs:
  - Falsy guard: `!value` → `value == null` (preserves `0` and `false`)
  - Clipboard: guard `navigator.clipboard` for HTTP contexts
  - Label formatting: capitalize first letter in `formatLabel`
- Build `action` type support on top of the generic renderer

## Notification Integration

- `approval.created` events already flow through the notification system
- When an `action` approval is created (and not auto-approved), notifications fire via existing channels (webhook, Discord, ntfy)
- When auto-approved, `approval.approved` event fires with decision note indicating trust-based auto-approval
- No new notification event types needed — existing `approval.created` and `approval.decided` cover it

## What This Doesn't Include

- Per-category or per-action-type policies (YAGNI — start with binary trust)
- Approval budgets or rate limiting (can add later if needed)
- Agent-to-agent approval delegation
- Structured action taxonomy

## Open Questions

1. Should auto-approved actions still appear in the approvals list (with `approved` status), or be filtered out by default? **Leaning:** Show them with a "auto-approved" badge — auditability matters.
2. Naming: `requireHumanApprovalForAllActions` vs `disableAutoApproval` vs something else?
3. Should the existing `hire_agent` auto-approve logic (which currently lives inline in `approvals.create()`) be refactored to use the same `autoApproveIfTrusted` column, or left as-is?

## Related PRs

| PR | Status | Relationship |
|----|--------|-------------|
| #348 | Open (approved) | Absorb — generic payload renderer |
| #303 | Open | Superseded by notification channels (PR #389) |
| #382 | Open | Trust levels feature (current work) |
| #389 | Open | Notification channels backend (current branch) |
