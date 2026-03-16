---
name: server-operations
description: >
  Use when troubleshooting or configuring the Paperclip server, systemd
  service, deployment modes, Claude Code authentication, or SSH access.
  Also use when a Board operator or DevOps agent needs to perform server
  administration tasks. Do NOT use for application-level Paperclip tasks
  like creating issues or managing agents.
---

# Server Operations Playbook

## Paperclip Server on nucbuntu

The Paperclip control plane runs as a systemd service on nucbuntu
(Ubuntu, 124GB RAM, eth0: 192.168.20.184).

### Service Management
```bash
sudo systemctl start paperclip
sudo systemctl stop paperclip
sudo systemctl restart paperclip
systemctl status paperclip
journalctl -u paperclip -n 50 --no-pager
```

### Startup Timing

Embedded PostgreSQL takes 10-15 seconds to initialize. Always wait
before testing:
```bash
sudo systemctl restart paperclip
sleep 15
curl http://localhost:3100/api/health
```

A 5-second sleep is NOT enough. If health check fails after 15 seconds,
check the logs — do not just retry.

## Deployment Modes

### local_trusted (loopback only)

- Binds to 127.0.0.1 ONLY — will refuse to start with 0.0.0.0
- No authentication required
- Use for: local CLI work, SSH tunnel browser access

### authenticated + private (network accessible)

- Binds to 0.0.0.0
- Login required via Better Auth
- Use for: normal operation with remote browser access

### Switching Modes

Two places must agree — the config file AND the systemd unit:

Config file:
```bash
# Edit deployment mode and host
nano ~/.paperclip/instances/default/config.json
# "deploymentMode": "local_trusted" or "authenticated"
# "host": "127.0.0.1" or "0.0.0.0"
```

Systemd unit HOST override:
```bash
# Check current value
systemctl cat paperclip | grep HOST

# Override
sudo systemctl edit paperclip
# Add under [Service]:
# Environment=HOST=127.0.0.1   (for local_trusted)
# Environment=HOST=0.0.0.0     (for authenticated)
```

Then apply:
```bash
sudo systemctl daemon-reload
sudo systemctl restart paperclip
sleep 15
curl http://localhost:3100/api/health
```

CRITICAL: If config says local_trusted but systemd sets HOST=0.0.0.0,
the server will crash with "local_trusted mode requires loopback host
binding." Both must be consistent.

### Quick Switch to local_trusted (for maintenance)
```bash
sudo systemctl stop paperclip
sed -i 's/"deploymentMode": "authenticated"/"deploymentMode": "local_trusted"/' ~/.paperclip/instances/default/config.json
sed -i 's/"host": "0.0.0.0"/"host": "127.0.0.1"/' ~/.paperclip/instances/default/config.json
sudo systemctl edit paperclip
# Change HOST=0.0.0.0 to HOST=127.0.0.1
sudo systemctl daemon-reload
sudo systemctl start paperclip
sleep 15
curl http://localhost:3100/api/health
```

### Quick Switch back to authenticated
```bash
sudo systemctl stop paperclip
sed -i 's/"deploymentMode": "local_trusted"/"deploymentMode": "authenticated"/' ~/.paperclip/instances/default/config.json
sed -i 's/"host": "127.0.0.1"/"host": "0.0.0.0"/' ~/.paperclip/instances/default/config.json
sudo systemctl edit paperclip
# Change HOST=127.0.0.1 to HOST=0.0.0.0
sudo systemctl daemon-reload
sudo systemctl start paperclip
sleep 15
curl http://localhost:3100/api/health
```

## SSH Tunnel for Browser Access (local_trusted mode)

When the server is in local_trusted mode, access the web UI from a
remote desktop via SSH tunnel:

From the desktop:
```bash
ssh -L 3100:localhost:3100 transpara@nucbuntu
```

Then open http://localhost:3100 in the desktop browser (NOT
http://nucbuntu:3100 — that will fail because the server only listens
on loopback).

Keep the SSH session open while using the browser.

## Claude Code OAuth Authentication

Agents use Claude Code with a Claude Max subscription (no API keys).
OAuth tokens expire periodically and must be refreshed.

### Symptom

Agent runs fail with:
```
OAuth token has expired. Please obtain a new token or refresh your existing token.
```

### Fix: Transfer Credentials from Windows Desktop

OAuth login on a headless server often times out. Instead, authenticate
on a machine with a browser and copy credentials:

On Windows desktop (PowerShell):
```powershell
claude login
# Browser opens, authenticate normally
scp $env:USERPROFILE\.claude\.credentials.json transpara@nucbuntu:~/.claude/.credentials.json
```

On macOS/Linux desktop:
```bash
claude login
scp ~/.claude/.credentials.json transpara@nucbuntu:~/.claude/.credentials.json
```

Verify on the server:
```bash
claude "hello"
```

Then restart Paperclip so agents pick up the new credentials:
```bash
sudo systemctl restart paperclip
```

### Known Issue

Running /login directly on the headless server with code-paste flow
times out after 15 seconds even with valid network connectivity and a
correct code. The credential transfer workaround is reliable.

## Agent Budget Management

The CLI does not have an agent update command. Use the API directly:
```bash
# Bump budget
curl -s -X PATCH http://localhost:3100/api/agents/<AGENT_ID> \
  -H 'Content-Type: application/json' \
  -d '{"budgetMonthlyCents": 15000}'

# Resume a paused agent
curl -s -X POST http://localhost:3100/api/agents/<AGENT_ID>/resume

# Trigger a heartbeat manually
curl -s -X POST http://localhost:3100/api/agents/<AGENT_ID>/heartbeat/invoke
```

Note: Under Claude Max, spentMonthlyCents is phantom spend (token count
times price card). Actual cost is zero. Budget hard-stops still prevent
runaway execution.

## Data Locations

| Data | Path |
|------|------|
| Paperclip config | ~/.paperclip/instances/default/config.json |
| Embedded Postgres | ~/.paperclip/instances/default/db |
| Storage | ~/.paperclip/instances/default/data/storage |
| Backups | ~/.paperclip/instances/default/data/backups |
| Secrets key | ~/.paperclip/instances/default/secrets/master.key |
| Logs | ~/.paperclip/instances/default/logs |
| Agent workspaces | ~/.paperclip/instances/default/workspaces/<agent-id> |
| Claude credentials | ~/.claude/.credentials.json |

## Nuclear Reset (Development Only)

To wipe all Paperclip data and start fresh:
```bash
sudo systemctl stop paperclip
rm -rf ~/.paperclip/instances/default/db
sudo systemctl start paperclip
```

This destroys all companies, agents, issues, and history. Never do
this in a production context.
