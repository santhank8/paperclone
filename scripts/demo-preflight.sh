#!/usr/bin/env bash
# =============================================================================
# demo-preflight.sh — eMerge Demo Stack Health Check
# =============================================================================
#
# Verifies that all components of the Raava demo stack are healthy and ready
# for a live demo. Designed to complete in under 5 seconds.
#
# Usage:
#   ./scripts/demo-preflight.sh
#
# Exit codes:
#   0 — All checks passed
#   1 — One or more checks failed
#
# Environment:
#   DASHBOARD_PORT  — Dashboard port (default: 3100)
#   FLEET_API_PORT  — Fleet-API port (default: 8400)
#   MIN_DISK_GB     — Minimum free disk in GB (default: 5)
#   MAX_MEM_PCT     — Maximum memory usage percent (default: 90)
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
DASHBOARD_PORT="${DASHBOARD_PORT:-3100}"
FLEET_API_PORT="${FLEET_API_PORT:-8400}"
MIN_DISK_GB="${MIN_DISK_GB:-5}"
MAX_MEM_PCT="${MAX_MEM_PCT:-90}"

DASHBOARD_URL="http://localhost:${DASHBOARD_PORT}"
FLEET_API_URL="http://localhost:${FLEET_API_PORT}"

# ---------------------------------------------------------------------------
# Colors
# ---------------------------------------------------------------------------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# ---------------------------------------------------------------------------
# Counters
# ---------------------------------------------------------------------------
PASS=0
FAIL=0
WARN=0

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
pass() {
  echo -e "  ${GREEN}✓${NC} $1"
  ((PASS++))
}

fail() {
  echo -e "  ${RED}✗${NC} $1"
  ((FAIL++))
}

warn() {
  echo -e "  ${YELLOW}⚠${NC} $1"
  ((WARN++))
}

header() {
  echo ""
  echo -e "${BOLD}$1${NC}"
}

# ---------------------------------------------------------------------------
# Checks
# ---------------------------------------------------------------------------
header "Dashboard (port ${DASHBOARD_PORT})"

# 1. Dashboard responding
if curl -sf --max-time 3 "${DASHBOARD_URL}/api/health" >/dev/null 2>&1; then
  pass "Dashboard is responding on port ${DASHBOARD_PORT}"
else
  fail "Dashboard is NOT responding on port ${DASHBOARD_PORT}"
fi

# 2. Deployment mode is fleetos
HEALTH_RESPONSE=$(curl -sf --max-time 3 "${DASHBOARD_URL}/api/health" 2>/dev/null || echo "")
if [ -n "$HEALTH_RESPONSE" ]; then
  DEPLOY_MODE=$(echo "$HEALTH_RESPONSE" | grep -o '"deploymentMode"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"deploymentMode"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/')
  if [ "$DEPLOY_MODE" = "fleetos" ]; then
    pass "Deployment mode is 'fleetos'"
  elif [ -n "$DEPLOY_MODE" ]; then
    fail "Deployment mode is '${DEPLOY_MODE}' (expected 'fleetos')"
  else
    fail "Could not parse deploymentMode from /api/health response"
  fi
else
  fail "Cannot check deployment mode — /api/health unreachable"
fi

# ---------------------------------------------------------------------------
header "Fleet-API (port ${FLEET_API_PORT})"

# 3. Fleet-API responding
if curl -sf --max-time 3 "${FLEET_API_URL}/" >/dev/null 2>&1 || \
   curl -sf --max-time 3 "${FLEET_API_URL}/health" >/dev/null 2>&1; then
  pass "Fleet-API is responding on port ${FLEET_API_PORT}"
else
  fail "Fleet-API is NOT responding on port ${FLEET_API_PORT}"
fi

# ---------------------------------------------------------------------------
header "Demo Data"

# 4. At least 1 company exists
COMPANIES_RESPONSE=$(curl -sf --max-time 3 "${DASHBOARD_URL}/api/companies" 2>/dev/null || echo "")
if [ -n "$COMPANIES_RESPONSE" ]; then
  # Count array elements — works for JSON arrays
  COMPANY_COUNT=$(echo "$COMPANIES_RESPONSE" | grep -o '"id"' | wc -l)
  if [ "$COMPANY_COUNT" -ge 1 ]; then
    pass "Found ${COMPANY_COUNT} company/companies in dashboard DB"
  else
    fail "No companies found in dashboard DB (run demo-seed.sh first)"
  fi
else
  fail "Cannot reach /api/companies — dashboard may be down"
fi

# ---------------------------------------------------------------------------
header "LXD / Containers"

# 5. LXD is running
if command -v lxc >/dev/null 2>&1 && lxc list --format=csv >/dev/null 2>&1; then
  pass "LXD is running and responsive"
else
  fail "LXD is not available or not responding"
fi

# 6. At least 1 agent container running
if command -v lxc >/dev/null 2>&1; then
  RUNNING_CONTAINERS=$(lxc list status=Running --format=csv 2>/dev/null | wc -l)
  if [ "$RUNNING_CONTAINERS" -ge 1 ]; then
    pass "${RUNNING_CONTAINERS} agent container(s) running in LXD"
  else
    fail "No running containers in LXD"
  fi
else
  fail "lxc command not found — cannot check containers"
fi

# ---------------------------------------------------------------------------
header "Cloudflare Tunnel"

# 7. Cloudflare tunnel connected (optional — warn instead of fail)
if command -v cloudflared >/dev/null 2>&1; then
  if systemctl is-active --quiet cloudflared 2>/dev/null; then
    pass "Cloudflare tunnel service is active"
  elif pgrep -x cloudflared >/dev/null 2>&1; then
    pass "Cloudflare tunnel process is running"
  else
    warn "Cloudflare tunnel is not running (cert may not be configured yet)"
  fi
else
  warn "cloudflared not installed — tunnel not configured"
fi

# ---------------------------------------------------------------------------
header "System Resources"

# 8. Disk space > 5GB free
FREE_DISK_KB=$(df --output=avail / 2>/dev/null | tail -1 | tr -d ' ')
if [ -n "$FREE_DISK_KB" ]; then
  FREE_DISK_GB=$((FREE_DISK_KB / 1024 / 1024))
  if [ "$FREE_DISK_GB" -ge "$MIN_DISK_GB" ]; then
    pass "Disk space: ${FREE_DISK_GB}GB free (minimum ${MIN_DISK_GB}GB)"
  else
    fail "Disk space: ${FREE_DISK_GB}GB free (below ${MIN_DISK_GB}GB minimum)"
  fi
else
  fail "Could not determine free disk space"
fi

# 9. Memory usage < 90%
MEM_TOTAL=$(grep MemTotal /proc/meminfo 2>/dev/null | awk '{print $2}')
MEM_AVAIL=$(grep MemAvailable /proc/meminfo 2>/dev/null | awk '{print $2}')
if [ -n "$MEM_TOTAL" ] && [ -n "$MEM_AVAIL" ] && [ "$MEM_TOTAL" -gt 0 ]; then
  MEM_USED_PCT=$(( (MEM_TOTAL - MEM_AVAIL) * 100 / MEM_TOTAL ))
  if [ "$MEM_USED_PCT" -lt "$MAX_MEM_PCT" ]; then
    pass "Memory usage: ${MEM_USED_PCT}% (below ${MAX_MEM_PCT}% threshold)"
  else
    fail "Memory usage: ${MEM_USED_PCT}% (exceeds ${MAX_MEM_PCT}% threshold)"
  fi
else
  fail "Could not determine memory usage"
fi

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
echo ""
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "  ${GREEN}✓ ${PASS} passed${NC}  ${RED}✗ ${FAIL} failed${NC}  ${YELLOW}⚠ ${WARN} warnings${NC}"
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if [ "$FAIL" -gt 0 ]; then
  echo -e "  ${RED}Demo stack is NOT ready.${NC} Fix the failures above."
  exit 1
else
  if [ "$WARN" -gt 0 ]; then
    echo -e "  ${YELLOW}Demo stack is ready with warnings.${NC}"
  else
    echo -e "  ${GREEN}Demo stack is fully ready.${NC}"
  fi
  exit 0
fi
