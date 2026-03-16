# Rate Limit Mechanics: Deep Reference

## Max Plan vs. API Billing

**Max Plan (subscription):**
- Soft limits per rolling 5-minute window: token volume + API call count
- Hard limits per hour: varies by tier
- Limits reset — you're not locked out, you're throttled
- Community reports: Max subscribers hit limits within 30 minutes of sustained complex work
- Cost: flat monthly ($20/$100/$200 tiers) — but limits constrain effective throughput

**API Billing (pay-as-you-go):**
- No hard rate limits (at standard tier)
- Per-token billing: can spike to $500–1,500/month with unmanaged usage
- Rate limits at high tiers via concurrency caps, not token caps
- Better for heavy workloads if you've implemented cost controls

**Key difference:** Max hits throughput walls. API hits cost walls. Both are solved by the same techniques: model routing, MCP slimming, context hygiene.

---

## What Counts Toward Limits

**Token volume (primary limiter):**
- Input tokens (everything in the context window)
- Output tokens (Claude's response)
- Cache read tokens (discounted but still counted)
- Thinking block tokens (count as output)

**API call count (secondary limiter):**
- Each tool call = 1 API call
- Each conversation turn = 1 API call
- Subagent spawns = multiple API calls
- Context compaction = 1 API call

**MCP calls do NOT count** toward API rate limits (they're handled by MCP servers, not the Anthropic API).

---

## Gauging Remaining Budget Mid-Session

**Visual signal:** Context meter (top-right of Claude Code UI).
- Green: < 50% full
- Yellow: 50–80% full
- Red: > 80% full — time to act

**Behavioral signals (no meter needed):**
- Responses slow by 20–30% → approaching rate limit, not context limit
- "I'll keep this brief" unprompted → Claude is aware of approaching limits
- Tool calls queuing (visible in UI) → rate limit active, calls are being throttled
- HTTP 429 in tool error output → hard rate limit hit

**The difference: context limit vs. rate limit:**
- Context limit: responses get shallower, Claude loses earlier context, slow for a different reason
- Rate limit: responses slow uniformly, quality stays high but throughput drops

---

## Graceful Degradation Playbook

**When you hit 70% token budget or see behavioral signals:**

**Step 1 — /compact immediately**
Don't wait until 95%. At 70%, the summary is still rich. You recover 30–40% of working space.

**Step 2 — Scope strictly**
No new topics. No "while I'm here, also..." tasks. Current task → done → then reevaluate.

**Step 3 — Route remaining work to Haiku**
Any search, file read, or classification task left in your queue: spawn as Haiku.

**Step 4 — At 20% budget remaining: checkpoint and pause**
```
/checkpoint
```
Write the handoff. Start a fresh session with the checkpoint as context. Do not push forward.

**What NOT to do:**
- Don't compact repeatedly hoping to get more space (second compact has diminishing returns)
- Don't disable thinking blocks mid-task (changes the quality of current work)
- Don't spawn more subagents to "speed up" (multiplies the rate limit pressure)

---

## Max Plan Limit Response Strategy

If you're a Max subscriber hitting limits mid-session:

**Short-term fix:**
1. /compact
2. Switch to shorter turns (shorter prompts, scoped requests)
3. Avoid spawning subagents for 10–15 minutes (let the rolling window reset)

**Medium-term fix:**
- MCP slimming (reduces fixed overhead per request)
- Model routing (Haiku for search doesn't count toward Sonnet/Opus rate limits separately)

**Long-term fix:**
- Evaluate if your usage pattern fits API billing better than Max
- Community data: developers doing > 4 hours/day of heavy Claude Code work often spend less on API than Max due to rate limit lost productivity

---

## GitHub Issue #16157: "Usage Limits Hitting Immediately"

This open issue (553 reactions as of early 2026) tracks Max subscribers hitting limits within 30 minutes. Root causes identified by community:

1. **Unslimmed MCP stacks** — each tool call triggers new context injection
2. **No model routing** — everything runs at Sonnet/Opus rate
3. **Subagent spawns without result scoping** — each spawn = multiple API calls + full context injection
4. **CLAUDE.md bloat** — large CLAUDE.md files re-evaluated every request

All four are solved by the techniques in this skill.
