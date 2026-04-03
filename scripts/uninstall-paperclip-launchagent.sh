#!/bin/zsh

set -euo pipefail

LABEL="com.kevin.paperclip.server"
DEST="$HOME/Library/LaunchAgents/$LABEL.plist"

launchctl bootout "gui/$UID" "$DEST" >/dev/null 2>&1 || launchctl bootout "gui/$UID/$LABEL" >/dev/null 2>&1 || true
rm -f "$DEST"

echo "Removed LaunchAgent: $DEST"
