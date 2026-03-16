# Rate Limit Mechanics

## When to Use

- "I'm hitting rate limits mid-session"
- "Claude Code is throttling me"
- "Usage limits hit unexpectedly"
- Max subscribers hitting limits during a session

## Steps

**What counts:** token volume (input + output + cached), API call count, and for Max: rolling 5-minute window + hourly hard limits.

**Signs you're approaching the wall** (before it hits):
- Responses noticeably slow
- Unprompted "I'll keep this brief" hedges appear
- Tool calls start silently failing

**Graceful degradation checklist:**
- [ ] `/compact` immediately — frees remaining capacity
- [ ] Scope to one task: no new features until current task completes
- [ ] Route remaining searches to Haiku
- [ ] At 20% budget remaining: checkpoint and pause

## Verification

- You've run `/compact` and scoped to a single task
- You know whether you're on Max (rolling window) or API (token volume) billing

## Reference

See `../references/rate-limits.md` for: Max vs. API billing mechanics, how to gauge remaining budget, and the full degradation playbook.
