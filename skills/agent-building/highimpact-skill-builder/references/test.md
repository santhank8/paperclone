# Phase 2: Test — Running Evals and Grading Results

## 1. Spawn All Runs in the Same Turn

Fire with-skill AND baseline in parallel — don't run them sequentially.

**With-skill run:**
- Provide the skill path, eval prompt, and any input files
- Save outputs to: `<skill-name>-workspace/iteration-N/<eval-name>/with_skill/outputs/`

**Baseline run — pick the right kind:**
- New skill → no skill at all (same prompt, no skill path loaded)
- Improving existing → snapshot the old version first, point baseline at snapshot
- Save outputs to: `<skill-name>-workspace/iteration-N/<eval-name>/without_skill/outputs/`

**Workspace structure:**
```
<skill-name>-workspace/
└── iteration-N/
    └── <eval-name>/           # Descriptive name, NOT "eval-0"
        ├── eval_metadata.json
        ├── with_skill/
        │   ├── outputs/
        │   ├── grading.json
        │   └── timing.json
        └── without_skill/
            ├── outputs/
            ├── grading.json
            └── timing.json
```

---

## 2. While Runs Execute: Draft Assertions

Don't wait for subagents to finish. Draft assertions now.

Good assertions are **objectively verifiable** — pass/fail without interpretation:
- "Output contains a `<nav>` element"
- "JSON has required keys: `id`, `title`, `status`"
- "File saved to expected path"

Bad assertions:
- "Output looks good"
- "Style is appropriate"

**Subjective skills** (writing, design, brainstorming) → skip assertions entirely; use qualitative review in step 6.

Write assertions as named checks (not "assertion-1"). Update `eval_metadata.json`:

```json
{
  "eval_id": "descriptive-eval-name",
  "prompt": "...",
  "assertions": [
    { "id": "has-nav-element", "description": "Output contains a <nav> element" },
    { "id": "valid-json", "description": "Output is parseable JSON" }
  ]
}
```

For assertions that can be checked programmatically, write a script now — run it during grading.

---

## 3. Capture Timing Data

When a subagent completes, the notification contains `total_tokens` and `duration_ms`. Save immediately — this data isn't persisted elsewhere.

Save to `timing.json`:

```json
{
  "total_tokens": 12400,
  "duration_ms": 34200,
  "total_duration_seconds": 34.2
}
```

One file per run (with_skill and without_skill each get their own).

---

## 4. Grade Results

Spawn a grader subagent using `agents/grader.md` instructions. Pass it:
- The eval prompt and assertions from `eval_metadata.json`
- The output files from `with_skill/outputs/` and `without_skill/outputs/`

Grader saves `grading.json`:

```json
{
  "expectations": [
    {
      "text": "Output contains a <nav> element",
      "passed": true,
      "evidence": "Found <nav class=\"main-nav\"> on line 14"
    }
  ],
  "summary": {
    "passed": 3,
    "failed": 1,
    "total": 4,
    "pass_rate": 0.75
  }
}
```

For programmatic assertions: run the script instead of eyeballing. Script output feeds into `grading.json`.

---

## 5. Present Results to User

**Always inline first.** Show a concise summary in conversation:
- Pass rates for with-skill vs baseline
- Key failures and what they reveal
- Any timing/token differences worth noting

Example:
```
With-skill: 4/5 passed (80%) | Baseline: 2/5 passed (40%)
Failed: "valid-json" — skill produced markdown block instead of raw JSON
Tokens: with_skill used 2.3x more tokens (expected for this skill type)
```

**If the user wants a deeper review:**
```bash
python scripts/generate_review.py --static
# Iteration 2+: add --previous-workspace <path>
```

**For aggregate benchmarks across evals:**
```bash
python scripts/aggregate_benchmark.py
# Produces benchmark.json + benchmark.md
```

---

## 6. Analyst Pass

After grading, surface patterns the aggregate stats hide:

- **Non-discriminating assertions** — always pass in both configs. They're not testing skill impact; consider dropping or replacing them.
- **High-variance evals** — passed one run, failed another. Flag as possibly flaky; don't optimize against noise.
- **Time/token tradeoffs** — skill adds 40% tokens for a 15% pass-rate gain. Worth calling out so the user can decide.

Present insights alongside results, not in a separate message.

---

## 7. Read User Feedback

Ask inline:

> "What looks good? What needs work?"

Empty response = looks fine, proceed.

Focus improvements on specific complaints — don't touch what's passing.

---

## 8. Context Checkpoint

After each test iteration, save a compact checkpoint to the workspace. This survives context compression.

Save `iteration-N/checkpoint.md`:

```markdown
## Iteration N Checkpoint
- Evals tested: [list]
- Pass rates: with_skill X%, baseline Y%
- Key failures: [brief description]
- User feedback: [verbatim or "none"]
- Next change: [what to adjust in the skill]
```

Don't wait until after feedback to write this — save it as soon as grading is done, then update with feedback.
