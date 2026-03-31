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
#
# Output:
#   - Logs detalhados em stdout
#   - JSON report em /tmp/paperclip-plugin-validation-<timestamp>.json

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

# Config
TIMESTAMP=$(date -Iseconds)
COMMIT=$(git rev-parse --short HEAD)
REPORT_FILE="/tmp/paperclip-plugin-validation-$(date +%Y%m%d-%H%M%S).json"

# Initialize counters
declare -A STEP_DURATION
declare -A STEP_STATUS
TOTAL_START=$(date +%s)

echo "========================================"
echo "Paperclip Plugin System Validation"
echo "Timestamp: $TIMESTAMP"
echo "Commit: $COMMIT"
echo "========================================"
echo ""

# ── Step 1: SDK Typecheck ──────────────────────────────────────────────
echo "[1/6] SDK Typecheck..."
STEP_START=$(date +%s)
if pnpm --filter @paperclipai/plugin-sdk typecheck; then
    STEP_DURATION[typecheck]=$(($(date +%s) - STEP_START))
    STEP_STATUS[typecheck]="pass"
    echo "✅ SDK typecheck passed (${STEP_DURATION[typecheck]}s)"
else
    STEP_DURATION[typecheck]=$(($(date +%s) - STEP_START))
    STEP_STATUS[typecheck]="fail"
    echo "❌ SDK typecheck failed"
    exit 1
fi
echo ""

# ── Step 2: SDK Unit Tests ─────────────────────────────────────────────
echo "[2/6] SDK Unit Tests..."
STEP_START=$(date +%s)
if pnpm --filter @paperclipai/plugin-sdk test; then
    STEP_DURATION[tests]=$(($(date +%s) - STEP_START))
    STEP_STATUS[tests]="pass"
    echo "✅ SDK tests passed (${STEP_DURATION[tests]}s)"
else
    STEP_DURATION[tests]=$(($(date +%s) - STEP_START))
    STEP_STATUS[tests]="fail"
    echo "❌ SDK tests failed"
    exit 1
fi
echo ""

# ── Step 3: Plugin E2E Lifecycle Tests ─────────────────────────────────
echo "[3/6] Plugin E2E Lifecycle Tests..."
STEP_START=$(date +%s)
if pnpm test -- plugin-e2e-lifecycle; then
    STEP_DURATION[e2e]=$(($(date +%s) - STEP_START))
    STEP_STATUS[e2e]="pass"
    echo "✅ E2E lifecycle tests passed (${STEP_DURATION[e2e]}s)"
else
    STEP_DURATION[e2e]=$(($(date +%s) - STEP_START))
    STEP_STATUS[e2e]="fail"
    echo "❌ E2E lifecycle tests failed"
    exit 1
fi
echo ""

# ── Step 4: Plugin Typecheck ───────────────────────────────────────────
echo "[4/6] Plugin Typecheck (all plugins)..."
STEP_START=$(date +%s)
PLUGIN_STATUS=()
for plugin in playwright-mcp ruflo-bridge skills-hub; do
    echo "  Typechecking @paperclipai/plugin-$plugin..."
    if pnpm --filter @paperclipai/plugin-$plugin typecheck; then
        PLUGIN_STATUS+=("\"$plugin\": \"pass\"")
        echo "  ✅ $plugin passed"
    else
        PLUGIN_STATUS+=("\"$plugin\": \"fail\"")
        echo "  ❌ $plugin failed"
        STEP_DURATION[typecheck]=$(($(date +%s) - STEP_START))
        STEP_STATUS[typecheck]="fail"
        exit 1
    fi
done
STEP_DURATION[typecheck]=$(($(date +%s) - STEP_START))
STEP_STATUS[typecheck]="pass"
echo "✅ All plugins typecheck passed (${STEP_DURATION[typecheck]}s)"
echo ""

# ── Step 5: Plugin Build ───────────────────────────────────────────────
echo "[5/6] Plugin Build..."
STEP_START=$(date +%s)
for plugin in playwright-mcp ruflo-bridge skills-hub; do
    echo "  Building @paperclipai/plugin-$plugin..."
    if pnpm --filter @paperclipai/plugin-$plugin build; then
        echo "  ✅ $plugin built"
    else
        echo "  ❌ $plugin build failed"
        STEP_DURATION[build]=$(($(date +%s) - STEP_START))
        STEP_STATUS[build]="fail"
        exit 1
    fi
done
STEP_DURATION[build]=$(($(date +%s) - STEP_START))
STEP_STATUS[build]="pass"
echo "✅ All plugins built successfully (${STEP_DURATION[build]}s)"
echo ""

# ── Step 6: Documentation Validation ───────────────────────────────────
echo "[6/6] Documentation Validation..."
STEP_START=$(date +%s)
DOCS_STATUS=()
if [ ! -f "doc/plugins/README.md" ]; then
    echo "❌ doc/plugins/README.md not found"
    DOCS_STATUS+=("\"doc/plugins/README.md\": \"missing\"")
else
    DOCS_STATUS+=("\"doc/plugins/README.md\": \"present\"")
fi

if [ ! -f "doc/plugins/PLUGIN_SPEC.md" ]; then
    echo "❌ doc/plugins/PLUGIN_SPEC.md not found"
    DOCS_STATUS+=("\"doc/plugins/PLUGIN_SPEC.md\": \"missing\"")
else
    DOCS_STATUS+=("\"doc/plugins/PLUGIN_SPEC.md\": \"present\"")
fi

if [ ! -f "doc/plugins/PLUGIN_AUTHORING_GUIDE.md" ]; then
    echo "❌ doc/plugins/PLUGIN_AUTHORING_GUIDE.md not found"
    DOCS_STATUS+=("\"doc/plugins/PLUGIN_AUTHORING_GUIDE.md\": \"missing\"")
else
    DOCS_STATUS+=("\"doc/plugins/PLUGIN_AUTHORING_GUIDE.md\": \"present\"")
fi

for plugin in playwright-mcp ruflo-bridge skills-hub; do
    if [ ! -f "packages/plugins/$plugin/README.md" ]; then
        echo "❌ packages/plugins/$plugin/README.md not found"
        DOCS_STATUS+=("\"packages/plugins/$plugin/README.md\": \"missing\"")
    else
        DOCS_STATUS+=("\"packages/plugins/$plugin/README.md\": \"present\"")
    fi
done

if [[ "${DOCS_STATUS[@]}" == *"missing"* ]]; then
    STEP_DURATION[docs]=$(($(date +%s) - STEP_START))
    STEP_STATUS[docs]="fail"
    exit 1
fi

STEP_DURATION[docs]=$(($(date +%s) - STEP_START))
STEP_STATUS[docs]="pass"
echo "✅ Documentation validation passed (${STEP_DURATION[docs]}s)"
echo ""

# ── Summary ────────────────────────────────────────────────────────────
TOTAL_END=$(date +%s)
TOTAL_DURATION=$((TOTAL_END - TOTAL_START))

echo "========================================"
echo "✅ ALL VALIDATIONS PASSED"
echo "Timestamp: $TIMESTAMP"
echo "Commit: $COMMIT"
echo "Total Duration: ${TOTAL_DURATION}s"
echo "========================================"
echo ""

# Generate JSON report
cat > "$REPORT_FILE" << EOF
{
  "timestamp": "$TIMESTAMP",
  "commit": "$COMMIT",
  "overall_status": "pass",
  "total_duration_seconds": $TOTAL_DURATION,
  "steps": {
    "typecheck": {"status": "${STEP_STATUS[typecheck]}", "duration_seconds": ${STEP_DURATION[typecheck]}},
    "tests": {"status": "${STEP_STATUS[tests]}", "duration_seconds": ${STEP_DURATION[tests]}},
    "e2e": {"status": "${STEP_STATUS[e2e]}", "duration_seconds": ${STEP_DURATION[e2e]}},
    "typecheck_plugins": {"status": "${STEP_STATUS[typecheck]}", "duration_seconds": ${STEP_DURATION[typecheck]}},
    "build": {"status": "${STEP_STATUS[build]}", "duration_seconds": ${STEP_DURATION[build]}},
    "docs": {"status": "${STEP_STATUS[docs]}", "duration_seconds": ${STEP_DURATION[docs]}}
  },
  "plugins": {
    $(IFS=,; echo "${PLUGIN_STATUS[*]}")
  },
  "documentation": {
    $(IFS=,; echo "${DOCS_STATUS[*]}")
  }
}
EOF

echo "📄 JSON Report: $REPORT_FILE"
echo ""

exit 0
