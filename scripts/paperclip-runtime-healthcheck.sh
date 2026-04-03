#!/bin/zsh

set -euo pipefail

URL="${PAPERCLIP_HEALTH_URL:-http://127.0.0.1:3100/api/health}"

curl -fsS --max-time 3 "$URL"
