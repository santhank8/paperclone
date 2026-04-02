# Anomaly, Dependency, and Burn Visualization Protocol

Purpose: operationalize roadmap tasks 113, 115, and 117.

## 1. Anomaly Detection (Task 113)

Detect sudden degradation in delivery system behavior.

Signals:
- Quality anomaly: QA score drops by 1.0 or more sprint-over-sprint
- Cost anomaly: total token spend rises by 35% or more without scope increase
- Throughput anomaly: committed-to-shipped ratio falls below 0.6
- Reliability anomaly: blocker count doubles vs trailing 3-sprint baseline

Action policy:
- Any single critical anomaly triggers automatic Board review
- Two medium anomalies trigger a targeted maintenance sprint proposal

## 2. Cross-Sprint Dependency Tracking (Task 115)

Track feature dependencies as first-class sprint metadata.

Required metadata fields:
- dependsOnFeatureIds
- dependsOnSprintIds
- blockedByIssueIds
- downstreamRiskLevel (low, medium, high)

Rules:
- No high-risk dependency can enter execution without Enforcer approval
- Dependency chains longer than 3 hops require decomposition

## 3. Burnup and Burndown Views (Task 117)

Maintain two visual summaries per sprint.

Burndown:
- Remaining committed work over sprint time

Burnup:
- Delivered value over sprint time against target scope

Interpretation triggers:
- Burndown flattening for 2 checkpoints indicates execution stall
- Burnup lag greater than 30% at midpoint triggers scope correction

Output artifacts:
- Included in analytics/weekly-health-report-template.md
- Linked from operations/multi-sprint-planning.md
