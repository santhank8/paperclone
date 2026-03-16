# Phase 3: Improve — Iterating on a Skill from Test Results

## 1. How to Think About Improvements

**Generalize from feedback — don't overfit.** The skill runs across thousands of prompts, not just your test cases. If a fix only works because you hardcoded a specific pattern from one eval, you've optimized for the benchmark, not the skill.

**Keep the prompt lean.** Read transcripts, not just outputs. If the model is spending turns on unnecessary steps, cut the instructions driving that. Dead weight in a skill doesn't just waste tokens — it introduces drift. Every instruction that isn't earning its keep is a source of noise.

**Explain the why, not just the rule.** LLMs respond better to reasoning than rigid commands. If you find yourself writing ALWAYS or NEVER in caps, stop and reframe: explain what goes wrong without the constraint and why. "Don't summarize before acting — it adds a wasted turn and the user already knows what they asked" beats "NEVER summarize the user's request."

**Look for repeated work across runs.** If every test run independently generated similar scaffolding, helper functions, or setup code — that's a signal. Pull it into `scripts/` and reference it from the skill. Deterministic setup should be a script, not a re-generated artifact.

**Draft, then review with fresh eyes.** After writing your revision, step back and read it as someone who has never seen the skill. Kill anything that requires context only you have. Every reference that needs explaining is a smell.

---

## 2. The Iteration Loop

After each round of improvements:

1. Apply changes to the skill file
2. Rerun all test cases (including baselines) into `iteration-N+1/`
3. Present results: inline summary of what changed, deltas vs previous iteration
4. Get feedback from the user
5. Repeat

**Stop when:**
- User is satisfied with outputs
- Feedback comes back empty or minor
- No meaningful delta between iterations — marginal gains don't justify another round

Don't keep iterating to polish. If the skill is good enough to ship, ship it.

---

## 3. Presenting Results

Show a tight summary after each iteration — don't dump raw outputs:

```
Iteration 3 results:
- Test case 1: improved (hallucinated step removed)
- Test case 2: no change
- Test case 3: regressed — added verbosity, investigating

Net: 1 improved, 1 neutral, 1 regressed. Worth another pass on case 3?
```

Optionally render an HTML viewer if the user wants visual comparison. But text summary first — don't make them wait for a browser.

---

## 4. Blind Comparison (Advanced)

For rigorous A/B testing — when human review isn't conclusive — run a blind comparison:

- Give two outputs (previous vs new) to an independent comparator agent
- Don't label which is which
- Ask it to evaluate against the stated criteria and pick a winner

Read `agents/comparator.md` and `agents/analyzer.md` for the prompt templates and grading rubrics. This is optional — most improvements are obvious enough from direct review. Reserve blind comparison for genuinely close calls.

---

## 5. Anti-Patterns to Watch For

| Anti-pattern | What it looks like | Fix |
|---|---|---|
| Rule accumulation | Skill grows by 20 lines each iteration | Ask: what can I remove instead of add? |
| Expansion when you need simplification | Adding new sections to fix edge cases | Rewrite the section that's causing confusion |
| Overfitting to test cases | Instructions that only make sense for eval prompts | Ask: does this apply to 80% of real users? |
| Ignoring transcripts | You're only reading outputs, not how the model got there | Open the raw transcript, check tool call order |
| Iterating past diminishing returns | Round 6 with no clear delta | Ship it |

---

## 6. Context Checkpoint

After each improvement iteration, update the workspace checkpoint file:

```
## Checkpoint — Iteration N
- Version: N
- What changed: [1-2 line summary of edits to skill]
- Test delta: [X improved, Y neutral, Z regressed]
- Outstanding feedback: [issues still open]
- State of the skill: [2-3 sentence summary of current quality and remaining gaps]
```

Update this before moving to the next iteration. If the session ends mid-loop, this is what the next session needs to resume without losing context.
