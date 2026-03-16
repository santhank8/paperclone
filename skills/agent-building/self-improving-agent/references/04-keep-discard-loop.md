# Keep/Discard Loop — Verifying Improvements Objectively

## Purpose

A rule change that *feels* better might not *score* better. The keep/discard loop runs objective tests before and after every change, then decides: keep the change or discard it.

Default: 8 iterations. Stop early if 3 consecutive iterations show no delta.

## The One-Number Criterion

**Keep if:** measurable quality went up without measurable loss.
**Discard if:** any metric regressed, even if others improved.

No partial credit. A rule that improves trigger accuracy but hurts output quality is discarded.

## Scoring Dimensions

| Dimension | Measurement | Tool |
|---|---|---|
| Trigger accuracy | % of "should trigger" test cases that fire | Manual prompt tests |
| Output quality | % of output assertions passing | Manual review against test-cases.md |
| SKILL.md line count | Raw count | `wc -l SKILL.md` |

Preferred result: same or better scores at equal or fewer lines.

## Iteration Protocol

### Before You Start

1. Run all test cases against current state — this is your baseline
2. Record scores in `references/test-log.md`
3. Note the current line count

### Each Iteration

```
Iteration N:
1. Make ONE focused change (rule text, description, instruction)
2. Re-run affected test cases
3. Record new scores
4. Compare to baseline:
   - If all scores held or improved → KEEP, update baseline
   - If any score regressed → DISCARD, restore from previous state
5. Log: what changed, before/after scores, keep/discard
```

### Iteration Log Format

```markdown
## Iteration 1 — 2026-03-15
**Change:** Added "instead: use Glob tool" to bash_instead_of_glob rule
**Before:** Trigger 83%, Output 90%, 95 lines
**After:** Trigger 83%, Output 90%, 96 lines
**Decision:** DISCARD — added a line with no score change. Not worth the bloat.

## Iteration 2 — 2026-03-15
**Change:** Moved rule from "Code Quality" to "Tool Selection" section
**Before:** Trigger 83%, Output 90%, 95 lines
**After:** Trigger 92%, Output 92%, 95 lines
**Decision:** KEEP — trigger +9%, output +2%, same lines.

## Iteration 3 — 2026-03-15
**Change:** Added anti-rationalization line ("Thinking 'I'll ls...'? Glob. Done.")
**Before:** Trigger 92%, Output 92%, 95 lines
**After:** Trigger 92%, Output 95%, 96 lines
**Decision:** KEEP — output +3%, trigger flat, +1 line acceptable.
```

## 8-Iteration Schedule

| Iteration | Target | Typical Focus |
|---|---|---|
| 1-2 | Quick wins | Proximity fixes, missing alternatives |
| 3-4 | Description depth | Anti-rationalization, specificity |
| 5-6 | Compression | Remove what no test validates |
| 7-8 | Polish | Phrasing, table consolidation |

## Stop Conditions

- **3 iterations with no change** → stop. You've hit the floor. Ship it.
- **Score drops below baseline** → stop. The skill is regressing, not improving. Restore from last keep.
- **All 8 iterations done** → stop regardless. Don't optimize past the 8-iteration budget.

## The 100% Trigger Problem

If trigger accuracy is already at 100%, **don't touch trigger phrases.** Zero upside, real downside. All remaining iterations are simplicity-only: reduce line count without touching anything that affects scores.

See: proactive-agent optimization (AIS-32) — 121→75 lines at 100% trigger by removing inline code blocks that duplicated reference files.

## Objective Test Cases

For the loop to work, test cases must be:
- **Stable** — same prompts every iteration (don't add new test cases mid-loop)
- **Representative** — cover the top 3 use cases and 2 adversarial cases
- **Binary** — pass/fail, not "kinda passes"

See `test-cases.md` for the test suite for this skill.

## Common Discard Patterns

| What you changed | Why it was discarded |
|---|---|
| Added more detail to a section | Output score flat, +3 lines → not worth it |
| Rewrote trigger description | Trigger improved 5%, output dropped 3% → net negative |
| Added code example | Already covered in reference file → duplication, safe to remove |
| Split one rule into two | No score change, added complexity → discard |

## After the Loop

When you're done with 8 iterations (or hit stop condition):
1. Run the full test suite one final time
2. Record final scores in test-log.md
3. Calculate improvement from baseline: `(final - baseline) / baseline * 100`
4. Document what worked: which iteration types yielded gains
