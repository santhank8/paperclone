# Shangrila

ValCtrl's internal fork of [Paperclip](https://github.com/paperclipai/paperclip) — open-source orchestration for AI-agent companies.

Named after the mythical hidden valley: a self-sustaining paradise that runs itself.

## What This Is

Shangrila is Paperclip with ValCtrl-specific customizations layered on top. All upstream Paperclip documentation (`doc/GOAL.md`, `doc/PRODUCT.md`, `doc/SPEC-implementation.md`, `doc/DEVELOPING.md`, `doc/DATABASE.md`) remains authoritative for core behavior.

This document covers only what differs from upstream.

## Git Topology

| Remote | URL | Purpose |
|--------|-----|---------|
| `origin` | `github.com/valctrltech/shangrila` | Our fork |
| `upstream` | `github.com/paperclipai/paperclip` | Source of truth |

### Branches

| Branch | Role |
|--------|------|
| `master` | Untouched mirror of upstream. Never commit directly. Merge source only. |
| `shangrila/main` | **Default branch.** All ValCtrl customizations live here. |
| `shangrila/feat-*` | Feature branches for individual changes, merged into `shangrila/main`. |

### Upstream Sync Workflow

Run after each upstream tagged release, or monthly minimum. There is also a scheduled GitHub Actions workflow (`upstream-sync.yml`) that dry-runs this every Monday and reports conflicts.

```sh
git checkout master
git fetch upstream
git merge upstream/master --ff-only
git push origin master

git checkout shangrila/main
git merge master --no-edit
# resolve conflicts if any
pnpm install
pnpm -r typecheck
pnpm test:run
git push origin shangrila/main
```

## CI/CD Pipeline

### CI (GitHub Actions — `ubuntu-latest` runners)

| Workflow | Trigger | What it does |
|----------|---------|--------------|
| `pr.yml` | PR to `shangrila/main` | Typecheck, tests, build |
| `shangrila-ci.yml` | Push to `shangrila/main` | Typecheck, tests, build, Docker smoke test |
| `docker.yml` | Push to `shangrila/main` | Build & push image to `ghcr.io/valctrltech/shangrila` |
| `upstream-sync.yml` | Manual / Monday 9am UTC | Dry-run upstream merge, typecheck, tests |
| `refresh-lockfile.yml` | Push to `shangrila/main` | Auto-refresh `pnpm-lock.yaml` if deps changed |

### CD (Self-hosted runner on EC2)

| Workflow | Trigger | What it does |
|----------|---------|--------------|
| `deploy.yml` | Shangrila CI passes, or manual dispatch | Runs `scripts/deploy.sh` on the EC2 |

**Deploy flow:** `git pull → pnpm install → pnpm build → systemctl restart shangrila → health check`

The self-hosted runner (`shangrila-ec2`) is registered to the `valctrltech/shangrila` repo and runs as a systemd service on the EC2 instance.

## Deployment Architecture

Shangrila runs as a **bare Node.js process** on an AWS EC2 instance, managed by systemd. Docker images are built in CI for future migration but are not currently used in production.

```
User → Cloudflare (HTTPS) → Cloudflare Tunnel (cloudflared) → localhost:3100 (Shangrila)
```

### EC2 Instance

| Setting | Value |
|---------|-------|
| Hostname (Tailscale) | `commandorg` |
| Access | `ssh commandorg` (Tailscale SSH) |
| Public domain | `command.valctrl.com` |
| Process manager | systemd (`shangrila.service`) |
| Working directory | `/home/ubuntu/shared/shangrila` |
| Node command | `node --import ./server/node_modules/tsx/dist/loader.mjs server/dist/index.js` |
| Port | 3100 (not exposed publicly — Cloudflare Tunnel only) |
| Database | Embedded PostgreSQL (PGlite) at `~/.paperclip/instances/default/db` |
| Auto-backup | Every 60 min, 30-day retention |
| GH Actions runner | `~/actions-runner` (systemd service, label: `shangrila`) |

### Environment Variables (`.env`)

Located at `/home/ubuntu/shared/shangrila/.env` (permissions: 600).

| Variable | Purpose |
|----------|---------|
| `BETTER_AUTH_SECRET` | Auth session signing key |
| `BETTER_AUTH_URL` | Base URL for Better Auth (social OAuth redirect URIs) |
| `PAPERCLIP_PUBLIC_URL` | Public-facing URL |
| `PAPERCLIP_ALLOWED_HOSTNAMES` | Allowed hostnames for requests |
| `BETTER_AUTH_TRUSTED_ORIGINS` | CORS trusted origins |
| `PAPERCLIP_DEPLOYMENT_MODE` | `authenticated` |
| `SERVE_UI` | `true` |
| `PORT` | `3100` |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `LINEAR_API_KEY` | Linear integration API key |

### Services on EC2

| Service | systemd unit | Purpose |
|---------|-------------|---------|
| Shangrila | `shangrila.service` | The application |
| Cloudflare Tunnel | `cloudflared.service` | Routes `command.valctrl.com` → `localhost:3100` |
| Tailscale | `tailscaled.service` | Secure SSH access |
| GH Actions Runner | `actions.runner.valctrltech-shangrila.shangrila-ec2.service` | CD deploy runner |
| Fail2ban | `fail2ban.service` | SSH brute-force protection |

### Network Security

| Port | Service | Exposure |
|------|---------|----------|
| 22 | SSH | Security group: 2 specific IPs only |
| 3100 | Shangrila | Not publicly exposed. Reached only via Cloudflare Tunnel |
| 54329 | Embedded Postgres | Loopback (127.0.0.1) only |

No ports 80/443 are open. All web traffic goes through the Cloudflare Tunnel.

### Cloudflare Tunnel Config

Located at `/etc/cloudflared/config.yml`:

```yaml
tunnel: ed28b8e1-e413-491f-999c-d561ad37f514
credentials-file: /home/ubuntu/.cloudflared/ed28b8e1-e413-491f-999c-d561ad37f514.json

ingress:
  - hostname: command.valctrl.com
    service: http://localhost:3100
  - service: http_status:404
```

DNS record for `command.valctrl.com` is a CNAME to `ed28b8e1-e413-491f-999c-d561ad37f514.cfargotunnel.com` (proxied through Cloudflare).

## Key Files

| File | Purpose |
|------|---------|
| `scripts/deploy.sh` | CD deploy script (runs on EC2 via GH Actions) |
| `scripts/shangrila.service` | systemd service definition (reference copy) |
| `.github/workflows/deploy.yml` | CD workflow (triggers on CI success) |
| `.github/workflows/shangrila-ci.yml` | CI workflow (typecheck, test, build, Docker smoke) |
| `.github/workflows/upstream-sync.yml` | Weekly upstream merge dry-run |
| `.cursor/rules/shangrila.mdc` | Cursor AI context for this fork |
| `doc/SHANGRILA.md` | This file |

## Customization Layering

To minimize merge conflicts on upstream sync, place changes in the lowest-conflict zone possible:

| Risk | Area | Rule |
|------|------|------|
| Zero | `skills/` | New files only. Additive. |
| Zero | `packages/plugins/` | New plugin packages. |
| Zero | `packages/adapters/` | New adapter packages. |
| Zero | `.cursor/rules/` | Cursor-specific rules. |
| Low | `docker/`, deploy configs, `.env.*` | Infra-specific. Upstream rarely changes these. |
| Medium | `server/` | Prefer new files. Avoid modifying existing routes/services. |
| Medium | `packages/db/` | New tables safe. Modifying existing table schemas = conflict risk. |
| High | `ui/` | Upstream iterates fast. Keep patches minimal and isolated. |
| High | `packages/shared/` | Core type contracts. Modifications ripple across all layers. |

When modifying upstream files is unavoidable, keep the diff small and explain the reason in the commit message.

## Current Customizations

1. **Google OAuth login** — Better Auth social provider for Google sign-in. Server conditionally registers when `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` env vars are present. Modified files: `server/src/auth/better-auth.ts`, `ui/src/pages/Auth.tsx`, `ui/src/api/auth.ts`.
2. **Subscription cost amortization** — Fixed-fee agent billing. New DB migration, services, routes, and UI components.
3. **CI/CD pipeline** — Shangrila-specific CI workflows, self-hosted runner CD, and systemd deployment.

## Common Operations

### Bootstrap first admin

```sh
ssh commandorg
cd /home/ubuntu/shared/shangrila
set -a && source .env && set +a
pnpm paperclipai auth bootstrap-ceo
```

### Restart Shangrila

```sh
ssh commandorg
sudo systemctl restart shangrila
sudo journalctl -u shangrila -f  # follow logs
```

### Check health

```sh
curl -s http://localhost:3100/api/health   # from EC2
curl -s https://command.valctrl.com/api/health  # from anywhere
```

### Manual deploy (skip CI)

```sh
ssh commandorg
bash /home/ubuntu/shared/shangrila/scripts/deploy.sh
```

### View deploy logs

```sh
ssh commandorg
sudo journalctl -u shangrila --no-pager -n 50
```

## Local Development

```sh
pnpm install
pnpm dev
```

API + UI at `http://localhost:3100`. Uses embedded PGlite locally — no external database needed.

Reset local dev DB:

```sh
rm -rf data/pglite
pnpm dev
```

## Verification

Before any PR or merge:

```sh
pnpm -r typecheck
pnpm test:run
pnpm build
```
