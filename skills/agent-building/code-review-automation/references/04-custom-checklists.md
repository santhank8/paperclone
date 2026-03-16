# Custom Review Checklists

## Location and Format

Create `~/.claude/review-checklist.md`. The orchestrator reads this file and appends it to every sub-reviewer prompt at review time.

Format: headers for each stack, checkbox items for each rule.

```markdown
# Review Checklist

## [Stack Name]
- [ ] Rule description (why it matters)
- [ ] Rule description (why it matters)
```

## Next.js / Convex Checklist

```markdown
## Next.js/Convex
- [ ] Convex validators on all mutations and actions — prevents injection via schema bypass
- [ ] Missing "use client" directive on components using hooks, event handlers, or browser APIs
- [ ] Server Components fetching sensitive data without authentication check (missing ctx.auth)
- [ ] useEffect used for data fetching — should use Server Components or Convex useQuery instead
- [ ] Client-side API calls to `/api/` routes that don't verify session on the server
- [ ] Missing loading and error states on Convex queries (undefined handling)
- [ ] Convex mutations called directly from useEffect without cleanup (potential double-invoke)
- [ ] ENV vars referenced on client-side that should be server-only (NEXT_PUBLIC_ prefix audit)
```

## iOS / Swift Checklist

```markdown
## iOS/Swift
- [ ] Force unwraps (!) in production code paths — any context where data could be missing
- [ ] Missing @MainActor on functions that touch UIKit/SwiftUI from async context
- [ ] Unhandled errors in async sequences (Task { } blocks without catch)
- [ ] ViewModels holding strong references to self in closures (retain cycles)
- [ ] UserDefaults storing sensitive data (tokens, passwords) — should use Keychain
- [ ] Network requests without timeout configuration
- [ ] Missing @Sendable conformance on types crossing actor boundaries
- [ ] Deprecated APIs flagged by iOS 26 (check against current deployment target)
```

## Python Checklist

```markdown
## Python
- [ ] f-strings in SQL queries — injection risk, use parameterized queries (cursor.execute("... WHERE id = %s", (id,)))
- [ ] Unhandled exceptions in async/await paths (bare except: clauses or missing try blocks)
- [ ] Missing type hints on public function signatures
- [ ] Mutable default arguments (def foo(items=[])) — Python gotcha, items is shared across calls
- [ ] subprocess.shell=True with user-supplied input — command injection
- [ ] Hardcoded secrets in source (API keys, passwords, tokens)
- [ ] Missing input validation on data from request.json or request.args
- [ ] Unbounded file reads (open().read() on user-supplied paths)
```

## Go Checklist

```markdown
## Go
- [ ] Error returns ignored (_, err := vs err :=) — explicit ignore is fine, missing check is not
- [ ] Goroutine leaks — goroutines started without a way to stop them (missing context cancellation)
- [ ] Context not propagated through call chain (ctx context.Context as first param)
- [ ] Mutex not deferred on unlock (lock() without defer unlock() in same function)
- [ ] Slice append in loop without pre-allocation for large slices
- [ ] HTTP response body not closed (defer resp.Body.Close())
- [ ] Race conditions on shared maps without sync.RWMutex
- [ ] sql.DB connection not closed or returned to pool
```

## React Native / Expo Checklist

```markdown
## React Native/Expo
- [ ] ScrollView + .map() instead of FlashList/LegendList for lists (performance critical)
- [ ] useState for scroll position or animation values — use useSharedValue instead
- [ ] JS-based navigator (@react-navigation/stack) instead of native stack
- [ ] Image from react-native instead of expo-image (missing blurhash, caching)
- [ ] Pressable missing hitSlop for touch targets under 44x44 points
- [ ] useEffect with no dependency array on component that re-renders frequently
- [ ] Zustand store accessed without selector (whole store = all re-renders)
```

## Team-Specific Rules Template

```markdown
## [Your Company] Standards
- [ ] All API responses include request ID in headers (for tracing)
- [ ] Database migrations are backwards-compatible (expand-contract pattern)
- [ ] Feature flags wrap all experimental code
- [ ] Error messages don't expose stack traces to clients
- [ ] New environment variables documented in .env.example
```

## How the Checklist Gets Applied

When the orchestrator loads your checklist, it passes it to each sub-reviewer as:

```
Additional review checklist for this codebase:
[contents of ~/.claude/review-checklist.md]

Apply these checks in addition to your standard review criteria.
```

The security reviewer applies your security checklist items, performance reviewer checks your perf items, etc. Style items go to the style reviewer. If a checklist item doesn't clearly belong to one reviewer, all reviewers see it and the most relevant one flags it.
