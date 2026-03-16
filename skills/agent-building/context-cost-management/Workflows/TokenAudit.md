# Token Audit

## When to Use

- "What's eating my context budget?"
- "Why is my context so full?"
- "What's consuming all my tokens?"
- Unexplained context usage before the session is long

## Steps

**What's actually consuming your budget:**

| Source | Typical Token Cost | Notes |
|--------|-------------------|-------|
| MCP tool definitions | 500–2,000 per tool | 81 tools = **143K tokens before first message** |
| CLAUDE.md | 1K–10K | Every rule fires on every request |
| File reads | 500–50K per file | Cumulative across the session |
| Conversation history | Grows unbounded | Auto-compact at ~95% full |
| Thinking blocks | 1K–32K | Enabled by default for complex tasks |
| Subagent results injected back | 5K–100K | Full transcripts = parent context explosion |

**Audit your session mid-flight:**
1. Check the context meter (top-right in Claude Code UI)
2. Count active MCP tools: `Settings → MCP Servers → count enabled tools`
3. Each tool definition = 500–2,000 tokens regardless of whether you invoke it

## Verification

- You can identify the top 1-2 sources consuming your context budget
- You know whether the issue is MCP tools, CLAUDE.md size, file reads, or history

## Reference

See `../references/token-audit.md` for: the 143K-token math, calculating your effective per-session budget, and warning signs of context bloat.
