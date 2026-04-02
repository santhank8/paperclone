# Code Review Protocol

> Sprint Co Capability — Phase 11: Advanced Agent Capabilities

## Purpose

QA tests **functionality** — does the feature work as specified? Code review evaluates **code quality** — is the implementation clean, maintainable, secure, and following established patterns?

These are complementary, not redundant. Both are required before a feature ships.

## Review Criteria

| Category | What to Check | Weight |
|----------|--------------|--------|
| **Readability** | Clear logic flow, appropriate abstraction level, self-documenting | 15% |
| **Naming conventions** | Variables, functions, files follow project conventions | 10% |
| **Error handling** | Errors caught, meaningful messages, no silent failures | 15% |
| **Type safety** | Proper types, no `any` abuse, generic constraints where useful | 10% |
| **Test coverage** | New code has tests, edge cases covered, tests are meaningful | 15% |
| **Performance patterns** | No N+1 queries, unnecessary re-renders, memory leaks, or O(n²) where O(n) suffices | 10% |
| **Security patterns** | No injection risks, secrets exposed, broken access control, or unsafe deserialization | 15% |
| **Documentation** | Complex logic commented, public APIs documented, README updated if needed | 10% |

## Review Format

### Line-by-Line Comments

```markdown
### FILE: <path/to/file.ts>

**L12-15** [severity: suggestion]
Consider extracting this into a named function for readability.

**L42** [severity: blocker]
SQL query built with string concatenation — injection risk. Use parameterized query.

**L78-80** [severity: nit]
Inconsistent naming: `getData` vs `fetchResults` — pick one pattern.
```

Severity levels:
| Severity | Meaning | Blocks Approval |
|----------|---------|-----------------|
| **blocker** | Must fix before merge — bug, security issue, or broken pattern | Yes |
| **suggestion** | Should fix — improves quality but not critical | No |
| **nit** | Optional — style preference or minor improvement | No |

### Review Summary

```markdown
# Code Review Summary

- **Task:** <task-id> — <title>
- **Reviewer:** Code Review Agent
- **Date:** <YYYY-MM-DD>
- **Files Reviewed:** <count>
- **Lines Changed:** <additions/deletions>

## Overall Score: X/5

| Category | Score | Notes |
|----------|-------|-------|
| Readability | X/5 | |
| Naming | X/5 | |
| Error handling | X/5 | |
| Type safety | X/5 | |
| Test coverage | X/5 | |
| Performance | X/5 | |
| Security | X/5 | |
| Documentation | X/5 | |

## Blockers (must fix)
1. <description + file:line>

## Suggestions (should fix)
1. <description + file:line>

## Nits (optional)
1. <description + file:line>

## Verdict: [APPROVED | CHANGES_REQUESTED | NEEDS_DISCUSSION]
```

### Score Interpretation

| Score | Meaning | Action |
|-------|---------|--------|
| 4.5–5.0 | Excellent | Approve |
| 3.5–4.4 | Good | Approve with suggestions noted |
| 2.5–3.4 | Acceptable | Changes requested — non-blockers |
| 1.5–2.4 | Below standard | Changes requested — blockers present |
| 0–1.4 | Unacceptable | Reject — significant rework needed |

## Review Workflow

```
Engineer completes task
  → Creates handoff artifact with code changes
    → Code Review Agent reviews
      → APPROVED: proceed to QA
      → CHANGES_REQUESTED: return to Engineer
        → Engineer addresses feedback
          → Re-review (only changed items)
            → APPROVED → QA
      → NEEDS_DISCUSSION: escalate to Sprint Lead
```

### Turnaround Target

| Metric | Target |
|--------|--------|
| Time to first review | <15 min from handoff |
| Re-review after fixes | <10 min |
| Max review rounds | 3 (then escalate to Sprint Lead) |

## Automated Checks

The following automated checks run **before** the Code Review Agent's manual review:

| Check | Tool | Auto-fail Threshold |
|-------|------|---------------------|
| Linting | ESLint / project config | Any error-level violations |
| Type checking | TypeScript compiler | Any type errors |
| Cyclomatic complexity | Complexity analyzer | >15 per function |
| Duplicate code | Detector | >20 duplicate lines |
| Bundle size | Size check | >10% increase without justification |
| Dependency audit | npm audit | Any high/critical vulnerabilities |

If automated checks fail, the code is returned to the Engineer **before** the review agent spends tokens reviewing it.

## Review Disagreement Protocol

When the Engineer disagrees with review feedback:

```
1. Engineer replies to the specific comment with rationale
   └── "I disagree because <reason>"

2. Code Review Agent considers the rationale
   ├── If persuaded → withdraws the comment
   └── If not persuaded → maintains the comment with counter-rationale

3. If still disagreed after one round:
   └── Sprint Lead mediates
       ├── Reviews both positions
       ├── Makes a binding decision
       └── Decision logged for future reference (creates precedent)

4. Historian records the disagreement and resolution
   └── Used to refine review standards over time
```

### Precedent Log

Disagreements that result in Sprint Lead decisions are logged:

```markdown
## Review Precedent: <YYYY-MM-DD>

- **Topic:** <what was disagreed on>
- **Engineer Position:** <summary>
- **Reviewer Position:** <summary>
- **Sprint Lead Decision:** <ruling>
- **Rationale:** <why>
- **Applies Going Forward:** [yes/no]
```

## What Code Review Does NOT Cover

| Not in Scope | Handled By |
|-------------|------------|
| Does the feature work? | QA Engineer |
| Does the UI look right? | Design System Agent |
| Is the feature spec-complete? | Stakeholder review |
| Is the deployment safe? | DevOps / deploy pipeline |
