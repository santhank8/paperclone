# Local Always-On Content Marketing Runbook

This runbook is for the current MacBook setup that runs Paperclip as a local-first, always-on content and marketing company.

## What is already set up

- Paperclip UI: `http://127.0.0.1:3100`
- Health check: `http://127.0.0.1:3100/api/health`
- Runtime mode: `local_trusted`
- Exposure: `private`
- Database: embedded PostgreSQL
- Storage: local disk
- Secrets: local encrypted
- App launcher: `~/Applications/Chrome Apps.localized/Paperclip.app`
- LaunchAgent: `~/Library/LaunchAgents/com.kevin.paperclip.server.plist`

## Daily start

Use the app first:

1. Click `Paperclip.app`
2. Wait for the UI to open
3. If the server is already healthy, the UI opens immediately
4. If the server is stopped, the app starts it in the background and then opens the UI

If you want the terminal fallback, use:

```sh
cd /Users/kevin/codex/projects/paperclip
env -u DATABASE_URL pnpm paperclipai run
```

The app launcher now prefers the LaunchAgent-managed service and only falls back to direct startup if the LaunchAgent is missing.

## Daily stop

Use the runtime stop helper:

```sh
cd /Users/kevin/codex/projects/paperclip
./scripts/paperclip-runtime-stop.sh
```

## Health check

Use this when you want a quick yes/no status:

```sh
curl -sS http://127.0.0.1:3100/api/health
```

Expected shape:

```json
{"status":"ok"}
```

For a fuller operator view:

```sh
cd /Users/kevin/codex/projects/paperclip
./scripts/paperclip-runtime-status.sh
```

## LaunchAgent install

Install the macOS login-time service:

```sh
cd /Users/kevin/codex/projects/paperclip
./scripts/install-paperclip-launchagent.sh
```

Remove it:

```sh
cd /Users/kevin/codex/projects/paperclip
./scripts/uninstall-paperclip-launchagent.sh
```

## Backup and restore

Automatic backups are already enabled.

Manual backup:

```sh
cd /Users/kevin/codex/projects/paperclip
env -u DATABASE_URL pnpm paperclipai db:backup
```

Backup location:

```text
~/.paperclip/instances/default/data/backups
```

If you ever need a full reset, the dangerous path is:

```sh
rm -rf ~/.paperclip/instances/default/db
```

Only do this after a backup and only if you really intend to rebuild the local database from scratch.

## Codex reauth

Use this when Codex stops responding or the CLI session is no longer logged in:

```sh
codex login status
```

If it reports a signed-out or broken state, re-run the Codex CLI login flow in Terminal, then re-test the Growth and Analytics lanes.

## Gemini fallback

Gemini is used for CEO strategy and visual-review style work, but it may hit quota limits.

Watch for these signs:

- `gemini_hello_probe_quota_exhausted`
- repeated `429` responses
- heartbeat runs that end in `error`

If that happens:

1. Pause Gemini-driven heartbeats
2. Keep the company running on Codex-backed roles
3. Re-check Google API usage and quota
4. Resume Gemini only after the account is healthy again

If visual work is needed while Gemini is blocked, keep the work as a brief and route execution through the Codex roles until quota recovers.

This runbook assumes a staged rollout. The manifest keeps timer heartbeats disabled by default, and the enable script turns on only the configured stage.

Pilot stage:

```sh
cd /Users/kevin/codex/projects/paperclip
node scripts/enable-content-marketing-heartbeats.mjs pilot
```

Steady stage:

```sh
cd /Users/kevin/codex/projects/paperclip
node scripts/enable-content-marketing-heartbeats.mjs steady
```

Disable all timer heartbeats again:

```sh
cd /Users/kevin/codex/projects/paperclip
node scripts/disable-content-marketing-heartbeats.mjs
```

## Operational notes

- The current app launcher is a custom macOS app that opens `http://127.0.0.1:3100/` and starts Paperclip when needed.
- The app now prefers LaunchAgent-managed startup so Finder launches are less sensitive to GUI `PATH` differences.
- A LaunchAgent template and install script are included for login-time auto-start.
- The fixed local port is `3100`.
- The fixed home directory is `~/.paperclip/instances/default`.
- The company bootstrap and smoke outputs live under `report/`.

## Before and after

Before this runbook:

- The setup worked, but the operator had to remember the exact start and recovery steps.
- Gemini quota fallback and Codex reauth were not written down as a simple operator flow.

After this runbook:

- Start, health check, backup, restore, Codex reauth, and Gemini fallback are all in one place.
- The app launcher, LaunchAgent, and Terminal fallback are all documented.
- Recovery steps are explicit enough for a non-expert operator to follow.
- The staged nature of heartbeat automation is also documented, so operators know what is and is not yet fully autonomous.
