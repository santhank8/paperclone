# Web Analytics Monitoring Strategy

**Created:** 2026-03-16
**Owner:** CMO
**Status:** Active
**Measurement ID:** G-6NBK0MG2QD

---

## CURRENT STATUS

- GA4 tag installed and verified on withapurpose.co
- Tracking code present in site header
- No automated reporting or monitoring configured yet

---

## KEY METRICS TO TRACK

### Traffic Metrics
- Sessions (total visits)
- Users (unique visitors)
- Page views
- Session duration
- Bounce rate
- Traffic sources (organic, direct, social, referral)

### Acquisition Channels
- Organic search (SEO performance)
- Direct traffic
- Social media (LinkedIn, X)
- Referral traffic
- Email campaigns (when active)

### Engagement Metrics
- Pages per session
- Average session duration
- Return visitor rate
- Content engagement by page

### Conversion Metrics (when Gumroad goes live)
- Product page views
- Add to cart events
- Checkout initiated
- Purchases
- Revenue

### Content Performance
- Top pages by views
- Top landing pages
- Exit pages
- Blog/article performance (when added)

---

## REPORTING CADENCE

### Daily (Automated Alert)
- Sessions vs previous day
- Traffic anomalies (+/- 50%)
- Error pages (404s)

### Weekly Report
- Sessions, users, page views
- Traffic source breakdown
- Top 5 content pages
- Week-over-week trends
- Social referral performance

### Monthly Deep Dive
- Full traffic analysis
- Audience demographics
- Geographic distribution
- Device breakdown
- Acquisition trends
- Content performance ranking
- Conversion funnel analysis

---

## REQUIRED SETUP FOR AUTOMATION

### Option A: GA4 Data API (Recommended)

**Requirements:**
1. Google Cloud Project with Analytics Data API enabled
2. Service account with Viewer access to GA4 property
3. Property ID (different from Measurement ID G-6NBK0MG2QD)
4. JSON credentials file

**Implementation:**
```python
# Using google-analytics-data library
from google.analytics.data import AnalyticsDataClient
from google.analytics.data_v1alpha.types import RunReportRequest

client = AnalyticsDataClient.from_service_account_json('credentials.json')
# Fetch metrics programmatically
```

**Advantages:**
- Fully automated
- Real-time data access
- Custom dashboards
- Can integrate with cron jobs

### Option B: Chrome CDP Automation

**Requirements:**
- Chrome CDP profile with GA4 login session
- Scheduled browser automation

**Disadvantages:**
- Fragile (UI changes break scripts)
- Requires active session maintenance
- Slower and less reliable

---

## DASHBOARD SETUP

### Primary Dashboard
- Traffic overview (sessions, users, page views)
- Source/medium breakdown
- Top content
- Geographic distribution

### Marketing Dashboard
- Social traffic breakdown (LinkedIn vs X)
- Campaign performance (when running)
- Content engagement
- Conversion metrics

### Technical Dashboard
- Page load times (via GA4 events)
- Error tracking
- Device/browser breakdown
- Mobile vs desktop

---

## INTEGRATION WITH CMO WORKFLOW

### Content Strategy Feedback Loop
1. Publish content → Track in GA4
2. Weekly review of content performance
3. Adjust strategy based on engagement data
4. Report insights to CEO

### Social Media Attribution
- UTM parameters for all social links
- Track LinkedIn vs X traffic
- Measure conversion from social posts

### SEO Performance
- Organic search traffic trends
- Landing page performance from search
- Keyword opportunities (via Search Console when linked)

---

## NEXT STEPS

1. **Get GA4 API credentials from Stefan**
   - Google Cloud project with Analytics Data API
   - Service account JSON credentials
   - Property ID for withapurpose.co

2. **Create automated reporting script**
   - Daily/weekly metric collection
   - Store reports in `/reports/analytics/`

3. **Set up dashboard for quick checks**
   - Either GA4 dashboard or custom solution

4. **Link Search Console** (SEO)
   - Enables keyword and SERP data
   - Requires domain verification

---

## REPORTING TEMPLATES

See: `analytics-report-template.md`