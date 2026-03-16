---
title: Board Governance
description: Human operator as the board — full control to pause, resume, terminate, override budgets, and approve decisions
type: constraint
links: [company-model, org-structure, approval-gates, cost-budget]
---

# Board Governance

The human operator is the board of directors. Paperclip enforces that the board retains ultimate control over all autonomous agent activity.

## Board Powers

The board can at any time:

- **Pause/resume/terminate** any agent
- **Reassign or cancel** any task
- **Edit budgets and limits** (company and agent level)
- **Approve/reject/cancel** pending [[approval-gates]]
- **Create agents directly** (bypassing hire approval flow)
- **Override strategy** decisions

## Permission Matrix (V1)

| Action | Board | Agent |
|---|---|---|
| Create company | yes | no |
| Hire/create agent | yes (direct) | request via approval |
| Pause/resume agent | yes | no |
| Create/update task | yes | yes |
| Force reassign task | yes | limited |
| Approve requests | yes | no |
| Report cost | yes | yes |
| Set company budget | yes | no |
| Set subordinate budget | yes | yes (manager subtree only) |

Agents can set budgets for their direct reports, but cannot modify company-wide budgets or their own.

## Auth Model

V1 is single-tenant with one board operator per deployment:

- **Board auth**: session-based, full read/write across all companies in the deployment
- **Agent auth**: bearer API key mapped to one agent and one [[company-model]]

Agent keys are hashed at rest. Plaintext shown once at creation. Keys cannot access other companies. Agents cannot mutate auth/keys or bypass [[approval-gates]].

## Governance with Rollback

Configuration changes are versioned. Approval gates are enforced. Bad changes can be rolled back safely. The [[cost-budget]] system provides hard-stop enforcement so agents cannot overspend.

## Every Mutation Is Auditable

Every board action writes to the activity log. There is no untracked state change. The system is designed so you can look at Paperclip and understand your entire company at a glance — who's doing what, how much it costs, and whether it's working.
