# End-to-End Walk-Through

## The Scenario

PR #47 adds an authentication endpoint and a user data API. The diff touches `src/auth/login.ts`, `src/api/users.ts`, and `src/components/LoginForm.tsx`. We'll run the full automated review and post results.

## Step 1: Fetch the Diff

```bash
$ gh pr diff 47 --name-only
src/auth/login.ts
src/api/users.ts
src/components/LoginForm.tsx
package-lock.json

$ gh pr diff 47 | grep -v 'package-lock' > /tmp/pr47-diff.txt
$ wc -l /tmp/pr47-diff.txt
312 /tmp/pr47-diff.txt
```

Manageable size. Load checklist if it exists:

```bash
$ cat ~/.claude/review-checklist.md
## Next.js/Convex
- [ ] Convex validators on all mutations
- [ ] Missing "use client" on hook-using components
```

## Step 2: Spawn 4 Parallel Sub-Reviewers

All four Agent calls fire simultaneously:

```
[Security]     → analyzing auth/login.ts for injection, auth gaps, secret exposure
[Performance]  → analyzing api/users.ts for N+1 queries, unbounded fetches
[Correctness]  → analyzing all files for null handling, error paths, edge cases
[Style]        → analyzing all files for naming, dead code, complexity
```

Approximate timing: ~35 seconds for all four to complete in parallel.

## Step 3: Raw Reviewer Outputs

**Security reviewer returns:**
```
src/auth/login.ts:23 | CRITICAL | SQL injection: `db.query(\`SELECT * FROM users WHERE email = '${email}'\`)` — email is directly interpolated | Use parameterized query: db.query("SELECT * FROM users WHERE email = ?", [email])
src/auth/login.ts:47 | HIGH | Password logged on failed login: `console.log(\`Login failed for ${email}: ${password}\`)` — exposes credentials in logs | Remove password from log: console.log(`Login failed for ${email}`)
```

**Performance reviewer returns:**
```
src/api/users.ts:67 | HIGH | N+1 query: getPermissions(userId) called inside forEach loop over users — scales O(n) with user count | Pre-fetch all permissions with getPermissionsByUserIds(userIds) before the loop
src/api/users.ts:89 | MEDIUM | Unbounded query: db.query("SELECT * FROM audit_log WHERE userId = ?") with no LIMIT — could return millions of rows | Add LIMIT 1000 with pagination or date range filter
```

**Correctness reviewer returns:**
```
src/auth/login.ts:31 | HIGH | Missing null check: user.profile.displayName accessed without checking user.profile exists — crashes when profile is null | Add: if (!user.profile) return { ...user, displayName: user.email }
src/components/LoginForm.tsx:12 | MEDIUM | Error state not reset on retry: setError(null) not called when form is resubmitted — stale error persists | Call setError(null) at the start of handleSubmit
```

**Style reviewer returns:**
```
src/api/users.ts:102 | LOW | Dead code: commented-out getUserById function from old API — 15 lines | Remove commented code; retrieve from git history if needed
src/components/LoginForm.tsx:8 | LOW | Misleading name: handleClick actually handles form submission, not a click | Rename to handleSubmit
```

## Step 4: Merge and Sort

After dedup (no overlaps), sorted by severity:

| File:Line | Severity | Reviewer | Finding | Suggestion |
|-----------|----------|----------|---------|------------|
| auth/login.ts:23 | 🔴 CRITICAL | Security | SQL injection via template literal | Use parameterized query |
| auth/login.ts:47 | 🟠 HIGH | Security | Password logged on failure | Remove password from log |
| api/users.ts:67 | 🟠 HIGH | Performance | N+1 query in forEach | Pre-fetch all permissions |
| auth/login.ts:31 | 🟠 HIGH | Correctness | Null dereference on user.profile | Add null check |
| api/users.ts:89 | 🟡 MEDIUM | Performance | Unbounded audit log query | Add LIMIT + pagination |
| LoginForm.tsx:12 | 🟡 MEDIUM | Correctness | Error state not reset on retry | setError(null) in handleSubmit |
| api/users.ts:102 | 🔵 LOW | Style | Dead commented code | Remove it |
| LoginForm.tsx:8 | 🔵 LOW | Style | Misleading function name | Rename to handleSubmit |

**Summary:** 8 findings — 1 critical, 3 high, 2 medium, 2 low

## Step 5: Post to PR

```bash
$ cat > /tmp/review-output.md << 'EOF'
## 🔍 Code Review — 2026-03-16 14:32

**Reviewers:** Security · Performance · Correctness · Style (parallel)
**PR:** #47 — Add authentication endpoint and user data API
**Findings:** 8 total (1 critical, 3 high, 2 medium, 2 low)

---

| File:Line | Severity | Finding | Suggestion |
|-----------|----------|---------|------------|
| auth/login.ts:23 | 🔴 CRITICAL | SQL injection via template literal in email query | Use parameterized query: `db.query("SELECT ... WHERE email = ?", [email])` |
| auth/login.ts:47 | 🟠 HIGH | Password exposed in failed-login log | Remove `${password}` from console.log |
| api/users.ts:67 | 🟠 HIGH | N+1 query: getPermissions() in forEach loop | Pre-fetch all permissions before loop |
| auth/login.ts:31 | 🟠 HIGH | Null dereference: user.profile.displayName without null check | Add `if (!user.profile)` guard |
| api/users.ts:89 | 🟡 MEDIUM | Unbounded SELECT on audit_log | Add LIMIT 1000 + date range filter |
| LoginForm.tsx:12 | 🟡 MEDIUM | Stale error state on retry | Call `setError(null)` in handleSubmit |
| api/users.ts:102 | 🔵 LOW | Dead commented-out code | Remove 15 commented lines |
| LoginForm.tsx:8 | 🔵 LOW | Misleading function name handleClick | Rename to handleSubmit |

---
*Generated by Claude Code code-review-automation · Next.js/Convex checklist applied*
EOF

$ gh pr comment 47 --body "$(cat /tmp/review-output.md)"
✓ Created comment
```

## What the PR Comment Looks Like

The comment appears immediately on the PR with a formatted table. For the CRITICAL SQL injection finding, you'd also add a line-level annotation:

```bash
COMMIT=$(gh pr view 47 --json headRefOid -q .headRefOid)
OWNER=$(git remote get-url origin | sed 's|.*github.com[:/]\([^/]*\)/.*|\1|')
REPO=$(git remote get-url origin | sed 's|.*github.com[:/][^/]*/\([^.]*\).*|\1|')

gh api "repos/$OWNER/$REPO/pulls/47/reviews" \
  -f commit_id="$COMMIT" \
  -f event="COMMENT" \
  -f body="Review findings attached" \
  -f "comments[][path]=src/auth/login.ts" \
  -f "comments[][position]=23" \
  -f "comments[][body]=🔴 **CRITICAL — SQL Injection**

\`\`\`ts
// BEFORE (vulnerable)
db.query(\`SELECT * FROM users WHERE email = '${email}'\`)

// AFTER (safe)
db.query('SELECT * FROM users WHERE email = ?', [email])
\`\`\`"
```

## Total Time

- Diff fetch: ~2s
- 4 parallel reviewers: ~35s
- Merge + format: ~1s
- Post comment: ~2s

**Total: ~40 seconds for a comprehensive parallel code review.**
