# Diagnosing Regressions: Deep Reference

## The 3-Way Decision Tree

```
Session degraded (bad answers, forgotten context, repeated mistakes, shallow output)
│
├─ Did I do heavy file reads, many tool calls, or spawn subagents recently?
│  YES → Context collapse (most common case)
│  │
│  ├─ Fix: /compact + post-compact checklist
│  ├─ If severe: /clear + resume from checkpoint
│  └─ Prevention: checkpoint at 60% context; /compact before heavy read passes
│
├─ Did I recently update CLAUDE.md, add MCP servers, or change project config?
│  YES → Config drift
│  │
│  ├─ Fix: Revert the CLAUDE.md/config change, test with clean session
│  ├─ Audit: identify which rule Claude is ignoring (GitHub #2544 pattern)
│  └─ Prevention: test CLAUDE.md changes in a throwaway session before committing
│
└─ Happening in clean sessions too, no config changes?
   MAYBE → Model regression
   │
   ├─ Reproduce: fresh session, explicit context, same task
   ├─ Test: does it fail identically with the same prompt?
   ├─ Validate: check Claude Code version; check community regression trackers
   └─ Escalate: if confirmed regression, file GitHub issue with reproduction case
```

---

## The Clean Session Test

**Purpose:** Separate context collapse (your session) from model regression (global problem).

```bash
# 1. Open a fresh Claude Code session (new terminal, not /clear)
# 2. Provide explicit context for the task (don't assume prior conversation)
# 3. Run the exact prompt that was failing

"I'm implementing a JWT refresh token rotation function.
Here's the function signature: [paste it]
Here's the error I'm getting: [paste it]
What's wrong?"
```

**Results:**
- Works in clean session → context collapse (your session was degraded, not the model)
- Fails identically → model regression OR config problem at system level

**If it works in clean session:**
- The problem is your session, not Claude
- Resume from checkpoint or /clear with a handoff

**If it fails identically:**
- Check your global CLAUDE.md and MCP config (applies to all sessions)
- Check Claude Code version: `claude --version`
- Check community reports

---

## CLAUDE.md Audit (GitHub #2544 Pattern)

GitHub issue #2544 (42 reactions): "Claude silently ignores CLAUDE.md instructions."

Claude Code reads CLAUDE.md but doesn't guarantee compliance with every rule. Rules that are:
- Contradictory (cancel each other out)
- Vague (no testable action)
- Too numerous (lower-priority rules get deprioritized)
- Outdated (reference files/configs that no longer exist)

...get silently ignored.

**Audit procedure:**

**Step 1 — Count your rules:**
More than 30 rules? Prioritize. The top 10–15 get reliably followed. The rest are aspirational.

**Step 2 — Test each high-priority rule:**
For each rule you care about, give Claude a task that should trigger it. Did it fire?

**Step 3 — Remove dead rules:**
Rules referencing old patterns, deprecated APIs, or files that no longer exist. They consume tokens without effect.

**Step 4 — Consolidate redundant rules:**
"Don't use npm" + "Always use bun" = one rule: "Use bun for all package operations."

**Trimming target:** CLAUDE.md under 5,000 tokens. Under 3,000 tokens for most projects.

---

## Community Regression Tracking

**`marginallab.ai`** — daily SWE-Bench regression tracker. Built because developers couldn't distinguish "model got worse" from "my session collapsed." Tracks Claude Code performance on standardized benchmarks across versions.

**When to check it:**
- You've run the clean session test and it still fails
- Multiple developers on your team report the same degradation at the same time
- The failure is on a task type you've done successfully many times before

**Claude Code GitHub issues** — search for `regression` or `quality` in recent issues. If you're seeing a regression, someone else probably already filed it.

**Version check:**
```bash
claude --version
```

If a recent update broke something, rolling back to a previous version is possible (though not recommended long-term).

---

## The Diagnosis Log Pattern

When you hit a degradation, log it before fixing it. This builds a pattern over time.

```markdown
## Degradation Log

### 2026-03-15
- **Symptom:** Claude stopped following the "no useEffect for data" rule
- **Context:** Session at ~80% full, had done 20+ file reads
- **Diagnosis:** Context collapse (fresh session worked fine)
- **Fix:** /compact + re-stated the rule explicitly
- **Outcome:** Resolved

### 2026-02-28
- **Symptom:** All function implementations were verbose/over-engineered
- **Context:** Fresh session, no config changes
- **Diagnosis:** Unclear (persisted in clean session)
- **Fix:** Tested again 2 days later — resolved (likely brief model quality dip)
- **Outcome:** Transient, no action needed
```

Pattern across 3+ entries → systemic issue worth addressing (config, rules, or filing a GitHub issue).
