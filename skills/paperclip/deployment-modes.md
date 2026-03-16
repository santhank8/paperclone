---
title: Deployment Modes
description: local_trusted (no login) vs authenticated (sessions) — PGlite for dev, external Postgres for production
type: constraint
links: [company-model, execution/heartbeat-system, board-governance]
---

# Deployment Modes

Paperclip supports two deployment modes that control authentication and exposure.

## Modes

### `local_trusted` (Default)

- Single-user local deployment with no login friction
- Implicit board operator — whoever accesses the UI is the board
- Embedded PGlite database at `~/.paperclip/instances/default/db`
- Local file storage at `~/.paperclip/instances/default/data/storage`
- No `DATABASE_URL` needed — auto-provisions on first run

Start with:
```bash
pnpm install && pnpm dev
# Dashboard at http://localhost:3100
```

### `authenticated`

- Login-required mode with session-based auth
- Supports both private-network and public deployment
- External PostgreSQL via `DATABASE_URL`
- S3-compatible object storage for assets and run logs

## Database Options

| Environment | Database | Config |
|---|---|---|
| Dev/local | Embedded PGlite (port 54329) | Leave `DATABASE_URL` unset |
| Local prod-like | Docker Postgres | Set `DATABASE_URL` |
| Production | Supabase/hosted Postgres | Set `DATABASE_URL` |

Reset local dev DB: `rm -rf data/pglite && pnpm dev`

Drizzle migrations are the source of truth. 28 migrations ship with V1. No destructive migration for upgrade path.

## Storage

- **Local default**: `local_disk` — files stored on the filesystem
- **Cloud**: `s3` — S3-compatible object storage

Run logs follow the same pattern: `local_file` for dev, `object_store` for cloud.

## Configuration

Server config lives at `~/.paperclip/instances/default/config.json`. The [[company-model]] data model is the same regardless of deployment mode. [[board-governance]] auth adapts to the mode — implicit in `local_trusted`, session-based in `authenticated`.

The [[execution/heartbeat-system]] runs identically in both modes. Agents use bearer API keys regardless of deployment mode.

## Quick Health Check

```bash
curl http://localhost:3100/api/health
curl http://localhost:3100/api/companies
```
