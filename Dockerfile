FROM node:lts-trixie-slim

# System dependencies
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl git jq procps python3 python3-pip \
  && curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
       -o /usr/share/keyrings/githubcli-archive-keyring.gpg \
  && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
       > /etc/apt/sources.list.d/github-cli.list \
  && apt-get update \
  && apt-get install -y --no-install-recommends gh \
  && rm -rf /var/lib/apt/lists/* \
  && curl -fsSL "https://dl.k8s.io/release/$(curl -fsSL https://dl.k8s.io/release/stable.txt)/bin/linux/$(dpkg --print-architecture)/kubectl" \
       -o /usr/local/bin/kubectl \
  && chmod +x /usr/local/bin/kubectl \
  && curl -LsSf https://astral.sh/uv/install.sh | sh \
  && mv /root/.local/bin/uv /usr/local/bin/uv \
  && mv /root/.local/bin/uvx /usr/local/bin/uvx

# Paperclip server + CLI from npm (stable release)
ARG PAPERCLIP_VERSION=2026.318.0
WORKDIR /app
RUN npm install --omit=dev \
      @paperclipai/server@${PAPERCLIP_VERSION} \
      paperclipai@${PAPERCLIP_VERSION} \
  && npm install --global --omit=dev \
      paperclipai@${PAPERCLIP_VERSION} \
      @anthropic-ai/claude-code@latest \
      @openai/codex@latest \
      opencode-ai \
      @google/gemini-cli \
  && mkdir -p /paperclip \
  && chown node:node /paperclip

ENV NODE_ENV=production \
  HOME=/paperclip \
  HOST=0.0.0.0 \
  PORT=3100 \
  SERVE_UI=true \
  PAPERCLIP_HOME=/paperclip \
  PAPERCLIP_INSTANCE_ID=default \
  PAPERCLIP_CONFIG=/paperclip/instances/default/config.json \
  PAPERCLIP_DEPLOYMENT_MODE=authenticated \
  PAPERCLIP_DEPLOYMENT_EXPOSURE=private

VOLUME ["/paperclip"]
EXPOSE 3100

USER node
CMD ["node", "node_modules/@paperclipai/server/dist/index.js"]
