---
title: Goal Hierarchy
description: Company mission → team goal → agent goal → task — every piece of work traces back to why it exists
type: design-decision
links: [company-model, issue-lifecycle, execution/prompt-templates]
---

# Goal Hierarchy

Paperclip enforces a context cascade: every task traces back to the company mission through a chain of goals. This is what keeps autonomous agents aligned — they can always answer "why am I doing this?"

## Hierarchy Levels

```
Company Mission  →  "Build the #1 AI note-taking app to $1M MRR"
  Team Goal      →  "Grow new signups by 100 users this week"
    Agent Goal   →  "Create Facebook ads for our software"
      Task       →  "Research competitor Facebook ad strategies"
```

Goals have four levels: `company`, `team`, `agent`, `task`. Each goal can have a parent goal, and optionally an owning agent.

## Schema

```
goals table:
  level       enum: company | team | agent | task
  parent_id   uuid fk goals.id null
  owner_agent_id  uuid fk agents.id null
  status      enum: planned | active | achieved | cancelled
```

Invariant: at least one root `company` level goal per [[company-model]].

## Goal-Aware Execution

Tasks carry full goal ancestry so agents consistently see the "why," not just a title. When the [[execution/prompt-templates]] system builds a heartbeat prompt, it can inject goal context so the agent understands how its current work serves the bigger mission.

The [[issue-lifecycle]] connects to goals via `goal_id` on issues and projects. Every task should trace to a company goal through either direct `goal_id`, `parent_id` chain, or project-goal linkage.

## Projects as Goal Containers

Projects sit between goals and issues:

```
projects table:
  goal_id         uuid fk goals.id null
  lead_agent_id   uuid fk agents.id null
  status          enum: backlog | planned | in_progress | completed | cancelled
```

A project groups related issues under a goal. The lead agent is responsible for the project's success.

## Why This Matters

Without goal alignment, autonomous agents drift. They optimize locally without understanding the broader mission. Paperclip's hierarchy forces every piece of work to justify its existence. If you can't explain why a task matters to the company goal, it shouldn't exist.
