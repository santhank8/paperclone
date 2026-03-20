# DIYBrand Infrastructure Helper Scripts

Helper scripts and automated checks for deployment and operations.

---

## Quick Start

### Before First Deployment

1. **Verify deployment is ready:**
   ```bash
   ./scripts/verify-deployment-ready.sh
   ```
   Checks that all configuration files, dependencies, and documentation are in place.

2. **Run GitHub pre-deployment check:**
   - Go to: GitHub repo → Actions → Pre-Deployment Environment Check
   - Click "Run workflow" button
   - Select environment: `staging` or `production`
   - Workflow validates all GitHub secrets and configuration

3. **Push to main branch:**
   ```bash
   git push origin main
   ```
   This triggers the CI/CD pipeline automatically.

### After Deployment

4. **Run infrastructure smoke tests:**
   ```bash
   # Test staging deployment
   ./scripts/test-infrastructure.sh staging

   # Test production deployment
   ./scripts/test-infrastructure.sh production
   ```
   Validates that all critical endpoints and security headers are functioning.

---

## Available Scripts

### verify-deployment-ready.sh

**Purpose:** Pre-deployment environment validation

**Usage:**
```bash
./scripts/verify-deployment-ready.sh
```

**Checks:**
- ✓ Repository is clean (no uncommitted changes)
- ✓ Repository is ahead of origin (has commits to deploy)
- ✓ All required configuration files exist
- ✓ All required documentation files exist
- ✓ Sentry integration is configured
- ✓ Security headers are in next.config.ts
- ✓ Environment templates exist (.env.staging, .env.production)
- ✓ Required dependencies in package.json

**Output:**
- GREEN ✓ = Critical check passed
- RED ✗ = Critical issue (fix before deploying)
- YELLOW ⚠ = Informational (no action required)

**Example Output:**
```
✓ Repository is clean
✓ CI/CD workflow exists (.github/workflows/ci-cd.yml)
✓ Sentry integration configured in next.config.ts
✗ .env.production template missing  ← FIX THIS
⚠ VERCEL_TOKEN (requires manual GitHub configuration)
```

---

### test-infrastructure.sh

**Purpose:** Post-deployment infrastructure validation (smoke tests)

**Usage:**
```bash
./scripts/test-infrastructure.sh [staging|production]
```

**Default Environment:** production

**Examples:**
```bash
# Test production deployment
./scripts/test-infrastructure.sh production

# Test staging deployment
./scripts/test-infrastructure.sh staging

# Test production (shorthand)
./scripts/test-infrastructure.sh
```

**Tests:**
- 📡 **Connectivity:** Homepage loads (HTTP 200)
- 🔐 **Security Headers:** HSTS, X-Frame-Options, X-Content-Type-Options
- 🚨 **Error Tracking:** Sentry test endpoint responds
- 📄 **Content:** FAQ, Guides, and pricing visible
- 🔧 **APIs:** Feedback endpoint returns 405 (POST required)
- ⚡ **Performance:** Response time < 2 seconds (excellent) or < 5 seconds (acceptable)

**Output:**
- GREEN ✓ = Test passed
- RED ✗ = Test failed (needs investigation)
- YELLOW ⚠ = Test passed with warning

**Example Output:**
```
🧪 DIYBrand Infrastructure Smoke Test
====================================
Environment: production
URL: https://diybrand.app

Testing Homepage... ✓ (200)
Testing HSTS Header... ✓ (max-age=31536000...)
Testing Error Tracking... ✓ (Sentry endpoint responding)
Testing FAQ Page... ✓ (contains 'FAQ')
Measuring response time... ✓ (850ms - excellent)

📊 Smoke Test Results
✓ Passed: 8
✗ Failed: 0

✅ All infrastructure tests passed!
```

---

## GitHub Actions Workflows

### pre-deployment-check.yml

**Purpose:** Automated validation before deployment

**Access:** GitHub → Actions → "Pre-Deployment Environment Check"

**Usage:**
1. Go to GitHub repo → Actions tab
2. Select "Pre-Deployment Environment Check" workflow
3. Click "Run workflow" button
4. Choose environment: `staging` or `production`
5. Click "Run workflow"
6. Wait for checks to complete

**What it validates:**
- ✓ All GitHub secrets are configured (VERCEL_TOKEN, SENTRY_DSN, etc.)
- ✓ All required configuration files exist
- ✓ Sentry is properly integrated
- ✓ Security headers are configured
- ✓ Environment variable templates are in place

**When to run:**
- Before first deployment
- After making infrastructure changes
- Before deploying to production (recommended)

---

## Deployment Workflow

### Step 1: Verify Readiness (Pre-Deployment)

```bash
# Local verification
./scripts/verify-deployment-ready.sh

# GitHub verification (automated)
# Go to Actions → Pre-Deployment Environment Check → Run workflow
```

**Expected result:** All checks pass ✓

### Step 2: Deploy to Production

```bash
# Push to main branch
git push origin main
```

GitHub Actions CI/CD pipeline automatically triggers:
1. Lint check (ESLint)
2. Test execution
3. Build Next.js application
4. Deploy to staging (automatic)
5. Deploy to production (requires manual approval)
6. Uptime verification

### Step 3: Verify Deployment (Post-Deployment)

```bash
# Run infrastructure smoke tests
./scripts/test-infrastructure.sh production
```

**Expected result:** All tests pass ✓

---

## Troubleshooting

### verify-deployment-ready.sh says "Repository is clean" failed

**Cause:** You have uncommitted changes

**Fix:**
```bash
# Check what's uncommitted
git status

# Stage and commit changes
git add -A
git commit -m "chore: your message here"
```

### test-infrastructure.sh says "Homepage ... ✗ (Expected 200, got 502)"

**Cause:** Server returned error (Bad Gateway)

**Fix:**
1. Wait 1-2 minutes for Vercel deployment to complete
2. Check Vercel dashboard: https://vercel.com/dashboard
3. Check GitHub Actions: https://github.com/diybrand/app/actions
4. If still failing, see INFRASTRUCTURE-RUNBOOK.md for detailed troubleshooting

### test-infrastructure.sh says "response time ... ✗ (5200ms - slow)"

**Cause:** Page loaded slowly

**Fix:**
1. This is usually not critical on first deployment
2. Monitor over next few hours
3. If consistently slow: See INFRASTRUCTURE-RUNBOOK.md section "Performance Issues"
4. Check Core Web Vitals in Vercel Analytics

---

## Script Development

### Adding a New Script

1. Create script in `scripts/` directory
2. Make it executable: `chmod +x scripts/your-script.sh`
3. Add helpful output and color coding
4. Document in this README
5. Test locally before committing

### Script Template

```bash
#!/bin/bash

# DIYBrand [Tool Name]
# Usage: ./scripts/[script-name].sh [options]

set -e

echo "🔍 DIYBrand [Description]"
echo "========================="
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Your logic here

echo ""
echo "✅ Script completed successfully"
```

---

## Common Commands

```bash
# Make script executable
chmod +x scripts/verify-deployment-ready.sh

# Run pre-deployment check
./scripts/verify-deployment-ready.sh

# Test production infrastructure
./scripts/test-infrastructure.sh production

# Test staging infrastructure
./scripts/test-infrastructure.sh staging

# View GitHub Actions logs
# Go to: GitHub → Actions → [Workflow Name] → Latest Run

# Manually trigger pre-deployment check
# Go to: GitHub → Actions → Pre-Deployment Environment Check → Run Workflow
```

---

## Support

For detailed deployment procedures, see:
- **[DEPLOYMENT-CHECKLIST.md](../DEPLOYMENT-CHECKLIST.md)** — 9-phase verification checklist
- **[LAUNCH-OPERATIONS-GUIDE.md](../LAUNCH-OPERATIONS-GUIDE.md)** — Day-by-day operations guide
- **[INFRASTRUCTURE-RUNBOOK.md](../INFRASTRUCTURE-RUNBOOK.md)** — Detailed troubleshooting guide
- **[QUICK-REFERENCE.md](../QUICK-REFERENCE.md)** — One-page incident response

Contact: @Atlas (DevOps Engineer)

---

**Last Updated:** 2026-03-20
