#!/usr/bin/env bash
#
# Kill all local Paperclip dev server processes (across all worktrees).
#
# Does NOT kill processes started under LaunchAgent when they set
# PAPERCLIP_MANAGED_BY_LAUNCHD=1 (see contrib/macos-launchagent/). To stop
# that service use: launchctl bootout "gui/$(id -u)" ~/Library/LaunchAgents/io.paperclip.local.plist
#
# Usage:
#   scripts/kill-dev.sh        # kill all paperclip dev processes
#   scripts/kill-dev.sh --dry  # preview what would be killed
#

set -euo pipefail
shopt -s nullglob

DRY_RUN=false
if [[ "${1:-}" == "--dry" || "${1:-}" == "--dry-run" || "${1:-}" == "-n" ]]; then
  DRY_RUN=true
fi

# macOS: wide ps output includes process environment; LaunchAgent should set PAPERCLIP_MANAGED_BY_LAUNCHD=1.
is_launchagent_paperclip_service() {
  local pid="$1"
  local cmd
  local re1 re_true
  cmd=$(ps wwwe -p "$pid" -o command= 2>/dev/null || true)
  # Match exact boolean tokens (avoid false positives like =10, =100).
  re1='(^|[[:space:]])PAPERCLIP_MANAGED_BY_LAUNCHD=1($|[[:space:]])'
  re_true='(^|[[:space:]])PAPERCLIP_MANAGED_BY_LAUNCHD=true($|[[:space:]])'
  [[ "$cmd" =~ $re1 ]] && return 0
  [[ "$cmd" =~ $re_true ]] && return 0
  return 1
}

# Collect PIDs of node processes running from any paperclip directory.
# Matches paths like /Users/*/paperclip/... or /Users/*/paperclip-*/...
# Excludes postgres-related processes.
pids=()
lines=()
skipped_launchd=0

while IFS= read -r line; do
  [[ -z "$line" ]] && continue
  [[ "$line" == *postgres* ]] && continue
  pid=$(echo "$line" | awk '{print $2}')
  if is_launchagent_paperclip_service "$pid"; then
    skipped_launchd=$((skipped_launchd + 1))
    continue
  fi
  pids+=("$pid")
  lines+=("$line")
done < <(ps aux | grep -E '/paperclip(-[^/]+)?/' | grep node | grep -v grep || true)

if [[ $skipped_launchd -gt 0 ]]; then
  echo "Skipped $skipped_launchd process(es) marked PAPERCLIP_MANAGED_BY_LAUNCHD (LaunchAgent service)."
  echo ""
fi

if [[ ${#pids[@]} -eq 0 ]]; then
  echo "No Paperclip dev processes found."
  exit 0
fi

if [[ ${#node_pids[@]} -gt 0 ]]; then
  echo "Found ${#node_pids[@]} Paperclip dev node process(es):"
  echo ""

for i in "${!pids[@]}"; do
  line="${lines[$i]}"
  pid="${pids[$i]}"
  start=$(echo "$line" | awk '{print $9}')
  cmd=$(echo "$line" | awk '{for(i=11;i<=NF;i++) printf "%s ", $i; print ""}')
  # Shorten the command for readability
  cmd=$(echo "$cmd" | sed "s|$HOME/||g")
  printf "  PID %-7s  started %-10s  %s\n" "$pid" "$start" "$cmd"
done

  echo ""
fi

if [[ ${#pg_pids[@]} -gt 0 ]]; then
  echo "Found ${#pg_pids[@]} embedded PostgreSQL master process(es):"
  echo ""

  for i in "${!pg_pids[@]:-}"; do
    pid="${pg_pids[$i]}"
    data_dir="${pg_data_dirs[$i]}"
    pidfile="${pg_pidfiles[$i]}"
    short_data_dir="${data_dir/#$HOME\//}"
    short_pidfile="${pidfile/#$HOME\//}"
    printf "  PID %-7s  data %-55s  pidfile %s\n" "$pid" "$short_data_dir" "$short_pidfile"
  done

  echo ""
fi

if [[ "$DRY_RUN" == true ]]; then
  echo "Dry run — re-run without --dry to kill these processes."
  exit 0
fi

echo "Sending SIGTERM..."
for pid in "${pids[@]}"; do
  kill "$pid" 2>/dev/null && echo "  sent SIGTERM to $pid" || echo "  $pid already gone"
done

leftover_pg_pids=()
leftover_pg_data_dirs=()
for i in "${!pg_pids[@]:-}"; do
  pid="${pg_pids[$i]}"
  if is_pid_running "$pid"; then
    leftover_pg_pids+=("$pid")
    leftover_pg_data_dirs+=("${pg_data_dirs[$i]}")
  fi
done

if [[ ${#leftover_pg_pids[@]} -gt 0 ]]; then
  echo "Sending SIGTERM to leftover embedded PostgreSQL processes..."
  for i in "${!leftover_pg_pids[@]:-}"; do
    pid="${leftover_pg_pids[$i]}"
    data_dir="${leftover_pg_data_dirs[$i]}"
    kill -TERM "$pid" 2>/dev/null \
      && echo "  signaled $pid ($data_dir)" \
      || echo "  $pid already gone"
  done
  echo "Waiting up to 15s for PostgreSQL to shut down cleanly..."
  for pid in "${leftover_pg_pids[@]:-}"; do
    if wait_for_pid_exit "$pid" 15; then
      echo "  postgres $pid exited cleanly"
    fi
  done
fi

if [[ ${#node_pids[@]} -gt 0 ]]; then
  for pid in "${node_pids[@]:-}"; do
    if kill -0 "$pid" 2>/dev/null; then
      echo "  node $pid still alive, sending SIGKILL..."
      kill -KILL "$pid" 2>/dev/null || true
    fi
  done
fi

if [[ ${#pg_pids[@]} -gt 0 ]]; then
  for pid in "${pg_pids[@]:-}"; do
    if kill -0 "$pid" 2>/dev/null; then
      echo "  postgres $pid still alive, sending SIGKILL..."
      kill -KILL "$pid" 2>/dev/null || true
    fi
  done
fi

echo "Done."
