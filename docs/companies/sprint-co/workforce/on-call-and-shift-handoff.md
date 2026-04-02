# On-Call Rotation and Shift Handoff Protocol

Purpose: operationalize roadmap tasks 122 and 127.

## 1. On-Call Rotation (Task 122)

Coverage model:
- Primary on-call: Sprint Lead
- Secondary on-call: one engineer agent
- Governance fallback: Enforcer for policy incidents

Rotation cadence:
- Weekly rotation for primary and secondary roles
- No agent remains primary for more than 2 consecutive rotations

On-call responsibilities:
- Triage incidents within 15 minutes
- Trigger incident protocol in operations/incident-response.md
- Escalate SEV-1 immediately to Judge and Stakeholder

## 2. Shift Handoff (Task 127)

Every handoff must include:
- Current objective and acceptance criteria
- Latest known status and blockers
- Open risks and confidence score
- Exact next action
- Evidence links (artifacts, issue IDs, logs)

Handoff quality gate:
- Receiving agent confirms comprehension before proceeding
- Missing required fields returns handoff for correction

Recovery behavior:
- If recipient unavailable, on-call secondary picks up
- If both unavailable, Sprint Lead reallocates task

Output artifacts:
- Handoff note stored with sprint artifacts
- Handoff quality score appended to agent-performance analytics
