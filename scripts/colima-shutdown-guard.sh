#!/bin/bash
# Colima graceful shutdown guard
# Runs as a macOS LaunchDaemon — traps SIGTERM (sent on Mac shutdown/reboot)
# and runs "colima stop" so Postgres can flush WAL before the VM dies.
#
# INSTALL (one-time, needs sudo):
#   sudo cp scripts/colima-shutdown-guard.sh /usr/local/bin/colima-shutdown-guard.sh
#   sudo chmod +x /usr/local/bin/colima-shutdown-guard.sh
#   sudo cp scripts/com.colima.graceful-shutdown.plist /Library/LaunchDaemons/
#   sudo launchctl load /Library/LaunchDaemons/com.colima.graceful-shutdown.plist
#
# VERIFY:
#   sudo launchctl list | grep colima
#
# LIVE STATUS:
#   tail -f /tmp/colima-shutdown.log
#
# UNINSTALL:
#   sudo launchctl unload /Library/LaunchDaemons/com.colima.graceful-shutdown.plist
#   sudo rm /Library/LaunchDaemons/com.colima.graceful-shutdown.plist
#   sudo rm /usr/local/bin/colima-shutdown-guard.sh

LOGFILE="/tmp/colima-shutdown.log"
COLIMA="/opt/homebrew/bin/colima"
HEARTBEAT_INTERVAL=300  # print a heartbeat every 5 minutes

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOGFILE"
}

colima_status() {
    "$COLIMA" status 2>&1 | grep -E 'running|stopped|error' | head -1 || echo "unknown"
}

cleanup() {
    log "⚠️  SIGTERM received — macOS is shutting down"
    log "→ Colima status before stop: $(colima_status)"
    log "→ Running: colima stop (timeout 90s)..."
    timeout 90 "$COLIMA" stop 2>&1 | tee -a "$LOGFILE"
    EXIT_CODE=$?
    if [ $EXIT_CODE -eq 0 ]; then
        log "✅ colima stop completed cleanly"
    elif [ $EXIT_CODE -eq 124 ]; then
        log "⏱️  colima stop timed out after 90s — forcing with colima stop --force"
        "$COLIMA" stop --force 2>&1 | tee -a "$LOGFILE"
    else
        log "❌ colima stop exited with code $EXIT_CODE"
    fi
    log "--- shutdown guard done, exiting ---"
    exit 0
}

trap cleanup SIGTERM SIGINT

log "=========================================="
log "colima-shutdown-guard started (PID $$)"
log "Colima path: $COLIMA"
log "Colima status: $(colima_status)"
log "Watching for macOS shutdown signal (SIGTERM)..."
log "=========================================="

TICK=0
while true; do
    sleep 60 &
    wait $!
    TICK=$((TICK + 1))
    if [ $((TICK * 60)) -ge $HEARTBEAT_INTERVAL ]; then
        log "💓 heartbeat — still running | colima: $(colima_status)"
        TICK=0
    fi
done
