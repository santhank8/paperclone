#!/usr/bin/env bash
set -euo pipefail

SHANGRILA_DIR=/home/ubuntu/shared/shangrila
LOG_PREFIX="[shangrila-deploy]"

echo "$LOG_PREFIX Starting deployment at $(date -u)"

cd "$SHANGRILA_DIR"

echo "$LOG_PREFIX Pulling latest from shangrila/main..."
git fetch origin shangrila/main
git reset --hard origin/shangrila/main

echo "$LOG_PREFIX Installing dependencies..."
pnpm install --frozen-lockfile

echo "$LOG_PREFIX Building..."
pnpm build

echo "$LOG_PREFIX Restarting shangrila service..."
sudo systemctl restart shangrila

echo "$LOG_PREFIX Waiting for health check..."
for i in $(seq 1 30); do
  if curl -sf http://localhost:3100/api/health > /dev/null 2>&1; then
    echo "$LOG_PREFIX Health check passed on attempt $i"
    curl -s http://localhost:3100/api/health
    echo
    echo "$LOG_PREFIX Deployment complete at $(date -u)"
    exit 0
  fi
  sleep 2
done

echo "$LOG_PREFIX Health check failed after 60 seconds"
sudo journalctl -u shangrila --no-pager -n 50
exit 1
