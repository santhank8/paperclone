# Phase 5: Ship It

## What This Phase Does

Creates a properly described PR using gh CLI, writes a changelog entry, verifies the deploy, and archives TASK.md to git. The PR description is auto-populated from TASK.md and git log.

## PR Creation with gh CLI

Ask Claude to generate the PR command:
> "Read TASK.md and git log main..HEAD. Create a gh pr create command with a well-structured body: summary bullets from completed steps, acceptance criteria as the test plan, and notes from TASK.md Notes fields."

Claude generates the command. You run it. Or build it manually:

```bash
gh pr create \
  --title "[Feature]: [concise description from TASK.md]" \
  --body "$(cat <<'EOF'
## Summary
- [What changed and why — from TASK.md Step titles]
- [Key architectural decision made during implementation]

## Steps Completed
- [x] Step 1: [title]
- [x] Step 2: [title]
- [x] Step 3: [title]

## Test Plan
[Acceptance criteria from TASK.md — already written, copy them here]

## Notes
[Implementation decisions, gotchas, or follow-ups from TASK.md Notes fields]
EOF
)"
```

## Changelog Entry Format

```markdown
## [YYYY-MM-DD] [Feature Name]

### Added
- [What's new for users, not implementation details]

### Changed
- [Behavior changes, not refactors]

### Fixed
- [Bugs closed, with references if applicable]
```

Generate the raw material from git log:

```bash
git log main..HEAD --format="- %s" | grep -v "^- wip\|^- fix typo\|^- Merge"
```

## Deploy Verification

After PR merge:

```bash
# Check CI status
gh pr checks [PR number]

# Watch deploy run
gh run watch $(gh run list --limit 1 --json databaseId -q '.[0].databaseId')

# Confirm deploy completed
gh run list --limit 3
```

Smoke test the new behavior in production (or staging) before marking the project done.

## Archive TASK.md

After ship:

```bash
mkdir -p docs/completed
cp TASK.md "docs/completed/$(date +%Y-%m-%d)-[feature-name]-TASK.md"
git add docs/completed/
git commit -m "archive: TASK.md for [feature name]"
```

Reset TASK.md for the next feature or delete if the project is complete.
Update CLAUDE.md: remove the active step from the session state section.

## Checklist: Ship Complete

- [ ] All TASK.md steps marked done ✓
- [ ] PR created with structured description (summary, steps, test plan)
- [ ] CI passing (`gh pr checks`)
- [ ] Deploy verified
- [ ] Changelog entry written
- [ ] TASK.md archived to `docs/completed/`
- [ ] CLAUDE.md session state cleared (no stale active step)
