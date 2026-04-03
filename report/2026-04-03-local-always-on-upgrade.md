# Local Always-On Upgrade Report

Date: 2026-04-03

## Scope

- Convert Paperclip from app-assisted local startup into a more reliable always-on local service
- Add operational control and staged heartbeat governance for the content marketing company
- Leave the deployment mode as `local_trusted` and `private`

## Before

- Paperclip UI was available at `http://127.0.0.1:3100`, but availability depended on a manually started server process.
- `Paperclip.app` existed, but it behaved like a launcher shortcut more than a managed service path.
- There was no installed macOS `LaunchAgent` for login-time auto-start and keepalive.
- There was no dedicated Codex-based operations controller role inside the company.
- Heartbeat automation was either off or manually managed without staged rollout controls.
- Smoke verification had drift risk because terminal run states had changed.
- Startup, stop, health, fallback, and recovery steps were not fully consolidated around a managed runtime path.

## After

- A launchd-managed runtime path is installed at `~/Library/LaunchAgents/com.kevin.paperclip.server.plist`.
- The repo now includes start/stop/status/install/uninstall helpers:
  - `scripts/paperclip-runtime-launch.sh`
  - `scripts/paperclip-runtime-start.sh`
  - `scripts/paperclip-runtime-stop.sh`
  - `scripts/paperclip-runtime-status.sh`
  - `scripts/paperclip-runtime-healthcheck.sh`
  - `scripts/install-paperclip-launchagent.sh`
  - `scripts/uninstall-paperclip-launchagent.sh`
- `Paperclip.app` now prefers LaunchAgent-managed startup and only falls back to direct launch if the LaunchAgent is missing.
- The content marketing company now includes an `Operations Controller` Codex lane plus an `운영 통제` project and `ops-control-loop` issue.
- Staged automation is now declared in the manifest:
  - `manual`
  - `pilot`
  - `steady`
- A pilot heartbeat stage was applied so `ops`, `growth`, and `analytics` can run on timers while `CEO/Gemini` remains off-timer.
- A rollback helper now exists for heartbeat timers:
  - `scripts/disable-content-marketing-heartbeats.mjs`
- The operator runbook now documents:
  - app launch
  - LaunchAgent install/remove
  - start/stop/status
  - backup/restore
  - Codex reauth
  - Gemini quota fallback
  - staged heartbeat rollout

## Verified outcomes

- `curl http://127.0.0.1:3100/api/health` returned `ok` after LaunchAgent install.
- `launchctl print gui/$UID/com.kevin.paperclip.server` showed the LaunchAgent in `state = running`.
- `node scripts/bootstrap-content-marketing-company.mjs` succeeded after adding the operations lane.
- `node scripts/enable-content-marketing-heartbeats.mjs --stage pilot` enabled:
  - `ops`
  - `growth`
  - `analytics`
- A stop/start validation completed successfully:
  - stop service
  - restart service
  - health endpoint returned `ok`

## Remaining known limitations

- `gemini_local` remains configuration-ready but quota-limited in the current account/key state.
- This is now a strong staged always-on foundation, not a claim that every lane is safe for unattended autopilot.
- Full public or multi-user authenticated deployment is still out of scope.

## Rollback

- Disable heartbeat timers:
  - `node scripts/disable-content-marketing-heartbeats.mjs`
- Remove login-time service:
  - `./scripts/uninstall-paperclip-launchagent.sh`
- Stop the local runtime:
  - `./scripts/paperclip-runtime-stop.sh`
