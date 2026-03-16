# Complete Walkthrough: A Session That Remembers

End-to-end example. Session 1 hits a gotcha → captures it → Session 2 avoids repeating it.

---

## The Setup

Doug is building an API integration. Memory system just installed, index is empty.

```
~/.claude/memory/
└── MEMORY.md    # Empty — just "# Memory Index"
```

---

## Session 1: The Gotcha Happens

```
Doug: Add rate limit handling to the Stripe webhook endpoint.

Claude: [reads code, adds exponential backoff with 3 retries]
```

During work, Claude discovers something non-obvious: Stripe's test environment returns 429s with `Retry-After: 0`, but production 429s don't include the header at all. The test would pass, but the production code would fail trying to read a header that isn't there.

**Without memory system:** This gets noted in-context, then compacted away. Session 2 hits the same issue.

---

## PostToolUse Hook Fires After the Edit

```
CAPTURE SIGNAL: Did this change reveal a decision or gotcha worth saving? Save now — not at end of session.
```

**Claude writes the gotcha immediately:**

```bash
# ~/.claude/memory/gotcha_stripe_429.md
cat > ~/.claude/memory/gotcha_stripe_429.md << 'EOF'
---
name: gotcha_stripe_429
description: Stripe test 429s include Retry-After: 0; prod 429s omit the header entirely
type: gotcha
---

Stripe 429 behavior differs between environments:
- **Test environment:** Returns `Retry-After: 0` header
- **Production:** No `Retry-After` header — must use exponential backoff, never depend on header presence

**Why:** Discovered when testing rate limit handling — test passed but code would fail in prod reading a missing header.

**How to apply:** When implementing Stripe rate limit handling, always fall back to exponential backoff. Never assume `Retry-After` will be present.
EOF
```

**Claude updates the index:**

```markdown
# Memory Index

- [gotcha_stripe_429.md](gotcha_stripe_429.md) — Stripe test 429s have Retry-After: 0; prod 429s don't
```

---

## Session End: Stop Hook Fires

```
SESSION ENDING: Save any decisions, gotchas, or breakthroughs before exiting.
```

Claude confirms the gotcha is saved. Session ends cleanly.

---

## Session 2: The Payoff

**SessionStart hook fires before Doug's first message:**

```
# Memory Index

- [gotcha_stripe_429.md](gotcha_stripe_429.md) — Stripe test 429s have Retry-After: 0; prod 429s don't
---MEMORY-LOADED---
```

Model sees the Stripe gotcha before Doug says anything.

```
Doug: Refactor the webhook retry logic to use the new HttpClient.
```

Claude is already aware of the Stripe test/prod difference. Implements retry logic that doesn't depend on `Retry-After` header. Test and prod behaviors handled correctly from the start.

**Without memory:** Same bug would likely recur during the refactor.
**With memory:** Gotcha survived context compaction, a `--resume`, and a completely fresh session.

---

## The Full Loop

```
Session 1:
  SessionStart → MEMORY.md loaded (empty index)
  [work happens]
  PostToolUse fires → gotcha discovered → memory file written → index updated
  Stop → review prompt → confirmed saved

Session 2:
  SessionStart → MEMORY.md loaded (includes gotcha)
  [model acts with prior context]
  → same bug not repeated
```

---

## After 10 Sessions

```
~/.claude/memory/
├── MEMORY.md                          # Index (< 200 lines)
├── user_expertise.md                  # Doug's stack + level
├── user_style.md                      # Response style preferences
├── feedback_no_db_mocks.md            # Don't mock DB in tests
├── feedback_no_summaries.md           # Don't summarize diffs
├── project_auth_rewrite.md            # Auth = compliance, not cleanup
├── gotcha_stripe_429.md               # Stripe 429 prod vs test
├── gotcha_cors_dev_domains.md         # CORS blocks *.dev domains
├── reference_bugs_linear.md           # Linear INGEST for pipeline bugs
└── reference_grafana_latency.md       # Grafana latency dashboard URL
```

9 files. Every session opens with the index. Each gotcha avoided saves 15-30 minutes of re-investigation.

---

## What This Looks Like in Practice

**Session 6, two months later:**

```
Doug: We need to add a staging environment for the Stripe integration.

Claude: [has MEMORY.md loaded, sees gotcha_stripe_429.md]

Will note that Stripe's test environment returns Retry-After: 0 on 429s but
production doesn't include the header at all — the staging environment will
likely behave like production on this. Implementing fallback backoff by default
rather than relying on the header.
```

Doug didn't have to repeat the context. The memory did it.
