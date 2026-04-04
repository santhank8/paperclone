# Dead Letter Queue and Agent Heartbeat Protocol

Purpose: operationalize roadmap tasks 183 and 185.

## 1. Dead Letter Queue for Failed Handoffs (Task 183)

A handoff enters dead letter queue when:
- Recipient unavailable after retry policy exhausted
- Handoff payload fails validation repeatedly
- Dependency artifact cannot be resolved

DLQ workflow:
- Capture failed handoff metadata
- Tag failure reason and retry count
- Notify Sprint Lead and on-call secondary
- Route to manual triage if unresolved after max retries

Required fields:
- handoffId
- sourceAgent
- targetAgent
- failureReason
- retryAttempts
- timestamp

## 2. Agent Health Check Heartbeat (Task 185)

Heartbeat dimensions:
- Alive: process is running
- Responsive: responds within latency threshold
- Productive: recent meaningful output exists

Cadence:
- Heartbeat ping every 60 seconds for active agents
- Heartbeat ping every 5 minutes for idle agents

Escalation:
- 2 missed heartbeats: warning
- 3 missed heartbeats: auto-reassign critical tasks
- 5 missed heartbeats: incident response trigger

Output artifacts:
- Heartbeat status included in operations monitoring summary
- Reassignment events logged in activity stream
