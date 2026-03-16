# Cross-Skill Failure Patterns

These patterns have appeared across multiple skills. Treat them as hard rules.

## CRITICAL: Tests Written But Not Run
**Frequency:** 2/3 first submissions (git-workflow, mcp-integration)
**What happens:** SkillBuilder writes test-cases.md with good test scenarios but never actually executes them. Posts "test results" without real scores.
**Root cause:** SkillBuilder treats Phase 2 (Test) as "write the test file" instead of "run the tests and log results."
**Rule:** No skill is done until test-log.md contains real execution results with percentage scores. If the file doesn't exist or has no numbers, tests were not run.

## Pattern: Build Quality is Fine
**Frequency:** 3/3 skills
**Observation:** The actual skill content (SKILL.md, reference files, code examples) is consistently good on first submission. The failures are always about process (testing, verification), never about content quality.
**Implication:** SkillBuilder's creative output is solid. The bottleneck is testing discipline, not skill authoring ability.

## Optimizer: Inline Code Blocks Are Primary Dead Weight
**Frequency:** 4/4 optimized skills (code-review-automation: 8/8 kept, -50% lines)
**Observation:** Every inline code block in SKILL.md that duplicates a reference file is removable with zero score impact. Output tests verify reference file content, not SKILL.md body.
**Rule:** SKILL.md role is phase detection + minimal summary + pointer. Code blocks belong in reference files only. A "Full Walk-Through" standalone section pointing at walkthrough.md is always redundant if walkthrough.md is in the Reference Index.

## Optimizer: At 100% Trigger, All Gains Are Simplicity-Only
**Frequency:** Observed in proactive-agent, highimpact-skill-builder, and code-review-automation optimizations
**Observation:** When starting at 100% trigger score, touching trigger phrases risks regressions with no upside. Keep/discard decision becomes: line reduction with stable scores = KEEP; anything that might change scores = risky.
**Rule:** At 100% trigger baseline, focus exclusively on identifying and removing content that no test validates.
