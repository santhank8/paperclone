# Comandero Epic Audit

Date: 2026-04-12

## Summary

The original Comandero Epic split was not salvageable as-is.

- The structural blocker was a shared PrivateClip roadmap taxonomy rather than a Comandero-specific one.
- That blocker is now fixed by a company-specific roadmap override and a Comandero roadmap document.
- All open Comandero issues now point at one of four Comandero Epics.
- The worst cancelled duplicate waves were remapped by exact title so historical Epic counts are materially cleaner.
- Project assignment was also degraded; two open issues had no project and were fixed during this audit.

## Structural Blocker Status

The original blocker was that the roadmap was global and repo-backed rather than company-scoped.

- `GET /api/roadmap` now resolves a company-specific roadmap file when the company has `roadmapPath` configured.
- `PATCH /api/roadmap/items/:roadmapId` now writes back to the company-specific roadmap file when applicable.
- Comandero now uses `doc/company-roadmaps/comandero-roadmap.md`.

Before the fix, Comandero was forced to classify restaurant/cart/sales work under roadmap items like:

- `RM-2026-Q2-04 External adapter/plugin reliability`
- `RM-2026-Q2-06 Cloud/shared deployment polish`
- `RM-2026-Q2-07 Reusable company templates`
That was the root cause of the garbage Epic split.

## Live Fixes Applied

These safe fixes were applied during the audit:

- Comandero company settings now point at `doc/company-roadmaps/comandero-roadmap.md`
- `COMA-166` moved from no project to `App`
- `COMA-1048` moved from no project to `QA / Release`
- all `19` open Comandero issues were remapped to the four Comandero Epics
- `412` historical issues in exact-title duplicate clusters were remapped to the new Epic set
- `27` remaining historical issues using invalid legacy Epic IDs were remapped to the new Epic set

## Audit Snapshot

Full company issue set:

- Total issues: `1017`
- Issues with exactly one roadmap ID: `1017`
- Issues with zero roadmap IDs: `0`
- Issues with multiple roadmap IDs: `0`
- Issues using invalid non-Comandero roadmap IDs: `0`
- Issues still using `RM-UNPLANNED`: `160`

Open issue set:

- Open issues: `19`
- Open issues using `RM-UNPLANNED`: `0`

Current Epic totals after cleanup:

- `RM-2026-Q2-01 Checkout Trust And Explainability`: `355`
- `RM-2026-Q2-02 Release Confidence And QA Gates`: `300`
- `RM-2026-Q2-03 Sales-Safe Website And Funnel`: `117`
- `RM-2026-Q2-04 Runtime And Ops Hygiene`: `85`
- `RM-UNPLANNED`: `160`

## Proposed Comandero Epics

These are the Epic names Comandero should actually use:

1. `Checkout Trust And Explainability`
2. `Release Confidence And QA Gates`
3. `Sales-Safe Website And Funnel`
4. `Runtime And Ops Hygiene`

## Open-Issue Remap

### Checkout Trust And Explainability

- `COMA-145` `App` `RM-2026-Q2-01` -> Cart UX trust audit from restaurant owner POV
- `COMA-148` `App` `RM-2026-Q2-02` -> P0 cart trust fix: deterministic multi-supplier checkout outcome
- `COMA-978` `App` `RM-2026-Q2-02` -> Cart trust audit — eliminate any source of doubt (restaurant owner POV)
- `COMA-1031` `App` `RM-2026-Q2-05` -> UX cart review
- `COMA-1045` `App` `RM-2026-Q2-01` -> Cart trust P1: make blocked checkout recovery immediate and obvious
- `COMA-1046` `App` `RM-2026-Q2-02` -> Cart: fix optimizer mode activation and applied-state truthfulness
- `COMA-1047` `App` `RM-2026-Q2-01` -> [P0] Blocked optimizer preview does not identify which cart items need attention
- `COMA-1050` `App` `RM-2026-Q2-02` -> Unblock dirty branch push by fixing cart baseline test regressions
- `COMA-1051` `App` `RM-2026-Q2-05` -> [P0] Optimizer preview shows irreconcilable totals in cart trust flow
- `COMA-1053` `App` `RM-2026-Q2-02` -> [P1] Savings mode blocks checkout without showing the affected item or recovery action
- `COMA-1055` `App` `RM-2026-Q2-02` -> Cart: replace ambiguous bonus value copy with explicit payoff math
- `COMA-1056` `App` `RM-UNPLANNED` -> Cart: provide supplier override on every relevant line

### Release Confidence And QA Gates

- `COMA-1048` `QA / Release` `RM-2026-Q2-02` -> Release Gate: Cart/Checkout + Gates
- `COMA-1049` `App` `RM-2026-Q2-01` -> QA gate: verify blocked checkout recovery is trustworthy
- `COMA-1054` `App` `RM-2026-Q2-02` -> Validate COMA-55 trust gates and run repeat cart re-audit
- `COMA-1057` `App` `RM-UNPLANNED` -> QA re-audit: prove trust-critical cart flows after optimizer fixes

### Sales-Safe Website And Funnel

- `COMA-1052` `Website` `RM-2026-Q2-02` -> Deploy the sales-safe public-site fix live on Vercel immediately after QA clears runtime safety

### Runtime And Ops Hygiene

- `COMA-166` `App` `RM-2026-Q2-01` -> Runtime: fix stale execution locks left behind after finished heartbeat runs
- `COMA-190` `Operations` `RM-2026-Q2-01` -> Reassign and structure all existing issues into correct projects and owners

## What To Change Next

1. Backfill the remaining `160` `RM-UNPLANNED` historical issues; that is the largest remaining source of Epic noise.
2. Review whether any of those `RM-UNPLANNED` issues should stay as true interrupt work or be folded into the four Comandero Epics.
3. Carry `roadmapPath` through portability/export workflows if company-specific roadmaps need to survive import/export intact.
