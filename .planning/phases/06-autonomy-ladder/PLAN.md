# Phase 6 Plan: Autonomy Ladder

## Goal
Define and enforce what agent-generated PR means.

## Tasks
1. Create doc/AGENT_PR_CONTRACT.md with PR package requirements, required sections, escalation triggers
2. Update AGENTS.md with PR requirements reference and escalation policy
3. Create scripts/check-pr-evidence.mjs to validate PR description sections
4. Add pnpm pr:evidence:check to package.json
5. Add evidence check CI step in pr-policy.yml for high/medium risk PRs
6. Add AGENT_PR_CONTRACT.md to docs:lint required docs

## Verification
- pnpm pr:evidence:check passes with valid input, fails with invalid
- pnpm docs:lint passes with AGENT_PR_CONTRACT.md
