# Web Analytics Setup Report

**Issue:** WIT-28
**Date:** 2026-03-16
**Completed By:** CMO

---

## WHAT WAS DONE

### 1. Verified GA4 Installation
- GA4 tag confirmed on withapurpose.co
- Measurement ID: G-6NBK0MG2QD
- Tag properly placed in `<head>` section

### 2. Created Analytics Strategy
- File: `strategy/web-analytics.md`
- Defines key metrics, reporting cadence, and dashboard requirements
- Outlines integration with CMO workflow

### 3. Created Report Template
- File: `reports/analytics-report-template.md`
- Weekly report structure ready to use
- Includes traffic sources, content performance, and recommendations

---

## BLOCKER: API ACCESS NEEDED

To enable automated analytics monitoring, Stefan needs to provide:

### Required from Google Cloud Console

1. **Create a Google Cloud Project** (or use existing)
   - Go to: https://console.cloud.google.com

2. **Enable Analytics Data API**
   - APIs & Services → Enable APIs → Search "Google Analytics Data API"

3. **Create Service Account**
   - IAM & Admin → Service Accounts → Create
   - Grant "Viewer" role

4. **Get Property ID**
   - Go to GA4 Admin → Property Settings
   - Copy Property ID (different from G-6NBK0MG2QD)
   - Add service account email as user with "Viewer" access

5. **Download JSON Credentials**
   - Service Account → Keys → Add Key → JSON
   - Save securely

### Deliver to CMO

Once you have:
- Property ID (numeric, like 123456789)
- JSON credentials file

I can set up automated reporting immediately.

---

## RECOMMENDATION: NO NEW AGENT NEEDED

**Assessment:** A dedicated "Web Analytics" agent is overkill for current scale.

**Rationale:**
- Single website, low traffic initially
- Weekly reports sufficient for now
- CMO can handle analytics as part of marketing oversight
- Can revisit when traffic scales or multiple properties exist

**Alternative:** CMO will own analytics monitoring. Once API access is provided, I'll:
1. Install google-analytics-data library
2. Create automated reporting script
3. Set up weekly report generation
4. Alert on traffic anomalies

---

## IMMEDIATE NEXT STEPS

1. **Stefan provides GA4 API credentials** (see above)
2. **CMO sets up automated reporting** (1-2 hours work)
3. **First weekly report generated** (within 24 hours of credentials)
4. **Dashboard configured** for quick checks

---

## FILES CREATED

```
withapurpose/
├── strategy/
│   └── web-analytics.md          # Full analytics strategy
└── reports/
    └── analytics-report-template.md  # Weekly report template
```

---

**Status:** BLOCKED on API credentials from Stefan
**CMO Ready to Proceed:** Yes, immediately upon receiving credentials