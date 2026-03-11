# Phase 1 Plan: Baseline Instrumentation and Scorecard

## Goal
Lock initial metrics so progress is measurable.

## Tasks
1. Create `doc/HARNESS_SCORECARD.md` with all 11 harness parameters, baseline/target scores, metric sources, and update cadence
2. Create `scripts/harness-scorecard.mjs` that validates scorecard schema, frontmatter, required headings, parameter count, and metric source presence
3. Add `pnpm harness:scorecard:check` to package.json

## Verification
- `pnpm harness:scorecard:check` exits 0
