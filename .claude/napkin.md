# Napkin

## Corrections
| Date | Source | What Went Wrong | What To Do Instead |
|------|--------|----------------|-------------------|
| 2026-03-22 | User | `.gitignore` missing `.claude/ground-cache*`, `.claude/cache/`, `.pi/` despite AGENTS.md §4.3 listing them | When AGENTS.md §4.3 says "ignore," verify the repo's `.gitignore` actually has the pattern. Don't assume. |
| 2026-03-22 | Session | `git rebase --continue` opened vim and hung the session | Always use `GIT_EDITOR=true git rebase --continue` in agent context |

## User Preferences
- Focus recommendations to the fork (origin), not upstream — don't suggest upstream PRs until user is ready
- User expects agents to run manual verification themselves when possible, not defer to user

## Patterns That Work
- Extract pure functions from complex services (heartbeat.ts) to make them testable without DB infrastructure — follows existing shouldResetTaskSessionForWake pattern
- Full end-to-end zombie scenario test via API: create company → agent → issue → wakeup → kill server → restart → verify reap + recovery
- `codex-review-exec` with `--session` flag for iterative Codex review rounds

## Patterns That Don't Work
- `void` fire-and-forget for critical startup operations — zombies survive restarts; use `await` with retry instead
- Predicate-only unit tests without behavioral tests of the actual guard pattern — Codex code-verify rejects these
- Rebasing onto heavily-diverged upstream without checking for duplicate changes — upstream may have already applied your fix, causing type errors from duplicated ternary branches

## Domain Notes
- pnpm monorepo: server/ ui/ packages/db packages/shared packages/adapters/ cli/
- heartbeat.ts (~2350 lines) is the orchestration core
- 8 adapter types: claude-local, codex-local, cursor-local, gemini-local, openclaw, openclaw-gateway, opencode-local, pi-local
- Dev: `pnpm dev` → localhost:3100, embedded PGlite
- Verification: `pnpm -r typecheck && pnpm test:run && pnpm build`
- Upstream: paperclipai/paperclip (722+ commits ahead as of v0.3.1). Major additions: plugins, routines, worktrees, gemini adapter, budgets, company skills
- No DB test infrastructure — all heartbeat tests are pure-function extractions
