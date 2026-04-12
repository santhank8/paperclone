# Comandero Roadmap

Status: Active
Owner: CEO
Last Updated: 2026-04-12

This document is the source of truth for Comandero roadmap-linked delivery.

## Contract

1. Every active delivery issue must reference exactly one roadmap item ID from this file.
2. Cart trust, release gates, website funnel work, and runtime hygiene must not be mixed into the same roadmap item.
3. `RM-UNPLANNED` is for true exceptions only and must be backfilled quickly.

## Now

### RM-2026-Q2-01 Checkout Trust And Explainability

- Outcome: restaurant owners can understand exactly what the cart will do, what changed, what they will pay, and how to recover blocked states.
- Scope: item-level explanations, totals truthfulness, supplier labeling, optimizer state clarity, override flows, and checkout recovery.
- Exit Criteria: trust-critical cart flows are self-explanatory and no longer require manual interpretation.
- Status: In Progress

### RM-2026-Q2-02 Release Confidence And QA Gates

- Outcome: trust-critical changes ship only with explicit evidence and repeatable release gates.
- Scope: QA audits, release gates, smoke proof, re-audits, and confidence checks for cart and checkout.
- Exit Criteria: release decisions are evidence-backed and repeatable for trust-critical flows.
- Status: In Progress

### RM-2026-Q2-03 Sales-Safe Website And Funnel

- Outcome: the public site and top-of-funnel path support sales without breaking trust or runtime safety.
- Scope: website fixes, deployment safety, onboarding funnel integrity, and sales-safe release sequencing.
- Exit Criteria: website changes can ship without jeopardizing conversion or operational safety.
- Status: In Progress

### RM-2026-Q2-04 Runtime And Ops Hygiene

- Outcome: execution infrastructure, issue routing, and operational hygiene stop creating avoidable delivery drag.
- Scope: stale lock cleanup, execution hygiene, project assignment cleanup, and routing/ownership maintenance.
- Exit Criteria: runtime hygiene issues no longer block product or release work.
- Status: In Progress
