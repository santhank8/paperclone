Heartbeat Hardening Plan

Overview
- Objective: Harden Metaclip's heartbeat routines to reduce deployment risk, ensure idempotency, and enable clean rollback.
- Scope: targeted at the heartbeat path around tickScheduledTriggers and the dispatch of routine runs.
- Outcome: predictable heartbeat behavior under load and after deployment, with traceable idempotency keys and auditable actions.

Scope details
- tickScheduledTriggers: ensure idempotencyKey is generated for each trigger and passed to dispatch calls.
- Duplicate trigger handling: detect and suppress duplicate enqueue within a defined window to avoid concurrent runs.
- Auditing: lightweight audit trail for heartbeat actions (routineId, triggerId, idempotencyKey, timestamp, outcome).
- Rollback: documented steps to revert to the last known-good state in case of issues.

Proposed Changes (high level)
- Code: implement idempotencyKey propagation through the heartbeat path; add guard to prevent duplicate enqueues for the same key/time window.
- Governance: document behavior, edge cases, and rollback steps; define monitoring requirements.

Testing strategy
- Unit tests for idempotencyKey generation and propagation.
- Integration smoke tests simulating rapid repeated triggers to ensure no duplicates are enqueued.
- Manual validation in staging/dev environments that mirror production config.

Rollback plan
- If issues are observed, revert the changes to the previous commit on the feature branch and perform a controlled restart if necessary.
- Maintain a short rollback checklist and verification steps.

Acceptance criteria
- No duplicate heartbeat runs observed within a defined monitoring window after deployment.
- Every heartbeat run includes a non-empty idempotencyKey and is passed to the dispatch path.
- Rollback procedures are tested and verifiable in staging.

Sign-off workflow
- CTO approves the Heartbeat Hardening Plan.
- Board approves the code changes path (META-999 linked) before merging to master.

Owners and next steps
- Owner: Internal Affairs Lead
- Next: after sign-off, create feature/heartbeat-hardening branch and implement the plan per governance-first flow.
