FROM node:lts-trixie-slim AS base
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl git locales \
  && sed -i '/^# *en_US.UTF-8 UTF-8/s/^# *//' /etc/locale.gen \
  && locale-gen en_US.UTF-8 \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable
ENV LANG=en_US.UTF-8 \
    LC_ALL=en_US.UTF-8

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY cli/package.json cli/
COPY server/package.json server/
COPY ui/package.json ui/
COPY packages/shared/package.json packages/shared/
COPY packages/db/package.json packages/db/
COPY packages/adapter-utils/package.json packages/adapter-utils/
COPY packages/adapters/claude-local/package.json packages/adapters/claude-local/
COPY packages/adapters/codex-local/package.json packages/adapters/codex-local/
COPY packages/adapters/cursor-local/package.json packages/adapters/cursor-local/
COPY packages/adapters/openclaw-gateway/package.json packages/adapters/openclaw-gateway/
COPY packages/adapters/opencode-local/package.json packages/adapters/opencode-local/
COPY packages/adapters/pi-local/package.json packages/adapters/pi-local/

RUN pnpm install --frozen-lockfile

FROM base AS build
WORKDIR /app
COPY --from=deps /app /app
COPY . .
RUN pnpm --filter @paperclipai/ui build
RUN pnpm --filter @paperclipai/server build
RUN test -f server/dist/index.js || (echo "ERROR: server build output missing" && exit 1)

FROM base AS production
WORKDIR /app
COPY --chown=node:node --from=build /app /app
RUN arch="$(dpkg --print-architecture)" \
  && codex_vendor_bin='' \
  && case "$arch" in \
    amd64) codex_pkg='@openai/codex@linux-x64'; codex_vendor_bin='/usr/local/lib/node_modules/@openai/codex/vendor/x86_64-unknown-linux-musl/codex/codex' ;; \
    arm64) codex_pkg='@openai/codex@linux-arm64'; codex_vendor_bin='/usr/local/lib/node_modules/@openai/codex/vendor/aarch64-unknown-linux-musl/codex/codex' ;; \
    *) codex_pkg='@openai/codex@latest' ;; \
  esac \
  && if ! id postgres >/dev/null 2>&1; then adduser --system --group --home /var/lib/postgresql postgres; fi \
  && npm install --global --omit=dev @anthropic-ai/claude-code@latest "$codex_pkg" opencode-ai \
  && if [ -n "$codex_vendor_bin" ] && [ -f "$codex_vendor_bin" ]; then ln -sf "$codex_vendor_bin" /usr/local/bin/codex; fi \
  && mkdir -p /paperclip \
  && chown node:node /paperclip

ENV NODE_ENV=production \
  HOME=/paperclip \
  HOST=0.0.0.0 \
  PORT=3100 \
  SERVE_UI=true \
  PAPERCLIP_IN_CONTAINER=true \
  PAPERCLIP_HOME=/paperclip \
  PAPERCLIP_INSTANCE_ID=default \
  PAPERCLIP_CONFIG=/paperclip/instances/default/config.json \
  PAPERCLIP_DEPLOYMENT_MODE=authenticated \
  PAPERCLIP_DEPLOYMENT_EXPOSURE=private

USER node

VOLUME ["/paperclip"]
EXPOSE 3100

USER node
CMD ["node", "--import", "./server/node_modules/tsx/dist/loader.mjs", "server/dist/index.js"]
