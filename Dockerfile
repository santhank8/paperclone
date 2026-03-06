FROM node:20-bookworm-slim
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl git \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable

# Create the data volume directory
RUN mkdir -p /paperclip && chown -R node:node /paperclip

# Set up the application directory and ensure the node user owns it
WORKDIR /app
RUN chown -R node:node /app

# Copy package files first
COPY --chown=node:node package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY --chown=node:node cli/package.json cli/
COPY --chown=node:node server/package.json server/
COPY --chown=node:node ui/package.json ui/
COPY --chown=node:node packages/shared/package.json packages/shared/
COPY --chown=node:node packages/db/package.json packages/db/
COPY --chown=node:node packages/adapter-utils/package.json packages/adapter-utils/
COPY --chown=node:node packages/adapters/claude-local/package.json packages/adapters/claude-local/
COPY --chown=node:node packages/adapters/codex-local/package.json packages/adapters/codex-local/
COPY --chown=node:node packages/adapters/cursor-local/package.json packages/adapters/cursor-local/
COPY --chown=node:node packages/adapters/openclaw/package.json packages/adapters/openclaw/
COPY --chown=node:node packages/adapters/opencode-local/package.json packages/adapters/opencode-local/

# Install global tools as root
RUN npm install --global --omit=dev @anthropic-ai/claude-code@latest @openai/codex@latest

# Switch to non-root user
USER node

# Install dependencies
RUN pnpm install --no-frozen-lockfile

# Copy the rest of the source code
COPY --chown=node:node . .

# Build the project
RUN pnpm build

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

# Use the workspace start script
CMD ["pnpm", "--filter", "@paperclipai/server", "start"]
