---
name: persistent-memory
description: Use when building persistent memory for Claude Code agents that survives context compaction or session restarts. Triggers on: "claude code memory", "agent keeps forgetting", "MEMORY.md", "context compaction", "SessionStart hook", "Stop hook", "cross-session memory", "persistent memory", "memory across sessions", "session memory". Also fires for developers losing state between Claude Code sessions or wanting to capture decisions without a database. NOT for: in-app database features, Redis caching, or vector search.
---

# Persistent Memory Across Sessions

Context compaction silently wipes everything your agent learned. `--resume` replays tokens, not decisions. The pattern: file-based memory + hooks. Zero external dependencies, works offline, survives compaction.

## The System

```
~/.claude/memory/
├── MEMORY.md              # Index — always in context, < 200 lines
├── feedback_terse.md      # "User wants terse responses"
├── project_auth.md        # "Auth rewrite is compliance, not cleanup"
└── gotcha_stripe_429.md   # "Prod Stripe 429s omit Retry-After header"
```

1. **SessionStart hook** loads `MEMORY.md` → model knows what matters before you say a word
2. **PostToolUse hook** captures decisions at the moment they happen
3. **Stop hook** prompts review before exit

---

## Quick Setup (3 steps)

**Step 1 — Create the index:**

```bash
mkdir -p ~/.claude/memory
echo "# Memory Index" > ~/.claude/memory/MEMORY.md
```

**Step 2 — Add SessionStart hook** (`~/.claude/settings.json`):

```json
{
  "hooks": {
    "SessionStart": [{
      "matcher": "",
      "hooks": [{
        "type": "command",
        "command": "cat ~/.claude/memory/MEMORY.md 2>/dev/null && echo '---MEMORY-LOADED---' || echo 'No memory index found'"
      }]
    }]
  }
}
```

**Step 3 — Add Stop hook** (review before exit):

```json
"Stop": [{
  "matcher": "",
  "hooks": [{
    "type": "command",
    "command": "echo 'SESSION ENDING: Save decisions, gotchas, or breakthroughs to ~/.claude/memory/ before exiting.'"
  }]
}]
```

That's it. Persistent memory is live. See `references/hooks.md` for PostToolUse capture and advanced patterns.

---

## Memory File Format

```markdown
---
name: gotcha_stripe_429
description: Prod Stripe 429s omit Retry-After header — test env always includes it
type: gotcha
---

Stripe 429 behavior differs:
- **Test:** Returns `Retry-After: 0`
- **Production:** No header — use exponential backoff, never depend on the header

**Why:** Discovered when testing rate limit logic — test passed but would have broken in prod.
```

**The four types:**

| Type | Stores | Example |
|------|--------|---------|
| `user` | Who you're working with, preferences | "Prefers terse responses, mid-level dev" |
| `feedback` | Corrections and behavioral rules | "Don't mock DB in tests — caused prod incident" |
| `project` | Decisions, deadlines, rationale | "Auth rewrite = compliance requirement, not cleanup" |
| `reference` | Where to find things | "Pipeline bugs in Linear project INGEST" |

Full type examples with real entries: `references/memory-types.md`

---

## MEMORY.md: The Index

```markdown
# Memory Index

- [feedback_terse.md](feedback_terse.md) — Keep responses short; user hates padding
- [project_auth.md](project_auth.md) — Auth rewrite is compliance-driven, not tech debt
- [gotcha_stripe_429.md](gotcha_stripe_429.md) — Prod Stripe 429s omit Retry-After header
```

Rules:
- **Links + one-line description only.** Never write memory content inline.
- **Under 200 lines.** MEMORY.md is always in context — it must stay small.
- **Check before adding** — update existing entries, don't create duplicates.
- **One file per topic**, named by topic not date.

---

## What NOT to Save

| Skip it | Why |
|---------|-----|
| Code patterns, architecture, file paths | Read the source — it's always current |
| Git history, who changed what | `git log` is authoritative |
| Debugging steps tried | Fix is in the code; commit message has context |
| In-progress work / current task | Ephemeral — use `handoff.md` instead |
| Anything in CLAUDE.md | Already in context, don't duplicate |

**Threshold test:** "Would I be annoyed re-deriving this next session?" If yes → save. If you'd just re-read the code → skip.

Full anti-patterns + decay management: `references/anti-patterns.md`

---

## Anti-Rationalization

| What you'll tell yourself | The truth |
|---|---|
| "I'll save it at end of session" | Context compresses without warning. Save at the moment decisions happen. |
| "This is too obvious to save" | The 34 sessions with 0 saves all felt that way. If you made a choice, save it. |
| "MEMORY.md is getting long, I'll consolidate later" | Later is never. Consolidate now. 200-line limit is a hard wall. |
| "The model will remember from context" | It won't. Compaction erases in-context memory. Files survive. |
| "I'll just put it in CLAUDE.md" | CLAUDE.md is for behavioral rules, not session facts. Wrong container. |

---

## Complete Walkthrough

`references/walkthrough.md` — Session 1 hits a gotcha → captures it → Session 2 opens → learning visible before first message. Full working code.

---

## Reference Files

| File | Contents |
|------|----------|
| `references/hooks.md` | SessionStart, Stop, PostToolUse implementations + full settings.json template |
| `references/memory-types.md` | Four types with body structure, real entries, choosing the right type |
| `references/anti-patterns.md` | What not to save, decay management, deduplication, memory vs. handoff |
| `references/walkthrough.md` | End-to-end: capture → survive compaction → recover in new session |
