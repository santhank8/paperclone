---
Owner: Engineering
Last Verified: 2026-03-11
Applies To: paperclip monorepo
Links: [AGENTS](../AGENTS.md), [MERGE_POLICY](MERGE_POLICY.md), [QUALITY_SCORE](QUALITY_SCORE.md)
---

# Agent PR Contract

Minimum requirements for agent-generated pull requests.

## PR Package Requirements

Every agent-authored PR must include:

### 1. Implementation
- Code changes that address the task

### 2. Tests
- New or updated tests covering the changed behavior
- All existing tests must continue to pass

### 3. Documentation
- Updated docs when behavior, commands, or APIs change
- New docs for new features or subsystems

### 4. Contract Sync
- If schema/API changes: update all impacted layers (db, shared, server, ui)
- If shared validators change: verify downstream consumers

## PR Description Required Sections

Agent PRs must include these sections in the description:

### Scope
What this PR changes and why.

### Verification
Evidence that the change works:
- `pnpm -r typecheck` output reference
- `pnpm test:run` output reference
- `pnpm build` output reference

### Contract Sync
Which contracts were checked/updated (or "N/A — no contract changes").

### Risks
Known risks, edge cases, or limitations of this change.

## Escalation Triggers

Agents must escalate to human review (not auto-merge) when:

1. **Security/auth logic** — any change to authentication, authorization, or company scoping
2. **Budget/financial controls** — changes to cost tracking, budget enforcement, or billing
3. **Data model changes** — new or modified database schema
4. **Unclear requirements** — ambiguous task description or conflicting constraints
5. **Data loss risk** — deletions, migrations, or state transitions that could lose data
6. **Cross-cutting changes** — modifications affecting 3+ bounded contexts

## Proof of Verification

The PR description must reference actual command output (not just "tests pass"). Include:
- Exit codes or summary lines from typecheck, test:run, build
- Number of tests passed
- Any warnings or known failures with explanation
