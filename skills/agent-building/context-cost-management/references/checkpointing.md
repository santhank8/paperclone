# Session Checkpointing: Deep Reference

## The Checkpoint Trigger Conditions

**Mandatory checkpoints:**
- Before `/clear` — never clear without checkpointing
- Before any subagent run expected to take > 5 minutes
- Before a break > 30 minutes
- When context hits 60% (checkpoint is cheap; recovery is expensive)

**Opportunistic checkpoints:**
- After completing a significant feature or decision
- After a session that involved multiple file changes
- When you've made decisions that aren't obvious from the code

**Non-events that don't need checkpoints:**
- Single-file quick edits
- Question/answer exchanges without code changes
- Sessions under 30 minutes

---

## What a Good Handoff Contains

```markdown
# Session Handoff
**Created:** 2026-03-15T18:00:00Z
**Branch:** feature/user-auth

## What Was Happening
Implementing JWT refresh token rotation in the auth service. The access token
endpoint is done and tested. Refresh token rotation logic is 80% complete —
the `rotateRefreshToken()` function is written but the database cleanup step
(removing old tokens) is not yet implemented.

## Next Action
Open `services/auth/tokenService.ts`. Implement the `cleanupExpiredTokens()`
call at line 142, after the new token is saved but before the response is returned.
Run `bun test auth` to confirm the test suite passes.

## Open Questions
- Should we hard-delete expired tokens or soft-delete (for audit trail)?
  This affects the cleanup query. Leaning toward soft-delete — check with team.

## Files In Progress
- `services/auth/tokenService.ts` — refresh rotation (80% done)
- `services/auth/__tests__/token.test.ts` — test for rotation (needs cleanup test)

## Decisions Made
- Using sliding window refresh (each refresh extends expiry) not fixed TTL
- Token stored in httpOnly cookie, not localStorage (security decision, don't change)
- Refresh token length: 64 bytes (128 hex chars) — standardized across the service
```

**Cold-start SLA:** This handoff → full productivity in under 60 seconds.

---

## Cold-Start Procedure

When resuming from a handoff:

**1. Read the handoff file:**
```
Read references/handoff.md (or wherever you saved it)
```

**2. Re-read the active files:**
Open every file listed in "Files In Progress." Don't assume they match the handoff description — someone may have changed them.

**3. Run the test suite:**
```
bun test [relevant scope]
```
Verify actual state matches expected state before writing new code.

**4. Execute "Next Action" exactly:**
The handoff was written with a specific next step in mind. Do that step first. Defer "also while I'm here" work until the handoff task is complete.

**5. Close the loop on open questions:**
If any "Open Questions" block a decision, resolve them before touching the code they affect.

**Total time from cold start to first commit:** < 60 seconds for a well-written handoff.

---

## The /checkpoint and /handoff Skills

**`/checkpoint`** — lightweight: saves current state to context memory. Good for short breaks or before /compact.

**`/handoff`** — full handoff file generation: structured markdown, written to disk. Best for:
- End-of-session saves
- Before /clear
- Handing work to another agent

**Running /handoff:**
```
/handoff
```
Claude generates the handoff file at `handoff.md` (or prompts for a path). Review it before ending the session — a bad handoff is worse than no handoff.

---

## Handoff Quality Checklist

Before ending a session, verify your handoff:

- [ ] "Next Action" is specific enough to execute without thinking
- [ ] All in-progress files are listed
- [ ] Decisions are recorded WITH their reasoning (not just "we're using X")
- [ ] Open questions are explicit (don't leave them implied)
- [ ] Branch name is correct (don't resume on the wrong branch)
- [ ] Test state is noted (do tests pass currently? what's the expected state?)

**Common handoff failure modes:**
- "Next: implement the auth thing" — too vague, 5 minutes of archaeology to reconstruct
- Missing file list — 10 minutes of `git status` to figure out what was in flight
- Decision without reason — "we're using soft-delete" vs. "we're using soft-delete for audit trail compliance"
- No branch info — resumed on main, overwrote feature work

---

## Cold-Start Speed Benchmarks

| Handoff Quality | Time to First Useful Commit |
|----------------|----------------------------|
| No handoff | 15–30 minutes |
| Minimal (1–2 lines) | 5–10 minutes |
| Standard (template above) | 45–90 seconds |
| Detailed (+ decision log) | 30–60 seconds |

The time investment writing a good handoff (2–3 minutes) pays back 15–30 minutes of cold-start archaeology on every resume.
