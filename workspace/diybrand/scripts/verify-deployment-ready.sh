#!/bin/bash

# DIYBrand Deployment Readiness Verification Script
# Run this before starting first production deployment
# Usage: ./scripts/verify-deployment-ready.sh

set -e

echo "🔍 DIYBrand Deployment Readiness Checker"
echo "========================================"
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ERRORS=0
WARNINGS=0

# Helper functions
check_pass() {
    echo -e "${GREEN}✓${NC} $1"
}

check_fail() {
    echo -e "${RED}✗${NC} $1"
    ERRORS=$((ERRORS + 1))
}

check_warn() {
    echo -e "${YELLOW}⚠${NC} $1"
    WARNINGS=$((WARNINGS + 1))
}

# Check 1: GitHub secrets configured
echo "📋 Checking GitHub Secrets..."
echo ""

REQUIRED_SECRETS=(
    "VERCEL_TOKEN"
    "VERCEL_PROJECT_ID"
    "VERCEL_ORG_ID"
    "SENTRY_DSN"
    "NEXT_PUBLIC_SENTRY_DSN"
    "STRIPE_SECRET_KEY"
    "DATABASE_URL"
)

# Note: Cannot verify GitHub secrets without authentication
# This is informational only
echo "Required GitHub Secrets (must be set manually in GitHub):"
for secret in "${REQUIRED_SECRETS[@]}"; do
    echo "  ⚠ $secret"
done
echo ""
echo "Verify in GitHub: Settings → Secrets and variables → Actions"
echo "All 8 secrets should be marked as 'masked'"
echo ""

# Check 2: Local repository status
echo "🔧 Checking Repository Status..."
echo ""

if git status --porcelain | grep -q .; then
    check_fail "Repository has uncommitted changes"
else
    check_pass "Repository is clean"
fi

if git rev-parse --verify origin/master > /dev/null 2>&1; then
    COMMITS_AHEAD=$(git rev-list --count origin/master..HEAD)
    if [ "$COMMITS_AHEAD" -gt 0 ]; then
        check_pass "Repository has $COMMITS_AHEAD commits ahead of origin"
    else
        check_fail "Repository is not ahead of origin (no commits to push)"
    fi
else
    check_warn "Cannot verify origin/master (may not be tracking remote)"
fi

echo ""

# Check 3: Configuration files
echo "📁 Checking Configuration Files..."
echo ""

if [ -f ".github/workflows/ci-cd.yml" ]; then
    check_pass "CI/CD workflow exists (.github/workflows/ci-cd.yml)"
else
    check_fail "CI/CD workflow missing (.github/workflows/ci-cd.yml)"
fi

if [ -f ".github/workflows/pr-validation.yml" ]; then
    check_pass "PR validation workflow exists"
else
    check_fail "PR validation workflow missing"
fi

if [ -f "next.config.ts" ]; then
    if grep -q "withSentryConfig" next.config.ts; then
        check_pass "Sentry integration configured in next.config.ts"
    else
        check_fail "Sentry integration NOT configured in next.config.ts"
    fi
else
    check_fail "next.config.ts not found"
fi

if [ -f "sentry.server.config.ts" ]; then
    check_pass "Server-side Sentry config exists"
else
    check_fail "Server-side Sentry config missing"
fi

if [ -f "sentry.client.config.ts" ]; then
    check_pass "Client-side Sentry config exists"
else
    check_fail "Client-side Sentry config missing"
fi

if [ -f "src/instrumentation.ts" ]; then
    check_pass "Sentry instrumentation exists"
else
    check_fail "Sentry instrumentation missing"
fi

echo ""

# Check 4: Environment files
echo "🌍 Checking Environment Configuration..."
echo ""

if [ -f ".env.production" ]; then
    check_pass ".env.production template exists"
    if grep -q "VERCEL_TOKEN" .env.production; then
        check_warn ".env.production contains template variables (should be replaced in CI/CD)"
    fi
else
    check_fail ".env.production template missing"
fi

if [ -f ".env.staging" ]; then
    check_pass ".env.staging template exists"
else
    check_fail ".env.staging template missing"
fi

echo ""

# Check 5: Documentation
echo "📚 Checking Documentation..."
echo ""

DOCS=(
    "INFRASTRUCTURE.md"
    "DEPLOYMENT-CHECKLIST.md"
    "LAUNCH-OPERATIONS-GUIDE.md"
    "QUICK-REFERENCE.md"
    "INFRASTRUCTURE-RUNBOOK.md"
    "VERCEL-SETUP.md"
)

for doc in "${DOCS[@]}"; do
    if [ -f "$doc" ]; then
        check_pass "$doc exists"
    else
        check_fail "$doc missing"
    fi
done

echo ""

# Check 6: Dependencies
echo "📦 Checking Dependencies..."
echo ""

if grep -q '@sentry/nextjs' package.json; then
    check_pass "Sentry Next.js package is in package.json"
else
    check_fail "Sentry Next.js package missing from package.json"
fi

echo ""

# Check 7: Build test
echo "🔨 Testing Build..."
echo ""

echo "Note: Run 'npm run build' separately to test build (takes ~2 minutes)"
echo ""

# Summary
echo "========================================"
echo "📊 Readiness Summary"
echo "========================================"
echo ""

if [ "$ERRORS" -eq 0 ]; then
    echo -e "${GREEN}✓ All critical checks passed!${NC}"
else
    echo -e "${RED}✗ $ERRORS critical issues found${NC}"
fi

if [ "$WARNINGS" -gt 0 ]; then
    echo -e "${YELLOW}⚠ $WARNINGS warnings (informational only)${NC}"
fi

echo ""

if [ "$ERRORS" -eq 0 ]; then
    echo "✅ Infrastructure is ready for deployment!"
    echo ""
    echo "Next steps:"
    echo "1. Verify GitHub secrets are configured (cannot check from script)"
    echo "2. Verify domain is registered with Vercel DNS configured"
    echo "3. Start deployment: 'git push origin main'"
    echo "4. Monitor: Use QUICK-REFERENCE.md for incident response"
    exit 0
else
    echo "❌ Fix issues above before attempting deployment"
    exit 1
fi
