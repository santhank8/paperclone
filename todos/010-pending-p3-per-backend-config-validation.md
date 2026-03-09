---
status: pending
priority: p3
issue_id: "010"
tags: [code-review, validation, data-integrity, agent-native]
dependencies: []
---

# Add Per-Backend Config Validation at Create/Update Time

## Problem Statement

The `config` field is validated as `z.record(z.unknown())` -- any JSON object is accepted. A user can create a Discord channel with `config: {}` (missing `webhookUrl`), and the error only surfaces at send time. This is especially problematic for agent consumers who cannot visually inspect form labels.

## Findings

**Source agents:** data-integrity-guardian, architecture-strategist, agent-native-reviewer

**Evidence:**
- `packages/shared/src/validators/notification-channel.ts` lines 6, 13, 21: `z.record(z.unknown())`
- webhook requires `{ url, secret? }`, discord requires `{ webhookUrl }`, ntfy requires `{ topic, server? }`
- `testConnection` partially validates, but only when explicitly called

## Proposed Solutions

### Option A: Per-type Zod schemas in service layer
Define `CONFIG_SCHEMAS: Record<string, z.ZodSchema>` and validate on create/update.

- **Pros:** Fast failure, better error messages, self-documenting
- **Cons:** Schemas need updating when new config fields added
- **Effort:** Small-Medium (30-60 min)
- **Risk:** Low

## Acceptance Criteria

- [ ] Creating a channel with missing required config fields returns a validation error
- [ ] Error message specifies which fields are required for the channel type

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-09 | Created from code review of PR #389 | Silent dispatch failures from invalid configs |
