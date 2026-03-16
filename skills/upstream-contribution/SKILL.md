---
name: upstream-contribution
description: >
  Use when working on any task that involves contributing code to an
  upstream Transpara LLC repository. This includes syncing forks,
  scouting for tasks, creating branches, coding fixes or features,
  code review, and creating pull requests. Do NOT use for work that
  stays entirely within transpara-ai owned code.
---

# Upstream Contribution Workflow

## Overview

Transpara AI maintains forks of Transpara LLC repositories under the
transpara-ai GitHub org. All contribution work happens in these forks.
We never push directly to upstream repos. The goal is to earn accepted
PRs that prove our team produces peer-quality work.

## Fork Locations

All forks are cloned at: /home/transpara/transpara-ai/repos/<repo-name>

Each fork has two remotes:
- origin: the transpara-ai fork
- upstream: the transpara LLC source repo

## Step 1: Sync Fork with Upstream

Before any work, sync the fork:
```bash
cd /home/transpara/transpara-ai/repos/<repo-name>
git fetch upstream
git checkout main   # or master — check which is default
git merge upstream/main
git push origin main
```

If there are conflicts, resolve them conservatively — prefer upstream
changes unless there is a clear reason not to. Report conflicts to the
CTO before proceeding.

Verify the repo still builds and tests pass after sync.

## Step 2: Scout for Candidates

Scan the synced repo for small, self-contained improvements. Good
candidates in priority order:

1. Failing or missing tests
2. Documentation gaps or errors
3. Dependency updates with clear changelogs
4. Linting or type-checking fixes
5. Small bug fixes with obvious root cause
6. CI/CD improvements

Every candidate must meet ALL criteria:
- Small scope (1-3 heartbeat sessions for one engineer)
- Matches team competencies (TypeScript/React or Python)
- High confidence of acceptance by upstream maintainers
- Low risk (no core business logic, auth, or data integrity)
- Self-contained (no dependencies on unreleased work)

Document each candidate with: repo, files affected, what the issue is,
estimated effort, which agent should do it, and risk assessment.

## Step 3: Create Branch

All work happens on a feature branch in the transpara-ai fork:
```bash
git checkout -b ai/<type>-<short-description>
```

Branch naming:
- ai/fix-<description> for bug fixes
- ai/feat-<description> for features
- ai/docs-<description> for documentation
- ai/test-<description> for test improvements
- ai/chore-<description> for dependency updates or maintenance

NEVER create branches in the upstream repo.

## Step 4: Do the Work

The assigned engineer works on the branch following these rules:

- Match the UPSTREAM repo conventions, not transpara-ai conventions
  - Their linting rules
  - Their commit message style
  - Their test framework and patterns
  - Their code formatting
- Keep changes minimal and focused — no unrelated reformatting
- Write tests that follow the repo's existing test patterns
- Update documentation if behavior changes

### Definition of Done
- All existing tests still pass
- New tests cover the change
- Linting passes (using upstream linter config)
- Type-checking passes (if applicable)
- The repo builds successfully
- Commit messages follow upstream conventions
- Change is described clearly in a comment

## Step 5: CTO Code Review

The CTO reviews before any PR is created:

- Pull the branch and run all tests locally
- Verify code style matches upstream conventions (not ours)
- Check the change is minimal and focused
- Verify commit messages follow upstream style
- Look for anything that reveals AI authorship (unusual patterns,
  over-commenting, generic variable names, repetitive structure)
- If issues found: send back with specific feedback
- If satisfied: create PR within the transpara-ai fork

## Step 6: CEO Strategic Review

The CEO reviews the PR for:

- Strategic alignment with Transpara AI mission
- Professional tone in PR title and description
- No proprietary information leaked (no references to Paperclip,
  agents, AI systems, or internal tooling)
- The PR must read as if a skilled human developer submitted it

If approved: the upstream PR is created from the transpara-ai fork
to the transpara org repo.

## Step 7: Upstream PR

The upstream PR must:
- Have a clear, concise title following upstream conventions
- Explain what was changed and why in the description
- Reference any relevant upstream issues if they exist
- Include test results or evidence the change works
- Contain NO mention of AI, agents, Paperclip, or transpara-ai internals

## Critical Rules

1. ALL work in transpara-ai forks, NEVER upstream directly
2. Branch names always prefixed with ai/
3. No force pushes to shared branches
4. Upstream conventions override our conventions
5. The PR must stand on its own merit
6. Quality bar: upstream reviewers should not know this was AI-authored

## Knowledge Capture

After any upstream contribution (successful or not), every agent
involved must update their KNOWLEDGE.md with:
- Upstream repo structure, build system, test framework
- Code conventions and patterns observed
- What worked and what was rejected
- Lessons for the next contribution attempt
