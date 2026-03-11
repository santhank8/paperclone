#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

sync_one() {
  local source_rel="$1"
  local dest_rel="$2"
  local source="$REPO_ROOT/$source_rel"
  local dest="$REPO_ROOT/$dest_rel"

  if [[ ! -f "$source" ]]; then
    echo "[WARN] missing template: $source_rel" >&2
    return 0
  fi

  mkdir -p "$(dirname "$dest")"
  cp "$source" "$dest"
  echo "[SYNC] $source_rel -> $dest_rel"
}

sync_one "ops/templates/agents/CEO_ASSISTANT.md" "agents/ceo/AGENTS.md"
sync_one "ops/templates/agents/CFO_ASSISTANT.md" "agents/cfo/AGENTS.md"
sync_one "ops/templates/agents/PRINCIPAL_ARCHITECT.md" "agents/principal-architect/AGENTS.md"
sync_one "ops/templates/agents/PRINCIPAL_DEVELOPER.md" "agents/principal-developer/AGENTS.md"
sync_one "ops/templates/agents/QA_ARCHITECT.md" "agents/qa-architect/AGENTS.md"
sync_one "ops/templates/agents/QA_TESTER.md" "agents/qa-tester/AGENTS.md"
