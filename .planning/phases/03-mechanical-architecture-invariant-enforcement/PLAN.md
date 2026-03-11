# Phase 3 Plan: Mechanical Architecture and Invariant Enforcement

## Goal
Convert textual architecture rules into automated failing checks.

## Tasks
1. Create scripts/arch-lint.mjs enforcing import boundaries (ui/server/shared/db/adapters)
2. Add pnpm arch:lint to package.json and CI
3. Create contract tests:
   - company-scope-contract.test.ts: company boundary enforcement via assertCompanyAccess
   - mutation-activity-log-contract.test.ts: mutation routes must call logActivity
   - issue-transition-guard-contract.test.ts: issue statuses match expected set
   - agent-auth-company-boundary-contract.test.ts: agent keys cannot cross company boundary
4. Create shared-validator-contract.test.ts: validator export stability + routes use shared schemas

## Verification
- pnpm arch:lint exits 0
- All contract tests pass
