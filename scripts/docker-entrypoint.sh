#!/bin/sh
set -e

# Capture runtime UID/GID from environment variables, defaulting to 1000
PUID=${USER_UID:-1000}
PGID=${USER_GID:-1000}

# Adjust the node user's UID/GID if they differ from the runtime request
# and fix volume ownership only when a remap is needed
changed=0

if [ "$(id -u node)" -ne "$PUID" ]; then
    echo "Updating node UID to $PUID"
    usermod -o -u "$PUID" node
    changed=1
fi

if [ "$(id -g node)" -ne "$PGID" ]; then
    echo "Updating node GID to $PGID"
    groupmod -o -g "$PGID" node
    usermod -g "$PGID" node
    changed=1
fi

if [ "$changed" = "1" ]; then
    chown -R node:node /paperclip
fi

# OpenCode persists cache and sqlite state under /paperclip. If those paths are
# ever touched as root (for example by maintenance execs), later headless runs
# as node fail with SQLite WAL and cache permission errors. Repair the specific
# OpenCode paths on every boot without recursively chowning the whole volume.
mkdir -p /paperclip/.cache/opencode /paperclip/.local/share/opencode
chown -R node:node /paperclip/.cache/opencode /paperclip/.local/share/opencode

exec gosu node "$@"
