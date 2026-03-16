# Token Audit: Deep Reference

## The 143K-Token Math

A developer reported 81 active MCP tools consuming 143,000 tokens before the first real message.

**The calculation:**
```
81 tools × ~1,770 tokens average = 143,370 tokens
```

At 200K context window (Claude 3.5 Sonnet): that's **71.7% of the context window gone before you type anything.**

Each tool definition includes: name, description, parameter schema, examples. Complex tools (filesystem, GitHub) can hit 3,000–5,000 tokens each.

---

## Token Cost Table (Real-World Measurements)

| Source | Low | Typical | High |
|--------|-----|---------|------|
| Simple MCP tool (1 param) | 200 | 500 | 800 |
| Complex MCP tool (5+ params) | 800 | 1,500 | 3,000 |
| filesystem MCP server (full) | — | 8,000–15,000 | — |
| CLAUDE.md (minimal) | 200 | 1,500 | — |
| CLAUDE.md (heavy) | — | 5,000 | 10,000+ |
| Single file read (small) | 200 | 2,000 | — |
| Single file read (large) | — | 10,000 | 50,000+ |
| Conversation history (10 turns) | 500 | 3,000 | — |
| Conversation history (50 turns) | — | 20,000 | 80,000+ |
| Thinking block (simple task) | 500 | 3,000 | — |
| Thinking block (complex task) | — | 10,000 | 32,000 |
| Subagent result (scoped) | 200 | 1,000 | — |
| Subagent result (full transcript) | — | 20,000 | 100,000+ |

---

## Calculating Your Effective Per-Session Budget

**Step 1 — Count your MCP tools:**
```
Settings → MCP Servers → count total enabled tools
```

**Step 2 — Estimate fixed overhead:**
```
fixed_overhead = (mcp_tool_count × 1,500) + claude_md_tokens + system_prompt_tokens
```

**Step 3 — Available working budget:**
```
working_budget = context_window - fixed_overhead
# Example: 200K - 30K (20 tools) - 5K (CLAUDE.md) = 165K available
```

**Step 4 — Estimate session runway:**
```
turns_before_compact = working_budget / avg_tokens_per_turn
# Avg turn (with file reads): ~5,000 tokens
# 165K / 5,000 = ~33 meaningful turns before compact needed
```

---

## Warning Signs of Context Bloat

**Early warning (50–70% full):**
- Responses are slightly slower than normal
- Claude starts dropping minor details from earlier in the conversation

**Mid warning (70–85% full):**
- Claude explicitly references "earlier in our conversation" less accurately
- Suggestions stop accounting for constraints you established 20+ turns ago
- File reads feel slower (more context to prepend)

**Late warning (85–95% full):**
- Claude repeats work already done
- Acknowledges context limits ("I'll focus on what's most relevant")
- Tool calls occasionally time out

**Auto-compact trigger (~95%):**
- Session auto-compacts; you lose conversation history detail
- You're now in recovery mode — proactive checkpointing would have been better

---

## Audit Procedure

Run this audit at the start of any session you expect to be long (> 30 minutes):

1. **MCP audit:** Settings → MCP Servers. List all enabled servers. For each: when did I last use this? Disable anything unused in this project.

2. **CLAUDE.md audit:** Open your CLAUDE.md. Are all rules still firing? Rules Claude silently ignores waste tokens on every request. Trim dead rules. (See `references/diagnose.md` for the GitHub #2544 pattern.)

3. **Baseline estimate:** Apply the Step 2–4 calculation above. Know your effective runway before you start.

4. **Set a checkpoint trigger:** If your runway is < 50 turns, set a mental checkpoint at 50% context used.
