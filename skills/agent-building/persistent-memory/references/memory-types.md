# Memory Types — Full Reference

Four types, each with a distinct purpose. One fact per file. Named by topic, not date.

---

## Type: `user`

Stores information about the person you're working with: role, expertise, preferences, working style.

**When to save:** When you learn details that change how you should collaborate.

**Body structure:** Simple facts. One aspect per file.

```markdown
---
name: user_expertise
description: Doug is mid-level dev with iOS/Swift, RN/Expo, Next.js/Convex stacks
type: user
---

Mid-level developer. Works across:
- iOS/Swift (primary)
- React Native/Expo
- Next.js + Convex

Explain advanced patterns but trust fundamentals. Don't lecture on async/await.
Frame frontend explanations in terms of backend analogues when possible.
```

```markdown
---
name: user_style
description: Doug wants terse responses — no padding, no summaries
type: user
---

Prefers action over narration. Dislikes:
- "Great question!"
- Restating what he said
- Trailing summaries after code changes

Response style: one-line answers for one-line questions. Skip the preamble. Do → explain only if needed.
```

---

## Type: `feedback`

Stores corrections and behavioral rules. These are the highest-priority memories — they change how the model acts.

**When to save:** When the user corrects you in a way that should change future behavior. Especially if the correction is surprising or non-obvious.

**Body structure:** Rule first, then **Why:** and **How to apply:** lines. The why lets you judge edge cases.

```markdown
---
name: feedback_no_db_mocks
description: Don't mock the database in tests — caused a prod incident
type: feedback
---

Integration tests must hit a real database, not mocks.

**Why:** Prior incident where mocked tests passed but prod migration failed. Mock diverged from real schema.

**How to apply:** When writing tests that touch persistence, use real DB (test instance or in-memory SQLite, not a mock). If setup is complex, write a helper. Don't mock your way around complexity.
```

```markdown
---
name: feedback_no_summaries
description: Don't summarize what you just did — user can read the diff
type: feedback
---

Don't add trailing summaries after completing code changes.

**Why:** User finds it condescending. He can read the diff.

**How to apply:** After any Edit/Write sequence, stop. Don't say "I've made the following changes:". Speak only to explain a decision or flag a blocker.
```

---

## Type: `project`

Stores decisions, deadlines, and rationale for the current project. These decay — include dates on time-sensitive entries.

**When to save:** When you learn the *why* behind a decision, constraint, or deadline. "Auth rewrite" alone is useless — *compliance requirement before Q2 audit* is worth saving.

**Body structure:** Fact/decision first, then **Why:** and **How to apply:**.

```markdown
---
name: project_auth_rewrite
description: Auth middleware rewrite is compliance-driven, not tech-debt cleanup
type: project
---

Current auth middleware rewrite was flagged by legal. Compliance requirement.

**Why:** Legal flagged old approach in Q1 audit. Must be done before Q2 SOC2 review (2026-04-01).

**How to apply:** When scoping auth middleware changes, prioritize compliance requirements over ergonomics. Don't suggest "while we're here, clean up X" unless it directly serves compliance. Flag new auth patterns for legal review.
```

---

## Type: `reference`

Stores pointers to where information lives in external systems.

**When to save:** When you discover where things are tracked, documented, or monitored. Especially if you'd waste time hunting for it next session.

```markdown
---
name: reference_bugs_linear
description: Pipeline bugs tracked in Linear project "INGEST"
type: reference
---

All data pipeline bugs go in Linear project "INGEST".
URL: linear.app/company/project/ingest

When working on pipeline issues, check INGEST first for known bugs before investigating from scratch.
```

---

## Choosing the Right Type

| Situation | Type |
|-----------|------|
| Learned user hates over-explaining | `user` |
| User corrected a mistake — "don't do X" | `feedback` |
| Decided to use pattern A not B for project reasons | `project` |
| Found the dashboard or issue tracker URL | `reference` |
| Hit a tricky bug with non-obvious cause | `project` (or `feedback` if behavioral) |
| Library has surprising behavior | `project` |
| API behaves differently in test vs prod | `project` |

**feedback vs. project:** If it changes how you *behave*, it's `feedback`. If it describes the *state of the world*, it's `project`. The Stripe 429 gotcha is a `project` memory (state of the world). "Don't mock the DB" is `feedback` (behavioral rule).

---

## The gotcha Subtype

The brief uses `type: gotcha` as a subtype of `project`. This is fine — the type field is informational, not enforced. Use `gotcha` when the memory is specifically about a mistake or trap to avoid repeating.

```markdown
---
name: gotcha_hooks_absolute_paths
description: Claude Code hooks silently fail with relative paths — must use absolute
type: gotcha
---

Hook command paths must be absolute. Relative paths silently fail with no error.

Wrong:  `"command": "scripts/my-hook.sh"`
Right:  `"command": "/Users/doug/.claude/hooks/my-hook.sh"`
```
