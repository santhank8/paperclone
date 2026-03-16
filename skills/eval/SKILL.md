---
name: eval
context: fork
description: Run skill evaluations. Triggers on: "/eval", "evaluate skill", "test skill quality", "benchmark skill", "run evals", "check skill score", "eval all skills". NOT for: writing test cases (use highimpact-skill-builder), QC review (use QC agent).
---

# Skill Evaluation

Run `bun run scripts/eval-runner.ts` with the appropriate arguments.

## Modes

| Mode | Command |
|------|---------|
| Evaluate one skill | `bun run scripts/eval-runner.ts skills/agent-building/[name]/SKILL.md` |
| Evaluate all skills | `bun run scripts/eval-runner.ts --all` |
| Compare versions | `bun run scripts/eval-runner.ts --compare [skill-name]` |

## What It Tests

- **Trigger accuracy** — Does the skill description match prompts that should fire it?
- **No-fire accuracy** — Does the skill correctly stay silent for out-of-scope prompts?
- **Output quality** — Does the skill content cover the output assertions in test-cases.md?

## Results

Results save to `skills/evals/results/[skill-name]/YYYY-MM-DD.json`. Run `--compare` after a skill update to see the delta.

## Judge Prompt

The scorer lives at `skills/evals/judges/skill-quality.md`. It defines rubrics for trigger match confidence (0–100), output completeness (0–10), accuracy (0–10), and actionability (0–10). Pass threshold: overall ≥ 70%.
