# Agent-to-Agent Pair Programming Protocol

> Sprint Co Capability — Phase 11: Advanced Agent Capabilities

## When to Pair

Pair programming doubles model cost. Use it only when the value justifies the expense.

**Pair when:**
- Task complexity is rated HIGH or CRITICAL and benefits from two perspectives
- Debugging sessions exceed 15 minutes without progress
- Knowledge transfer is needed (e.g., new agent onboarding to an unfamiliar codebase area)
- Architectural decisions require real-time discussion
- Security-sensitive code requires immediate second-set-of-eyes review

**Do not pair when:**
- Task is straightforward implementation with clear spec
- Agent has demonstrated proficiency in the domain
- Budget is constrained and task is non-critical

## Pair Configurations

### Driver / Navigator Model (adapted for AI agents)

| Role | Responsibility |
|------|---------------|
| **Driver** | Writes code, makes implementation decisions, produces artifacts |
| **Navigator** | Reviews in real-time via structured comments, catches errors, suggests alternatives, tracks big picture |

Roles are assigned by the Orchestrator based on agent strengths:
- Agent with deeper domain knowledge → Driver
- Agent with broader architectural awareness → Navigator

### Configuration Table

| Pair Type | Driver | Navigator | Use Case |
|-----------|--------|-----------|----------|
| Eng + Eng | Frontend Engineer | Backend Engineer | Full-stack feature |
| Eng + Reviewer | Engineer | Code Reviewer | Complex refactor |
| Eng + QA | Engineer | QA Engineer | Test-driven development |
| Debug | Engineer (stuck) | Rubber Duck / another Eng | Debugging |

## Session Protocol

### Step 1: Establish Shared Context
```
PAIR-SESSION-INIT:
  task_id: <paperclip-task-id>
  driver: <agent-name>
  navigator: <agent-name>
  objective: <one-line goal>
  shared_artifacts:
    - <list of files/docs both agents should read>
  time_budget: <max minutes>
  token_budget: <max tokens for session>
```

### Step 2: Driver Starts Implementation
- Driver produces code in increments of ~50 lines
- After each increment, Driver posts a structured update

### Step 3: Navigator Reviews Every 50 Lines
Navigator responds with a structured review block:
```
NAVIGATOR-REVIEW:
  increment: <number>
  lines_reviewed: <range>
  issues:
    - severity: [blocker|suggestion|nit]
      line: <line-number>
      comment: <description>
  overall: [proceed|pause|rethink]
```

### Step 4: Swap Roles at Midpoint
- At 50% of the time/token budget, roles swap
- New Driver picks up from current state
- Swap ensures both agents understand the full implementation

### Step 5: Session Close
- Both agents sign off on the final artifact
- Session log is saved

## Communication Format

All inter-agent messages during pairing use this structure:

```markdown
## PAIR-MSG
- **From:** <agent-name> (<role>)
- **To:** <agent-name> (<role>)
- **Type:** [code-update | review | question | decision | role-swap | session-end]
- **Content:**

<message body>

- **Action Required:** [yes/no] — <description if yes>
```

## Session Artifacts

Every pair session produces a `pair-session-log.md`:

```markdown
# Pair Session Log

- **Task:** <task-id> — <title>
- **Date:** <YYYY-MM-DD>
- **Driver (first half):** <agent>
- **Navigator (first half):** <agent>
- **Duration:** <minutes>
- **Tokens Used:** <count>

## Decisions Made
1. <decision and rationale>
2. ...

## Disagreements
1. <what was disagreed on> → <how it was resolved>

## Code Produced
- Files created/modified: <list>
- Lines of code: <count>
- Test coverage: <% if applicable>

## Outcome
- [x] Objective achieved
- [ ] Partial — carried over: <what remains>

## Retrospective
- **What worked:** <brief>
- **What didn't:** <brief>
- **Pair again for this type of task?** [yes/no]
```

## Cost Considerations

| Metric | Single Agent | Paired Agents | Delta |
|--------|-------------|---------------|-------|
| Model cost | 1x | ~2x | +100% |
| Time to complete | baseline | ~0.7x baseline | -30% |
| Defect rate | baseline | ~0.5x baseline | -50% |
| Knowledge spread | 1 agent | 2 agents | +100% |

**Decision rule:** Pair when `(defect_cost_saved + rework_time_saved) > pairing_cost_increase`.

The Orchestrator tracks pairing ROI per session and adjusts recommendations over time.
