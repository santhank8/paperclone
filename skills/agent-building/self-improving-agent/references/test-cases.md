# Test Cases: self-improving-agent skill

## Trigger Tests (should fire)

| ID | Prompt | Expected |
|---|---|---|
| T1 | "How do I build a self-improving agent in Claude Code?" | TRIGGER |
| T2 | "My agent keeps making the same mistakes every session" | TRIGGER |
| T3 | "Set up violation detection hooks in Claude Code" | TRIGGER |
| T4 | "How do I maintain a lessons-learned.md for my Claude Code agent?" | TRIGGER |
| T5 | "How do I improve CLAUDE.md rules based on real violation data?" | TRIGGER |
| T6 | "Wire a PostToolUse hook that logs rule violations" | TRIGGER |
| T7 | "Run a keep/discard loop on a Claude Code skill" | TRIGGER |
| T8 | "Build an agent feedback loop" | TRIGGER |
| T9 | "Session audit with a Stop hook in Claude Code" | TRIGGER |
| T10 | "Agent learning loop — how do I make my agent improve over time?" | TRIGGER |
| T11 | "Detect when my agent breaks its rules automatically" | TRIGGER |
| T12 | "Claude Code session memory improvement — capture learnings" | TRIGGER |

## No-Trigger Tests (should NOT fire)

| ID | Prompt | Expected |
|---|---|---|
| N1 | "Set up persistent memory for my Claude Code agent" | NO TRIGGER (→ persistent-memory #002) |
| N2 | "Build an autonomous agent from scratch in Claude Code" | NO TRIGGER (→ autonomous-agent #001) |
| N3 | "Schedule my agent to run every hour with CronCreate" | NO TRIGGER (→ proactive-agent #009) |
| N4 | "Use Mem0 for agent memory retrieval" | NO TRIGGER (out of scope — external framework) |
| N5 | "Coordinate multiple agents to split up tasks" | NO TRIGGER (→ multi-agent-coordination #003) |

## Output Tests (what SKILL.md output should contain when triggered)

| ID | Assertion | Test Prompt |
|---|---|---|
| O1 | SKILL.md shows Quick Entry table with 8 links (includes Why Agents Stay Dumb + Four-Phase Loop) | T1 |
| O2 | Phase 1 section covers PostToolUse hook + JSON config | T3, T6 |
| O3 | Phase 2 section shows lessons-learned.md entry format | T4 |
| O4 | Phase 2 specifies 2-occurrence threshold | T12 |
| O5 | Phase 3 section includes "the rule test" concept | T5 |
| O6 | Phase 4 section shows keep/discard scoring table | T7 |
| O7 | Anti-rationalization table has 5 entries | T2 |
| O8 | References section links all 6 reference files | T1 |
| O9 | Violation types table appears (in reference or SKILL.md) | T3, T11 |
| O10 | Session-End Summary section covers Stop hook config | T9 |

## Confidence Thresholds

- T1-T4: High confidence (direct phrase matches)
- T5-T8: Medium-high confidence (conceptual matches)
- T9-T12: Medium confidence (vocabulary slightly indirect)
- N1-N5: High confidence these should NOT trigger (description has explicit NOT-for clauses)
