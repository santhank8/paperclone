#!/usr/bin/env bash
# Ensure all local patches are applied before service starts
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

for patch in scripts/local/*.patch; do
  [ -f "$patch" ] || continue
  # Check if patch is already applied (reverse apply --check succeeds = already applied)
  if git apply --reverse --check "$patch" 2>/dev/null; then
    echo "Already applied: $(basename "$patch")"
  elif git apply --check "$patch" 2>/dev/null; then
    git apply "$patch" && echo "Applied: $(basename "$patch")"
  else
    echo "WARN: Cannot apply $(basename "$patch") cleanly — may conflict with upstream changes"
  fi
done

# Shell-based patches (node_modules, etc.)
for script in scripts/local/*.patch.sh; do
  [ -f "$script" ] || continue
  bash "$script"
done
