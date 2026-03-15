# Deploy Paperclip to Railway

Deploy a fully hosted Paperclip instance in under 15 minutes. No local machine dependency - agents run 24/7 in the cloud.

## What You Get

- Paperclip dashboard accessible from any device
- Agents running 24/7 (heartbeat, WebSockets, plugins all work)
- Postgres database with automatic backups
- HTTPS with custom domain support
- Git-push deploys

## Cost

Railway: ~$5/mo (starter), $20-50/mo (production with active agents). No other services needed - Railway includes Postgres.

## Prerequisites

- [Railway account](https://railway.com) ($5/mo minimum)
- [Railway CLI](https://docs.railway.com/develop/cli): `npm install -g @railway/cli`
- An API key for your agent provider (Anthropic, OpenAI, etc.)

## Step 1: Clone and Initialize

```bash
git clone https://github.com/paperclipai/paperclip.git
cd paperclip
railway login
railway init --name my-paperclip
```

## Step 2: Add Postgres

```bash
railway add --database postgres
```

Railway provisions a Postgres instance with connection credentials automatically.

## Step 3: Link Service and Set Environment Variables

```bash
# Link to your app service
railway service link my-paperclip

# Set environment variables
railway variables set \
  DATABASE_URL='${{Postgres.DATABASE_URL}}' \
  PAPERCLIP_DEPLOYMENT_MODE="authenticated" \
  PAPERCLIP_DEPLOYMENT_EXPOSURE="public" \
  BETTER_AUTH_SECRET="$(openssl rand -hex 32)" \
  HOST="0.0.0.0" \
  PORT="3100" \
  SERVE_UI="true" \
  PAPERCLIP_MIGRATION_AUTO_APPLY="true"
```

Add your agent API key:

```bash
# For Claude Code agents
railway variables set ANTHROPIC_API_KEY="sk-ant-..."

# For Codex agents
railway variables set OPENAI_API_KEY="sk-..."
```

> **Note:** API keys are required for hosted deployments. OAuth/browser login flows only work on local machines.

## Step 4: Deploy

```bash
railway up --detach
```

Railway detects `Dockerfile.railway`, builds, and deploys. First build takes ~5 minutes.

## Step 5: Generate Public URL

```bash
railway domain --port 3100
```

This creates a `*.up.railway.app` URL. Set it as the public URL:

```bash
RAILWAY_URL="https://your-app-production.up.railway.app"  # Replace with your actual URL
railway variables set \
  PAPERCLIP_PUBLIC_URL="$RAILWAY_URL" \
  PAPERCLIP_AUTH_PUBLIC_BASE_URL="$RAILWAY_URL"
```

## Step 6: Create First Admin

Visit your Railway URL. You'll see "Instance setup required."

To create the first admin, you need to generate a bootstrap invite via the database. Get your Postgres public URL from Railway:

```bash
railway variables -s Postgres | grep DATABASE_PUBLIC_URL
```

Then create the invite (requires Node.js and `postgres` package):

```bash
npm install -g postgres  # if not already installed

node -e "
const { createHash, randomBytes } = require('crypto');
const pg = require('postgres');
const sql = pg('YOUR_DATABASE_PUBLIC_URL');  // Replace with your public URL
const token = 'pcp_bootstrap_' + randomBytes(24).toString('hex');
const hash = createHash('sha256').update(token).digest('hex');
const now = new Date();
const expires = new Date(now.getTime() + 72*60*60*1000);
sql\`INSERT INTO invites (invite_type, token_hash, allowed_join_types, expires_at, invited_by_user_id, created_at, updated_at)
  VALUES ('bootstrap_ceo', \${hash}, 'human', \${expires}, 'system', \${now}, \${now})\`
.then(() => { console.log('Visit: YOUR_RAILWAY_URL/invite/' + token); sql.end(); });
"
```

Open the printed URL in your browser to sign up as the first admin. The invite expires in 72 hours.

## Step 7: Configure Agents

After logging in, create or edit an agent and select an adapter:

- **Claude Code** - uses `ANTHROPIC_API_KEY`
- **Codex** - uses `OPENAI_API_KEY`
- **OpenClaw Gateway** - uses remote API

Make sure the corresponding API key is set as a Railway environment variable (Step 3).

## Custom Domain (Optional)

```bash
railway domain your-paperclip.example.com --port 3100
```

Add a CNAME record at your DNS provider pointing to your `*.up.railway.app` URL. Railway auto-provisions SSL.

```bash
railway variables set \
  PAPERCLIP_PUBLIC_URL="https://your-paperclip.example.com" \
  PAPERCLIP_AUTH_PUBLIC_BASE_URL="https://your-paperclip.example.com"
```

## Migrating Existing Data

If you have an existing local Paperclip instance with data you want to keep:

```bash
# 1. Dump from local embedded Postgres (default port 54329)
pg_dump --data-only --no-owner --no-privileges \
  -d "postgresql://paperclip:paperclip@127.0.0.1:54329/paperclip" \
  -Fc -f paperclip-data.dump

# 2. Get Railway Postgres public URL
railway variables -s Postgres | grep DATABASE_PUBLIC_URL

# 3. Restore to Railway
pg_restore --data-only --no-owner --no-privileges \
  -d "YOUR_DATABASE_PUBLIC_URL" \
  paperclip-data.dump
```

## Troubleshooting

### Build fails with "VOLUME banned in Dockerfiles"

Railway bans Docker `VOLUME` instructions. This is why the repo includes `Dockerfile.railway` which removes the `VOLUME` line. The `railway.toml` config points to it automatically.

### Build fails with "pnpm-lock.yaml is not up to date"

Run `pnpm install` locally to regenerate the lockfile, commit it, and redeploy.

### Build fails with "Cannot find module @paperclipai/plugin-sdk"

`Dockerfile.railway` includes the plugin-sdk build step. If you're using the standard `Dockerfile`, add `RUN pnpm --filter @paperclipai/plugin-sdk build` before the server build step.

### Agent fails with "401 Unauthorized"

Your agent adapter needs an API key set as a Railway environment variable. See Step 3.

### Health check fails after changing deployment mode

`local_trusted` mode only accepts loopback connections. Railway health checks come from external IPs. Always use `authenticated` mode for Railway deployments.

## Architecture Notes

Railway runs Paperclip as a persistent container, which means all features work out of the box:

- **Heartbeat scheduler** - runs as `setInterval`, triggers agent work
- **WebSocket server** - live UI updates work natively
- **Agent execution** - `child_process.spawn` works (Claude Code, Codex, etc.)
- **Plugin system** - worker processes via `child_process.fork` work
- **Embedded Postgres** - disabled when `DATABASE_URL` is set (Railway Postgres used instead)

This is why Railway (or similar container platforms) is recommended over serverless platforms like Vercel, which can't support persistent processes, WebSockets, or child process spawning.
