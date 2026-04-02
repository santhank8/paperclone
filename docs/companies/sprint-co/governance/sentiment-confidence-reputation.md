# Sentiment, Confidence, and Reputation Protocol

Purpose: operationalize roadmap tasks 96, 97, and 102.

## 1. Sentiment Tracking (Task 96)

Track communication sentiment for every sprint checkpoint.

- Sources: boardroom comments, handoff notes, blocker reports
- Scale: -2 very negative, -1 negative, 0 neutral, +1 positive, +2 very positive
- Aggregation windows: per checkpoint, per sprint, rolling 4-sprint average
- Alert: if rolling average drops below -0.5 for 2 consecutive checkpoints

Output artifact:
- Sentiment section in weekly health report with trend and notable drivers

## 2. Confidence Scoring (Task 97)

Every major claim and delivery estimate includes confidence.

- Self confidence: 0.0-1.0 from producing agent
- Peer confidence: 0.0-1.0 from reviewer (Critic/QA/Judge depending on context)
- Final confidence: weighted score
  - 60% peer
  - 40% self

Interpretation:
- 0.80-1.00: high confidence, normal execution
- 0.60-0.79: medium confidence, add validation gate
- below 0.60: high risk, escalation required

Output artifact:
- Confidence table attached to sprint plan and release recommendation

## 3. Reputation System (Task 102)

Agent reputation is based on outcomes, not verbosity.

Reputation components:
- Quality: QA and Critic scores (35%)
- Reliability: on-time completion and low rework (30%)
- Cost discipline: budget adherence (20%)
- Collaboration: handoff quality and governance behavior (15%)

Update cadence:
- Recompute every sprint close
- Keep both sprint score and trailing 8-sprint score

Autonomy coupling:
- Reputation feeds trust levels in governance/trust-levels.md

Output artifact:
- Reputation snapshot in analytics/agent-performance.md
