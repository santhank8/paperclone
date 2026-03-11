# Roadmap: Harness Engineering Adoption

## Overview

Raise harness-engineering maturity from baseline (~52/100) to >=85/100 by adding repository knowledge contracts, mechanical architecture checks, artifact-rich autonomous execution, risk-tiered merge lanes, and continuous entropy cleanup across the Paperclip monorepo.

## Phases

- [ ] **Phase 1: Baseline Instrumentation and Scorecard** - Lock initial metrics so progress is measurable
- [ ] **Phase 2: Repository Knowledge as System of Record** - Make repo documentation legible for humans and agents
- [ ] **Phase 3: Mechanical Architecture and Invariant Enforcement** - Convert textual rules into failing checks
- [ ] **Phase 4: Deterministic Agent Harness and Artifacts** - Make every autonomous run observable and reproducible
- [ ] **Phase 5: Risk-Tiered Merge Policy** - Increase throughput without reducing safety
- [ ] **Phase 6: Autonomy Ladder** - Define and enforce what agent-generated PR means
- [ ] **Phase 7: Entropy and Garbage Collection** - Institutionalize continuous cleanup
- [ ] **Phase 8: Learning Loop and Quarterly Re-Scoring** - Turn unknowns into explicit experiments

## Phase Details

### Phase 1: Baseline Instrumentation and Scorecard
**Goal**: Lock initial metrics so progress is measurable
**Depends on**: Nothing (first phase)
**Success Criteria** (what must be TRUE):
  1. `doc/HARNESS_SCORECARD.md` exists with all 11 harness parameters and measurable metric sources
  2. `pnpm harness:scorecard:check` validates scorecard schema and required headings
  3. Each parameter has baseline score, target score, metric source, and update cadence
**Plans**: TBD

### Phase 2: Repository Knowledge as System of Record
**Goal**: Make repo documentation legible for both humans and agents
**Depends on**: Phase 1
**Success Criteria** (what must be TRUE):
  1. Canonical docs exist: ARCHITECTURE.md, QUALITY_SCORE.md, RELIABILITY.md, SECURITY.md
  2. ADR exists at doc/DECISIONS/0001-harness-engineering-adoption.md
  3. Each doc has Owner, Last Verified, Applies To, Links fields
  4. `pnpm docs:lint` validates doc existence, front-matter, and link integrity
  5. CI runs docs:lint before typecheck
**Plans**: TBD

### Phase 3: Mechanical Architecture and Invariant Enforcement
**Goal**: Convert textual architecture rules into automated failing checks
**Depends on**: Phase 2
**Success Criteria** (what must be TRUE):
  1. `pnpm arch:lint` enforces import boundaries (ui cannot import server, routes cannot bypass services for mutations, restricted DB schema imports)
  2. Contract tests exist for: company-scope boundary, mutation activity logging, issue transition guards, agent auth company boundary
  3. Shared validator drift guard test validates server routes use shared validators
  4. All checks run in CI
**Plans**: TBD

### Phase 4: Deterministic Agent Harness and Artifacts
**Goal**: Every autonomous run is observable and reproducible
**Depends on**: Phase 3
**Success Criteria** (what must be TRUE):
  1. `pnpm harness:run` provides single entrypoint for scoped agent tasks
  2. Harness collects logs, failing test output, and run metadata
  3. CI uploads artifacts on failure with deterministic naming by PR SHA
  4. Runbook at doc/HARNESS_RUNBOOK.md explains local reproduction and failure classification
**Plans**: TBD

### Phase 5: Risk-Tiered Merge Policy
**Goal**: Increase merge throughput without reducing safety
**Depends on**: Phase 4
**Success Criteria** (what must be TRUE):
  1. doc/MERGE_POLICY.md defines low/medium/high risk taxonomy based on changed paths
  2. High-risk paths (auth, company scoping, issue checkout, approvals, budgets) require elevated review
  3. Low-risk PRs with green checks can flow through fast lane
  4. CI enforces reviewer count by risk tier
**Plans**: TBD

### Phase 6: Autonomy Ladder
**Goal**: Define and enforce what agent-generated PR means
**Depends on**: Phase 5
**Success Criteria** (what must be TRUE):
  1. doc/AGENT_PR_CONTRACT.md defines minimum PR package (implementation + tests + docs + contract sync)
  2. AGENTS.md updated with escalation triggers and responsibilities
  3. `pnpm pr:evidence:check` validates PR description has required sections (Scope, Verification, Contract Sync, Risks)
  4. CI blocks PRs missing evidence sections
**Plans**: TBD

### Phase 7: Entropy and Garbage Collection
**Goal**: Institutionalize continuous cleanup with bounded scope
**Depends on**: Phase 6
**Success Criteria** (what must be TRUE):
  1. doc/CLEANUP_POLICY.md defines entropy categories, weekly cleanup budget, and rollback expectations
  2. doc/CLEANUP_BACKLOG.md tracks current cleanup candidates
  3. `pnpm entropy:scan` runs detection scripts for stale doc links, untested routes, orphaned types
  4. Scan produces machine-readable report
**Plans**: TBD

### Phase 8: Learning Loop and Quarterly Re-Scoring
**Goal**: Turn unknowns into explicit experiments and tie scorecard to release process
**Depends on**: Phase 7
**Success Criteria** (what must be TRUE):
  1. doc/HARNESS_LEARNING_REGISTRY.md tracks experiments with Hypothesis, Metric, Window, Decision, Follow-up
  2. Top 10 unknowns from rollout are logged with owners and dates
  3. Release checklist in doc/RELEASING.md references scorecard gate
  4. Quarterly delta table process defined in HARNESS_SCORECARD.md
**Plans**: TBD

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Baseline Instrumentation and Scorecard | 0/0 | Not started | - |
| 2. Repository Knowledge as System of Record | 0/0 | Not started | - |
| 3. Mechanical Architecture and Invariant Enforcement | 0/0 | Not started | - |
| 4. Deterministic Agent Harness and Artifacts | 0/0 | Not started | - |
| 5. Risk-Tiered Merge Policy | 0/0 | Not started | - |
| 6. Autonomy Ladder | 0/0 | Not started | - |
| 7. Entropy and Garbage Collection | 0/0 | Not started | - |
| 8. Learning Loop and Quarterly Re-Scoring | 0/0 | Not started | - |
