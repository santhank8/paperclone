# Intellitrade CRCA-Q + Paperclip

## Architecture (path A)

- **Paperclip** is the source of truth for heartbeat runs, audit, and (optional) issue comments.
- **Intellitrade** (`nextjs_space`) may call Paperclip REST to create issues or `POST /api/agents/:agentId/heartbeat/invoke` after webhooks—do not run `crca-q` in parallel on the same task unless you implement deduplication.

## Paperclip agent setup

1. Install the runner: `pip install -e Intellitrade-CRCA/crca_q` (and CR-CA deps from `CR-CA/requirements.txt` for full signals).
2. Create an agent with adapter type **`process`**.
3. Example `adapterConfig`:

```json
{
  "command": "crca-q",
  "args": ["run", "--json"],
  "cwd": "/absolute/path/to/Intellitrade-CRCA",
  "timeoutSec": 900,
  "env": {}
}
```

4. Optional: set `CRCA_Q_EXECUTION_MODE` in `env` to `disabled` (default if unset in runner), `paper`, or `live`.

## Injected environment

On each heartbeat, Paperclip sets:

| Variable | Purpose |
|----------|---------|
| `PAPERCLIP_CONTEXT_JSON` | `companyId`, `agentId`, `heartbeatRunId`, merged `contextSnapshot` (`issueId`, `wakeReason`, …) |
| `PAPERCLIP_AGENT_JWT` | JWT for `Authorization: Bearer` on `/api/issues/:id/comments` during this run |
| `PAPERCLIP_API_URL` | API base (e.g. `http://localhost:3100`) |
| `PAPERCLIP_AGENT_ID` / `PAPERCLIP_COMPANY_ID` | Legacy helpers |

## Intellitrade → Paperclip

From Next.js or server actions:

1. `POST /api/companies/:companyId/issues` (board session) to open a task.
2. `POST /api/agents/:agentId/heartbeat/invoke` (board or agent key per policy) with payload that includes `issueId` in context so `PAPERCLIP_CONTEXT_JSON` carries it.
3. Runner posts a summary comment when `issueId` + JWT + API URL are present.

## Execution modes

| Mode | Behavior |
|------|----------|
| `disabled` | Demo market data; no live trading |
| `paper` | Historical/live data path without `live_trading_mode` (exchange dry-run) |
| `live` | Real orders if API keys are configured—use only with explicit governance |
