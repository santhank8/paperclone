#!/usr/bin/env bash
set -euo pipefail

# validate-plugins.sh — Validação autônoma do sistema de plugins Paperclip
#
# Executa validação completa do sistema de plugins:
# - SDK typecheck e testes unitários
# - E2E lifecycle tests (sem dependência Postgres)
# - Build de todos os plugins
# - Validação de documentação
#
# Uso:
#   ./scripts/validate-plugins.sh
#   # Ou via cron: 0 * * * * /root/paperclip-repo/scripts/validate-plugins.sh >> /var/log/paperclip-plugin-validation.log 2>&1

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

echo "========================================"
echo "Paperclip Plugin System Validation"
echo "Timestamp: $(date -Iseconds)"
echo "Commit: $(git rev-parse --short HEAD)"
echo "========================================"
echo ""

# ── Step 1: SDK Typecheck ──────────────────────────────────────────────
echo "[1/6] SDK Typecheck..."
pnpm --filter @paperclipai/plugin-sdk typecheck
echo "✅ SDK typecheck passed"
echo ""

# ── Step 2: SDK Unit Tests ─────────────────────────────────────────────
echo "[2/6] SDK Unit Tests..."
pnpm --filter @paperclipai/plugin-sdk test
echo "✅ SDK tests passed"
echo ""

# ── Step 3: Plugin E2E Lifecycle Tests ─────────────────────────────────
echo "[3/6] Plugin E2E Lifecycle Tests..."
pnpm test -- plugin-e2e-lifecycle
echo "✅ E2E lifecycle tests passed"
echo ""

# ── Step 4: Plugin Typecheck ───────────────────────────────────────────
echo "[4/6] Plugin Typecheck (all plugins)..."
pnpm --filter @paperclipai/plugin-playwright-mcp typecheck
pnpm --filter @paperclipai/plugin-ruflo-bridge typecheck
pnpm --filter @paperclipai/plugin-skills-hub typecheck
echo "✅ All plugins typecheck passed"
echo ""

# ── Step 5: Plugin Build ───────────────────────────────────────────────
echo "[5/6] Plugin Build..."
pnpm --filter @paperclipai/plugin-playwright-mcp build
pnpm --filter @paperclipai/plugin-ruflo-bridge build
pnpm --filter @paperclipai/plugin-skills-hub build
echo "✅ All plugins built successfully"
echo ""

# ── Step 6: Documentation Validation ───────────────────────────────────
echo "[6/6] Documentation Validation..."
if [ ! -f "doc/plugins/README.md" ]; then
    echo "❌ doc/plugins/README.md not found"
    exit 1
fi

if [ ! -f "doc/plugins/PLUGIN_SPEC.md" ]; then
    echo "❌ doc/plugins/PLUGIN_SPEC.md not found"
    exit 1
fi

if [ ! -f "doc/plugins/PLUGIN_AUTHORING_GUIDE.md" ]; then
    echo "❌ doc/plugins/PLUGIN_AUTHORING_GUIDE.md not found"
    exit 1
fi

# Validate plugin READMEs
for plugin in playwright-mcp ruflo-bridge skills-hub; do
    if [ ! -f "packages/plugins/$plugin/README.md" ]; then
        echo "❌ packages/plugins/$plugin/README.md not found"
        exit 1
    fi
done

echo "✅ Documentation validation passed"
echo ""

# ── Summary ────────────────────────────────────────────────────────────
echo "========================================"
echo "✅ ALL VALIDATIONS PASSED"
echo "Timestamp: $(date -Iseconds)"
echo "========================================"

exit 0
