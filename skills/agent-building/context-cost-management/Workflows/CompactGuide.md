# Compact Guide

## When to Use

- "When should I run /compact?"
- "Should I compact or start fresh?"
- Session context is at 60-80% and the task is still running
- Answers are getting worse and you suspect context pressure

## Steps

**When to compact vs. start fresh:**

| Situation | Action |
|-----------|--------|
| 60–80% context used, task still running | `/compact` — preserve state, free space |
| Task complete, starting new feature | `/clear` — full fresh start |
| Degrading (repeated mistakes, shallow answers) | `/compact` first; no improvement → fresh |
| Below 50%, no degradation | Continue, don't compact |

**What compact preserves vs. loses:**

| Preserved | Lost |
|-----------|------|
| Task awareness (what you were doing) | Exact file contents you read |
| Decisions made | Prior reasoning chains |
| Code state (what was changed) | Conversation history detail |
| Current goal | Tool call history |

**Post-compact checklist** (run immediately after):
- [ ] Re-read the file you were last editing
- [ ] Re-state the current task goal explicitly
- [ ] Verify Claude still knows the relevant codebase context
- [ ] Run a quick test to confirm state is intact

## Verification

- You've chosen the right action (compact vs. clear) for your situation
- If you compacted: post-compact checklist complete, session state verified intact

## Reference

See `../references/compact-guide.md` for: manual vs. auto compact triggers, post-compact recovery workflow, when `/clear` beats `/compact`.
