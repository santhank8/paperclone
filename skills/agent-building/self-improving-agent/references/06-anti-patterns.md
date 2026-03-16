# Anti-Patterns — What Goes Wrong

## 1. Over-Capturing

**What it looks like:**
```markdown
## used_read_instead_of_readfile — 2026-03-10
- **Frequency:** 1 in 1 session
- **Example:** Used fs.readFileSync instead of fs.promises.readFile in one async function
- **Status:** active
```

**Why it fails:** One occurrence is noise. You've created cognitive overhead for a pattern that may never recur. The lessons file becomes unreadable when it's full of n=1 entries.

**The fix:** Enforce the 2-occurrence threshold. Log to violations.jsonl immediately, but don't promote to lessons-learned.md until session 2 confirms the pattern.

---

## 2. The n=1 Rule Update Trap

**What it looks like:** Agent makes a mistake once → rule gets updated → next session rule is enforced but the "mistake" was actually the correct behavior in context.

**Example:** Agent used `grep` in Bash once — legitimately, to search a Docker log file where Grep tool doesn't apply. Rule gets updated to add more restrictions. Now the legitimate use case is blocked.

**Why it fails:** Single data points can't tell you whether the behavior is:
- A violation of an ambiguous rule
- A legitimate exception to a valid rule
- A sign the rule needs a better exception clause

**The fix:** 2-occurrence threshold before any rule change. On session 1: log it. On session 2: diagnose. On session 3+: update.

---

## 3. Complexity Chasing

**What it looks like:**
```
RULE: Use Glob for file discovery.
→ After 1 violation: "except when searching recursively"
→ After 2 violations: "except when the path has spaces"
→ After 3 violations: "except in Docker contexts, except when..."
→ 12 sub-rules later: nobody reads this rule
```

**Why it fails:** Sub-rules signal that the original rule was under-specified. Adding sub-rules treats symptoms. The root cause is usually: the rule doesn't give an adequate alternative, or it doesn't explain *why* the restriction exists.

**The fix:** When you find yourself adding a sub-rule, stop. Diagnose whether the original rule's phrasing is the problem. Usually, one clear rewrite beats five sub-rules.

---

## 4. Pruning Neglect

**What it looks like:** lessons-learned.md grows from 5 entries to 50 over 6 months. `resolved` entries from 2025 are still listed as `active`. New entries are buried below stale ones. Nobody reads it.

**Why it fails:** The value of the lessons file scales inversely with its length. A 5-entry file gets read. A 50-entry file gets skipped.

**The fix:** Quarterly pruning:
- Archive `resolved` entries older than 6 months
- Delete `monitoring` entries with zero recurrence for 90 days
- Keep `active` entries forever — they're still problems
- Cap the file at 20 entries by enforcing the archive schedule

---

## 5. Confusing Learning With Knowing

**What it looks like:** "I've seen this before, I know why it happens, I'll just fix the rule."

This skips the lessons file entirely. The agent (you) is trusting pattern recognition over data. Three sessions later, the "fix" is re-introducing the bug it was supposed to solve.

**Why it fails:** Memory between sessions is zero without the file. What feels like "I know this pattern" is actually "I saw this in this session." The lessons file is the only thing that actually persists.

**The fix:** Always write it down. The act of writing forces specificity. "I know why it's happening" often becomes "I actually don't know" when you try to fill in the `Root cause hypothesis` field.

---

## 6. Keep/Discard Loop Skipping

**What it looks like:** "The rule change is obviously better, I don't need to run tests."

**Why it fails:**
- "Obviously better" rules have caused regressions in past sessions (see optimization log AIS-32: T11 borderline trigger was NOT fixed by obvious adjacent phrases — needed the exact vocabulary from the failing test)
- The test takes 10 minutes. A cascading regression takes a session to debug.

**The fix:** Enforce the loop even for "obvious" changes. If the rule test passes immediately, the loop takes 15 minutes total and gives you data you'd otherwise be guessing at.

---

## Signal vs Noise: Decision Table

| Situation | Action |
|---|---|
| First time seeing a violation | Log to violations.jsonl only |
| Second time, same type, different session | Promote to lessons-learned.md |
| Third time same type | Trigger rule refinement workflow |
| Violation with known legitimate exception | Add exception to rule, don't log as violation |
| Violation fixed by obvious rule clarification | Still run keep/discard loop |
| Lessons file has 20+ entries | Run pruning pass before adding new entries |
