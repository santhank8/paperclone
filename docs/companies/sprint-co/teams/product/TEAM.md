---
schema: agentcompanies/v1
kind: team
slug: product
name: Product Team
description: >
  Responsible for translating raw briefs into structured sprint plans.
  Owns scope definition, backlog prioritization, and anti-scope-creep enforcement.
company: sprint-co
---

# Product Team

## Purpose

The Product Team converts vague human intent into precise, executable plans. It is the first team activated in every sprint. Its output — `sprint-plan.md` — is the contract that the Engineering Team builds against.

## Agents

| Agent | Role |
|-------|------|
| Product Planner | Brief expansion, backlog creation, V1/V2/V3 scope labeling |

## Responsibilities

1. **Brief Intake**: Receive the raw brief from the Sprint Orchestrator
2. **Spec Expansion**: Turn 1–4 sentences into a full product specification
3. **Backlog Creation**: Decompose spec into ordered, dependency-aware tasks
4. **Scope Control**: Label every feature V1 (must-have), V2 (nice-to-have), or V3 (future)
5. **Handoff**: Produce `sprint-plan.md` and signal Engineering Team

## Success Criteria

- `sprint-plan.md` produced within 20 minutes of brief receipt
- All V1 features are achievable within the remaining 2h40m sprint window
- Each backlog item has clear acceptance criteria
- No scope creep: the spec does NOT expand beyond what the brief implied

## Inputs

- Raw brief (1–4 sentences) from Sprint Orchestrator

## Outputs

- `sprint-plan.md` — structured product spec with sprint backlog
