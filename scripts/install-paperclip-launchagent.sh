#!/bin/zsh

set -euo pipefail

APP_ROOT="/Users/kevin/codex/projects/paperclip"
LABEL="com.kevin.paperclip.server"
TEMPLATE="$APP_ROOT/launcher/$LABEL.plist.template"
DEST="$HOME/Library/LaunchAgents/$LABEL.plist"
LOG_DIR="$HOME/Library/Logs/Paperclip"
PATH_VALUE="/Users/kevin/.local/bin:/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

mkdir -p "$HOME/Library/LaunchAgents" "$LOG_DIR"

sed \
  -e "s|__APP_ROOT__|$APP_ROOT|g" \
  -e "s|__HOME__|$HOME|g" \
  -e "s|__PATH__|$PATH_VALUE|g" \
  "$TEMPLATE" > "$DEST"

chmod 644 "$DEST"
chmod +x "$APP_ROOT/scripts/paperclip-runtime-launch.sh" \
  "$APP_ROOT/scripts/paperclip-runtime-healthcheck.sh" \
  "$APP_ROOT/scripts/paperclip-runtime-start.sh" \
  "$APP_ROOT/scripts/paperclip-runtime-stop.sh" \
  "$APP_ROOT/scripts/paperclip-runtime-status.sh"

launchctl bootout "gui/$UID" "$DEST" >/dev/null 2>&1 || true
launchctl bootstrap "gui/$UID" "$DEST"
launchctl enable "gui/$UID/$LABEL" >/dev/null 2>&1 || true
launchctl kickstart -k "gui/$UID/$LABEL"

echo "Installed LaunchAgent: $DEST"
echo "Logs: $LOG_DIR"
