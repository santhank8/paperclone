FROM node:lts-trixie-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl git \
  && rm -rf /var/lib/apt/lists/*

RUN npm install -g openclaw@2026.2.12 @betrue/openclaw-claude-code-plugin

# Create clawd user to match EC2 setup
RUN useradd -m -s /bin/bash clawd

ENV HOME=/home/clawd \
  PORT=18789

EXPOSE 18789

COPY <<'ENTRYPOINT' /entrypoint.sh
#!/bin/sh
# Fix ownership of volume data
chown -R clawd:clawd /home/clawd

exec su clawd -c "openclaw gateway --port 18789 --bind 0.0.0.0 --allow-unconfigured"
ENTRYPOINT
RUN chmod +x /entrypoint.sh

CMD ["/entrypoint.sh"]
