---
name: paperclip
description: "Skill graph for Paperclip — the open-source control plane for AI agent companies. Use when working with Paperclip orchestration, agent heartbeats, adapters, task management, cost tracking, org charts, or governance. Triggers on: \"paperclip agent setup\", \"heartbeat configuration\", \"adapter protocol\", \"agent budget\", \"approval gates\", \"issue checkout\", \"company goal alignment\"."
scraped: 2026-03-13
sources:
  - https://paperclip.ing/
  - https://github.com/paperclipai/paperclip (README)
  - doc/SPEC-implementation.md (local)
  - doc/PRODUCT.md (local)
  - doc/spec/agent-runs.md (local)
  - doc/spec/agents-runtime.md (local)
node_count: 15
link_count: 56
---

# Paperclip — Skill Graph

Paperclip is the open-source control plane for autonomous AI companies. It orchestrates teams of AI agents as employees within a company structure — with org charts, goals, budgets, governance, heartbeat execution, and a full audit trail. It is not an agent framework or chatbot — it's the operating system that companies made of agents run on.

## Areas

- **Core Domain**
  - [[company-model]] — First-order entity; all business objects are company-scoped with data isolation
  - [[org-structure]] — Agents as employees in a strict reporting tree with roles and titles
  - [[goal-hierarchy]] — Company mission → team → agent → task alignment cascade
  - [[issue-lifecycle]] — Task states, atomic checkout, single assignee, comments

- **execution/** — Agent execution subsystem
  - [[execution/heartbeat-system]] — Wakeup coordinator, triggers, queue semantics, run lifecycle
  - [[execution/adapter-protocol]] — AgentRunAdapter interface all runtimes implement
  - [[execution/claude-local-adapter]] — Claude CLI subprocess, JSON parsing, session persistence
  - [[execution/session-resume]] — Per-task session state across heartbeats
  - [[execution/prompt-templates]] — Mustache variables, pills, credential injection

- **Governance & Observability**
  - [[cost-budget]] — Monthly budgets, cost events, hard-stop auto-pause
  - [[approval-gates]] — Board approval for hires and CEO strategy
  - [[board-governance]] — Human operator powers, permission matrix, auth model
  - [[activity-log]] — Append-only audit trail for every mutation
  - [[realtime-events]] — WebSocket push for live UI updates

- **Operations**
  - [[deployment-modes]] — local_trusted vs authenticated, PGlite vs external Postgres

## Cross-Cutting Connections

- [[execution/heartbeat-system]] bridges execution and governance — connects to adapters, sessions, issues, costs, and realtime events (highest centrality, 5 links)
- [[issue-lifecycle]] connects work management to execution and governance — links to goals, heartbeats, approvals, costs, and activity (5 links)
- [[activity-log]] is the audit backbone — every mutation from every subsystem writes here

## Quick Paths

- **"I need to set up an agent"** → [[execution/claude-local-adapter]] → [[execution/adapter-protocol]] → [[org-structure]]
- **"I need to understand the heartbeat loop"** → [[execution/heartbeat-system]] → [[execution/session-resume]] → [[execution/adapter-protocol]]
- **"How does task management work?"** → [[issue-lifecycle]] → [[goal-hierarchy]] → [[approval-gates]]
- **"How are costs tracked?"** → [[cost-budget]] → [[execution/heartbeat-system]] → [[board-governance]]
- **"What governance exists?"** → [[board-governance]] → [[approval-gates]] → [[activity-log]]
- **"How do I deploy this?"** → [[deployment-modes]] → [[company-model]]

## Gaps

- **Plugin system** — V1 does not include a plugin framework or extension SDK; on post-V1 roadmap
- **ClipHub/ClipMart** — Company template marketplace not yet shipped
- **Multi-board governance** — V1 is single board operator; fine-grained human permissions deferred
- **Knowledge base** — Shared company knowledge subsystem out of scope for V1
- **Codex local adapter** — Documented but less detail available than claude_local; config is similar
- **HTTP adapter** — Webhook-based adapter exists but deep configuration details were thin in docs
