#!/bin/bash
# SENTINEL VPS Health Check Script
# Deploy to: /home/nail/sentinel/vps-healthcheck.sh
# Cron: */30 * * * * /home/nail/sentinel/vps-healthcheck.sh

set -euo pipefail

WEBHOOK_URL="${SENTINEL_WEBHOOK:-https://nail.n8n.evohaus.org/webhook/sentinel-alert}"
LOG_DIR="/home/nail/sentinel/logs"
mkdir -p "$LOG_DIR"

TIMESTAMP=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
STATUS="OK"
FINDINGS=""

echo "[$TIMESTAMP] SENTINEL VPS Health Check Starting..."

# 1. DISK CHECK
DISK_PCT=$(df -h / | tail -1 | awk '{print $5}' | tr -d '%')
if [ "$DISK_PCT" -gt 85 ]; then
  STATUS="CRITICAL"
  FINDINGS="$FINDINGS | DISK: ${DISK_PCT}% used"
elif [ "$DISK_PCT" -gt 70 ]; then
  [ "$STATUS" = "OK" ] && STATUS="WARNING"
  FINDINGS="$FINDINGS | DISK: ${DISK_PCT}% used"
fi

# 2. MEMORY CHECK
MEM_AVAIL_KB=$(grep MemAvailable /proc/meminfo | awk '{print $2}')
MEM_AVAIL_MB=$((MEM_AVAIL_KB / 1024))
if [ "$MEM_AVAIL_MB" -lt 1024 ]; then
  STATUS="CRITICAL"
  FINDINGS="$FINDINGS | RAM: ${MEM_AVAIL_MB}MB available"
elif [ "$MEM_AVAIL_MB" -lt 2048 ]; then
  [ "$STATUS" = "OK" ] && STATUS="WARNING"
  FINDINGS="$FINDINGS | RAM: ${MEM_AVAIL_MB}MB available"
fi

# 3. SWAP CHECK
SWAP_USED_KB=$(grep SwapFree /proc/meminfo | awk '{print $2}')
SWAP_TOTAL_KB=$(grep SwapTotal /proc/meminfo | awk '{print $2}')
SWAP_USED=$((SWAP_TOTAL_KB - SWAP_USED_KB))
SWAP_USED_MB=$((SWAP_USED / 1024))
if [ "$SWAP_USED_MB" -gt 2048 ]; then
  STATUS="CRITICAL"
  FINDINGS="$FINDINGS | SWAP: ${SWAP_USED_MB}MB used"
fi

# 4. DOCKER CONTAINERS CHECK
STOPPED_CONTAINERS=$(docker ps -a --filter "status=exited" --filter "status=dead" --format "{{.Names}}" 2>/dev/null | tr '\n' ', ')
if [ -n "$STOPPED_CONTAINERS" ]; then
  STATUS="CRITICAL"
  FINDINGS="$FINDINGS | DOCKER DOWN: $STOPPED_CONTAINERS"
fi

# 5. SERVICE HEALTH
for service in "supabase.evohaus.org" "nail.n8n.evohaus.org"; do
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "https://$service" 2>/dev/null || echo "000")
  if [ "$HTTP_CODE" = "000" ] || [ "$HTTP_CODE" -ge 500 ]; then
    STATUS="CRITICAL"
    FINDINGS="$FINDINGS | $service: HTTP $HTTP_CODE"
  fi
done

# 6. LOAD AVERAGE
LOAD_1M=$(cat /proc/loadavg | awk '{print $1}')
CPUS=$(nproc)
LOAD_PER_CPU=$(echo "$LOAD_1M $CPUS" | awk '{printf "%.1f", $1/$2}')
HIGH_LOAD=$(echo "$LOAD_PER_CPU" | awk '{print ($1 > 3.0) ? "1" : "0"}')
if [ "$HIGH_LOAD" = "1" ]; then
  [ "$STATUS" = "OK" ] && STATUS="WARNING"
  FINDINGS="$FINDINGS | LOAD: ${LOAD_1M} (${LOAD_PER_CPU}/core)"
fi

# 7. OOM CHECK
OOM_COUNT=$(dmesg 2>/dev/null | grep -ci "oom\|killed process" || true)
OOM_COUNT=${OOM_COUNT:-0}
OOM_COUNT=$(echo "$OOM_COUNT" | tr -dc '0-9')
OOM_COUNT=${OOM_COUNT:-0}
if [ "$OOM_COUNT" -gt 0 ]; then
  STATUS="CRITICAL"
  FINDINGS="$FINDINGS | OOM: $OOM_COUNT events in dmesg"
fi

# LOG RESULT
RESULT="[$TIMESTAMP] STATUS=$STATUS DISK=${DISK_PCT}% RAM=${MEM_AVAIL_MB}MB SWAP=${SWAP_USED_MB}MB LOAD=${LOAD_1M}${FINDINGS}"
echo "$RESULT" >> "$LOG_DIR/health.log"
echo "$RESULT"

# ALERT IF NOT OK
if [ "$STATUS" != "OK" ]; then
  curl -s -X POST "$WEBHOOK_URL" \
    -H "Content-Type: application/json" \
    -d "{
      \"type\": \"sentinel_vps_health\",
      \"machine\": \"vps\",
      \"severity\": \"$(echo $STATUS | tr '[:upper:]' '[:lower:]')\",
      \"finding\": \"$FINDINGS\",
      \"disk_pct\": $DISK_PCT,
      \"ram_avail_mb\": $MEM_AVAIL_MB,
      \"swap_used_mb\": $SWAP_USED_MB,
      \"load_1m\": \"$LOAD_1M\",
      \"timestamp\": \"$TIMESTAMP\"
    }" 2>/dev/null || echo "WARNING: Failed to send alert to webhook"
fi

echo "[$TIMESTAMP] SENTINEL VPS Health Check Complete: $STATUS"
