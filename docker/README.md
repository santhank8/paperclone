# Docker

Run Paperclip in containers without installing Node or pnpm locally.

All commands below assume you are in the **project root** (the directory containing `package.json`), not inside `docker/`.

## Building the image

```sh
docker build -t paperclip-local -f docker/Dockerfile .
```

The Dockerfile installs common agent tools (`git`, `gh`, `curl`, `wget`, `ripgrep`, `python3`) and the Claude, Codex, and OpenCode CLIs.

Build arguments:

| Arg | Default | Purpose |
|-----|---------|---------|
| `USER_UID` | `1000` | UID for the container `node` user (match your host UID to avoid permission issues on bind mounts) |
| `USER_GID` | `1000` | GID for the container `node` group |

```sh
docker build -t paperclip-local -f docker/Dockerfile \
  --build-arg USER_UID=$(id -u) --build-arg USER_GID=$(id -g) .
```

## Docker Compose

### Quickstart (embedded SQLite)

Single container, no external database. Data persists via a bind mount.

```sh
BETTER_AUTH_SECRET=$(openssl rand -hex 32) \
  docker compose -f docker/docker-compose.quickstart.yml up --build
```

Overrides:

```sh
PAPERCLIP_PORT=3200 \
PAPERCLIP_DATA_DIR=../data/pc \
BETTER_AUTH_SECRET=<your-secret> \
  docker compose -f docker/docker-compose.quickstart.yml up --build
```

Pass `OPENAI_API_KEY` and/or `ANTHROPIC_API_KEY` to enable local adapter runs.

### Full stack (with PostgreSQL)

Paperclip server + PostgreSQL 17. The database is health-checked before the server starts.

```sh
BETTER_AUTH_SECRET=$(openssl rand -hex 32) \
  docker compose -f docker/docker-compose.yml up --build
```

PostgreSQL data persists in a named Docker volume (`pgdata`). Paperclip data persists in `paperclip-data`.

### Untrusted PR review

Isolated container for reviewing untrusted pull requests with Codex or Claude, without exposing your host machine. See `doc/UNTRUSTED-PR-REVIEW.md` for the full workflow.

```sh
docker compose -f docker/docker-compose.untrusted-review.yml build
docker compose -f docker/docker-compose.untrusted-review.yml run --rm --service-ports review
```

## Manual Docker run

```sh
docker run --name paperclip \
  -p 3100:3100 \
  -e HOST=0.0.0.0 \
  -e PAPERCLIP_HOME=/paperclip \
  -e BETTER_AUTH_SECRET=$(openssl rand -hex 32) \
  -v "$(pwd)/data/docker-paperclip:/paperclip" \
  paperclip-local
```

Open [http://localhost:3100](http://localhost:3100).

## Podman Quadlet (systemd)

The `quadlet/` directory contains unit files to run Paperclip + PostgreSQL as systemd services via Podman Quadlet.

| File | Purpose |
|------|---------|
| `quadlet/paperclip.pod` | Pod definition — groups containers into a shared network namespace |
| `quadlet/paperclip.container` | Paperclip server — joins the pod, connects to Postgres at `127.0.0.1` |
| `quadlet/paperclip-db.container` | PostgreSQL 17 — joins the pod, health-checked |

### Setup

1. Build the image (see above).

2. Copy quadlet files to your systemd directory:

   ```sh
   # Rootless (recommended)
   cp docker/quadlet/*.pod docker/quadlet/*.container \
     ~/.config/containers/systemd/

   # Or rootful
   sudo cp docker/quadlet/*.pod docker/quadlet/*.container \
     /etc/containers/systemd/
   ```

3. Create a secrets env file (keep out of version control):

   ```sh
   cat > ~/.config/containers/systemd/paperclip.env <<EOL
   BETTER_AUTH_SECRET=$(openssl rand -hex 32)
   POSTGRES_USER=paperclip
   POSTGRES_PASSWORD=paperclip
   POSTGRES_DB=paperclip
   DATABASE_URL=postgres://paperclip:paperclip@127.0.0.1:5432/paperclip
   # OPENAI_API_KEY=sk-...
   # ANTHROPIC_API_KEY=sk-...
   EOL
   ```

4. Create the data directory and start:

   ```sh
   mkdir -p ~/.local/share/paperclip
   systemctl --user daemon-reload
   systemctl --user start paperclip-pod
   ```

### Quadlet management

```sh
journalctl --user -u paperclip -f        # App logs
journalctl --user -u paperclip-db -f     # DB logs
systemctl --user status paperclip-pod    # Pod status
systemctl --user restart paperclip-pod   # Restart all
systemctl --user stop paperclip-pod      # Stop all
```

## Notes

- Containers in a pod share `localhost`, so Paperclip reaches Postgres at `127.0.0.1:5432`.
- PostgreSQL data persists in the `paperclip-pgdata` named volume.
- Paperclip data persists at `~/.local/share/paperclip` (quadlet) or via Docker volumes/bind mounts (compose).
- For rootful quadlet deployment, remove `%h` prefixes and use absolute paths.
- The `docker-entrypoint.sh` adjusts the container `node` user UID/GID at startup to match the values passed via `USER_UID`/`USER_GID`, avoiding permission issues on bind-mounted volumes.
