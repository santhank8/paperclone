#!/usr/bin/env bash
export PATH="$HOME/.asdf/installs/nodejs/22.21.1/bin:$PATH"
export SHARP_IGNORE_GLOBAL_LIBVIPS=1

cd "$(cd "$(dirname "$0")" && pwd)"

echo "🛑 Stopping Paperclip..."
corepack pnpm dev:stop || true

echo "🛑 Stopping LM Studio bridge..."
pkill -f "lmstudio-bridge.mjs" 2>/dev/null && echo "   Bridge stopped" || echo "   Bridge not running"

echo "Done."
