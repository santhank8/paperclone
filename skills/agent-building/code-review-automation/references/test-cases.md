# Test Cases: code-review-automation

## Trigger Tests (should fire this skill)

| ID | Prompt | Expected | Confidence |
|----|--------|----------|------------|
| T1 | "review my PR before I merge" | TRIGGER | HIGH |
| T2 | "automated code review for this diff" | TRIGGER | HIGH |
| T3 | "run a code review on PR #47" | TRIGGER | HIGH |
| T4 | "set up parallel code review agents" | TRIGGER | HIGH |
| T5 | "security review before I push this" | TRIGGER | HIGH |
| T6 | "I want a free alternative to Anthropic Code Review" | TRIGGER | HIGH |
| T7 | "how do I post review results as a PR comment" | TRIGGER | HIGH |
| T8 | "set up auto code review hook before git push" | TRIGGER | HIGH |
| T9 | "add Next.js specific checks to my code review" | TRIGGER | HIGH |
| T10 | "code review automation skill" | TRIGGER | HIGH |
| T11 | "gh cli code review setup" | TRIGGER | MEDIUM |
| T12 | "review this diff with security and performance checks" | TRIGGER | HIGH |

## No-Fire Tests (should NOT fire this skill)

| ID | Prompt | Expected | Reason |
|----|--------|----------|--------|
| N1 | "explain what this function does" | NO TRIGGER | Code explanation, not review |
| N2 | "debug this error in my TypeScript" | NO TRIGGER | Debugging, not code review |
| N3 | "write unit tests for this component" | NO TRIGGER | Test writing → tdd-workflow skill |
| N4 | "what does this code do" | NO TRIGGER | Code reading, not automated review |
| N5 | "set up GitHub Actions CI pipeline" | NO TRIGGER | CI/CD integration — explicitly out of scope |

## Output Tests (assertions for review output quality)

| ID | Scenario | Assertion |
|----|----------|-----------|
| O1 | SQL injection in diff | Security reviewer flags it as CRITICAL with specific line reference |
| O2 | N+1 query in diff | Performance reviewer flags it as HIGH with batching suggestion |
| O3 | Missing null check | Correctness reviewer flags it with specific fix suggestion |
| O4 | Large diff (300+ lines) | Skill instructs to exclude lock files and generated files |
| O5 | User has review-checklist.md | Skill loads and applies stack-specific checks |
| O6 | "post to PR" intent | Skill provides `gh pr comment` command with correct syntax |
| O7 | No findings | Skill outputs clean "✅ No findings" message, not empty table |
| O8 | Pre-push hook setup | Skill provides complete hook script with branch scope filter |
| O9 | Hook blocks on critical | Skill explains exit code 1 mechanism and --no-verify escape hatch |
| O10 | Severity table requested | Output includes file:line, severity, finding, suggestion columns |
