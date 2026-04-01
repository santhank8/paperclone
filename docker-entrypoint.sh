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

# Always ensure /paperclip is owned by node — Docker named volumes may
# be initialised as root even when the UID/GID has not changed.
chown -R node:node /paperclip

# ── Claude config bootstrap ──────────────────────────────────────────
# Claude CLI needs a WRITABLE config directory for sessions, analytics,
# and settings. The shared credentials volume from claude-code-docker is
# mounted read-only at /claude-config-shared. We copy credentials into a
# writable directory so Claude can both read creds and write runtime data.
CLAUDE_WRITABLE="${CLAUDE_CONFIG_DIR:-/paperclip/.claude-config}"
mkdir -p "$CLAUDE_WRITABLE"
chown node:node "$CLAUDE_WRITABLE"

if [ -d /claude-config-shared ]; then
    for f in /claude-config-shared/.credentials.json \
             /claude-config-shared/settings.json \
             /claude-config-shared/statsig.json; do
        if [ -f "$f" ]; then
            cp -a "$f" "$CLAUDE_WRITABLE/" 2>/dev/null || true
            chown node:node "$CLAUDE_WRITABLE/$(basename "$f")" 2>/dev/null || true
        fi
    done
    echo "Claude config: copied credentials from shared volume to $CLAUDE_WRITABLE"
else
    echo "Claude config: no shared volume at /claude-config-shared (using API key or built-in claude)"
fi

exec gosu node "$@"
