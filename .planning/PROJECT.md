# Harness Engineering Adoption

## Vision
Raise harness-engineering maturity from baseline (~52/100) to >=85/100 overall, with critical dimensions (legibility, architecture enforcement, autonomy safety, merge throughput) at >=90/100.

## Scope
Paperclip monorepo V1 hardening and throughput uplift. Adds deterministic harness layer: repository knowledge contracts, mechanical architecture checks, artifact-rich autonomous execution, risk-tiered merge lanes, and continuous entropy cleanup.

## Tech Stack
- TypeScript monorepo (`server`, `ui`, `packages/*`)
- GitHub Actions (`.github/workflows/`)
- Vitest + Playwright
- Docs under `doc/`

## Success Criteria
1. Overall score >=85 and no critical parameter below 80
2. Repository as SoR, Legibility, Architecture enforcement, Throughput policy >=90
3. Evidence of two consecutive release cycles with stable gates
4. Weekly scorecard updates for at least 8 consecutive weeks

## Constraints
- Must not weaken company-scoping, auth boundaries, or governance semantics
- Must maintain passing typecheck, test:run, build at all times
