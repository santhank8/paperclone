# Review Architecture: Parallel Sub-Reviewers

## The Four Sub-Reviewers

Each reviewer focuses on one domain. Parallel Agent calls — total review time = time for the slowest single reviewer.

### Security Reviewer (Sonnet)
```
SECURITY_PROMPT = """You are a security code reviewer. Analyze this diff for:
- OWASP Top 10: SQL injection, XSS, command injection, IDOR, SSRF
- Authentication/authorization gaps (missing auth checks, privilege escalation)
- Secret exposure (API keys, tokens, credentials in code or logs)
- Cryptography misuse (weak algorithms, hardcoded keys, broken randomness)
- Input validation failures at trust boundaries

For each finding output exactly:
FILE:LINE | SEVERITY | FINDING | SUGGESTION

Severity: CRITICAL (exploitable now), HIGH (exploitable with effort), MEDIUM (defense-in-depth), LOW (best practice)
Only report actual findings. If the diff is clean, output: NO_FINDINGS

Diff to review:
"""
```

### Performance Reviewer (Sonnet)
```
PERF_PROMPT = """You are a performance code reviewer. Analyze this diff for:
- N+1 query patterns (loops containing database calls)
- Missing caching for expensive repeated computations
- Unbounded queries (missing LIMIT, full table scans)
- Synchronous operations that should be async
- Memory leaks (event listeners not removed, closures holding references)
- Expensive loops (O(n²) patterns, unnecessary re-renders in React)

For each finding output exactly:
FILE:LINE | SEVERITY | FINDING | SUGGESTION

Severity: CRITICAL (will degrade under load), HIGH (noticeable impact), MEDIUM (optimization opportunity), LOW (minor inefficiency)
Only report actual findings. If the diff is clean, output: NO_FINDINGS

Diff to review:
"""
```

### Correctness Reviewer (Sonnet)
```
CORRECTNESS_PROMPT = """You are a correctness code reviewer. Analyze this diff for:
- Logic bugs (off-by-one errors, wrong conditions, inverted booleans)
- Null/undefined handling (missing null checks, accessing properties on null)
- Error handling gaps (uncaught exceptions, swallowed errors, no fallback)
- Race conditions (shared mutable state, missing locks)
- Edge cases (empty arrays, zero values, boundary conditions)
- Type mismatches (implicit conversions, wrong type assumptions)

For each finding output exactly:
FILE:LINE | SEVERITY | FINDING | SUGGESTION

Severity: CRITICAL (will crash in production), HIGH (fails under real conditions), MEDIUM (fails on edge cases), LOW (defensive improvement)
Only report actual findings. If the diff is clean, output: NO_FINDINGS

Diff to review:
"""
```

### Style Reviewer (Haiku — cheaper, lower stakes)
```
STYLE_PROMPT = """You are a code style reviewer. Analyze this diff for:
- Convention drift (naming inconsistencies vs. rest of codebase)
- Dead code (unreachable branches, unused variables, commented-out code)
- Misleading names (functions that don't do what their name suggests)
- Missing or incorrect comments on non-obvious logic
- Overly complex code that could be simplified

For each finding output exactly:
FILE:LINE | SEVERITY | FINDING | SUGGESTION

Severity: LOW or MEDIUM only. Style is never CRITICAL or HIGH.
Only report actual findings. If the diff is clean, output: NO_FINDINGS

Diff to review:
"""
```

## Model Tier Rationale

| Reviewer | Model | Why |
|---|---|---|
| Security | claude-sonnet-4-6 | Needs deep reasoning for attack vectors |
| Performance | claude-sonnet-4-6 | Complex query pattern analysis |
| Correctness | claude-sonnet-4-6 | Logic tracing requires full reasoning |
| Style | claude-haiku-4-5-20251001 | Pattern matching, lower stakes, 10x cheaper |

## Running in Parallel

```python
# Claude Code Agent tool — all four fire simultaneously
import asyncio

async def run_review(diff: str, checklist: str = "") -> dict:
    context = diff + ("\n\nAdditional checklist:\n" + checklist if checklist else "")

    results = await asyncio.gather(
        Agent(model="claude-sonnet-4-6", prompt=SECURITY_PROMPT + context),
        Agent(model="claude-sonnet-4-6", prompt=PERF_PROMPT + context),
        Agent(model="claude-sonnet-4-6", prompt=CORRECTNESS_PROMPT + context),
        Agent(model="claude-haiku-4-5-20251001", prompt=STYLE_PROMPT + context),
    )
    return {
        "security": results[0],
        "performance": results[1],
        "correctness": results[2],
        "style": results[3],
    }
```

## Merge and Dedup Logic

```python
def merge_findings(results: dict) -> list[dict]:
    all_findings = []

    for reviewer, output in results.items():
        if output.strip() == "NO_FINDINGS":
            continue
        for line in output.strip().split("\n"):
            parts = line.split(" | ")
            if len(parts) == 4:
                file_line, severity, finding, suggestion = parts
                all_findings.append({
                    "file_line": file_line,
                    "severity": severity,
                    "finding": finding,
                    "suggestion": suggestion,
                    "reviewer": reviewer,
                })

    # Dedup: same file:line + same severity = same finding from multiple reviewers
    seen = set()
    deduped = []
    for f in all_findings:
        key = (f["file_line"], f["finding"][:40])
        if key not in seen:
            seen.add(key)
            deduped.append(f)

    # Sort by severity
    severity_order = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3}
    return sorted(deduped, key=lambda x: severity_order.get(x["severity"], 4))

def format_findings(findings: list[dict]) -> str:
    if not findings:
        return "✅ No findings. Diff looks clean."

    lines = ["| File:Line | Severity | Finding | Suggestion |",
             "|-----------|----------|---------|------------|"]
    for f in findings:
        lines.append(f"| {f['file_line']} | {f['severity']} | {f['finding']} | {f['suggestion']} |")

    critical = sum(1 for f in findings if f["severity"] == "CRITICAL")
    high = sum(1 for f in findings if f["severity"] == "HIGH")
    summary = f"\n**Summary:** {len(findings)} findings — {critical} critical, {high} high"

    return "\n".join(lines) + summary
```

## Custom Checklist Integration

When `~/.claude/review-checklist.md` exists, append its contents to each sub-reviewer prompt:

```python
import os

checklist_path = os.path.expanduser("~/.claude/review-checklist.md")
checklist = ""
if os.path.exists(checklist_path):
    with open(checklist_path) as f:
        checklist = f.read()
```

The checklist becomes an additional instruction layer — reviewers catch everything from their built-in prompts PLUS your custom rules.
