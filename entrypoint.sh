#!/bin/bash
set -euo pipefail

# Inject Claude subscription credentials from Secrets Manager env var
if [[ -n "${CLAUDE_CREDENTIALS:-}" ]]; then
  mkdir -p /paperclip/.claude
  echo "$CLAUDE_CREDENTIALS" > /paperclip/.claude/.credentials.json
  echo "[entrypoint] Claude credentials written to /paperclip/.claude/.credentials.json"
fi

# Inject Codex/OpenAI subscription credentials
if [[ -n "${CODEX_CREDENTIALS:-}" ]]; then
  mkdir -p /paperclip/.codex
  echo "$CODEX_CREDENTIALS" > /paperclip/.codex/credentials.json
  echo "[entrypoint] Codex credentials written to /paperclip/.codex/credentials.json"
fi

# Authenticate gh CLI with the GitHub token
if [[ -n "${GITHUB_TOKEN:-}" ]]; then
  echo "$GITHUB_TOKEN" | gh auth login --with-token
  echo "[entrypoint] gh CLI authenticated"
fi

exec node --import ./server/node_modules/tsx/dist/loader.mjs server/dist/index.js
