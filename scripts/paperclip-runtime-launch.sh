#!/bin/zsh

set -euo pipefail

APP_ROOT="/Users/kevin/codex/projects/paperclip"
export HOME="${HOME:-/Users/kevin}"
export PATH="/Users/kevin/.local/bin:/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:${PATH:-}"

cd "$APP_ROOT"

if [ -x "/Users/kevin/.local/bin/pnpm" ]; then
  exec env -u DATABASE_URL /Users/kevin/.local/bin/pnpm paperclipai run
fi

if command -v pnpm >/dev/null 2>&1; then
  exec env -u DATABASE_URL pnpm paperclipai run
fi

if command -v corepack >/dev/null 2>&1; then
  exec env -u DATABASE_URL "$(command -v corepack)" pnpm paperclipai run
fi

echo "Paperclip runtime launch failed: pnpm/corepack not found" >&2
exit 1
