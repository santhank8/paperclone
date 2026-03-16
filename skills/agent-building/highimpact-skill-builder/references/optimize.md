# Phase: Optimize — Improving Skill Triggering Accuracy

## 1. How Skill Triggering Works

Claude sees each skill as a name + description pair in its available_skills list. It decides whether to invoke based on the description alone — no other skill content is visible at decision time.

Key constraints:
- Claude only reaches for a skill when the task is substantive enough to warrant it. Simple one-step queries may not trigger even with a perfect description.
- The description must communicate *when* to invoke (intent signal) and *what it delivers* (value signal) — both matter.
- Eval queries must be realistic and substantive. If a human wouldn't need help, Claude won't reach for a skill.

---

## 2. Generate Trigger Eval Queries

Create 20 queries — 8-10 should-trigger, 8-10 should-not-trigger.

**Realism is mandatory.** Queries must reflect actual user behavior: file paths, personal context, column names, URLs, casual phrasing, typos, varying length.

- Bad: "Format this data"
- Good: "ok so my boss just sent me this xlsx file (in downloads, called Q4 sales final FINAL v2.xlsx) and she wants me to add a profit margin column next to revenue..."

**Should-trigger queries** — cover:
- Multiple phrasings of the same core intent
- Implicit need (user describes the problem, not the solution)
- Uncommon but valid use cases
- Scenarios where a competing skill might seem relevant

**Should-not-trigger queries** — cover:
- Near-misses that share keywords but need something different
- Tasks the skill doesn't handle (wrong domain, wrong output type)
- NOT obviously irrelevant queries — near-misses reveal false positives

Save as JSON:

```json
[
  {"query": "ok so my boss just sent me this xlsx...", "should_trigger": true},
  {"query": "can you help me rename these files...", "should_trigger": false}
]
```

---

## 3. Review with User

Present the eval set for review using the HTML template at `assets/eval_review.html`.

Replace these placeholders in the template:
- `__EVAL_DATA_PLACEHOLDER__` — the JSON array (stringify it)
- `__SKILL_NAME_PLACEHOLDER__` — skill name from SKILL.md frontmatter
- `__SKILL_DESCRIPTION_PLACEHOLDER__` — current description from SKILL.md frontmatter

Write to `/tmp/eval_review.html` and open it in the browser.

User edits, toggles should_trigger, adds or removes queries, then exports to `~/Downloads/eval_set.json`.

---

## 4. Run Optimization Loop

Save the exported eval set to the skill's workspace directory, then run in background:

```bash
python -m scripts.run_loop \
  --eval-set <path/to/eval_set.json> \
  --skill-path <path/to/SKILL.md> \
  --model <current-model-id> \
  --max-iterations 5 \
  --verbose
```

Loop behavior:
- Uses 60/40 train/test split to prevent overfitting
- Runs each query 3 times per iteration for consistency
- Uses extended thinking to generate description improvements
- Selects best result by TEST score, not train score

Periodically check progress and update the user on current iteration, train score, and test score.

---

## 5. Apply Result

Take `best_description` from the script output. Update the `description` field in SKILL.md frontmatter.

Show the user before/after:

```
Before (score: 0.72):
  [old description]

After (score: 0.91):
  [new description]
```

Confirm before writing if scores are close or the description changed substantially in character.
