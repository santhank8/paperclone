# High-Throughput Quality Loop Implementation

## Scope

Implement a bounded write-verify-rewrite loop with strict publish gating and a sequential publish queue.

## Phase 1: Lock The Rules

- [x] define article loop
- [x] define strict verification requirement
- [x] define max attempts = 3
- [x] define human review backlog outcome
- [x] define specialist guidance rule
- [x] define publish queue

Source of truth:

- `docs/plans/2026-04-04-high-throughput-quality-loop-spec.md`

## Phase 2: Job State Model

- [ ] add explicit article attempt state
- [ ] store attempt count on the article run
- [ ] store specialist-guidance-used flags per lane
- [ ] store backlog outcome after max-attempt exhaustion

## Phase 3: Rewrite Loop

- [ ] after topic pass, generate draft automatically
- [ ] run strict verification automatically
- [ ] if fail, collect reason codes
- [ ] request specialist guidance for failed lanes
- [ ] rewrite using guidance
- [ ] repeat until pass or attempt 3

## Phase 4: Specialist Trigger Policy

- [ ] trigger specialist guidance from first failure
- [ ] prevent repeated calls to the same specialist for the same article and lane
- [ ] escalate ambiguous multi-lane failures to `Editor-in-Chief`

## Phase 5: Publish Queue

- [ ] add queue state for strict-pass articles
- [ ] publish queue should process sequentially
- [ ] publish queue should preserve boundary receipts and verification artifacts
- [ ] publish queue should run public verify after each publish

## Phase 6: Human Review Backlog

- [ ] add backlog state for articles that fail after 3 attempts
- [ ] preserve attempt history, reasons, and specialist guidance
- [ ] prevent infinite immediate retry on the same topic

## Phase 7: Throughput Reporting

- [ ] expose daily counts:
  - topic-passed
  - strict-pass
  - published
  - sent to human backlog
- [ ] expose average attempts per published article
- [ ] expose most common failing reason codes

## Immediate Execution Checklist

1. model article attempt state and max-attempt transitions
2. wire strict verify -> reason codes -> rewrite loop
3. add specialist one-shot guidance cache per article/lane
4. add publish queue state and sequential processor
5. add human review backlog state
6. add throughput reporting
