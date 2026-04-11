#!/bin/bash
set -euo pipefail

# =============================================================================
# Claude Code Runner — Entrypoint
# Spec ref: AgenticSquad_Functional_Spec v2.8 RC §6.3.5, §6.3.7
#
# Expected environment variables (injected by Code Operator at dispatch):
#   ANTHROPIC_API_KEY  — Claude Code auth (from Key Vault, always present)
#   GIT_TOKEN          — GitHub App installation token (short-lived, per-execution)
#   ISSUE_NUMBER       — GitHub issue number to implement
#   ISSUE_BODY         — Full story text with acceptance criteria
#   RETRY_CONTEXT      — (optional) Test failure context from previous attempt
#   REPO               — Repository (default: stepan-korec/trading-agent)
#   BRANCH_PREFIX      — Branch prefix (default: feat/issue-)
# =============================================================================

REPO="${REPO:-stepan-korec/trading-agent}"
BRANCH_PREFIX="${BRANCH_PREFIX:-feat/issue-}"
BRANCH="${BRANCH_PREFIX}${ISSUE_NUMBER}"
MAX_TURNS="${MAX_TURNS:-50}"

echo "============================================"
echo " Claude Code Runner"
echo " Issue: #${ISSUE_NUMBER}"
echo " Branch: ${BRANCH}"
echo " Repo: ${REPO}"
echo "============================================"
echo ""

# ─────────────────────────────────────────────
# Step 1: Clone the repository
# ─────────────────────────────────────────────
echo ">>> Step 1: Cloning repository..."

git clone --depth=50 \
  "https://x-access-token:${GIT_TOKEN}@github.com/${REPO}.git" \
  /workspace/repo

cd /workspace/repo

# Configure git for commits
git config user.name "trading-agent-workforce[bot]"
git config user.email "trading-agent-workforce[bot]@users.noreply.github.com"

# Create or checkout the feature branch
if git ls-remote --heads origin "${BRANCH}" | grep -q "${BRANCH}"; then
  echo "Branch ${BRANCH} exists — checking out"
  git checkout "${BRANCH}"
  git pull origin "${BRANCH}"
else
  echo "Creating new branch ${BRANCH}"
  git checkout -b "${BRANCH}"
fi

echo "Repository cloned and branch ready"

# ─────────────────────────────────────────────
# Step 2: Build the system prompt
# ─────────────────────────────────────────────
echo ""
echo ">>> Step 2: Building system prompt..."

SYSTEM_PROMPT="You are implementing a user story for the Trading Agent Platform.

## Story
${ISSUE_BODY}

## Context Documents
Read these files before writing any code:
- docs/specs/FUNCTIONAL_SPECIFICATION.md (behavioral requirements)
- docs/specs/ARCHITECTURE.md (service topology)
- docs/LESSONS_LEARNED.md (known pitfalls — READ THIS)

## Implementation Rules
1. Write code AND tests. Every new function gets a test.
2. Keep changes small and focused. Do not refactor unrelated code.
3. Follow existing patterns in the codebase. When uncertain, read neighboring files.
4. If the story requires a database migration, create it in services/<name>/migrations/.
5. If the story requires a new environment variable, document it in the PR description.
6. After making changes, run the relevant test suite to verify your work.
"

# Append retry context if this is a retry attempt
if [ -n "${RETRY_CONTEXT:-}" ]; then
  SYSTEM_PROMPT="${SYSTEM_PROMPT}

## Previous Attempt Failed
${RETRY_CONTEXT}

Fix the issues described above. Focus specifically on the test failures and do not change unrelated code.
"
  echo "Retry context appended (previous attempt failed)"
fi

echo "System prompt ready ($(echo "${SYSTEM_PROMPT}" | wc -c) bytes)"

# ─────────────────────────────────────────────
# Step 3: Run Claude Code
# ─────────────────────────────────────────────
echo ""
echo ">>> Step 3: Running Claude Code..."

# Write system prompt to temp file (avoids shell escaping issues)
echo "${SYSTEM_PROMPT}" > /tmp/system-prompt.txt

# Run Claude Code in non-interactive mode
# --dangerously-skip-permissions is safe: isolated container, throwaway filesystem
# --allowedTools restricts to Read, Edit, Bash, Grep, Glob (spec §6.3.7)
# Setting sources loads CLAUDE.md from repo root automatically
claude -p "$(cat /tmp/system-prompt.txt)" \
  --output-format json \
  --allowedTools "Read" "Edit" "Bash" "Grep" "Glob" \
  --max-turns "${MAX_TURNS}" \
  --dangerously-skip-permissions \
  --verbose \
  2>&1 | tee /tmp/claude-output.json

CLAUDE_EXIT=$?

if [ ${CLAUDE_EXIT} -ne 0 ]; then
  echo "Claude Code exited with code ${CLAUDE_EXIT}"
  # Still try to capture any partial work
fi

echo "Claude Code finished (exit code: ${CLAUDE_EXIT})"

# ─────────────────────────────────────────────
# Step 4: Check for changes and push
# ─────────────────────────────────────────────
echo ""
echo ">>> Step 4: Committing and pushing changes..."

# Check if there are any changes
if git diff --quiet && git diff --cached --quiet; then
  echo "No changes detected — Claude Code may not have made modifications"
  echo "EXIT_STATUS=no_changes" > /tmp/runner-result.env
  exit 0
fi

# Stage all changes
git add -A

# Count changes for commit message
FILES_CHANGED=$(git diff --cached --name-only | wc -l)
echo "Files changed: ${FILES_CHANGED}"

# Commit
git commit -m "feat: implement issue #${ISSUE_NUMBER}

Automated implementation by Claude Code Runner.
Files changed: ${FILES_CHANGED}

Closes #${ISSUE_NUMBER}"

# Push
git push origin "${BRANCH}"

echo "Changes pushed to ${BRANCH}"

# ─────────────────────────────────────────────
# Step 5: Write result metadata
# ─────────────────────────────────────────────
echo ""
echo ">>> Step 5: Writing result metadata..."

COMMIT_SHA=$(git rev-parse HEAD)

cat > /tmp/runner-result.env << RESULTEOF
EXIT_STATUS=success
BRANCH=${BRANCH}
COMMIT_SHA=${COMMIT_SHA}
FILES_CHANGED=${FILES_CHANGED}
CLAUDE_EXIT_CODE=${CLAUDE_EXIT}
RESULTEOF

echo "============================================"
echo " Run complete"
echo " Branch: ${BRANCH}"
echo " Commit: ${COMMIT_SHA}"
echo " Files: ${FILES_CHANGED}"
echo "============================================"
