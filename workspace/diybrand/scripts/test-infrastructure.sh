#!/bin/bash

# DIYBrand Infrastructure Smoke Test
# Run after deployment to verify all systems are operational
# Usage: ./scripts/test-infrastructure.sh [production|staging]

ENVIRONMENT=${1:-production}
if [ "$ENVIRONMENT" = "production" ]; then
    BASE_URL="https://diybrand.app"
elif [ "$ENVIRONMENT" = "staging" ]; then
    BASE_URL="https://staging.diybrand.app"
else
    echo "Usage: $0 [production|staging]"
    exit 1
fi

echo "🧪 DIYBrand Infrastructure Smoke Test"
echo "===================================="
echo "Environment: $ENVIRONMENT"
echo "URL: $BASE_URL"
echo ""

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASSED=0
FAILED=0

test_endpoint() {
    local name=$1
    local endpoint=$2
    local expected_status=$3

    echo -n "Testing $name... "

    RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL$endpoint" 2>/dev/null)
    STATUS=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | head -n-1)

    if [ "$STATUS" = "$expected_status" ]; then
        echo -e "${GREEN}✓${NC} ($STATUS)"
        PASSED=$((PASSED + 1))
    else
        echo -e "${RED}✗${NC} (Expected $expected_status, got $STATUS)"
        FAILED=$((FAILED + 1))
    fi
}

test_endpoint_contains() {
    local name=$1
    local endpoint=$2
    local search_string=$3

    echo -n "Testing $name... "

    RESPONSE=$(curl -s "$BASE_URL$endpoint" 2>/dev/null)

    if echo "$RESPONSE" | grep -q "$search_string"; then
        echo -e "${GREEN}✓${NC} (contains '$search_string')"
        PASSED=$((PASSED + 1))
    else
        echo -e "${RED}✗${NC} (does not contain '$search_string')"
        FAILED=$((FAILED + 1))
    fi
}

test_endpoint_header() {
    local name=$1
    local endpoint=$2
    local header_name=$3

    echo -n "Testing $name (header: $header_name)... "

    HEADER=$(curl -s -I "$BASE_URL$endpoint" 2>/dev/null | grep -i "^$header_name:" | head -1 | cut -d: -f2- | xargs)

    if [ -n "$HEADER" ]; then
        echo -e "${GREEN}✓${NC} ($HEADER)"
        PASSED=$((PASSED + 1))
    else
        echo -e "${RED}✗${NC} (header not found)"
        FAILED=$((FAILED + 1))
    fi
}

# Basic connectivity
echo "📡 Connectivity Tests"
echo "---"
test_endpoint "Homepage" "/" "200"
echo ""

# Security headers
echo "🔐 Security Headers"
echo "---"
test_endpoint_header "HSTS Header" "/" "Strict-Transport-Security"
test_endpoint_header "X-Frame-Options Header" "/" "X-Frame-Options"
test_endpoint_header "X-Content-Type-Options Header" "/" "X-Content-Type-Options"
echo ""

# Error tracking
echo "🚨 Error Tracking (Sentry)"
echo "---"
test_endpoint "Test Error Endpoint" "/api/test-error" "200"
echo "Note: Check Sentry dashboard within 30 seconds to verify error was captured"
echo "      https://sentry.io/organizations/diybrand/issues/"
echo ""

# Page content
echo "📄 Page Content"
echo "---"
test_endpoint_contains "FAQ Page" "/faq" "FAQ"
test_endpoint_contains "Guides Page" "/guides" "Guide"
test_endpoint_contains "Pricing" "/" "pricing\|price\|\$"
echo ""

# API endpoints
echo "🔧 API Endpoints"
echo "---"
test_endpoint "Feedback API" "/api/feedback" "405"  # POST required, GET returns 405
echo "Note: 405 is expected (POST required, not GET)"
echo ""

# Performance check
echo "⚡ Performance"
echo "---"
echo -n "Measuring response time... "
START_TIME=$(date +%s%N)
curl -s "$BASE_URL/" > /dev/null 2>&1
END_TIME=$(date +%s%N)
DURATION_MS=$(( (END_TIME - START_TIME) / 1000000 ))

if [ "$DURATION_MS" -lt 2000 ]; then
    echo -e "${GREEN}✓${NC} (${DURATION_MS}ms - excellent)"
elif [ "$DURATION_MS" -lt 5000 ]; then
    echo -e "${YELLOW}⚠${NC} (${DURATION_MS}ms - acceptable)"
    FAILED=$((FAILED + 1))
else
    echo -e "${RED}✗${NC} (${DURATION_MS}ms - slow)"
    FAILED=$((FAILED + 1))
fi
echo ""

# Summary
echo "===================================="
echo "📊 Smoke Test Results"
echo "===================================="
echo -e "${GREEN}✓ Passed: $PASSED${NC}"
echo -e "${RED}✗ Failed: $FAILED${NC}"
echo ""

if [ "$FAILED" -eq 0 ]; then
    echo -e "${GREEN}✅ All infrastructure tests passed!${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Check Sentry for test error: https://sentry.io/organizations/diybrand/issues/"
    echo "2. Monitor uptime check: https://status.diybrand.app"
    echo "3. Review error rate: https://sentry.io/organizations/diybrand/issues/"
    echo "4. Keep QUICK-REFERENCE.md open for incident response"
    exit 0
else
    echo -e "${RED}❌ Some infrastructure tests failed${NC}"
    echo ""
    echo "Troubleshooting:"
    echo "- Check INFRASTRUCTURE-RUNBOOK.md for detailed procedures"
    echo "- Verify GitHub secrets are configured correctly"
    echo "- Check Vercel deployment status: https://vercel.com/dashboard"
    exit 1
fi
