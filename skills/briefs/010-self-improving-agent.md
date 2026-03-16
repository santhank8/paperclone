# Skill Brief: Build a Self-Improving Agent in Claude Code

## Demand Signal

- ClawHub `self-improving-agent`: **227K downloads** — #1 skill on the platform by a wide margin
- ClawHub `self-improving` (self-reflection + self-learning variant): **74.1K downloads** — top 5
- Combined: **301K downloads** — 3x the next closest category, zero competing native skills
- GitHub issue #14227 (anthropics/claude-code): 200+ reactions requesting persistent session learning — led to official auto-memory in v2.1.59 (Feb 2026)
- Reddit r/ClaudeAI: "Self-Improvement Loop — my favorite Claude Code skill" thread (180 upvotes, 100+ comments praising the modularity)
- Reddit r/ClaudeAI: CLAUDE.md lessons-learned pattern thread: "My CLAUDE.md now has 200+ lines across 13 files" (120 upvotes)
- YouTube: "I Taught Claude to Take Notes on Itself" (15K views, Mar 2026) — devs building 3-layer extraction → update loops
- X: @addyosmani Jan 2026 post on iterative self-improvement loops (1.2K likes); @stephanejourdan on auto-memory (400 likes)
- Developer pain: "Agents drift without structure," "Re-explaining the same bugs every session," "Claude forgets my corrections"
- All top ClawHub skills use external frameworks (Mem0, ontology packages) — zero native solutions teaching the pattern directly

## Target Audience

Developers who have tried Claude Code's persistent memory or built a basic agent and now want it to **actually improve over time**. They've set up CLAUDE.md and maybe MEMORY.md, but they're manually updating rules and still seeing the same mistakes repeat across sessions. They know hooks exist but haven't wired them into a feedback loop.

They want:
- Mistakes caught and captured automatically, not just in passing
- Rules that get better from real violations, not from guessing upfront
- A quality loop that tightens skill/agent output over iterations
- Session-end learning, not just session-start context loading

## Core Thesis

Claude Code agents can improve themselves across sessions using only native primitives: hooks that detect and capture violations, a lessons file that builds institutional knowledge, and a rule-refinement loop that updates instructions from real patterns — no external memory frameworks needed.

## How This Differs From Adjacent Skills

| Skill | What It Teaches |
|-------|----------------|
| `autonomous-agent` (#001) | *Architecture*: CLAUDE.md, hooks, memory, subagents — the harness structure |
| `persistent-memory` (#002) | *Mechanics*: 4 memory types, when to save, how to organize |
| **`self-improving-agent` (#010)** | *The loop*: detect failures → capture learnings → refine rules → measure improvement |

The others teach you to build the house. This skill teaches you how the house gets better every day you live in it.

## Skill Scope

### In Scope
- PostToolUse hooks that detect rule violations and log them
- Stop hooks that audit the session and extract learnings
- `lessons-learned.md` file structure and entry format
- Pattern analysis: how to spot recurring violations vs. one-offs
- CLAUDE.md rule refinement from violation data
- Keep/discard quality loop for iterative skill/agent improvement
- Scoring outputs objectively (line count, trigger accuracy, test pass rate)
- Anti-patterns: over-capturing, premature rule updates, noisy memory

### Out of Scope
- Initial memory system setup (covered in persistent-memory skill #002)
- Harness architecture (covered in autonomous-agent skill #001)
- Proactive/scheduled improvement runs (covered in proactive-agent skill #009)
- External memory tools (Mem0, vector databases) — native-only
- Multi-agent learning coordination (covered in multi-agent-coordination skill #003)

## Sections

1. **Why Agents Stay Dumb** — The session-amnesia problem. Agents that learn nothing = agents that repeat the same mistakes. The difference between storing memories and *improving from them*. Three failure modes: capture without apply, apply without verify, verify without iterate.

2. **The Four-Phase Loop** — Detect → Capture → Apply → Verify. How these four phases compose into a continuous improvement cycle. The loop runs across sessions, not within them. Visual: loop diagram showing the phases and what fires each one.

3. **Phase 1 — Detect: Violation Hooks** — PostToolUse hook that identifies when a rule was broken (tool used wrong, pattern violated, prohibited command run). How to classify violations: `bash_instead_of_glob`, `grep_not_grep_tool`, `any_type_used`. How to route signal vs. noise. Working hook example with structured log output.

4. **Phase 2 — Capture: The Lessons File** — `lessons-learned.md` structure: violation type, frequency count, example session, rule state at time of violation. How to append entries without duplicating. When a violation is worth capturing (threshold: 2+ occurrences). Entry format with frontmatter for searchability.

5. **Phase 3 — Apply: Rule Refinement** — How to analyze the lessons file and update CLAUDE.md. The rule-refiner pattern: group by type → find the top violators → diagnose why the rule isn't working → rewrite for clarity, specificity, or enforcement strength. The test: can you read the rule and immediately know what to do? If ambiguous, the rule fails.

6. **Phase 4 — Verify: The Keep/Discard Loop** — Run the same test cases before and after the rule change. If scores hold or improve → keep. If scores drop → discard. Iterating 8 rounds with objective scoring (line count + test pass rate). The one-number criterion: did measurable quality go up without measurable loss?

7. **Session-End Summary** — Stop hook that runs an audit: what tools were called, what violations fired, what decisions were made, what to capture. How to compress session context to a 5-line summary. Why you save this now instead of later.

8. **Anti-Patterns** — Over-capturing (every decision, not just recurring patterns). Updating rules from one data point (n=1 is noise). Chasing complexity (adding subrules when the original rule just needs better phrasing). Letting the lessons file grow without periodic pruning. Confusing "I saw this fail once" with "this is a pattern."

## Success Criteria

After installing this skill, a developer should be able to:
- [ ] Wire a PostToolUse hook that logs rule violations to a structured file
- [ ] Wire a Stop hook that produces a 5-line session audit
- [ ] Maintain a `lessons-learned.md` with typed, searchable entries
- [ ] Apply a rule-refinement pass: pick a top violation → diagnose → update CLAUDE.md → verify
- [ ] Run a keep/discard loop on a skill with objective scoring criteria
- [ ] Explain the difference between capturing a learning and applying it

## Keywords

self-improving agent, claude code self-improvement, agent learning loop, rule refinement, violation detection hooks, lessons learned file, CLAUDE.md improvement, iterative agent optimization, keep discard loop, agent feedback loop, session memory improvement

## Competitive Positioning

| Their Approach | Our Approach |
|---------------|-------------|
| Install `self-improving-agent` from ClawHub (external framework) | Native hooks + lessons file — zero dependencies |
| Mem0 / vector DB for memory retrieval | Structured markdown file, searchable with Grep |
| Framework updates may break your setup | You own every line — nothing to update |
| Generic improvement loop for any agent | Wired to your actual violation patterns |
| Black-box learning mechanism | Transparent: you can read the lessons file and know exactly what changed |
| No verification step | Keep/discard loop with objective scoring before applying any change |

## Estimated Complexity

**Medium.** No external dependencies. All primitives are PostToolUse/Stop hooks + markdown files. The skill teaches composition and analysis, not new tooling. Depends on: `autonomous-agent` (#001) for harness context, `persistent-memory` (#002) for memory mechanics.
