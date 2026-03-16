# Skill Brief: Git Workflow Automation with Claude Code

## Demand Signal

- ClawHub "github" skill: 111,943 downloads — #6 overall, pure `gh` CLI wrapping (zero education, zero native patterns)
- ClawHub "gog" (git operations guide): 115,193 downloads — #5 overall
- Combined git-related ClawHub skills: 227,136+ downloads — demand rivaling skill #1
- GitHub issue #34645 (parallel agents hitting git lock contention): opened March 2026, 47 comments in first week — one of the fastest-growing pain threads
- GitHub issue #34682 (gitattributes not respected in worktrees): confirmed bug, affects parallel multi-agent setups
- GitHub issue #34693 (worktree isolation breaking between agents): 38 comments, feature request + bug report
- `aa799bb` commit in paperclipai/claude-code itself fixes a worktree seed bug — the maintainers are actively fighting this too
- YouTube search "Claude Code git workflow": zero tutorial results teaching worktrees or parallel branch strategies — content gap confirmed

## Target Audience

Developers who have mastered single-agent Claude Code work and are now hitting the ceiling:

- Running multiple Claude agents in parallel and getting `fatal: unable to lock ref` errors
- Manually creating branches and PRs — wondering if Claude can handle the whole git loop
- Using Claude Code for feature work but still switching to terminal for all git operations
- Coming from skill #3 (multi-agent-coordination) and asking: "okay, but how do I isolate each agent's git state?"

They know git. They don't need a git tutorial. They need the pattern for making Claude Code and git work together without friction.

## Core Thesis

Git worktrees + `gh` CLI give you parallel, isolated, fully automated git workflows that eliminate the #1 source of multi-agent failure: shared branch state. Claude Code can run the entire git loop — branch, implement, PR, merge — without a human touching the terminal.

## Skill Scope

### In Scope
- Git worktree setup for parallel agent isolation (create, list, remove)
- `gh` CLI patterns for PR creation, review, merge, and status checks from within Claude Code
- Branch strategy for multi-agent work (feature branches, agent-per-worktree pattern)
- Git lock avoidance: why agents collide and how to prevent it with worktree isolation
- Commit message conventions that work with Claude Code (co-authored-by, structured messages)
- The "full loop": branch → implement → commit → PR → merge → cleanup, fully automated
- Handling git conflicts when they happen in automated workflows
- Hook-based git automation (auto-commit on file save, pre-push validation)

### Out of Scope
- Basic git concepts (commits, branches, merges) — audience knows this
- GitHub Actions / CI setup — separate skill
- Multi-repo management / monorepo tooling
- Git LFS or large binary handling
- GitLab, Bitbucket, or non-GitHub providers
- Setting up SSH keys or authentication

## Sections

1. **Why Git + Multi-Agent Breaks (and the Fix)** — The shared-branch problem: two agents modify the same files, git locks, everything halts. Worktrees as the solution: each agent gets its own working directory, same repo, no contention. Shows the exact error and the exact fix.

2. **Git Worktrees: The Pattern** — `git worktree add`, `list`, `remove`. The agent-per-worktree setup. Where to put worktrees (temp dir vs. sibling dir). Naming conventions. How Claude Code's `isolation: "worktree"` option uses this under the hood.

3. **The `gh` CLI Loop** — PR creation with `gh pr create`. Status checks with `gh pr status`. Merging with `gh pr merge`. Listing and reviewing with `gh pr list`. The full PR lifecycle from within a Claude Code session without touching a browser.

4. **Branch Strategy for Claude Code** — Feature branch per task. Branch naming conventions that encode context (issue number, agent, task type). When to reuse branches vs. create fresh. Keeping main clean.

5. **Hook-Based Git Automation** — PreToolUse hook: validate branch before making changes (not on main). PostToolUse hook: auto-stage and checkpoint commits after significant file writes. Stop hook: create a WIP commit before session ends. All three examples, ready to install.

6. **Conflict Resolution in Automated Workflows** — When merges fail in an automated setup. The "detect, stash, rebase, unstash" pattern. How to give Claude enough context to resolve conflicts without human intervention. When to escalate vs. auto-resolve.

7. **The Full Loop: Branch to Merged PR** — End-to-end walkthrough: create branch → implement feature → stage and commit → push → create PR → request review → merge → delete branch → return to main. Every command. Every `gh` call. Every decision point. Fully copy-pasteable.

## Success Criteria

After installing this skill, a developer should be able to:
- [ ] Set up a git worktree for a new agent workstream in under 60 seconds
- [ ] Run a parallel 2-agent session without hitting a single git lock error
- [ ] Create a PR from within a Claude Code session using only `gh` CLI (no browser)
- [ ] Have a Stop hook that saves a WIP commit before context ends
- [ ] Complete the full branch → implement → PR → merge loop without touching a terminal manually

## Keywords

claude code git, git worktrees claude, gh cli claude code, parallel agents git, git workflow automation, claude code pr, multi-agent git isolation, git lock fix claude, automated pull request

## Competitive Positioning

| Their Approach | Our Approach |
|---|---|
| ClawHub "github" skill: wraps `gh` commands, no patterns | Teaches *why* the commands work and how they compose into a loop |
| ClawHub "gog": generic git guide, not Claude-specific | Built for Claude Code's multi-agent architecture specifically |
| Manual git: developer creates branches, PRs, merges by hand | Full loop automation — Claude runs end-to-end without human git ops |
| Multi-agent without worktrees: constant git lock failures | Worktree-per-agent: zero contention, proven isolation pattern |
| "Just use `git checkout`": shared branch, race conditions | "Use `git worktree add`": dedicated working directory per agent |

## Estimated Complexity

Medium. Dependencies: `git` (built-in), `gh` CLI (needs install — free). No paid APIs. All commands are standard git and GitHub operations. The skill is about composing them into reliable patterns, not introducing new tools.

**Build sequence dependency**: Best after skill #3 (multi-agent-coordination) — this is the git layer that makes parallel agents actually safe to run.
