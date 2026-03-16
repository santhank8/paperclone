# Auto-Triggering: PreToolUse Hook Before Push

## How It Works

A PreToolUse hook intercepts every Bash tool call Claude Code makes. When it detects `git push` to a non-main branch, it runs the review with `--check-only`. If critical findings exist, it exits 1 — which blocks Claude Code from executing the push.

## Hook Configuration

Add to `~/.claude/settings.json`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "~/.claude/hooks/pre-push-review.sh"
          }
        ]
      }
    ]
  }
}
```

## The Hook Script

Save to `~/.claude/hooks/pre-push-review.sh` and `chmod +x` it:

```bash
#!/bin/bash
# Pre-push code review hook
# Reads CLAUDE_TOOL_INPUT from environment (set by Claude Code)

INPUT="${CLAUDE_TOOL_INPUT:-}"

# Only intercept git push commands
if ! echo "$INPUT" | grep -q "git push"; then
  exit 0  # Not a push, don't intercept
fi

# Don't block pushes to main/master (those go through PR anyway)
if echo "$INPUT" | grep -qE "origin (main|master)"; then
  exit 0  # Pushing to main — skip review, trust the PR process
fi

# Don't block --no-verify pushes (explicit override)
if echo "$INPUT" | grep -q "\-\-no-verify"; then
  exit 0  # Developer explicitly bypassing
fi

echo "🔍 Running pre-push code review..."

# Get the diff for what's being pushed
DIFF=$(git diff origin/main...HEAD 2>/dev/null || git diff HEAD~1 2>/dev/null)

if [ -z "$DIFF" ]; then
  echo "No diff found — skipping review"
  exit 0
fi

# Run review in check-only mode
# Returns exit code 1 if CRITICAL findings exist
REVIEW_OUTPUT=$(echo "$DIFF" | claude "/review --check-only" 2>&1)
REVIEW_EXIT=$?

if [ $REVIEW_EXIT -ne 0 ]; then
  echo "❌ BLOCKED: Critical findings require attention before push:"
  echo "$REVIEW_OUTPUT"
  echo ""
  echo "Fix the issues above, or run: git push --no-verify  (to bypass)"
  exit 1  # Block the push
fi

echo "✅ Review passed — no critical findings"
exit 0
```

## The `--check-only` Flag

Your review skill needs to handle this flag to exit 1 on criticals:

```bash
# In your review implementation, check for the flag:
CHECK_ONLY=false
if echo "$@" | grep -q "\-\-check-only"; then
  CHECK_ONLY=true
fi

# After running reviewers and collecting findings:
CRITICAL_COUNT=$(grep -c "CRITICAL" /tmp/review-findings.md || echo 0)

if $CHECK_ONLY && [ "$CRITICAL_COUNT" -gt 0 ]; then
  echo "$CRITICAL_COUNT critical finding(s) found"
  cat /tmp/review-findings.md
  exit 1  # Signal to hook: block the push
fi
```

## Branch Scope Filter

The hook above only reviews pushes to feature branches. Customize the filter:

```bash
# Block ALL pushes (including to main) — strictest
# Remove the main/master check entirely

# Only review branches matching a naming pattern
if ! echo "$INPUT" | grep -qE "origin feature/|origin fix/|origin feat/"; then
  exit 0  # Not a feature branch push
fi

# Review everything except tags
if echo "$INPUT" | grep -q "\-\-tags"; then
  exit 0  # Tag push, skip
fi
```

## Testing the Hook

```bash
# Verify the hook file is executable
ls -la ~/.claude/hooks/pre-push-review.sh

# Dry-run: simulate what CLAUDE_TOOL_INPUT would contain
CLAUDE_TOOL_INPUT="git push origin feature/my-branch" \
  bash ~/.claude/hooks/pre-push-review.sh

# Check it doesn't intercept main pushes
CLAUDE_TOOL_INPUT="git push origin main" \
  bash ~/.claude/hooks/pre-push-review.sh
echo "Exit code: $?"  # Should be 0 (not intercepted)
```

## Override Mechanism

Developers can always bypass the hook:

```bash
git push --no-verify                    # bypass all hooks
git push origin main                    # goes to main, hook skips it
SKIP_REVIEW=1 git push origin feature/x # custom env var if you add it to hook
```

Document the bypass in your team's README so developers don't feel trapped.

## Performance Considerations

The hook adds ~30-60 seconds to a push (parallel review time). For most feature branch pushes this is acceptable. If it's too slow:

1. **Scope down the diff**: only review changed files in `src/`, skip test files
2. **Use faster models**: switch Security and Performance reviewers to Haiku for the hook (lower quality but faster)
3. **Only block on CRITICAL**: downgrade to `--critical-only` — let HIGH findings through with a warning instead of a block

```bash
# Warning mode instead of block
if $CHECK_ONLY && [ "$CRITICAL_COUNT" -gt 0 ]; then
  echo "⚠️  WARNING: $CRITICAL_COUNT critical finding(s). Proceeding anyway."
  echo "Run /review to see full results."
  exit 0  # Warning, not block
fi
```
