# Report Agents

Telegram bot + data collectors for Whales Market daily reporting. Part of the Paperclip agent system.

## Architecture

```
bot-listener.ts          Telegram bot (long-polling), routes commands to collectors
report-manager.ts        Orchestrates all collectors into a single report
platform-collector.ts    Queries Metabase/SQLite for trading metrics
social-collector.ts      Fetches X (Twitter) stats via RapidAPI
ga-collector.ts          Google Analytics 4 website metrics
visual-report.ts         Generates chart images via Puppeteer + sends to Telegram
monthly-report.ts        Month-over-month comparison report

lib/
  telegram.ts            Telegram send helper
  metabase-queries.ts    SQLite queries for platform data
  ga4-client.ts          GA4 API client (daily)
  ga4-monthly.ts         GA4 API client (monthly)
  charts.ts              Chart HTML generation
  formatters.ts          Number/growth formatting utilities
  platform-format.ts     Platform metrics → HTML
  social-format.ts       Social metrics → HTML
  report-html.ts         Full report HTML builder
  paperclip-api.ts       Paperclip API integration
```

## Setup

1. Copy `.env.example` to `.env` in the repo root (or ensure root `.env` has these):

   ```
   TELEGRAM_BOT_TOKEN=...
   TELEGRAM_CHAT_ID=...
   WHALES_DB_PATH=...
   RAPIDAPI_KEY=...
   GA4_PROPERTY_ID=...
   SOCIAL_ACCOUNTS=[...]
   ```

2. Place your GA4 service account key as `ga4-key.json` in the repo root (gitignored).

3. Install dependencies:

   ```bash
   cd scripts/report-agents
   npm install
   ```

## Usage

```bash
# Start the Telegram bot
npm run bot

# Run a one-shot daily report
npm run report

# Generate visual dashboard
npm run visual            # daily
npm run visual:weekly
npm run visual:monthly

# Individual collectors
npm run platform
npm run social
npm run ga
```

## Bot Commands

| Command | Description |
|---------|-------------|
| `/report` | Full daily report (platform + social + GA4) |
| `/volume` | Top tokens by volume (24h) |
| `/users` | New vs returning users |
| `/token <SYMBOL>` | Deep dive on a single token |
| `/funnel` | On-chain conversion funnel |
| `/trend` | 14-day daily trend |
| `/settle` | Settlement rate overview |
| `/mom` | Month-over-month comparison |
| `/visual` | Dashboard chart image |
| `/reset` | Reset conversation context |

Free-text questions are answered via Claude CLI with SQLite database context.
