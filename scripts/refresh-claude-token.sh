#!/bin/bash
# Reads fresh Claude Code OAuth credentials from macOS Keychain and Codex
# ChatGPT subscription auth from ~/.codex/auth.json, then pushes them to Fly.io.
#
# Run this on your Mac before the access token expires (~every 24 hours).
# Best practice: install as a LaunchAgent that runs every 6 hours.
#
# Setup (one-time):
#   chmod +x scripts/refresh-claude-token.sh
#   cp scripts/com.paperclip.refresh-claude-token.plist ~/Library/LaunchAgents/
#   launchctl load ~/Library/LaunchAgents/com.paperclip.refresh-claude-token.plist
#
# Manual run:
#   ./scripts/refresh-claude-token.sh

set -euo pipefail

export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

APP="${FLY_APP:-paperclip-holding}"
KEYCHAIN_SERVICE="Claude Code-credentials"
LOGFILE="$HOME/.paperclip-token-refresh.log"
REFRESH_THRESHOLD_MINUTES="${CLAUDE_REFRESH_THRESHOLD_MINUTES:-420}"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOGFILE"; }

read_claude_creds() {
  security find-generic-password -s "$KEYCHAIN_SERVICE" -w 2>/dev/null || true
}

credential_minutes_remaining() {
  echo "$1" | python3 -c "
import json, sys, time
d = json.load(sys.stdin)
ts = d['claudeAiOauth'].get('expiresAt', 0)
print(int((ts / 1000 - time.time()) / 60))
"
}

credential_expiry_utc() {
  echo "$1" | python3 -c "
import json, sys, datetime
d = json.load(sys.stdin)
ts = d['claudeAiOauth'].get('expiresAt', 0)
dt = datetime.datetime.utcfromtimestamp(ts / 1000)
print(dt.strftime('%Y-%m-%d %H:%M UTC'))
"
}

refresh_local_claude_token() {
  if ! command -v claude >/dev/null 2>&1; then
    log "ERROR: claude CLI not found; cannot refresh local Claude credentials before Fly sync"
    exit 1
  fi

  log "Refreshing local Claude credentials via a minimal Claude request..."
  if ! claude -p "Reply exactly: TOKEN_REFRESH_OK" --output-format json >/tmp/paperclip-claude-token-refresh.json 2>/tmp/paperclip-claude-token-refresh.err; then
    log "ERROR: Claude local refresh request failed"
    tail -40 /tmp/paperclip-claude-token-refresh.err 2>/dev/null | tee -a "$LOGFILE"
    exit 1
  fi
}

log "Reading Claude credentials from Keychain (service: $KEYCHAIN_SERVICE)..."

# Read raw JSON from macOS Keychain
CREDS=$(read_claude_creds)

if [ -z "$CREDS" ]; then
  log "ERROR: No credentials found in Keychain under '$KEYCHAIN_SERVICE'"
  log "  Make sure you are logged in to Claude Code on this Mac."
  exit 1
fi

# Validate: must be JSON containing claudeAiOauth
if ! echo "$CREDS" | python3 -c "import json,sys; d=json.load(sys.stdin); assert 'claudeAiOauth' in d" 2>/dev/null; then
  log "ERROR: Keychain credentials do not contain 'claudeAiOauth' key"
  exit 1
fi

MINUTES_REMAINING=$(credential_minutes_remaining "$CREDS")
EXPIRES_AT=$(credential_expiry_utc "$CREDS")

if [ "$MINUTES_REMAINING" -lt "$REFRESH_THRESHOLD_MINUTES" ]; then
  log "Token expires too soon ($MINUTES_REMAINING min remaining; threshold $REFRESH_THRESHOLD_MINUTES min)."
  refresh_local_claude_token
  CREDS=$(read_claude_creds)
  MINUTES_REMAINING=$(credential_minutes_remaining "$CREDS")
  EXPIRES_AT=$(credential_expiry_utc "$CREDS")
fi

if [ "$MINUTES_REMAINING" -le 0 ]; then
  log "ERROR: Claude token is still expired after local refresh attempt (expires: $EXPIRES_AT)"
  exit 1
fi

log "Token valid until: $EXPIRES_AT ($MINUTES_REMAINING min remaining)"

# Extract raw accessToken for CLAUDE_CODE_OAUTH_TOKEN env var
# (claude CLI 2.1.x checks this env var first — works on Linux where no Keychain is available)
ACCESS_TOKEN=$(echo "$CREDS" | python3 -c "
import json, sys
d = json.load(sys.stdin)
print(d['claudeAiOauth']['accessToken'])
")

if [ -z "$ACCESS_TOKEN" ]; then
  log "ERROR: Could not extract accessToken from credentials"
  exit 1
fi

log "Pushing credentials to Fly.io app: $APP ..."

CODEX_AUTH_JSON=""
if [ -f "$HOME/.codex/auth.json" ]; then
  if python3 -m json.tool "$HOME/.codex/auth.json" >/dev/null 2>&1; then
    CODEX_AUTH_JSON=$(cat "$HOME/.codex/auth.json")
    log "Codex auth found at ~/.codex/auth.json; including CODEX_AUTH_JSON."
  else
    log "WARNING: ~/.codex/auth.json exists but is not valid JSON; skipping CODEX_AUTH_JSON."
  fi
else
  log "WARNING: ~/.codex/auth.json not found; Codex agents may need manual login."
fi

# Set both secrets at once (single deploy trigger)
if [ -n "$CODEX_AUTH_JSON" ]; then
  fly secrets set \
    "CLAUDE_CREDENTIALS_JSON=$CREDS" \
    "CLAUDE_CODE_OAUTH_TOKEN=$ACCESS_TOKEN" \
    "CODEX_AUTH_JSON=$CODEX_AUTH_JSON" \
    --app "$APP" 2>&1 | tee -a "$LOGFILE"
else
  fly secrets set \
    "CLAUDE_CREDENTIALS_JSON=$CREDS" \
    "CLAUDE_CODE_OAUTH_TOKEN=$ACCESS_TOKEN" \
    --app "$APP" 2>&1 | tee -a "$LOGFILE"
fi

log "Done. Claude credentials refreshed; Codex auth included: $([ -n "$CODEX_AUTH_JSON" ] && echo yes || echo no)."
