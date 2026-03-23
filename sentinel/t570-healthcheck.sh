#!/bin/bash
# SENTINEL T570 Health Check Script
# Deploy to: ~/sentinel/t570-healthcheck.sh (T570 ThinkPad)
# Cron: */30 * * * * ~/sentinel/t570-healthcheck.sh

set -euo pipefail

WEBHOOK_URL="${SENTINEL_WEBHOOK:-https://nail.n8n.evohaus.org/webhook/sentinel-alert}"
MACHINE_NAME="t570"
LOG_DIR="$HOME/sentinel-logs"
mkdir -p "$LOG_DIR"

TIMESTAMP=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
STATUS="OK"
FINDINGS=""

echo "[$TIMESTAMP] SENTINEL T570 Health Check Starting..."

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
SWAP_TOTAL_KB=$(grep SwapTotal /proc/meminfo | awk '{print $2}')
SWAP_FREE_KB=$(grep SwapFree /proc/meminfo | awk '{print $2}')
SWAP_USED_MB=$(( (SWAP_TOTAL_KB - SWAP_FREE_KB) / 1024 ))
if [ "$SWAP_USED_MB" -gt 2048 ]; then
  STATUS="CRITICAL"
  FINDINGS="$FINDINGS | SWAP: ${SWAP_USED_MB}MB used"
fi

# 4. LOAD AVERAGE
LOAD_1M=$(cat /proc/loadavg | awk '{print $1}')
CPUS=$(nproc)
LOAD_PER_CPU=$(echo "$LOAD_1M $CPUS" | awk '{printf "%.1f", $1/$2}')
HIGH_LOAD=$(echo "$LOAD_PER_CPU" | awk '{print ($1 > 3.0) ? "1" : "0"}')
if [ "$HIGH_LOAD" = "1" ]; then
  [ "$STATUS" = "OK" ] && STATUS="WARNING"
  FINDINGS="$FINDINGS | LOAD: ${LOAD_1M} (${LOAD_PER_CPU}/core)"
fi

# 5. THERMAL CHECK (T570 thermal risk is HIGH)
CPU_TEMP=""
if command -v sensors &>/dev/null; then
  CPU_TEMP=$(sensors 2>/dev/null | grep -i "core 0" | awk '{print $3}' | tr -dc '0-9.' | head -c 5)
elif [ -f /sys/class/thermal/thermal_zone0/temp ]; then
  RAW_TEMP=$(cat /sys/class/thermal/thermal_zone0/temp)
  CPU_TEMP=$((RAW_TEMP / 1000))
fi

if [ -n "$CPU_TEMP" ]; then
  TEMP_INT=$(echo "$CPU_TEMP" | awk '{printf "%.0f", $1}')
  if [ "$TEMP_INT" -gt 85 ]; then
    STATUS="CRITICAL"
    FINDINGS="$FINDINGS | THERMAL: ${CPU_TEMP}°C (THROTTLING!)"
  elif [ "$TEMP_INT" -gt 70 ]; then
    [ "$STATUS" = "OK" ] && STATUS="WARNING"
    FINDINGS="$FINDINGS | THERMAL: ${CPU_TEMP}°C"
  fi
fi

# 6. TAILSCALE CHECK
TS_STATUS=$(tailscale status 2>/dev/null | head -1 || echo "not running")
if echo "$TS_STATUS" | grep -qi "stopped\|error\|not running"; then
  [ "$STATUS" = "OK" ] && STATUS="WARNING"
  FINDINGS="$FINDINGS | TAILSCALE: down"
fi

# 7. GPU CHECK (NVIDIA 940MX)
GPU_TEMP=""
if command -v nvidia-smi &>/dev/null; then
  GPU_TEMP=$(nvidia-smi --query-gpu=temperature.gpu --format=csv,noheader,nounits 2>/dev/null || echo "")
  if [ -n "$GPU_TEMP" ] && [ "$GPU_TEMP" -gt 80 ]; then
    [ "$STATUS" = "OK" ] && STATUS="WARNING"
    FINDINGS="$FINDINGS | GPU: ${GPU_TEMP}°C"
  fi
fi

# LOG RESULT
RESULT="[$TIMESTAMP] MACHINE=$MACHINE_NAME STATUS=$STATUS DISK=${DISK_PCT}% RAM=${MEM_AVAIL_MB}MB SWAP=${SWAP_USED_MB}MB LOAD=${LOAD_1M} CPU_TEMP=${CPU_TEMP:-n/a}${FINDINGS}"
echo "$RESULT" >> "$LOG_DIR/t570-health.log"
echo "$RESULT"

# ALERT IF NOT OK
if [ "$STATUS" != "OK" ]; then
  curl -s -X POST "$WEBHOOK_URL" \
    -H "Content-Type: application/json" \
    -d "{
      \"type\": \"sentinel_t570_health\",
      \"machine\": \"$MACHINE_NAME\",
      \"severity\": \"$(echo $STATUS | tr '[:upper:]' '[:lower:]')\",
      \"finding\": \"$FINDINGS\",
      \"disk_pct\": $DISK_PCT,
      \"ram_avail_mb\": $MEM_AVAIL_MB,
      \"swap_used_mb\": $SWAP_USED_MB,
      \"load_1m\": \"$LOAD_1M\",
      \"cpu_temp\": \"${CPU_TEMP:-n/a}\",
      \"timestamp\": \"$TIMESTAMP\"
    }" 2>/dev/null || echo "WARNING: Failed to send alert to webhook"
fi

echo "[$TIMESTAMP] SENTINEL T570 Health Check Complete: $STATUS"
