# Test Cases — highimpact-skill-builder

**FIXED EVALUATION — DO NOT MODIFY**

These test cases are the fixed benchmark for optimization. Scores are meaningless if cases change.

---

## Trigger Tests (should fire)

| ID | Prompt | Expected |
|----|--------|----------|
| T01 | "I want to create a skill for my PR review workflow — it takes a diff and produces structured feedback" | TRIGGER |
| T02 | "Make a skill that helps with writing commit messages from staged changes" | TRIGGER |
| T03 | "Can you turn this conversation into a skill? We just figured out a solid deployment checklist process" | TRIGGER |
| T04 | "I'd like to write a skill that does X — where do I start?" | TRIGGER |
| T05 | "My skill isn't triggering when users ask about code review. How do I optimize the description?" | TRIGGER |
| T06 | "Let's test this skill I wrote and see if it actually works" | TRIGGER |
| T07 | "The skill I built is missing edge cases — help me improve it" | TRIGGER |
| T08 | "I want to benchmark this skill against not having it" | TRIGGER |
| T09 | "Skill quality is poor — outputs are vague, how do I fix it?" | TRIGGER |
| T10 | "Quick skill for generating release notes from git log" | TRIGGER |
| T11 | "Skill performance is bad, triggering on wrong things" | TRIGGER |
| T12 | "The skill isn't working well — it fires too broadly" | TRIGGER |

## No-Fire Tests (should NOT fire)

| ID | Prompt | Expected |
|----|--------|----------|
| N01 | "What is a Claude Code skill and how does it work?" | NO TRIGGER — education, not building |
| N02 | "How do I install and configure MCP servers for Claude Code?" | NO TRIGGER — MCP domain |
| N03 | "Fix this TypeScript bug — the type mismatch on line 42" | NO TRIGGER — direct coding task |
| N04 | "Write me a Python script to parse and transform CSV files" | NO TRIGGER — direct coding task |
| N05 | "Help me set up my Git workflow with worktrees for parallel agents" | NO TRIGGER — git workflow skill |

---

## Output Tests

For each triggered test case, evaluate whether the SKILL.md + reference content covers the expected output:

| ID | Expected Output Coverage |
|----|--------------------------|
| O01 | Phase detection table identifies "Create" for new skills; interview questions present |
| O02 | Phase 1 Create instructions guide to SKILL.md writing + test case staging |
| O03 | "Turn this into a skill" path in Phase 1 — extract workflow from conversation |
| O04 | Interview section with 2-4 questions about trigger context, success definition |
| O05 | Description Optimization section — checklist + trigger phrase pattern |
| O06 | Phase 2 Test instructions — trigger test + output test procedure |
| O07 | Phase 3 Improve — root cause table, one-change-per-iteration rule |
| O08 | Benchmark guidance in test.md references |
| O09 | Failure-type → fix table in Phase 3 Improve |
| O10 | Quick Mode section — no interview, 3 trigger tests, ship |
