#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DEFAULT_E2E_HOME="$REPO_ROOT/.paperclip-local/e2e-home"

if [[ -n "${PNPM_BIN:-}" ]]; then
  :
elif command -v pnpm >/dev/null 2>&1; then
  PNPM_BIN="$(command -v pnpm)"
elif [[ -x "$HOME/.hermes/node/bin/pnpm" ]]; then
  PNPM_BIN="$HOME/.hermes/node/bin/pnpm"
else
  echo "Unable to find pnpm. Set PNPM_BIN or install pnpm." >&2
  exit 1
fi

export PATH="$(dirname "$PNPM_BIN"):$PATH"
export PAPERCLIP_HOME="${PAPERCLIP_E2E_HOME:-$DEFAULT_E2E_HOME}"
export PORT="${PAPERCLIP_E2E_PORT:-3100}"
export PAPERCLIP_DEPLOYMENT_MODE="${PAPERCLIP_DEPLOYMENT_MODE:-local_trusted}"

if [[ "${PAPERCLIP_E2E_RESET_HOME:-1}" == "1" ]]; then
  rm -rf "$PAPERCLIP_HOME"
fi
mkdir -p "$PAPERCLIP_HOME"

cd "$REPO_ROOT"
"$PNPM_BIN" paperclipai onboard --yes
exec "$PNPM_BIN" paperclipai run
