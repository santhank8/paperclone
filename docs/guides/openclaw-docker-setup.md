# 在 Docker 中运行 OpenClaw（本地开发）

如何在 Docker 容器中运行 OpenClaw，用于本地开发和测试 Paperclip OpenClaw 适配器集成。

## 自动化加入冒烟测试（推荐首先运行）

Paperclip 包含一个端到端加入冒烟测试工具：

```bash
pnpm smoke:openclaw-join
```

该工具自动化以下流程：

- 创建邀请（`allowedJoinTypes=agent`）
- OpenClaw 代理加入请求（`adapterType=openclaw`）
- 董事会批准
- 一次性 API 密钥领取（包括无效/重放领取检查）
- 向 Docker 化的 OpenClaw 风格 webhook 接收器发送唤醒回调

默认情况下，使用预配置的 Docker 接收器镜像（`docker/openclaw-smoke`），因此运行是确定性的，无需手动编辑 OpenClaw 配置。

权限说明：

- 该工具执行受董事会治理的操作（邀请创建、加入批准、新代理的唤醒）。
- 在认证模式下，需提供董事会/操作员认证，否则运行会提前退出并显示明确的权限错误。

## 一键 OpenClaw 网关 UI（手动 Docker 流程）

一条命令启动 Docker 中的 OpenClaw 并打印主机浏览器仪表盘 URL：

```bash
pnpm smoke:openclaw-docker-ui
```

默认行为是零标志：你可以直接运行该命令，无需任何配对相关的环境变量。

该命令执行的操作：

- 在 `/tmp/openclaw-docker` 中克隆/更新 `openclaw/openclaw`
- 构建 `openclaw:local`（除非设置 `OPENCLAW_BUILD=0`）
- 在 `~/.openclaw-paperclip-smoke/openclaw.json` 和 Docker `.env` 下写入隔离的冒烟测试配置
- 将代理模型默认值固定为 OpenAI（`openai/gpt-5.2`，使用 OpenAI 作为后备）
- 通过 Compose 启动 `openclaw-gateway`（包含所需的 `/tmp` tmpfs 覆盖）
- 探测并打印从 OpenClaw Docker 内部可访问的 Paperclip 主机 URL
- 等待健康检查并打印：
  - `http://127.0.0.1:18789/#token=...`
- 默认禁用 Control UI 设备配对，以方便本地冒烟测试

环境变量控制项：

- `OPENAI_API_KEY`（必需；从环境或 `~/.secrets` 加载）
- `OPENCLAW_DOCKER_DIR`（默认 `/tmp/openclaw-docker`）
- `OPENCLAW_GATEWAY_PORT`（默认 `18789`）
- `OPENCLAW_GATEWAY_TOKEN`（默认随机生成）
- `OPENCLAW_BUILD=0` 跳过重新构建
- `OPENCLAW_OPEN_BROWSER=1` 在 macOS 上自动打开 URL
- `OPENCLAW_DISABLE_DEVICE_AUTH=1`（默认）禁用 Control UI 设备配对以方便本地冒烟测试
- `OPENCLAW_DISABLE_DEVICE_AUTH=0` 保持配对启用（然后使用 `devices` CLI 命令批准浏览器）
- `OPENCLAW_MODEL_PRIMARY`（默认 `openai/gpt-5.2`）
- `OPENCLAW_MODEL_FALLBACK`（默认 `openai/gpt-5.2-chat-latest`）
- `OPENCLAW_CONFIG_DIR`（默认 `~/.openclaw-paperclip-smoke`）
- `OPENCLAW_RESET_STATE=1`（默认）在每次运行时重置冒烟测试代理状态，以避免过期的认证/会话偏移
- `PAPERCLIP_HOST_PORT`（默认 `3100`）
- `PAPERCLIP_HOST_FROM_CONTAINER`（默认 `host.docker.internal`）

### 认证模式

如果你的 Paperclip 部署处于 `authenticated` 模式，需提供认证上下文：

```bash
PAPERCLIP_AUTH_HEADER="Bearer <token>" pnpm smoke:openclaw-join
# or
PAPERCLIP_COOKIE="your_session_cookie=..." pnpm smoke:openclaw-join
```

### 网络拓扑提示

- 本地同主机冒烟测试：默认回调使用 `http://127.0.0.1:<port>/webhook`。
- 在 OpenClaw Docker 内部，`127.0.0.1` 指向容器本身，而非你的主机 Paperclip 服务器。
- 对于 OpenClaw Docker 内部使用的邀请/加入 URL，使用脚本打印的 Paperclip URL（通常是 `http://host.docker.internal:3100`）。
- 如果 Paperclip 因主机名错误拒绝容器可见的主机，从主机端允许它：

```bash
pnpm paperclipai allowed-hostname host.docker.internal
```

然后重启 Paperclip 并重新运行冒烟测试脚本。
- Docker/远程 OpenClaw：优先使用可达的主机名（Docker 主机别名、Tailscale 主机名或公共域名）。
- 认证/私有模式：在需要时确保主机名在允许列表中：

```bash
pnpm paperclipai allowed-hostname <host>
```

## 前提条件

- **Docker Desktop v29+**（支持 Docker Sandbox）
- **2 GB+ 内存** 可用于 Docker 镜像构建
- **API 密钥** 在 `~/.secrets` 中（至少需要 `OPENAI_API_KEY`）

## 方案 A：Docker Sandbox（推荐）

Docker Sandbox 提供更好的隔离（基于微虚拟机）和比 Docker Compose 更简单的设置。需要 Docker Desktop v29+ / Docker Sandbox v0.12+。

```bash
# 1. Clone the OpenClaw repo and build the image
git clone https://github.com/openclaw/openclaw.git /tmp/openclaw-docker
cd /tmp/openclaw-docker
docker build -t openclaw:local -f Dockerfile .

# 2. Create the sandbox using the built image
docker sandbox create --name openclaw -t openclaw:local shell ~/.openclaw/workspace

# 3. Allow network access to OpenAI API
docker sandbox network proxy openclaw \
  --allow-host api.openai.com \
  --allow-host localhost

# 4. Write the config inside the sandbox
docker sandbox exec openclaw sh -c '
mkdir -p /home/node/.openclaw/workspace /home/node/.openclaw/identity /home/node/.openclaw/credentials
cat > /home/node/.openclaw/openclaw.json << INNEREOF
{
  "gateway": {
    "mode": "local",
    "port": 18789,
    "bind": "loopback",
    "auth": {
      "mode": "token",
      "token": "sandbox-dev-token-12345"
    },
    "controlUi": { "enabled": true }
  },
  "agents": {
    "defaults": {
      "model": {
        "primary": "openai/gpt-5.2",
        "fallbacks": ["openai/gpt-5.2-chat-latest"]
      },
      "workspace": "/home/node/.openclaw/workspace"
    }
  }
}
INNEREOF
chmod 600 /home/node/.openclaw/openclaw.json
'

# 5. Start the gateway (pass your API key from ~/.secrets)
source ~/.secrets
docker sandbox exec -d \
  -e OPENAI_API_KEY="$OPENAI_API_KEY" \
  -w /app openclaw \
  node dist/index.js gateway --bind loopback --port 18789

# 6. Wait ~15 seconds, then verify
sleep 15
docker sandbox exec openclaw curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:18789/
# Should print: 200

# 7. Check status
docker sandbox exec -e OPENAI_API_KEY="$OPENAI_API_KEY" -w /app openclaw \
  node dist/index.js status
```

### Sandbox 管理

```bash
# List sandboxes
docker sandbox ls

# Shell into the sandbox
docker sandbox exec -it openclaw bash

# Stop the sandbox (preserves state)
docker sandbox stop openclaw

# Remove the sandbox
docker sandbox rm openclaw

# Check sandbox version
docker sandbox version
```

## 方案 B：Docker Compose（备选）

如果 Docker Sandbox 不可用（Docker Desktop < v29），使用此方案。

```bash
# 1. Clone the OpenClaw repo
git clone https://github.com/openclaw/openclaw.git /tmp/openclaw-docker
cd /tmp/openclaw-docker

# 2. Build the Docker image (~5-10 min on first run)
docker build -t openclaw:local -f Dockerfile .

# 3. Create config directories
mkdir -p ~/.openclaw/workspace ~/.openclaw/identity ~/.openclaw/credentials
chmod 700 ~/.openclaw ~/.openclaw/credentials

# 4. Generate a gateway token
export OPENCLAW_GATEWAY_TOKEN=$(openssl rand -hex 32)
echo "Your gateway token: $OPENCLAW_GATEWAY_TOKEN"

# 5. Create the config file
cat > ~/.openclaw/openclaw.json << EOF
{
  "gateway": {
    "mode": "local",
    "port": 18789,
    "bind": "lan",
    "auth": {
      "mode": "token",
      "token": "$OPENCLAW_GATEWAY_TOKEN"
    },
    "controlUi": {
      "enabled": true,
      "allowedOrigins": ["http://127.0.0.1:18789"]
    }
  },
  "env": {
    "OPENAI_API_KEY": "\${OPENAI_API_KEY}"
  },
  "agents": {
    "defaults": {
      "model": {
        "primary": "openai/gpt-5.2",
        "fallbacks": ["openai/gpt-5.2-chat-latest"]
      },
      "workspace": "/home/node/.openclaw/workspace"
    }
  }
}
EOF
chmod 600 ~/.openclaw/openclaw.json

# 6. Create the .env file (load API keys from ~/.secrets)
source ~/.secrets
cat > .env << EOF
OPENCLAW_CONFIG_DIR=$HOME/.openclaw
OPENCLAW_WORKSPACE_DIR=$HOME/.openclaw/workspace
OPENCLAW_GATEWAY_PORT=18789
OPENCLAW_BRIDGE_PORT=18790
OPENCLAW_GATEWAY_BIND=lan
OPENCLAW_GATEWAY_TOKEN=$OPENCLAW_GATEWAY_TOKEN
OPENCLAW_IMAGE=openclaw:local
OPENAI_API_KEY=$OPENAI_API_KEY
OPENCLAW_EXTRA_MOUNTS=
OPENCLAW_HOME_VOLUME=
OPENCLAW_DOCKER_APT_PACKAGES=
EOF

# 7. Add tmpfs to docker-compose.yml (required — see Known Issues)
# Add to BOTH openclaw-gateway and openclaw-cli services:
#   tmpfs:
#     - /tmp:exec,size=512M

# 8. Start the gateway
docker compose up -d openclaw-gateway

# 9. Wait ~15 seconds for startup, then get the dashboard URL
sleep 15
docker compose run --rm openclaw-cli dashboard --no-open
```

仪表盘 URL 格式如下：`http://127.0.0.1:18789/#token=<your-token>`

### Docker Compose 管理

```bash
cd /tmp/openclaw-docker

# Stop
docker compose down

# Start again (no rebuild needed)
docker compose up -d openclaw-gateway

# View logs
docker compose logs -f openclaw-gateway

# Check status
docker compose run --rm openclaw-cli status

# Get dashboard URL
docker compose run --rm openclaw-cli dashboard --no-open
```

## 已知问题和修复

### 启动容器时出现 "no space left on device"

Docker Desktop 的虚拟磁盘可能已满。

```bash
docker system df                   # check usage
docker system prune -f             # remove stopped containers, unused networks
docker image prune -f              # remove dangling images
```

### "Unable to create fallback OpenClaw temp dir: /tmp/openclaw-1000"（仅 Compose）

容器无法写入 `/tmp`。在 `docker-compose.yml` 中为**两个**服务添加 `tmpfs` 挂载：

```yaml
services:
  openclaw-gateway:
    tmpfs:
      - /tmp:exec,size=512M
  openclaw-cli:
    tmpfs:
      - /tmp:exec,size=512M
```

此问题不影响 Docker Sandbox 方案。

### 社区模板镜像中的 Node 版本不匹配

一些社区构建的 sandbox 模板（例如 `olegselajev241/openclaw-dmr:latest`）附带 Node 20，但 OpenClaw 要求 Node >=22.12.0。请使用我们本地构建的 `openclaw:local` 镜像作为 sandbox 模板，其中包含 Node 22。

### 网关启动后约 15 秒才会响应

Node.js 网关需要时间初始化。在访问 `http://127.0.0.1:18789/` 之前等待 15 秒。

### CLAUDE_AI_SESSION_KEY 警告（仅 Compose）

这些 Docker Compose 警告是无害的，可以忽略：
```
level=warning msg="The \"CLAUDE_AI_SESSION_KEY\" variable is not set. Defaulting to a blank string."
```

## 配置

配置文件：`~/.openclaw/openclaw.json`（JSON5 格式）

关键设置：
- `gateway.auth.token` — Web UI 和 API 的认证令牌
- `agents.defaults.model.primary` — AI 模型（使用 `openai/gpt-5.2` 或更新版本）
- `env.OPENAI_API_KEY` — 引用 `OPENAI_API_KEY` 环境变量（Compose 方案）

API 密钥存储在 `~/.secrets` 中，通过环境变量传递到容器中。

## 参考资料

- [OpenClaw Docker 文档](https://docs.openclaw.ai/install/docker)
- [OpenClaw 配置参考](https://docs.openclaw.ai/gateway/configuration-reference)
- [Docker 博客：在 Docker Sandbox 中安全运行 OpenClaw](https://www.docker.com/blog/run-openclaw-securely-in-docker-sandboxes/)
- [Docker Sandbox 文档](https://docs.docker.com/ai/sandboxes)
- [OpenAI 模型](https://platform.openai.com/docs/models) — 当前模型：gpt-5.2、gpt-5.2-chat-latest、gpt-5.2-pro
