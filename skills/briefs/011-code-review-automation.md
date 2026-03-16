# Skill Brief: Code Review Automation in Claude Code

## Demand Signal

- Anthropic launched a dedicated Code Review team feature at **~$15/PR** on March 9, 2026 — commercial validation at the highest level
- @Rahll post on Code Review launch: **12K views, 800 likes, 200+ replies** — "If Claude Code is so good, why do they need a separate feature to hunt for bugs" — devs want this built in, not bolted on
- @TheAnkurTyagi thread: **10K views, 500 likes** requesting "knowledge-aware reviews" and cheaper alternatives
- @svpino: **5K views, 300 likes** warning about false positives + requesting "automation skill to chain reviews with tests"
- @morganlinton deployment/review tutorial: **12K views, 700 likes**, 90+ replies requesting full automation
- No code review skill in ClawHub top 25 — the gap exists but hasn't been filled yet
- GitHub issues: #34886 "Decouple subagents from worktree isolation" — developers building parallel review workflows hitting friction
- Total engagement across X threads: **50K+ interactions** in the March 9 launch window alone

## Target Audience

Developers who run code reviews on every PR and either:
- Pay $15/PR for Anthropic's Code Review feature and want a free native alternative
- Do manual reviews that miss security issues, performance regressions, and style drift
- Have a checklist they run mentally but want automated and consistent

They use gh CLI, write TypeScript/Python/Swift/Go, and run Claude Code daily. They want a review that knows their stack, posts to the PR, and doesn't require a separate subscription.

## Core Thesis

Run comprehensive, parallel code reviews on any diff or PR using Claude Code's Agent tool and gh CLI — free on your existing Claude subscription, customizable for your stack, no separate product needed.

## Skill Scope

### In Scope
- Fetching PR diffs via `gh pr diff` and local `git diff`
- Running parallel sub-reviewers via the Agent tool (security, performance, correctness, style)
- Producing structured output with severity levels (critical/high/medium/low)
- Posting review results as PR comments via `gh pr comment`
- Configuring custom checklists per stack (Next.js/Convex, iOS/Swift, React Native, Python)
- Triggering reviews on-demand (`/review`) and via PreToolUse hook before commits

### Out of Scope
- CI/CD integration (Jenkins, GitHub Actions — hook points only, not full pipeline config)
- Real-time review during typing (this runs on completed diffs, not keystrokes)
- Anthropic Code Review API (we build the native equivalent, not a wrapper)
- Test generation (see tdd-workflow skill)

## Sections

1. **Why Native Beats $15/PR** — What Anthropic's Code Review product does, why it's expensive, and what the native Agent tool approach covers for free. The key insight: parallel sub-reviewers are just `Agent()` calls with focused prompts.

2. **The Review Architecture** — Four parallel sub-reviewers: Security (OWASP top 10, injection, XSS, auth), Performance (N+1 queries, missing caching, expensive loops), Correctness (logic bugs, null handling, edge cases), Style (convention drift, naming, dead code). Each is a focused Agent call — Sonnet for routine, Haiku for style.

3. **Fetching the Diff** — Three inputs: `gh pr diff <number>`, `git diff main...HEAD`, or a specific file range. How to scope the review so it's fast (don't review generated files, lock files, or vendor dirs).

4. **Running a Review** — The `/review` skill trigger, what the orchestrator does, how findings get collected, how severity is determined. Output format: markdown table with file+line, severity, finding, suggestion.

5. **Posting to the PR** — Using `gh pr comment` to post results. When to use a new comment vs. editing an existing one. How to thread findings to specific line numbers with the GitHub review API.

6. **Custom Checklists** — How to add stack-specific checks to `~/.claude/review-checklist.md`. Examples for Next.js/Convex (SQL injection via Convex validators, missing `use client`, server component misuse), iOS (missing `@MainActor`, force unwraps in production paths), Python (unhandled exceptions in async paths). How SkillBuilder reads this file at review time.

7. **Auto-Triggering** — PreToolUse hook that fires `/review` before any `git push`. How to scope it to only trigger on pushes to feature branches. How to block a push if critical findings exist.

8. **Full Walk-Through** — End-to-end: `gh pr diff 47` → four parallel Agent reviewers → findings merged and deduped → severity sort → PR comment posted. Real diff, real output.

## Success Criteria

After installing this skill, a developer should be able to:
- [ ] Run `/review` on any open PR and get structured findings within 60 seconds
- [ ] Get output with severity levels (critical/high/medium/low) and file+line references
- [ ] Post review results as a PR comment with one command
- [ ] Add stack-specific checks to `~/.claude/review-checklist.md` and have them appear in future reviews
- [ ] Configure the auto-trigger hook to run before every push to feature branches

## Keywords

claude code review, automated code review, pr review automation, code review skill, security review claude code, parallel code review, gh cli code review, native code review anthropic, free alternative code review

## Competitive Positioning

| Their Approach | Our Approach |
|---|---|
| Anthropic Code Review: ~$15/PR, separate product, can't customize | Native Agent tool: $0 extra, runs on your subscription, fully customizable |
| GitHub Copilot Review: requires Copilot Enterprise subscription | gh CLI + Agent: works with any GitHub plan |
| Manual review checklist: inconsistent, skipped under deadline | Automated pre-push hook: runs every time, blocks on criticals |
| One generic reviewer | Four parallel focused reviewers: security, perf, correctness, style |
| Fixed review checklist | Stack-aware: reads your `review-checklist.md` |

## Estimated Complexity

Medium. Uses: Agent tool (parallel subagents), gh CLI (diff fetching + comment posting), PreToolUse hook (auto-trigger), optional `review-checklist.md` (customization). No new dependencies — all primitives from existing skills.
