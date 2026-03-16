# The /compact Command: Deep Reference

## When to Use /compact vs /clear

**Use /compact when:**
- Context is 60–80% full and you're mid-task
- Session is degrading but you need to preserve task context
- You're about to do a heavy file read pass and want to free space first
- You have > 2 hours of work context you can't afford to lose

**Use /clear when:**
- Current task is complete, starting something unrelated
- Session has fully degraded and /compact won't recover it
- Context is corrupted (Claude is confidently wrong about recent changes)
- You want a fully clean state (no anchoring to old context)

**Rule of thumb:** /compact preserves your current task thread. /clear severs it cleanly.

---

## Manual vs. Auto Compact

**Auto-compact** fires at ~95% context usage. At that point:
- You've been in degraded performance for the last 20–30% of the session
- The summary Claude generates is based on heavily compressed history
- Post-compact recovery is harder — less coherent context to restore from

**Manual /compact at 60%:**
- Context is still rich — the summary is accurate
- You're compacting from strength, not desperation
- Post-compact checklist (below) is easier to execute

**Manual compact before long operations:**
```
[You're about to do a 10-file audit pass]
1. /compact first — frees space for the upcoming reads
2. Re-state your current goal
3. Run the file pass
```

---

## What /compact Actually Does

Claude generates a summary of the conversation, then replaces the full history with that summary. The summary includes:
- The stated task goal
- Key decisions made
- Files changed and what was changed
- Current state and next steps

What the summary does NOT preserve:
- Exact file contents you read (only references to them)
- Step-by-step reasoning chains (only conclusions)
- Tool call arguments (only outcomes)
- Nuances of decisions that weren't explicitly stated

**Implication:** anything you want in the post-compact context should be explicit, not implied. State decisions out loud. State constraints explicitly. Don't rely on Claude to infer from conversation tone.

---

## Post-Compact Checklist

Run these immediately after /compact:

**1. Re-read the active file:**
```
Read the file you were last editing.
```
The compact summary references the file but doesn't include its content. Re-read it to restore fidelity.

**2. Re-state the goal:**
```
"We are implementing [feature]. Current state: [X is done, Y is next]."
```
Make the current task explicit, not assumed.

**3. Verify constraint awareness:**
```
"Remember: we're not touching the auth layer. We're only changing [specific scope]."
```
Constraints often survive the summary as references, not hard stops. Re-anchor them.

**4. Check prior decisions:**
```
"We decided to use [approach] because [reason]. Still using that approach."
```

**5. Run a quick sanity test:**
If you were coding: run the tests, check the build. Confirm Claude's understanding matches reality.

**Time investment:** 2–3 minutes. Skip it and risk 20 minutes of context drift cleanup.

---

## The Compact-or-Clear Decision Matrix

```
Context at 60-80% full
│
├─ Mid-task, same feature? → /compact
│
├─ Task done, new task? → /clear (with checkpoint first)
│
└─ Session degrading (bad answers)?
   │
   ├─ Degraded recently (last 10 turns)? → /compact + post-compact checklist
   │
   └─ Degraded > 20 turns, pervasive errors? → /clear (loss is already baked in)
```
