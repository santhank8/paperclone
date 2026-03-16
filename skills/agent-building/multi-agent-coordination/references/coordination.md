# File-Based Coordination and SendMessage Patterns

## The Core Protocol

Three file types power agent coordination:

### 1. Task Manifest (`coordination/tasks.json`)

Written by the orchestrator before spawning. Agents read this to understand their scope.

```json
{
  "runId": "review-20260315-001",
  "tasks": [
    {
      "id": "logic",
      "assignedTo": "logic-reviewer",
      "scope": "Review correctness, data flow, and edge cases",
      "files": ["src/api/users.ts", "src/lib/validation.ts"],
      "worktree": "/tmp/agent-logic"
    },
    {
      "id": "security",
      "assignedTo": "security-reviewer",
      "scope": "Review auth, input validation, SQL injection surface",
      "files": ["src/api/users.ts", "src/middleware/auth.ts"],
      "worktree": "/tmp/agent-security"
    }
  ]
}
```

### 2. Status Files (`coordination/status-[agent].json`)

Written by each agent when they start and when they finish.

```json
{
  "agent": "logic-reviewer",
  "status": "done",
  "startedAt": "2026-03-15T18:00:00Z",
  "completedAt": "2026-03-15T18:04:23Z",
  "resultFile": "coordination/result-logic.md"
}
```

Status values: `running` | `done` | `blocked` | `failed`

### 3. Result Files (`coordination/result-[agent].md`)

Written by each agent. Structured summary only — no full transcripts.

```markdown
## Logic Review — result-logic.md

### Status: done
### Agent: logic-reviewer

### Findings
- `validateEmail()` in validation.ts does not handle Unicode email addresses
- `getUserById()` makes N+1 query — no batching, will degrade at scale
- Missing null check on `user.profile` at line 47

### Files Modified
- src/api/users.ts (no changes — read-only review)

### Blockers
none
```

## Orchestrator Polling Pattern

```python
# Python-style pseudo-code (adapt for your language)

import json, time, pathlib

def wait_for_agents(agents: list[str], timeout_sec=300):
    start = time.time()
    while True:
        done = []
        for agent in agents:
            status_file = pathlib.Path(f"coordination/status-{agent}.json")
            if status_file.exists():
                data = json.loads(status_file.read_text())
                if data["status"] in ("done", "failed", "blocked"):
                    done.append(agent)

        if len(done) == len(agents):
            return  # all finished

        if time.time() - start > timeout_sec:
            raise TimeoutError(f"Agents still running: {set(agents) - set(done)}")

        time.sleep(5)
```

For Claude Code orchestrators, prefer CronCreate over sleep loops:

```
// In orchestrator spawn prompt when you need polling behavior
Use CronCreate to poll coordination/status-*.json every 30 seconds.
When all status files show "done", read result files and aggregate.
```

## CronCreate Polling Pattern

```
CronCreate({
  interval: "30s",
  command: "python3 check_agents.py && echo 'All done' || echo 'Still running'"
})
```

This avoids the bash sleep-loop anti-pattern and doesn't block the orchestrator's context.

## Result Aggregation

Once all status files show `done`, orchestrator reads results and merges:

```python
def aggregate_results(agents: list[str]) -> str:
    sections = []
    for agent in agents:
        result_file = f"coordination/result-{agent}.md"
        content = pathlib.Path(result_file).read_text()
        sections.append(content)
    return "\n\n---\n\n".join(sections)
```

## SendMessage: When and How

Use SendMessage only when you need real-time control signals — not for results.

**Good use cases:**
- Orchestrator needs to pause a long-running agent mid-task
- Agent needs orchestrator decision to continue (ambiguous spec)
- Abort signal to all teammates

**Anti-patterns:**
- Using SendMessage to return results — use files instead
- Using SendMessage without a running teammate (`TeamCreate`) — Agent tool agents don't have a message inbox
- Fire-and-forget with no polling — agent stalls when no one reads

**Stable SendMessage pattern:**

```
// Only in a named Agent Teams context (when using TeamCreate)
SendMessage({ to: "logic-reviewer", message: "Pause review — scope change incoming" })

// Teammate must actively poll
while (true) {
    msg = ReceiveMessage()
    if (msg) handleMessage(msg)
    doWork()
}
```

**Stop polling = stall.** The known failure mode: teammate exits its polling loop, messages pile up, no error surfaced. Requires Esc from the user to recover. This is why files are preferred for results.

## Coordination Directory Setup

```bash
mkdir -p coordination
echo '{}' > coordination/tasks.json
# Agent status files and result files are created by agents at runtime
```

Add to `.gitignore` if you don't want coordination files in history:
```
coordination/status-*.json
coordination/result-*.md
```
