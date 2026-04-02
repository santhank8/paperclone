#!/bin/sh
set -e

# Capture runtime UID/GID from environment variables, defaulting to 1000
PUID=${USER_UID:-1000}
PGID=${USER_GID:-1000}

# Adjust the node user's UID/GID if they differ from the runtime request
if [ "$(id -u node)" -ne "$PUID" ]; then
    echo "Updating node UID to $PUID"
    usermod -o -u "$PUID" node
fi

if [ "$(id -g node)" -ne "$PGID" ]; then
    echo "Updating node GID to $PGID"
    groupmod -o -g "$PGID" node
    usermod -g "$PGID" node
fi

# Fix ownership where possible (NFS mounts may reject chown — that's OK)
chown -R node:node /paperclip 2>/dev/null || true

# --- SSH server setup ---
# Host keys and sshd config go in /etc/ssh (local to container, not NFS)
# Authorized keys read from /paperclip/.ssh/ (NFS volume, pre-seeded by operator)
mkdir -p /run/sshd

# Generate host keys if missing (stored locally in container, regenerated on rebuild)
if [ ! -f /etc/ssh/ssh_host_ed25519_key ]; then
    echo "Generating SSH host keys..."
    ssh-keygen -t ed25519 -f /etc/ssh/ssh_host_ed25519_key -N "" -q
    ssh-keygen -t rsa -b 4096 -f /etc/ssh/ssh_host_rsa_key -N "" -q
fi

# Ensure authorized_keys exists on volume (may already be pre-seeded)
mkdir -p /paperclip/.ssh 2>/dev/null || true
touch /paperclip/.ssh/authorized_keys 2>/dev/null || true
chmod 600 /paperclip/.ssh/authorized_keys 2>/dev/null || true

# Configure sshd
cat > /etc/ssh/sshd_config.d/paperclip.conf << SSHCONF
Port 2222
AuthorizedKeysFile /paperclip/.ssh/authorized_keys
PermitRootLogin no
AllowUsers node
PasswordAuthentication no
PrintMotd no
AcceptEnv LANG LC_* PAPERCLIP_* CLAUDE_* ANTHROPIC_* OPENAI_* GITHUB_*
SSHCONF

# Set node user shell to bash
usermod -s /bin/bash node 2>/dev/null || true

# Start sshd in background
/usr/sbin/sshd -e 2>&1 &
echo "SSH server started on port 2222"

exec gosu node "$@"
