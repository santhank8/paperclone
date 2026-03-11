# Paperclip Ops (Local + Quick Server)

This setup keeps runtime state inside this repo, not in `~/Documents/PaperClipMain`.

## Paths

- Runtime root: `./.paperclip-local` (ignored by git)
- Runtime env file: `./.paperclip-local/instances/default/.env`
- Docker compose env file: `./.paperclip-local/docker-compose.env`
- Agent role templates (source only): `./ops/templates/agents/*.md`

`./.paperclip-local` is the canonical local Paperclip home for this repo.
If you also have a legacy `~/.paperclip`, treat it as a backup/quarantine copy only.
Do not run day-to-day local or Docker workflows against two different Paperclip homes on the same machine.

`ops/local/*` is not a second Paperclip installation.
These scripts are the safe wrappers that force this repo to use `./.paperclip-local` as:

- `PAPERCLIP_HOME`
- config root
- embedded PostgreSQL data dir
- logs, secrets, workspaces, and agent runtime state

Instruction-path rule for this repo:

- runtime-canonical agent instructions live at `./agents/<slug>/AGENTS.md`
- `./ops/templates/agents/*.md` are templates/source material, not the primary runtime path
- if you refresh a template, sync it intentionally into `agents/<slug>/AGENTS.md`

## Local Run (fast)

From repo root:

```bash
./ops/local/run.sh
```

For live local development with the repo-scoped runtime home:

```bash
./ops/local/dev.sh
```

Use CLI:

```bash
./ops/local/cli.sh issue list
./ops/local/cli.sh agent list -C 7334f5e0-4b0c-4d50-a96b-afe10c64b0fe
```

## Keys and Secrets

Edit:

```bash
./.paperclip-local/instances/default/.env
```

Add only if needed:

```bash
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
```

Or use the helper (visible input while typing):

```bash
./ops/local/set-secrets.sh
```

The helper fails fast if a key does not match the expected provider format.

Notes:

- Claude can run via `claude auth login` without `ANTHROPIC_API_KEY`.
- Codex can run via `codex login` without `OPENAI_API_KEY`.

## External PostgreSQL (optional)

`pnpm dev` uses embedded PostgreSQL only when `DATABASE_URL` is not set.

If you want local dev to use an external Postgres instead of the embedded one,
add `DATABASE_URL` to:

```bash
./.paperclip-local/instances/default/.env
```

Example:

```bash
DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/paperclip
```

Then run:

```bash
./ops/local/dev.sh
```

This wrapper loads `PAPERCLIP_HOME`, `PAPERCLIP_CONFIG`, and the repo-local
`.env` file first, so local dev uses `./.paperclip-local` instead of drifting
back to `/paperclip/...` defaults.

## Quick Server Deploy (Docker)

One command (asks for secrets, stores locally, validates values, and boots compose):

```bash
./bootstrap-docker.sh
```

When authenticated mode starts with no instance admin yet, the script now generates the first bootstrap CEO invite automatically. In interactive mode it also opens that invite URL in your browser, so the Docker quickstart is a true one-click setup flow.

Persisted local files used by this flow:

- `./.paperclip-local/instances/default/.env` for provider keys
- `./.paperclip-local/docker-compose.env` for Docker compose settings such as `BETTER_AUTH_SECRET`, port, public URL, and data dir
- Docker quickstart should point `PAPERCLIP_DATA_DIR` at `./.paperclip-local` so local scripts and Docker read the same instance state
- Docker quickstart should also mount that same path as `PAPERCLIP_HOME_IN_CONTAINER` so absolute paths stored in the repo-local config keep working inside the container
- Docker quickstart should mount the repo root and project workspaces at the same absolute host paths inside the container when agent configs use absolute `cwd` or `instructionsFilePath` values

If Docker is installed but its daemon is not running, the bootstrap script now offers to start an available runtime first (for example Docker Desktop, OrbStack, Colima, or Podman) and then continues with the normal prompts.

Action modes (switch/case):

```bash
./bootstrap-docker.sh up
./bootstrap-docker.sh restart
./bootstrap-docker.sh status
./bootstrap-docker.sh logs
./bootstrap-docker.sh down
```

Useful flags:

```bash
./bootstrap-docker.sh up --no-build
./bootstrap-docker.sh up -y --port 3200 --public-url http://localhost:3200
./bootstrap-docker.sh logs --no-tail
```

On a server with Docker (manual mode):

```bash
git clone https://github.com/paperclipai/paperclip.git
cd paperclip
docker compose -f docker-compose.yml up --build -d
```

Optional env overrides:

```bash
PAPERCLIP_PORT=3100 PAPERCLIP_DATA_DIR=./.paperclip-local docker compose -f docker-compose.yml up --build -d
```

For container-based key auth, pass env vars in compose or docker run (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`).

Operational rule:

- `./ops/local/dev.sh` and `./ops/local/run.sh` use `./.paperclip-local`
- Docker quickstart should use that same `./.paperclip-local`
- keep `~/.paperclip` stopped unless you are explicitly doing recovery work
