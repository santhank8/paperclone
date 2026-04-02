# Regression, Contract, and Visual Testing Protocol

Purpose: operationalize roadmap tasks 134, 136, and 137.

## 1. Regression Detection Across Sprints (Task 134)

Regression baseline:
- Prior sprint shipped behavior and API outputs

Regression checks:
- Core user-flow smoke tests
- Non-functional checks (performance budget and error rate)
- Historical bug replay for top recurring failure classes

Escalation:
- Any critical regression blocks sprint close gate
- Two medium regressions require maintenance sprint allocation

## 2. API Contract Testing (Task 136)

Contract source:
- Shared schema and endpoint contracts in packages/shared

Contract test policy:
- Consumer and provider compatibility checks run in CI
- Breaking changes require explicit version bump and migration notes
- No deployment with unresolved contract mismatch

## 3. Visual Regression Pipeline (Task 137)

Scope:
- High-priority screens and flows

Method:
- Capture baseline screenshots per release
- Diff against current sprint output with threshold-based detection

Review workflow:
- QA flags true regressions
- Design-system agent reviews intended changes
- Stakeholder signs off for UX-impacting differences

Output artifacts:
- Visual diff report attached to sprint close checklist
