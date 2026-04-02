# Phase 1: Compose Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-01
**Phase:** 01-compose-foundation
**Areas discussed:** Compose file strategy, Database credentials, Volume strategy, Host integration, Agent locations

---

## Compose File Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Edit in-place (Recommended) | Modify docker/docker-compose.yml directly — simpler, one file to maintain | ✓ |
| Production override | Create docker-compose.prod.yml that overrides dev settings | |
| New standalone file | Create a fresh compose file outside docker/ | |

**User's choice:** Edit in-place
**Notes:** None — straightforward decision.

---

## Database Credentials

| Option | Description | Selected |
|--------|-------------|----------|
| Parameterize via .env (Recommended) | Move POSTGRES_USER/PASSWORD/DB to .env variables | ✓ |
| Keep hardcoded defaults | Leave paperclip/paperclip as-is | |
| You decide | Claude picks the best approach | |

**User's choice:** Parameterize via .env
**Notes:** None.

---

## Volume Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Bind mounts (Recommended) | Map to host directories — visible, easy to backup | ✓ |
| Named volumes | Keep current Docker named volumes | |
| You decide | Claude picks based on setup | |

**User's choice:** Bind mounts
**Notes:** Host path `/mnt/paperclip/` on docker-001. NFS-backed via Synology on Proxmox. Subdirs: `pgdata/` for PostgreSQL, `data/` for Paperclip app data.

---

## Host Integration

### UID/GID

| Option | Description | Selected |
|--------|-------------|----------|
| 1000:1000 | Default first user | |
| Custom UID/GID | Specific service account or NFS mapping | |
| Not sure | Need to check | ✓ |

**User's choice:** Not sure — to be determined during execution
**Notes:** Must run `id` on docker-001 to determine correct values. NFS UID mapping may also be a factor.

### Docker Networking

**User's choice:** Not sure — inspect Traefik config on docker-001 to determine
**Notes:** User asked to inspect Traefik's existing setup to understand whether it uses a shared Docker network or host port routing.

---

## Agent Locations

**User's question:** Where do agents need to be?
**Answer provided:** Claude Code, Codex, OpenCode are baked into the Docker image as child processes. OpenClaw connects via external WebSocket gateway.

### OpenClaw Location

| Option | Description | Selected |
|--------|-------------|----------|
| Same Docker host | Runs on docker-001 | |
| Different host/VM | Runs elsewhere on network | |
| Not set up yet | Configure later | ✓ |
| Let me explain | Different situation | |

**User's choice:** Not set up yet — deferred
**Notes:** User also asked whether Paperclip can call OpenClaw outside the container. Confirmed yes — OpenClaw adapter uses WebSocket gateway protocol, connects to external URL.

---

## Claude's Discretion

- HEALTHCHECK implementation details (interval, timeout, retries)
- Restart policy specifics (unless-stopped vs always)
- `.env.template` format and documentation style

## Deferred Ideas

- OpenClaw gateway setup — not running yet
- Traefik/Cloudflare/Technitium configuration — Phase 2
- Agent API keys — Phase 3
