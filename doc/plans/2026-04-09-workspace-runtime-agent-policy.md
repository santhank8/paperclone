# Workspace Runtime Agent Policy

**Date:** 2026-04-09
**Status:** Target policy — not yet fully implemented

This document defines the target runtime policy for how Paperclip agents should execute work, resolve project workspaces, and avoid wasting budget or tokens on autonomous runs without assigned issues.

It supersedes earlier git-centric framing and earlier manager-roaming proposals. The governing model is now:

- agents should only execute work when they have an assigned issue/task
- CEO is the only default company-level governance agent
- workspace resolution happens only after an issue/task has been selected

---

## Core Concept: Assigned-Issue Execution

An agent should not look for work on its own unless it is the CEO running an explicit company review cadence.

**The safe rule:**

- `CEO scheduled review or assigned issue exists` -> execution allowed
- `non-CEO with assigned issue exists` -> execution allowed
- `no assigned issue` -> exit without doing work

This keeps execution hierarchical and prevents token spend on idle or speculative runs.

---

## Core Concept: Project Workspace Mode

A **project workspace** is the durable codebase or working root for a project. It can be:

- a Git-backed engineering workspace (local checkout or remote repo)
- a normal local folder for marketing, operations, design, content, and similar departments
- a managed Paperclip project workspace when no external `cwd` exists yet

Git behavior is one subtype of project workspace behavior, not the defining case. The policy must gate on _valid project workspace resolved_, not on _is git repo_.

**Workspace rule:**

- `assigned issue + workspace resolved` -> **project workspace mode**
- `assigned issue + no workspace resolved` -> **issue execution without workspace mode**
- `no assigned issue` -> no execution

---

## Target Policy Rules

### 1. Agent with assigned project and multiple workspaces

1. Use `issue.projectWorkspaceId` first.
2. If missing, infer the most relevant project workspace from the issue context or inherited execution workspace.
3. If no relevant workspace is found, use the project's default workspace (`executionWorkspacePolicy.defaultProjectWorkspaceId`).
4. If there is no default and exactly one workspace is primary, use that.
5. If still ambiguous, do not guess. Return `workspace selection required`.

### 2. Agent with assigned project and one workspace

Always use that workspace automatically. No prompt required.

### 3. Agent with assigned project and no workspace

The agent may continue work on the assigned issue, but it must not enter project workspace mode.

Allow:
- issue analysis
- comments and status updates
- reporting
- lightweight planning directly tied to the assigned issue

Block:
- code edits
- filesystem changes
- repo/folder execution

Emit a clear reason such as `project has no workspace configured`.

### 4. Agent with assigned issue but no project

Do not enter project workspace mode.
Allow only issue-scoped non-workspace work such as reporting, clarification, or status updates.

### 5. Agent with no assigned issue

Do not execute work.
Exit cleanly without spending tokens on planning, research, or speculative follow-up.

### 6. Timer heartbeat with no explicit issue/project

1. Inspect the agent's assigned actionable issues first.
2. If one exists, bind the run to that assigned issue.
3. If multiple exist, prefer `in_progress`, then `todo`, then `in_review` that explicitly woke the agent.
4. If none exist:
   - `CEO` may run the scheduled company review/follow-up flow
   - every other agent exits without doing work
5. **Never use old task-session `cwd` or agent-home `cwd` as authority for project work.** Previous session `cwd` may help resume conversational context, but it must not authorize project/file work unless it maps to the resolved project workspace.

### 7. CEO

CEO is the only default company-level governance agent.

CEO may:
- run the scheduled company review cadence
- inspect all projects, goals, blockers, stale work, and agent health
- create issues and subtasks
- assign issues to other agents
- follow up on stale or blocked work
- hire new agents when needed

CEO must still not silently enter project workspace mode unless acting on a specific issue that resolves to a valid workspace.

### 8. Non-CEO agents

Non-CEO agents are execution agents, not autonomous coordinators.

- They only work when they have an assigned issue/task.
- They must never silently enter project workspace mode.
- They must not roam across company or project state looking for work.
- They may create subordinate work only if product policy explicitly allows it inside an already assigned parent issue.
- By default, delegation, follow-up, and hiring belong to CEO.

### 9. Workspace type handling

For engineering/IT: the workspace may be a Git repo and can allow branch/worktree operations.
For marketing, operations, design, content, and similar departments: the workspace may be a normal folder and should allow document/file work without requiring Git semantics.

The policy gates on _valid project workspace_, not on _is git repo_.

### 10. Managed project workspace

If a project is configured without a local `cwd` but Paperclip can provision a managed project workspace, that still counts as project workspace mode.
If no managed workspace can be provisioned, the run stays non-workspace.

### 11. Allowed fallback

Fallback is allowed only for **conversational continuity**, never for **project authority**.
Previous session `cwd` may help resume context, but it must not authorize project/file work unless it maps to the resolved project workspace.

---

## Current State (verified 2026-04-09)

### What already works

| Behavior | Location | Status |
|---|---|---|
| Issue creation sets `projectWorkspaceId` from project default workspace, falls back to primary/oldest workspace | `server/src/services/issues.ts:1465` | Implemented |
| Assignment wakeups carry `issueId` in context snapshot | `server/src/services/issue-assignment-wakeup.ts:24` | Implemented |
| Manager hierarchy (`reportsTo`, `getChainOfCommand`) exists | `server/src/services/agents.ts:651` | Implemented (query only) |
| `resolveWorkspaceForRun` resolves by issue, then project workspace list | `server/src/services/heartbeat.ts:1407` | Implemented |

### Main gaps

| Gap | Location | Policy rule violated |
|---|---|---|
| After exhausting project workspaces and managed workspace, falls back to `task_session` `cwd` from prior session | `server/src/services/heartbeat.ts:1562-1579` | Rules 6, 8, 11 |
| After `task_session` fallback, falls back to `agent_home` `cwd` | `server/src/services/heartbeat.ts:1582-1607` | Rules 6, 8, 11 |
| Timer heartbeats do not first scan assigned issues before deciding whether to execute | `server/src/services/heartbeat.ts` (timer path) | Rules 5, 6, 8 |
| Non-CEO agents can still fall into projectless execution because fallback paths exist | `server/src/services/heartbeat.ts` | Rules 5, 8, 11 |
| CEO-only governance model is not yet runtime-enforced | routes/services policy gap | Rule 7 |
| The system still allows autonomous non-issue work instead of exiting when no issue is assigned | heartbeat runtime | Rules 5, 6, 8 |

---

## Practical Summary

```text
CEO scheduled review -> allowed
assigned issue -> allowed
no assigned issue -> exit

assigned issue + workspace -> project workspace mode
assigned issue + no workspace -> issue-only non-workspace mode
no assigned issue -> no execution

CEO -> review, follow up, create tasks, assign tasks, hire
non-CEO agents -> execute assigned issues only

workspace type -> gates on valid project workspace, not git-only
managed workspace -> counts as project workspace mode
```

---

## Implementation Direction

1. Change timer heartbeat behavior so non-CEO agents exit immediately when they have no assigned issue.
2. Allow CEO timer wakes to run only for explicit governance review cadence.
3. Move issue selection ahead of workspace resolution in the runtime flow.
4. Remove `task_session` and `agent_home` fallback as authority for project work.
5. Enforce CEO as the default review, follow-up, task-creation, assignment, and hiring authority.
6. Keep other agents focused on assigned issue execution only.
