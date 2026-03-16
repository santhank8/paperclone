# Anti-Patterns and Memory Decay

---

## What NOT to Save

| Skip it | Why |
|---------|-----|
| Code patterns, conventions, architecture | Read the source — it's always current, memory goes stale |
| File paths and project structure | Glob/Grep finds these in 1 second |
| Git history, who changed what | `git log` and `git blame` are authoritative |
| Debugging steps you tried that didn't work | The fix is in the code; commit message has context |
| In-progress work, current task state | Ephemeral — use `handoff.md` instead |
| Anything already in CLAUDE.md | Already in context, duplicating creates drift |
| Scheduled tasks, cron jobs | Check the scheduler, not memory |
| Third-party API docs | Just fetch them — they change |

**The threshold test:** "Would I be annoyed re-deriving this next session?"
- Yes → save it.
- No, I'd just re-read the code → skip it.

---

## Memory Decay

Memories go stale. A `project` memory from months ago might be wrong today.

**How to prevent decay:**

1. **Include dates on time-sensitive entries.** "Auth rewrite due before Q2 audit (2026-04-01)" is better than "Auth rewrite has a deadline." After the date passes, the memory is suspect.

2. **Update don't duplicate.** Before writing a new file, scan MEMORY.md for an existing entry on the same topic. Update it in place.

3. **Delete wrong memories immediately.** When the user corrects something you had in memory, find the file → fix or delete → confirm. Never acknowledge a correction and leave bad data stored.

4. **Quarterly sweep on `project` type.** These have the shortest shelf life. Review and prune every few months.

---

## Deduplication Procedure

Before writing a new memory file:

1. Scan MEMORY.md index for related entries.
2. If an entry exists for the same topic → update that file instead of creating a new one.
3. If no entry exists → create a new file, add the link to MEMORY.md.
4. If MEMORY.md is approaching 200 lines → consolidate by merging related entries before adding.

---

## MEMORY.md Anti-Patterns

| Anti-Pattern | Why it fails |
|---|---|
| Writing memory content directly in MEMORY.md | Index grows to 500+ lines; context overflows; content gets skipped |
| Chronological entries ("2026-01-15: learned X") | Can't find things by topic; duplicates accumulate over time |
| One giant `learnings.md` | No structure; grows unbounded; can't update individual facts |
| Putting code snippets in memory | Stale instantly; just read the source |
| Saving every edit as "I changed file X" | Noise drowns signal; only the *why* is worth saving, not the *what* |
| Past 200 lines with "I'll trim later" | Later is never. At 200 lines, MEMORY.md becomes too long for context. Hard limit. |

---

## Memory vs. Handoff

| Use memory files when | Use handoff.md when |
|---|---|
| A decision has lasting value across many future sessions | You need to resume mid-task next session |
| A gotcha will happen again on this project | Current state is complex and temporal |
| A behavioral rule should change how you always work | You're mid-implementation and need to pick up exactly here |
| The learning is small (1-5 lines) | The context is large (current approach, blockers, next steps) |

Memory files are permanent (pruned when stale). Handoffs are temporary — archive them after resuming.

**Creating a handoff:**

```bash
# Before ending a complex session
cat > handoff.md << 'EOF'
# Session Handoff
**Created:** 2026-03-15T17:00:00Z

## What Was Happening
[current task context]

## Current State
[what's done, what's in progress]

## Next Steps
1. [immediate next action]
2. [following step]
EOF
```

---

## The Correction Protocol

When the user tells you something in memory is wrong:

1. Read the memory file immediately — don't just acknowledge verbally.
2. Find the incorrect entry.
3. Fix or delete it.
4. Update MEMORY.md index if the file was deleted.
5. Confirm to the user: "Updated [filename] — removed [wrong claim], replaced with [correct fact]."

**Never**: acknowledge the correction and leave bad data in memory. That's a silent lie that will burn you next session.
