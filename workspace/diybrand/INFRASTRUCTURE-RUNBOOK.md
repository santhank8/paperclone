# DIYBrand Infrastructure Runbook

**Owner:** Atlas (DevOps & Infrastructure Engineer)
**Version:** 1.0
**Last Updated:** 2026-03-20

This runbook provides quick-reference procedures for common infrastructure incidents and troubleshooting.

---

## Table of Contents

1. [Incident Response](#incident-response)
2. [Common Issues & Solutions](#common-issues--solutions)
3. [Monitoring Dashboards](#monitoring-dashboards)
4. [Rollback Procedures](#rollback-procedures)
5. [Emergency Contacts](#emergency-contacts)

---

## Incident Response

### High Error Rate Alert (> 1% within 5 minutes)

**Priority:** CRITICAL
**Expected Response Time:** < 5 minutes

#### Detection
- Sentry alert via Slack: `[CRITICAL] Error rate spike detected`
- Error Dashboard: https://sentry.io/organizations/diybrand/issues/

#### Immediate Action (First 2 minutes)
1. [ ] Check Sentry dashboard for error type and frequency
2. [ ] Look for common error message or stack trace
3. [ ] Check recent commits to `main` branch (`git log --oneline -10`)
4. [ ] Verify GitHub Actions pipeline status

#### If Error is in Recent Commit
1. [ ] Notify team in #dev-ops Slack channel
2. [ ] Check if staging environment shows same errors
3. [ ] If critical: **Rollback to previous commit** (see [Rollback Procedures](#rollback-procedures))
4. [ ] Monitor error rate for 10 minutes post-rollback

#### If Error is Persistent
1. [ ] Check database connection in Sentry error logs
2. [ ] Verify Vercel logs: https://vercel.com → DIYBrand project → Deployments
3. [ ] Check infrastructure metrics (CPU, memory, connections)
4. [ ] If database issue: See [Database Issues](#database-issues)
5. [ ] Escalate to Lead Engineer (Viktor) if unresolved after 10 minutes

---

### Uptime Alert (Site Down)

**Priority:** CRITICAL
**Expected Response Time:** < 2 minutes

#### Detection
- Uptime check failure (2+ consecutive failures)
- Slack alert: `[CRITICAL] diybrand.app is down`

#### Immediate Action (First 1 minute)
1. [ ] Test site manually: `curl -I https://diybrand.app`
2. [ ] Check Vercel deployment status: https://vercel.com/dashboard → DIYBrand
3. [ ] Check GitHub Actions pipeline (might be mid-deployment)

#### Common Causes & Solutions

**Cause: Deployment in progress**
- Status: Gray/yellow in Vercel dashboard
- Action: Wait 2-3 minutes for deployment to complete, verify it succeeds
- Time to resolve: 2-3 minutes

**Cause: GitHub Actions failed**
- Status: Red X on recent commit
- Action: Check workflow logs, identify stage that failed
- Solution: Fix code and push new commit or rollback (see [Rollback Procedures](#rollback-procedures))

**Cause: DNS not resolving**
- Test: `nslookup diybrand.app`
- Action: Check Vercel domain configuration (Settings → Domains)
- Time to resolve: 1-5 minutes (DNS propagation)

**Cause: Database connection failed**
- Error in Sentry: "ECONNREFUSED" or "Connection timeout"
- Action: Check `DATABASE_URL` in GitHub secrets
- Solution: Verify Vercel Postgres status, check IP whitelist

#### If Unable to Resolve Within 5 Minutes
1. [ ] Rollback to previous working commit
2. [ ] Notify team
3. [ ] Escalate to Lead Engineer

---

### Stripe Payment Failures

**Priority:** HIGH
**Expected Response Time:** < 10 minutes

#### Detection
- Support email: customer report of "payment failed"
- Sentry error: "Stripe API error"
- Error pattern: `stripe.errors.*`

#### Investigation
1. [ ] Check Stripe dashboard: https://dashboard.stripe.com
2. [ ] Look for failed charges in Transactions
3. [ ] Identify error type (insufficient funds, expired card, declined, etc.)

#### Common Causes

**Cause: API Key Invalid or Expired**
- Check GitHub secret: `STRIPE_SECRET_KEY`
- Solution: Update secret with new key from Stripe Dashboard

**Cause: Customer Card Issues**
- Notify customer: ask for different card or contact their bank
- Stripe will retry automatically

**Cause: Webhook Not Received**
- Check Stripe Dashboard → Developers → Webhooks
- View event logs for successful/failed deliveries
- If webhook failed: Vercel may be unreachable or `/api/webhooks/stripe` endpoint broken

#### Resolution Steps
1. [ ] Contact customer (if applicable)
2. [ ] Check Stripe logs and webhook status
3. [ ] If webhook issue: test endpoint `POST /api/webhooks/stripe` with sample event
4. [ ] Monitor for repeated issues from same customer
5. [ ] If systematic: escalate to Lead Engineer

---

## Common Issues & Solutions

### Database Issues

#### Symptom: "Connection refused" errors in Sentry

**Cause 1: DATABASE_URL invalid or expired**
```bash
# Test connection
psql $DATABASE_URL -c "SELECT 1"
```
- Solution: Get fresh `DATABASE_URL` from Vercel (Settings → Storage → Postgres)
- Update GitHub secret and redeploy

**Cause 2: Connection pool exhausted**
- Check current connections: `SELECT count(*) FROM pg_stat_activity;`
- Solution: Reduce connection pool size or optimize queries (see [Performance Issues](#performance-issues))
- Restart application: trigger new deployment

**Cause 3: Database maintenance/backup in progress**
- Check Vercel dashboard for maintenance alerts
- Solution: Wait for maintenance to complete (typically < 5 minutes)

#### Symptom: Slow database queries

**Check:**
```sql
-- Find slow queries
SELECT query, mean_time, calls FROM pg_stat_statements
ORDER BY mean_time DESC LIMIT 10;
```

**Solutions:**
1. [ ] Add database indexes on frequently queried columns (see INFRASTRUCTURE.md)
2. [ ] Optimize N+1 queries in application code
3. [ ] Implement query caching if applicable
4. [ ] Monitor with `EXPLAIN ANALYZE` for query plans

---

### Performance Issues

#### Symptom: Core Web Vitals degraded (LCP > 2.5s, CLS > 0.1)

**Check Vercel Analytics:**
1. Go to Vercel Dashboard → DIYBrand → Analytics
2. Check LCP, FID, CLS graphs over last 24 hours
3. Look for time of degradation

**Common Causes:**

**Large images not optimized**
- Solution: Use Next.js `<Image>` component with proper sizing
- Check bundle size: `npm run build` → `.next/static` folder

**Slow API endpoints**
- Check Server-Timing headers: `curl -I https://diybrand.app/api/...`
- Identify slow endpoint, optimize database query
- Add caching if needed

**Third-party scripts (Stripe, Sentry, analytics)**
- Load scripts asynchronously or defer
- Use Web Worker for heavy computations
- Monitor with DevTools Performance tab

**Solution Steps:**
1. [ ] Identify slow page/component
2. [ ] Profile with Chrome DevTools
3. [ ] Fix identified bottleneck
4. [ ] Push to main, verify performance improves in 10 minutes

---

### Sentry Configuration Issues

#### Symptom: No errors captured in Sentry

**Check:**
1. [ ] Sentry DSN correct in GitHub secrets (`SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`)
2. [ ] Test error endpoint: `curl https://diybrand.app/api/test-error`
3. [ ] Check Sentry dashboard for incoming events

**Solutions:**
- Verify `sentry.server.config.ts` and `sentry.client.config.ts` are committed
- Verify `src/instrumentation.ts` is in place
- Check environment variables loaded correctly: `console.log(process.env.SENTRY_DSN)` in logs
- Redeploy if secret updated: push new commit or manual redeploy

---

### GitHub Actions Pipeline Failures

#### Symptom: Red X on commit, pipeline failed

**Check Logs:**
1. Go to GitHub repo → Actions → Recent workflow run
2. Click workflow to see detailed logs
3. Identify which job failed (lint, test, build, deploy)

**Common Issues:**

**Lint fails (ESLint)**
- Error: specific linting rule violation
- Solution: Fix code locally, push new commit
- Reference: ESLint rules in `.eslintrc` config

**Build fails (Next.js)**
- Error: TypeScript error or missing import
- Solution: Fix code locally, verify `npm run build` passes locally
- Check Next.js version compatibility

**Deploy fails (Vercel)**
- Error: `VERCEL_TOKEN invalid` or project ID mismatch
- Solution: Check GitHub secrets are correct and current
- Reference: [GitHub Secrets Configuration](#phase-2-github-secrets-configuration)

---

### SSL/TLS Certificate Issues

#### Symptom: "SSL certificate not valid" browser warning

**Check:**
1. [ ] Domain in Vercel project settings (Settings → Domains)
2. [ ] DNS records point to Vercel nameservers
3. [ ] Wait 15-30 minutes for Let's Encrypt provisioning

**Solutions:**
1. Verify domain DNS: `nslookup diybrand.app`
2. Check Vercel domain status: should show "Valid SSL"
3. If stuck: remove domain from Vercel, re-add, wait for provisioning
4. Test certificate: `openssl s_client -connect diybrand.app:443 -showcerts`

---

## Monitoring Dashboards

### Critical Dashboards to Monitor

1. **Vercel Deployment Dashboard**
   - URL: https://vercel.com/dashboard → DIYBrand
   - Check: Latest deployment status, auto-updates

2. **Sentry Error Dashboard**
   - URL: https://sentry.io/organizations/diybrand/issues/
   - Check: Error rate, spike detection, unresolved issues

3. **Uptime Monitoring**
   - URL: https://status.diybrand.app (or equivalent)
   - Check: Green lights, response times

4. **GitHub Actions**
   - URL: https://github.com/diybrand/app/actions
   - Check: Latest workflow runs, any failures

5. **Vercel Analytics**
   - URL: Vercel Dashboard → DIYBrand → Analytics
   - Check: Core Web Vitals (LCP, FID, CLS)

### Daily Monitoring Checklist

**Every morning (or start of shift):**
- [ ] Check Vercel deployment status (green)
- [ ] Check Sentry error rate (< 1%)
- [ ] Check uptime monitor (all green)
- [ ] Scan GitHub Actions for failures
- [ ] Review Slack #dev-ops for overnight alerts

---

## Rollback Procedures

### Quick Rollback (Most Recent Commit)

**When to use:** Critical issue from recent deployment, need fast revert

```bash
# 1. Get the commit hash of the last good deployment
git log --oneline | head -5

# 2. Revert the broken commit (creates a new commit)
git revert HEAD --no-edit

# 3. Push to main (triggers CI/CD pipeline)
git push origin main

# 4. Watch GitHub Actions and Vercel for deployment completion
# Takes ~3-5 minutes
```

**Verify rollback succeeded:**
- [ ] GitHub Actions pipeline green
- [ ] Vercel shows successful deployment
- [ ] Uptime check passes
- [ ] Sentry error rate drops below 1%

### Full Rollback (Multiple Commits)

**When to use:** Multiple bad commits, need to go back further

```bash
# 1. Find the last good commit
git log --oneline | grep "successful deployment"

# 2. Check out that commit and create a rollback branch
git checkout <good-commit-hash>
git checkout -b rollback-from-<date>

# 3. Create revert commit that undoes all bad commits
git revert HEAD~N..HEAD --no-edit
# Where N = number of commits to revert

# 4. Push to main
git push origin rollback-from-<date>:main

# 5. Watch deployment
```

### Emergency: Force Reset to Known Good State

**Only use if absolutely necessary (full data loss risk)**

```bash
# 1. Identify good commit
GOOD_COMMIT="abc123"

# 2. Create rollback branch
git checkout -b emergency-rollback
git reset --hard $GOOD_COMMIT

# 3. Force push (only if you have permission)
git push origin emergency-rollback:main --force

# ⚠️  Warning: This will overwrite any commits since $GOOD_COMMIT
# Only do this in true emergency with approval
```

**After Emergency Rollback:**
1. [ ] Notify team immediately in #dev-ops
2. [ ] Document what went wrong
3. [ ] Review git history to understand lost commits
4. [ ] Recover any critical code manually
5. [ ] Escalate to Lead Engineer

---

## Emergency Contacts

### On-Call Escalation Chain

1. **First Response:** Atlas (DevOps)
   - Slack: @Atlas
   - Perform initial triage and basic fixes

2. **Secondary:** Viktor (Lead Engineer)
   - Slack: @Viktor
   - For code issues, deployment failures, database problems
   - Escalate if unresolved after 15 minutes

3. **Tertiary:** CEO
   - Slack: @CEO
   - For business-critical issues
   - Escalate if unresolved after 30 minutes

### External Support Contacts

- **Vercel Support:** https://vercel.com/support
- **Sentry Support:** https://sentry.io/support/
- **Stripe Support:** https://stripe.com/support
- **Database Provider (Vercel Postgres):** https://vercel.com/support

### Critical Slack Channels

- `#dev-ops` — Infrastructure and deployment alerts
- `#incidents` — Critical incident tracking
- `#monitoring` — Automated alerts (Sentry, uptime, etc.)

---

## Quick Reference Commands

```bash
# Check deployment status
curl -I https://diybrand.app

# Test Sentry error tracking
curl -X POST https://diybrand.app/api/test-error

# View recent commits
git log --oneline -10

# Check for uncommitted changes
git status

# View GitHub Actions status
gh run list --repo diybrand/app

# SSH into Vercel logs (if available)
vercel logs production --token $VERCEL_TOKEN
```

---

## Post-Incident Review Template

After resolving a critical incident, complete this template:

**Incident Summary:**
- Date/Time: ___________
- Duration: ___________
- Severity: CRITICAL / HIGH / MEDIUM
- Root Cause: ___________
- Actions Taken: ___________

**Prevention:**
- How could this have been prevented?
- What monitoring would catch this earlier?
- Code/infra changes needed?

**Follow-up:**
- [ ] Document root cause in GitHub issue
- [ ] Create task to prevent recurrence
- [ ] Update this runbook if needed
- [ ] Schedule team review

---

## Document Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-03-20 | Atlas | Initial runbook |

---

**Last Updated:** 2026-03-20
**Next Review:** 2026-04-20 (monthly)
