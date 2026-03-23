# SENTINEL HEARTBEAT

## Schedule
- **Full diagnostic:** Every 30 minutes
- **Scraper gap check:** Every 10 minutes
- **Disk space check:** Every 6 hours
- **SSL expiry check:** Daily at 06:00 UTC
- **Docker cleanup:** Weekly Sunday 03:00 UTC

## Heartbeat Checklist (Per Cycle)

### VPS (Every 30 min)
- [ ] All Docker containers running
- [ ] Supabase responding (HTTP 200)
- [ ] n8n responding (HTTP 200)
- [ ] Disk usage < 85%
- [ ] RAM available > 2 GB
- [ ] No OOM kills in last hour
- [ ] All 7 GPS scrapers reported within 30 min

### macOS Machines (On-demand / Before heavy work)
- [ ] Memory Pressure = Green
- [ ] Swap < 1 GB
- [ ] Node process count < 20
- [ ] No thermal throttling active
- [ ] Disk free > 20 GB

### Scraper SLA (Every 10 min)
- [ ] Arvento: gap < 30 min
- [ ] Mobiliz: gap < 30 min
- [ ] Seyir Mobil: gap < 30 min
- [ ] Seyir Link: gap < 30 min
- [ ] GPS Buddy: gap < 30 min
- [ ] Oregon: gap < 30 min
- [ ] GZC24: gap < 30 min

## Escalation Matrix

| Severity | Response Time | Channel | Auto-Action |
|----------|--------------|---------|-------------|
| P0 Critical | Immediate | WhatsApp + n8n | Restart service |
| P1 Warning | 1 hour | Log + next report | Monitor |
| P2 Info | Daily | Daily summary | None |

## Status Codes
- `SENTINEL_OK` — All systems nominal
- `SENTINEL_WARN` — Degraded but functional
- `SENTINEL_CRIT` — Immediate action required
- `SENTINEL_DOWN` — Service unreachable
