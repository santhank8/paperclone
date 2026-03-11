# Phase 6 Summary: Autonomy Ladder

## Completed
- Created doc/AGENT_PR_CONTRACT.md with:
  - PR package requirements (implementation + tests + docs + contract sync)
  - Required PR description sections (Scope, Verification, Contract Sync, Risks)
  - Escalation triggers (security, budget, data model, unclear reqs, data loss, cross-cutting)
  - Proof of verification requirements
- Updated AGENTS.md with section 11 referencing PR contract and escalation policy
- Created scripts/check-pr-evidence.mjs:
  - Validates 4 required sections in PR body
  - Checks verification section references typecheck, test:run, build
  - Supports stdin and --file input
- Added pnpm pr:evidence:check to package.json
- Added evidence check CI step in pr-policy.yml (runs for high/medium risk PRs)
- Added doc/AGENT_PR_CONTRACT.md to docs:lint

## Verification
- pnpm pr:evidence:check passes with complete PR body, fails with incomplete
- pnpm docs:lint passes with 9 required docs

## Files Changed
- Created: doc/AGENT_PR_CONTRACT.md, scripts/check-pr-evidence.mjs
- Modified: AGENTS.md, package.json, .github/workflows/pr-policy.yml, scripts/docs-lint.mjs
