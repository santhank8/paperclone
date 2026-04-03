#!/bin/zsh

set -euo pipefail

LABEL="com.kevin.paperclip.server"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
APP_ROOT="/Users/kevin/codex/projects/paperclip"
HEALTHCHECK="$APP_ROOT/scripts/paperclip-runtime-healthcheck.sh"

wait_for_health() {
  for _ in {1..45}; do
    if "$HEALTHCHECK" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  return 1
}

start_direct_fallback() {
  mkdir -p "$HOME/Library/Logs/Paperclip"
  nohup "$APP_ROOT/scripts/paperclip-runtime-launch.sh" >> "$HOME/Library/Logs/Paperclip/server.manual.log" 2>&1 &
  wait_for_health
}

if [ -f "$PLIST" ]; then
  launchctl bootstrap "gui/$UID" "$PLIST" >/dev/null 2>&1 || true
  launchctl enable "gui/$UID/$LABEL" >/dev/null 2>&1 || true
  if launchctl kickstart -k "gui/$UID/$LABEL" >/dev/null 2>&1 && wait_for_health; then
    exit 0
  fi
  start_direct_fallback
  exit 0
fi

start_direct_fallback
