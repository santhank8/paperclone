# Model Routing by Cost Tier: Deep Reference

## The Delegation Math

**Real-world session breakdown:**
```
Typical 2-hour coding session:
- File discovery / grep / classification: 40% of tool calls
- Feature implementation: 45% of tool calls
- Architecture review / high-stakes decisions: 15% of tool calls
```

**Cost comparison (input + output, per 1M tokens):**

| Model | Input | Output | Typical Task |
|-------|-------|--------|--------------|
| Claude Haiku 4.5 | $0.80 | $4 | File search, grep, filter |
| Claude Sonnet 4.6 | $3 | $15 | Implementation, analysis |
| Claude Opus 4.6 | $15 | $75 | Architecture, review |

**Session cost with all-Opus vs. tiered:**
```
All-Opus session (2 hours, 500K tokens): ~$22.50
Tiered (40% Haiku, 45% Sonnet, 15% Opus):
  200K × $0.015/K = $3.00  (Haiku)
  225K × $0.009/K = $2.03  (Sonnet)
  75K  × $0.045/K = $3.38  (Opus)
  Total: $8.41
Savings: ~63%
```

Across a full work month (20 sessions): $450 → $168. The 15x claim is for edge cases (heavy search/grep projects). 63% is a conservative real-world estimate.

---

## The Agent Tool `model` Parameter

The `Agent` tool in Claude Code accepts a `model` parameter:

```javascript
// Haiku — mechanical work
Agent({
  model: "haiku",
  prompt: `Find all API route files in /api directory.
           Return only file paths. No analysis.`
})

// Sonnet — implementation work
Agent({
  model: "sonnet",
  prompt: `Implement the user authentication middleware.
           Spec: references/auth-spec.md
           Return: summary of changes + any blockers.`
})

// Opus — architectural judgment
Agent({
  model: "opus",
  prompt: `Review the database schema migration plan.
           Flag any irreversible decisions or data loss risks.`
})
```

**Model parameter values:** `"haiku"`, `"sonnet"`, `"opus"` — the SDK maps these to the latest model in each family.

---

## Routing Decision Tree

```
What does this task require?
│
├─ Mechanical: find files, search, grep, count, filter, classify
│  → Haiku. Every time.
│
├─ Implementation: write code, refactor, analyze logic, structured output
│  → Sonnet. The workhorse.
│
├─ Judgment: architecture decisions, security review, trade-off analysis
│  → Opus. Use sparingly.
│
└─ Unsure?
   Start with Sonnet. If it can't handle it → escalate to Opus.
   Never escalate to Opus for "I want better output quality" — that's a prompt problem.
```

---

## The JSON Summary Contract

Subagents injecting full transcripts into the orchestrator is the #1 cost explosion pattern.

**Enforce this contract in every subagent spawn:**
```
Return ONLY a JSON summary:
{
  "status": "done" | "blocked",
  "findings": [<max 10 bullet points>],
  "files_modified": ["path/to/file"],
  "blockers": ["description if blocked"]
}
No diffs. No full file contents. No explanations.
```

**Cost impact:**
- Full transcript return: 20,000–100,000 tokens per subagent
- JSON summary: 200–500 tokens per subagent
- 10 subagents with full transcripts: 200K–1M tokens overhead
- 10 subagents with JSON summaries: 2K–5K tokens overhead

---

## Common Routing Mistakes

| Mistake | Fix |
|---------|-----|
| Running Opus for "find all files matching X" | Always Haiku for mechanical search |
| Not specifying model in spawn (inherits parent) | Always set model explicitly — parent is often Opus |
| Using Sonnet for 3-line grep task | Haiku is 4× cheaper and just as good at grep |
| Routing architectural review to Sonnet | Opus for anything where a wrong call has high cost |
| Asking Opus for "a bit more detail" | Rewrite the prompt. Opus is for judgment, not verbosity. |
| Spawning 10 Haiku agents in parallel to "save money" | Check the 95% rule — multi-agent overhead can exceed savings |

---

## CLAUDE.md Inheritance Gap

**Subagents don't load your CLAUDE.md.** Model routing preferences are not inherited.

If your CLAUDE.md says "use Haiku for search" — subagents don't see it. Encode routing rules in the spawn prompt:

```
You are running as claude-haiku-4-5-20251001.
RULES: Only discover files. Do NOT implement. Do NOT read file contents.
Return file paths only in JSON format.
```

This prevents a subagent from autonomously escalating to a heavier task and burning budget.
