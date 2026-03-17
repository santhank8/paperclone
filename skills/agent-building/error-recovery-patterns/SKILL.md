---
name: error-recovery-patterns
description: Fault tolerance patterns for Claude Code agents. Installs checkpoint-before-risk (PreToolUse), circuit breaker (PostToolUse), and state serializer (Stop hook) so agents survive tool failures, crashes, and retry loops. Use when agents lose progress, fail silently, get stuck retrying, or need to resume after a crash. Triggers on: "agent fails silently", "lost all progress", "lose all my work", "I lost hours of work", "stuck in retry loop", "infinite retry", "agent keeps retrying", "agent crashed", "crash recovery", "graceful failure", "fault tolerance", "error recovery", "checkpoint pattern", "circuit breaker", "error budget", "resume after failure", "my agent died mid-task", "agent lost state", "no state saved on crash", "agent fails without warning", "agents fail in production". NOT for: MCP server errors (skill #006), root cause debugging (skill #013), external retry libraries (tenacity, langgraph).
---

# Error Recovery Patterns

Agents fail in three predictable ways. Each has a native hook that catches it:

| Failure Mode | Hook | Artifact |
|---|---|---|
| State loss on crash | Stop | recovery-manifest.md |
| Tool failures silently swallowed | PostToolUse | error-count.txt |
| Risky operation with no rollback | PreToolUse | recovery.md checkpoint |

---

## Quick Setup

Three hooks in `~/.claude/settings.json`: `checkpoint.sh` (PreToolUse → Bash|Write|Edit|MultiEdit), `circuit-breaker.sh` (PostToolUse), `state-serializer.sh` (Stop).

→ Full JSON config + hook scripts: `references/checkpoint-pattern.md`, `references/circuit-breaker-hook.md`, `references/stop-hook-state.md`

---

## The Three Failure Modes

State loss (crash), tool failure (silent), infinite retry (loop). Each has a distinct detection signal and hook response.

→ Full taxonomy + signal detection: `references/failure-modes.md`

---

## Checkpoint Before Risky Operations

Before any destructive operation (file delete, git reset, database write), write a checkpoint to `recovery.md`. A PreToolUse hook auto-writes this before the call executes. If the session crashes, the next SessionStart hook reads `recovery.md` and resumes.

→ Full hook script + recovery.md template + SessionStart reader: `references/checkpoint-pattern.md`

---

## Circuit Breaker: PostToolUse Pattern

A PostToolUse hook tracks consecutive tool failures via `error-count.txt`. After threshold (default: 3), it exits 1 — blocking further agent action — and writes a human-escalation comment.

→ Full hook script + threshold config + error-count.txt format: `references/circuit-breaker-hook.md`

---

## Stop Hook: Serialize State on Exit

A Stop hook writes a recovery manifest on every session exit — normal or abnormal. The next session's SessionStart hook reads it and restores context.

→ Full serializer + manifest format + SessionStart reader: `references/stop-hook-state.md`

---

## Sub-Agent Retry with Preserved Context

Never retry a failed operation in the same context. Accumulated error traces pollute reasoning. Delegate retry to a fresh sub-agent passing only the checkpoint manifest. Context rot is the primary reason inline retry loops fail.

→ Full pattern + checkpoint manifest schema: `references/sub-agent-retry.md`

---

## Human Escalation Protocol

**Rule:** Retry once with a different approach. If it fails again, write a blocked comment and stop. Silent failure is the worst outcome — a blocked comment is a recoverable state.

→ Escalation comment template + when-to-give-up decision tree: `references/escalation-protocol.md`

---

## Resilient Agent Checklist

→ Pre-flight checklist + test-failure procedure + composition with #013 and #010: `references/resilient-agent-checklist.md`

---

## Anti-Rationalization

| What you'll tell yourself | The truth |
|---|---|
| "My agent doesn't fail — this is overkill" | All long-running agents fail eventually. The question is whether you recover or restart. |
| "I'll add recovery hooks after I get it working" | You add them after the first catastrophic state-loss. That's too late. |
| "Retrying will eventually work" | Same call, same error, same result. Retry with a different approach or escalate. |
| "The error message is clear enough, I don't need a checkpoint" | The next session won't have that error message. The checkpoint will. |
| "Sub-agent retry is complex, I'll just retry inline" | Inline retry accumulates failure traces that corrupt reasoning. Sub-agent starts clean. |
