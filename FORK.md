# ValCtrl Paperclip Fork

Internal fork of [paperclipai/paperclip](https://github.com/paperclipai/paperclip) used as **ValCtrl Command** — our agent orchestration dashboard for managing OpenClaw agents.

## What Was Changed

### Branding (user-facing strings only)
- App title: "Paperclip" → "Command" / "ValCtrl Command"
- HTML `<title>`, PWA manifest, login page, breadcrumbs, design guide
- Startup ASCII banner: PAPERCLIP → COMMAND
- Various UI tooltip/label strings
- **NOT changed:** package names, internal identifiers, env var names, database schema, localStorage keys

### Hardened Defaults
- `PAPERCLIP_AUTH_DISABLE_SIGN_UP=true` in Dockerfile
- `PAPERCLIP_DEPLOYMENT_MODE=authenticated` (was already default in Docker)
- `PAPERCLIP_DEPLOYMENT_EXPOSURE=private` (was already default in Docker)

### Docker Compose
- Port changed from 3100 to 18080 (avoids conflict with OpenClaw gateways on 18789/18790)
- PostgreSQL pinned to 16-alpine (upstream used 17)
- Added health checks on server container
- Added `restart: unless-stopped`
- DB port not exposed to host (no external access needed)

### Added Files
- `SECURITY.md` — internal infrastructure security policy
- `FORK.md` — this file
- `.github/workflows/upstream-sync.yml` — weekly upstream sync PR

## What Was NOT Changed
- No telemetry or analytics was found to remove (codebase is clean)
- No database schema or migration files modified
- No internal module/package names renamed
- No functionality removed — all adapters (including `openclaw_gateway`) fully intact
- No git history rewritten

## Telemetry Audit Results
Full audit found **zero phone-home code**:
- No PostHog, Mixpanel, Segment, Google Analytics, Sentry, Datadog
- No update checkers, license validators, or external feature flags
- All outbound API calls are legitimate provider integrations (Anthropic, OpenAI) initiated by user configuration

## Merging Upstream Updates

The fork uses a standard `upstream` remote:

```bash
git remote -v
# origin    https://github.com/valctrltech/valctrl-paperclip.git
# upstream  https://github.com/paperclipai/paperclip.git
```

### Manual merge
```bash
git fetch upstream
git checkout master
git merge upstream/master
# Resolve conflicts (likely in: ui/index.html, site.webmanifest, startup-banner.ts, docker-compose.yml, Dockerfile)
# Test: docker compose build && docker compose up -d
git push origin master
```

### Automated (weekly)
The `.github/workflows/upstream-sync.yml` workflow checks for upstream changes weekly and creates a PR if updates are available.

### Conflict hotspots
These files have ValCtrl-specific changes and are most likely to conflict on upstream merge:
- `ui/index.html` (title, meta)
- `ui/public/site.webmanifest` (name, description)
- `server/src/startup-banner.ts` (ASCII art)
- `docker-compose.yml` (port, postgres version)
- `Dockerfile` (PAPERCLIP_AUTH_DISABLE_SIGN_UP)
- `ui/src/pages/Auth.tsx` (login text)
- `ui/src/context/BreadcrumbContext.tsx` (document title)

## Deployment Architecture

```
shambala (EC2)
├── ValCtrl Command (this repo)
│   ├── Paperclip server    :18080
│   └── PostgreSQL 16       :5432 (internal)
├── OpenClaw Agent: Logan   :18789 (gateway)
├── OpenClaw Agent: Magnus  :18790 (gateway)
└── Future agents...        :18791+
```

Command connects to agents via the `openclaw_gateway` adapter using each agent's gateway URL and token.
