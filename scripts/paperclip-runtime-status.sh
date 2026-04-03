#!/bin/zsh

set -euo pipefail

LABEL="com.kevin.paperclip.server"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
HEALTH_URL="http://127.0.0.1:3100/api/health"
LOG_DIR="$HOME/Library/Logs/Paperclip"
HEALTHCHECK_SCRIPT="/Users/kevin/codex/projects/paperclip/scripts/paperclip-runtime-healthcheck.sh"

health_payload="unavailable"
for _ in 1 2 3; do
  if health_payload="$("$HEALTHCHECK_SCRIPT" 2>/dev/null)"; then
    break
  fi
  sleep 1
done

echo "label=$LABEL"
echo "plist=$PLIST"
echo "installed=$([ -f "$PLIST" ] && echo yes || echo no)"
if launchctl print "gui/$UID/$LABEL" >/dev/null 2>&1; then
  echo "launchd_loaded=yes"
else
  echo "launchd_loaded=no"
fi
echo "listener=$(lsof -nP -iTCP:3100 -sTCP:LISTEN 2>/dev/null | tail -n +2 | head -n 1 || true)"
echo "health=$health_payload"
echo "logs=$LOG_DIR"
