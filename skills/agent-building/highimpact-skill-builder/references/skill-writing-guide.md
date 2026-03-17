# Skill Writing Guide

## User Customization

Every skill should support user overrides via `skill-customizations/`. Add this block near the top of execution — after the intro, before the first step:

```markdown
## Customization

**Before executing, check for user customizations:**
1. Read `{project}/.claude/skill-customizations/{skill-name}/PREFERENCES.md` (if exists)
2. Read `~/.claude/skill-customizations/{skill-name}/PREFERENCES.md` (if exists)
3. Project-local overrides global. Both override skill defaults.
4. If neither exists, proceed with skill defaults.
```

Replace `{skill-name}` with the skill's directory name (e.g., `tdd-workflow`). No parsing required — the LLM reads the markdown and adjusts accordingly. Users who don't customize are unaffected.

See `docs/conventions/skill-customization.md` for the full convention and directory structure.

---

## When to Use Sub-Routing

| Condition | Decision |
|-----------|----------|
| Skill has 1-2 modes | Keep flat — SKILL.md handles everything |
| Skill has 3+ distinct modes | Use sub-routing — create `Workflows/[Name].md` per mode |
| SKILL.md exceeds 150 lines | Extract modes to Workflows/ |
| Modes share significant setup/context | Consider keeping flat with clear section headers |

Sub-routing pattern: SKILL.md becomes a router with a routing table and dispatch rules. Each workflow file is self-contained with its own When to Use, Steps, and Verification sections. See `docs/conventions/workflow-sub-routing.md` for the full convention.

## Writing Style

- **Imperative:** "Run the test. Record the score." Not "You should run the test."
- **Explain the why once.** Then drop it. Repetition wastes context.
- **Tables over prose** for comparisons, mappings, checklists.
- **Code blocks** for any command the user will copy.
- **Progressive disclosure:** high-level in SKILL.md, depth in `references/`.
- **No fluff.** "This section covers X" → just cover X.

## What Makes a Skill High-Impact

1. **Precise trigger description** — fires when intended, not otherwise
2. **Clear phase detection** — user always knows where they are
3. **Opinionated defaults** — don't make users make decisions the skill should make
4. **Escape hatches** — document how to override defaults
5. **Checkpoint discipline** — saves state so loops survive compression
6. **Reference structure** — keeps main file scannable; depth lives in `references/`
7. **Anti-rationalization table** — REQUIRED for multi-step workflows. Format: "What you'll tell yourself" → "The truth." Preempt the 3-5 shortcuts agents will rationalize.

## Anti-Patterns

| Anti-Pattern | Why It Fails |
|---|---|
| "Check if the user wants X, then Y, else Z" — 5 levels deep | Context window burns fast; user gets lost |
| Everything in one 400-line file | Never read past line 150 in practice |
| No phase detection on a multi-mode skill | Ambiguous entry point = bad output |
| Vague description ("helps with skills") | Won't trigger reliably |
| No test cases drafted | You're guessing at quality |

## Anti-Rationalization

| What you'll tell yourself | The truth |
|---|---|
| "The description is good enough" | Descriptions are the #1 reason skills don't trigger. 5 minutes optimizing saves every future user from a miss. Run the eval. |
| "I don't need to test this, it's straightforward" | Straightforward skills fail on edge cases you didn't imagine. The 3 test cases take 2 minutes. |
| "I'll add test cases later" | There is no later. The conversation ends, the skill ships untested, and you'll never come back. |
| "This skill is too simple for progressive disclosure" | If it's over 100 lines, it's not simple. Split it now or watch the model skip the bottom half. |
| "I'll just read the outputs, no need for transcripts" | Outputs show *what* happened. Transcripts show *why*. You can't fix instruction problems from outputs alone. |
| "One more iteration will fix it" | If you've done 3 rounds with no delta, the skill is done. Ship it or rewrite — don't polish. |
| "The user didn't ask for a baseline comparison" | Without a baseline you can't tell if the skill helps or hurts. Run it. Takes the same time as the with-skill run. |
| "I'll checkpoint after I finish this phase" | Context compresses without warning. Checkpoint NOW — after every test iteration, after every improvement. |
| "This feedback is minor, I'll skip it" | Minor feedback from one test case is a pattern across 1000 real invocations. Fix it or document why you won't. |
