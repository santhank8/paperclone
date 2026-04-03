#!/bin/zsh

set -euo pipefail

LABEL="com.kevin.paperclip.server"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"

if [ -f "$PLIST" ]; then
  launchctl bootout "gui/$UID" "$PLIST" >/dev/null 2>&1 || launchctl bootout "gui/$UID/$LABEL" >/dev/null 2>&1 || true
fi

pkill -f '/Users/kevin/codex/projects/paperclip.*paperclipai run' >/dev/null 2>&1 || true
pkill -f 'cli/src/index.ts "run"' >/dev/null 2>&1 || true
