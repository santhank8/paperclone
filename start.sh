#!/usr/bin/env bash
set -euo pipefail

export PATH="$HOME/.asdf/installs/nodejs/22.21.1/bin:$PATH"
export SHARP_IGNORE_GLOBAL_LIBVIPS=1

BRIDGE_PORT="${LMSTUDIO_BRIDGE_PORT:-3199}"
LMSTUDIO_URL="${LMSTUDIO_BASE_URL:-http://127.0.0.1:1234}"
PAPERCLIP_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "🎞️  Paperclip Launcher"
echo "   Node: $(node -v)"
echo "   Dir:  $PAPERCLIP_DIR"
echo ""

# Start LM Studio bridge if LM Studio is reachable
if curl -s --max-time 2 "$LMSTUDIO_URL/v1/models" > /dev/null 2>&1; then
  echo "🧠 LM Studio detected at $LMSTUDIO_URL — starting bridge on port $BRIDGE_PORT..."
  node "$PAPERCLIP_DIR/scripts/lmstudio-bridge.mjs" &
  BRIDGE_PID=$!
  echo "   Bridge PID: $BRIDGE_PID (http://127.0.0.1:$BRIDGE_PORT)"
else
  echo "⚠️  LM Studio not detected at $LMSTUDIO_URL — bridge not started"
  echo "   Start LM Studio and re-run start.sh to enable direct LM Studio agents"
fi

echo ""
echo "🚀 Starting Paperclip..."
echo "   UI:  http://127.0.0.1:3100"
echo "   API: http://127.0.0.1:3100/api"
echo ""

cd "$PAPERCLIP_DIR"
exec corepack pnpm dev:once
