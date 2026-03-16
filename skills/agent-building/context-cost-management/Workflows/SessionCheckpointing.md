# Session Checkpointing

## When to Use

- "I need to pause and resume a session"
- "How do I hand off context before clearing?"
- Before running `/clear` or `/compact`
- Context is at 60% and a long subagent run is coming
- Before a break longer than 30 minutes

## Steps

**When to checkpoint:**
- Before `/clear` — never clear without checkpointing
- Before spawning long subagent runs
- When context hits 60%
- Before a break longer than 30 minutes

**What a good handoff contains:**
- What Was Happening (1-3 sentences on task + state)
- Next Action (specific enough to run immediately)
- Open Questions (decisions needing context)
- Files In Progress

**Cold-start SLA:** A well-written handoff → full productivity in under 60 seconds.

Run `/checkpoint` or `/handoff` to auto-generate.

## Verification

- Handoff document written and saved
- Cold-start test: can a fresh session reach full productivity in under 60 seconds from this handoff?

## Reference

See `../references/checkpointing.md` for: full template, cold-start procedure, and handoff quality checklist.
