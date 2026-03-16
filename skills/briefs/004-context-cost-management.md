# Skill Brief: Claude Code Context & Cost Management

## Demand Signal

- HN: "Claude Code rate limits" story — 609 pts, **705 comments** (highest comment-to-points ratio of any Claude Code story ever)
- HN: Community-built SQLite context mode MCP post — 570 pts; tool achieved 98% token reduction, proving developers will build their own tooling to solve this pain
- GitHub #16157: "Usage Limits Hitting Immediately" — 553 reactions; Max subscribers hitting limits within 30 minutes of starting
- Community observation (HN thread, 400+ comments): "81 MCP tools consuming 143K tokens before the first message" — unaudited MCP stacks are the #1 source of invisible context spend
- Third-party tool `claude-code-router` built by community to route to cheaper models (GLM-4, DeepSeek) — workaround for cost explosion
- `marginalab.ai` daily SWE-Bench regression tracker built because developers can't distinguish "model got worse" from "my session collapsed"
- Official docs have a "Token budgeting" page — zero practical audit guidance, zero concrete techniques

## Target Audience

Developers who've been using Claude Code for more than a week and hit one of:
- Rate limits cutting out mid-feature despite a Max subscription
- Sessions degrading after 30–60 minutes — Claude starts forgetting context, repeating mistakes, giving shallower answers
- MCP tool definitions consuming all available context before the first real message
- $100–1,500/month bills they can't explain or control
- Uncertainty: "Did the model get worse or did my config break something?"

They know Claude Code basics. They don't know why it's costing them and what's actually eating their budget.

## Core Thesis

Most Claude Code slowdowns, limit-hits, and cost explosions aren't about Claude — they're about unaudited context and unmanaged session hygiene. Concrete techniques: token auditing, strategic `/compact`, MCP slimming, and model routing by cost tier can extend session longevity 10x and cut spend 15x without changing a line of code.

## Skill Scope

### In Scope
- Token audit: what consumes context (MCP tool definitions, file reads, CLAUDE.md, conversation history, thinking blocks)
- Using `/compact` effectively — when to run it, what gets preserved vs. lost, post-compact checklist
- MCP context mode: the lazy-loading pattern that reduced one developer's overhead 98%
- Model tiering: Haiku for search/grep, Sonnet for implementation, Opus for architecture and review — and how to enforce it via subagent delegation
- Rate limit mechanics: what counts toward limits, how to gauge remaining budget mid-session, graceful degradation strategy
- CLAUDE.md audit: trimming rules that aren't firing, detecting instructions Claude is silently ignoring (GitHub #2544 — 42 reactions)
- Session checkpointing: handoffs, `/checkpoint`, starting cold and hitting full productivity in 60 seconds
- Diagnosing: is this context collapse, stale config, or a model regression?

### Out of Scope
- MCP server installation and configuration (separate skill)
- Enterprise-scale cost tracking (Bedrock/Vertex billing dashboards)
- Custom rate-limit monitoring dashboards
- API-level cost optimization (this is Claude Code, not the API)
- Token optimization for prompts you write yourself

## Sections

1. **The Hidden Context Budget** — What costs tokens and how much. MCP tool definitions (143K before first message), conversation history, file reads, thinking blocks, subagent spawn overhead. Most developers have no idea what's eating their budget because the UI doesn't show it.

2. **Token Audit: Finding Your Top Consumers** — How to inspect actual token usage mid-session. Warning signs of context bloat. The "81 tools = 143K tokens" math. Calculating your effective per-session budget.

3. **The `/compact` Command: When and How** — When to compact vs. start fresh. What gets preserved (task awareness, code state) vs. what gets lost (exact file content, prior reasoning). The post-compact checklist to restore fidelity. Manual vs. automatic compact triggers.

4. **MCP Slimming: Context Mode Architecture** — The 98% token reduction technique: lazy loading vs. eager loading of MCP tools. Which MCP servers to disable per-project. Project-scoped vs. global MCP configs. How to audit which servers you actually use.

5. **Model Routing by Cost Tier** — Haiku for file search, grep, and simple lookups (10–30× cheaper). Sonnet for implementation. Opus for architecture decisions and code review. The delegation math: routing 80% of work to Haiku cuts cost 15x. How to enforce this via the `Agent` tool's `model` parameter.

6. **Rate Limit Mechanics** — What counts toward limits (tokens + API call volume). How Max vs. API billing differ. How to gauge remaining budget before hitting a wall. Graceful degradation: what to do when you're running low mid-session without losing work.

7. **Session Checkpointing** — When to `/checkpoint` (before `/clear`, before long subagent runs, when context hits 60%). What a good handoff file contains. Cold-starting a new session and reaching full productivity in under 60 seconds.

8. **Diagnosing Regressions** — Decision tree: context collapse vs. stale CLAUDE.md vs. model regression. How to reproduce the failure with a clean session. Using `--version` flags and community regression trackers to isolate the source.

## Success Criteria

After reading this skill, a developer should be able to:

- [ ] Run a token audit and identify their top 3 context consumers
- [ ] Slim their active MCP tool list by 50%+ using context mode
- [ ] Know when to `/compact` vs. start fresh, and what to do after compacting
- [ ] Route subagent work to the right model tier (Haiku/Sonnet/Opus) based on task type
- [ ] Checkpoint and cold-resume a session in under 60 seconds
- [ ] Diagnose whether a session degradation is context collapse, config drift, or model regression

## Keywords

claude code context, token management, context window, claude code cost, rate limits, /compact, context collapse, model routing, session management, MCP optimization, context mode, token budget, claude code slow, hitting limits, session longevity

## Competitive Positioning

| Their Approach | Our Approach |
|---|---|
| `claude-code-router` third-party tool to route models | Native `Agent` tool model tiering — no extra install |
| Build a 143K-token context MCP server as the "fix" | Audit + slim your MCP list first; add lazy loading only if needed |
| Community SWE-Bench tracker to detect model regressions | Reproducible diagnosis flowchart with native diagnostics |
| Hit limits → upgrade subscription → repeat | Model routing cuts effective cost 15x before paying for more |
| `/compact` is opaque — just run it and hope | Structured checklist: what to verify before and after compacting |

## Estimated Complexity

**Medium.** No external dependencies. All techniques are native Claude Code primitives (`/compact`, `Agent` tool with model parameter, context mode MCP config, CLAUDE.md trimming). The skill teaches audit patterns and decision frameworks, not new tooling. The MCP context mode section is the most technically involved but still only requires editing a JSON config.
