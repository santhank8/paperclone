# Skill Brief: Coordinate Multiple Claude Code Agents Without Losing Your Mind (or Your Budget)

## Demand Signal

- **ClawHub gap**: Zero skills in the 45k+ catalog teach multi-agent coordination — a complete white space while adjacent agent skills total 400k+ downloads (self-improving-agent: 224k, ontology: 107k, proactive-agent: 101k)
- **GitHub agent cluster**: 30+ open `area:agents` issues filed just in the last 48 hours (2026-03-14–15), including:
  - #34693: "Agent teams silently fall back to isolated subagents — runtime inconsistently chooses team path" (has repro)
  - #34692: "PreToolUse/PostToolUse hooks do not fire for subagent tool calls" (has repro)
  - #34668: "Agent Teams: teammates intermittently stop receiving SendMessage after extended polling" (has repro)
  - #34653: "MCP tool approval requests from Agent Teams teammates do not route to team lead" (has repro)
  - #34645: "Parallel subagents with worktree isolation fail due to git config lock contention" (has repro)
  - #34614: "TeamCreate spawns teammates that silently exit due to incorrect command generation" (has repro)
  - #34572: "Sub-agents should inherit parent's CLAUDE.md instructions" (1 comment — high pain)
  - #34558: "First-class multi-model orchestration — Haiku-as-Scout, cascading pipelines" (1 comment)
  - #30140: "Shared channel for agent teams" (multiple comments)
  - #10212: "Independent Context Windows for Sub-Agents" (traction)
- **Cost explosion evidence**: Documented case of 887k tokens/minute with 49 subagents; enterprise teams reporting 300–500% higher API costs than expected from naively spawning parallel agents
- **Community workarounds**: Developers running Claude Code in tmux panes as manual parallel subagents before TeamCreate existed — grassroots evidence of demand
- **Key insight**: The experimental `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` feature is actively buggy (silent fallbacks, SendMessage loss, exit races). Users need to know the stable coordination pattern — which is `Agent` tool + structured file/message coordination, not the experimental team primitives.

## Target Audience

Developers who've built their first autonomous agent (skill #001) and want to parallelize or specialize work:

- They've tried spawning multiple agents and watched their API bill explode
- They asked two agents to modify related code and got merge conflicts
- They tried TeamCreate and got silence — no error, no output, agent never ran
- They want a planner/implementer/reviewer pipeline but don't know how to wire it
- They want to use Haiku for cheap tasks and Opus for critical ones but can't figure out how to enforce it

They know how agents work conceptually. They're tripping on the *operational* patterns — coordination, cost control, and avoiding the known failure modes.

## Core Thesis

Parallel agents deliver real leverage, but only when you've solved three problems first: isolation (agents don't collide on files or git), coordination (agents share state without shared memory), and cost control (the right model for each task, not Opus everywhere). This skill teaches the stable patterns using only the `Agent` tool — no experimental flags, no flaky team primitives.

## Skill Scope

### In Scope

- When to parallelize (and the 95% of tasks where it adds overhead, not value)
- Git worktree isolation: each agent gets its own branch, no lock contention
- File-based coordination: shared status files, task manifests, result aggregation
- SendMessage fundamentals: the stable polling pattern that doesn't stall
- Model selection by task type: Haiku/Sonnet/Opus tiering for cost control
- Context budgeting: subagent result summarization to prevent parent context bloat
- CLAUDE.md injection: encoding rules into subagent prompts since they don't inherit
- Orchestrator patterns: fan-out/fan-in, pipeline (planner→implementer→reviewer), and scout patterns
- A working example: 3-agent code review pipeline with tiered models and file coordination

### Out of Scope

- `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` / `TeamCreate` / `TeamDelete` (actively buggy — skip it)
- Paperclip / external orchestration platforms (separate skill)
- MCP server setup (separate skill)
- Distributed / cloud agent execution
- Agent memory passing (brief mention only — deep treatment in skill #002)

## Sections

1. **The 95% Rule: When NOT to Use Multiple Agents** — The parallelization tax is real. Single agent wins for most tasks. The checkboxes for when multi-agent is actually justified: genuinely parallel subtasks, different tool/model requirements, blast radius isolation. One wrong decision here doubles your bill for nothing.

2. **Isolation First: Git Worktrees for Parallel Agents** — Why naive parallel agents corrupt each other's work (file locks, git config contention, build collisions). Setting up worktrees: each agent gets a branch, its own working directory, no collisions. The worktree lifecycle: create before spawn, cleanup after merge.

3. **Coordination Without Shared Memory** — Agents don't share in-context state. The stable coordination primitives: a shared task manifest (who owns what), status files (agent writes done when complete), result files (structured output the orchestrator reads). The pattern that works without any experimental features.

4. **SendMessage: The Stable Polling Pattern** — What SendMessage actually does (async inbox) vs. what developers expect (synchronous call). The known failure mode (stop polling → stuck teammate, requires Esc). The stable pattern: CronCreate for polling, not a bash sleep loop. When to use SendMessage vs. when to use files.

5. **Tiered Models: Right Tool, Right Cost** — Haiku vs. Sonnet vs. Opus: capabilities, context limits, when each makes sense. Enforcing model choice from the orchestrator prompt (it won't inherit). The cascade pattern: Haiku scouts → Sonnet implements → Opus validates. Real cost comparison for a 4-agent pipeline.

6. **Context Budget Management** — Each subagent result injected back to the orchestrator burns parent context. The summarization contract: agents return structured summaries (JSON/markdown), not full transcripts. Preventing the 887k token/minute trap. When to run agents in background vs. foreground.

7. **CLAUDE.md Inheritance Gap** — Subagents don't load your CLAUDE.md. Rules you think are universal are invisible to them. Encoding critical rules in the spawn prompt (not a reminder — a hard requirement in the subagent instructions). What goes in the prompt vs. what's safe to skip.

8. **Complete Example: 3-Agent Code Review Pipeline** — Orchestrator reads the PR diff. Scout agent (Haiku): identifies changed files, classifies risk by area. Review agents (Sonnet × 2, parallel, worktree-isolated): one reviews logic, one reviews security. Aggregator: orchestrator merges results into a single report. Full working code: spawn prompts, coordination files, model selection, cleanup.

## Success Criteria

After installing this skill, a developer should be able to:

- [ ] Correctly evaluate whether a given task justifies multiple agents (not just assume parallelism is faster)
- [ ] Set up git worktree isolation for two parallel agents without lock contention
- [ ] Write a shared status file protocol that two agents use to coordinate without shared memory
- [ ] Spawn a Haiku agent for file discovery and a Sonnet agent for analysis from the same orchestrator
- [ ] Return structured summaries from subagents to avoid parent context bloat
- [ ] Inject critical CLAUDE.md rules into a subagent spawn prompt
- [ ] Build a working 2-agent pipeline (scout → implementer) using only the stable `Agent` tool

## Keywords

claude code multi-agent, parallel agents, agent coordination, agent teams claude code, subagent orchestration, git worktree agents, claude code cost control, haiku sonnet opus routing, SendMessage claude code, agent pipeline, fan-out fan-in claude, multi-agent cost, subagent context bloat, claude code parallelization

## Competitive Positioning

| Their Approach | Our Approach |
|---------------|-------------|
| Use `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` / `TeamCreate` | Skip the experimental flag — stable `Agent` tool only |
| Spawn Opus agents for everything | Tiered routing: Haiku scout, Sonnet implement, Opus validate |
| Pass full transcripts back to orchestrator | Structured summaries only — prevents parent context bloat |
| 9 agents in parallel for a 2-hour task | Single agent is usually faster — teach the 95% rule first |
| Agents modify the same branch and collide | Worktree isolation — each agent is sandboxed by default |
| Copy CLAUDE.md rules into every prompt manually | Encode once in a subagent prompt template — reuse it |

## Estimated Complexity

Medium. No external dependencies — all native `Agent` tool and git worktree features. The hardest part isn't the code, it's the judgment: when to parallelize, how to structure coordination files, how much context each agent's results will consume. The skill provides decision frameworks, not just patterns.

**Dependencies needed:** Git (for worktrees — already required by most projects). Shell access (already required by Claude Code).

**Composes with:** Skill #001 (autonomous agent — spawn patterns), Skill #002 (persistent memory — agent memory passing).
