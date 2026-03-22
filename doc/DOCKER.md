# Docker 快速启动

在 Docker 中运行 Paperclip，无需在本地安装 Node 或 pnpm。

## 一行命令（构建 + 运行）

```sh
docker build -t paperclip-local . && \
docker run --name paperclip \
  -p 3100:3100 \
  -e HOST=0.0.0.0 \
  -e PAPERCLIP_HOME=/paperclip \
  -v "$(pwd)/data/docker-paperclip:/paperclip" \
  paperclip-local
```

打开：`http://localhost:3100`

数据持久化：

- 嵌入式 PostgreSQL 数据
- 上传的资产
- 本地密钥文件
- 本地智能体工作区数据

全部持久化在你的绑定挂载目录下（上面示例中的 `./data/docker-paperclip`）。

## Compose 快速启动

```sh
docker compose -f docker-compose.quickstart.yml up --build
```

默认值：

- 主机端口：`3100`
- 持久化数据目录：`./data/docker-paperclip`

可选覆盖：

```sh
PAPERCLIP_PORT=3200 PAPERCLIP_DATA_DIR=./data/pc docker compose -f docker-compose.quickstart.yml up --build
```

如果你更改了主机端口或使用非本地域名，请将 `PAPERCLIP_PUBLIC_URL` 设置为你将在浏览器/认证流程中使用的外部 URL。

## 认证 Compose（单一公共 URL）

对于认证部署，设置一个规范公共 URL 并让 Paperclip 推导认证/回调默认值：

```yaml
services:
  paperclip:
    environment:
      PAPERCLIP_DEPLOYMENT_MODE: authenticated
      PAPERCLIP_DEPLOYMENT_EXPOSURE: private
      PAPERCLIP_PUBLIC_URL: https://desk.koker.net
```

`PAPERCLIP_PUBLIC_URL` 用作以下项的主要来源：

- 认证公共基础 URL
- Better Auth 基础 URL 默认值
- 引导邀请 URL 默认值
- 主机名白名单默认值（从 URL 中提取主机名）

如需细粒度覆盖，仍可使用 `PAPERCLIP_AUTH_PUBLIC_BASE_URL`、`BETTER_AUTH_URL`、`BETTER_AUTH_TRUSTED_ORIGINS`、`PAPERCLIP_ALLOWED_HOSTNAMES`。

仅当你需要公共 URL 主机之外的额外主机名时（例如 Tailscale/LAN 别名或多个私有主机名），才显式设置 `PAPERCLIP_ALLOWED_HOSTNAMES`。

## Docker 中的 Claude + Codex 本地适配器

镜像预装了：

- `claude`（Anthropic Claude Code CLI）
- `codex`（OpenAI Codex CLI）

如果你想在容器内运行本地适配器，启动容器时传入 API 密钥：

```sh
docker run --name paperclip \
  -p 3100:3100 \
  -e HOST=0.0.0.0 \
  -e PAPERCLIP_HOME=/paperclip \
  -e OPENAI_API_KEY=... \
  -e ANTHROPIC_API_KEY=... \
  -v "$(pwd)/data/docker-paperclip:/paperclip" \
  paperclip-local
```

注意：

- 没有 API 密钥，应用仍然可以正常运行。
- Paperclip 中的适配器环境检查会提示缺失的认证/CLI 前置条件。

## 不可信 PR 审查容器

如果你想要一个单独的 Docker 环境来使用 `codex` 或 `claude` 审查不可信的 Pull Request，请使用 `doc/UNTRUSTED-PR-REVIEW.md` 中的专用审查工作流。

该设置将 CLI 认证状态保存在 Docker 卷中而非你的主机家目录中，并使用单独的临时工作区进行 PR 签出和预览运行。

## 入门冒烟测试（Ubuntu + npm 环境）

当你想模拟一台仅有 Ubuntu + npm 的全新机器并验证以下内容时使用：

- `npx paperclipai onboard --yes` 完成
- 服务器绑定到 `0.0.0.0:3100` 以便主机访问
- 入门/运行横幅和启动日志在终端中可见

构建 + 运行：

```sh
./scripts/docker-onboard-smoke.sh
```

打开：`http://localhost:3131`（默认冒烟测试主机端口）

有用的覆盖：

```sh
HOST_PORT=3200 PAPERCLIPAI_VERSION=latest ./scripts/docker-onboard-smoke.sh
PAPERCLIP_DEPLOYMENT_MODE=authenticated PAPERCLIP_DEPLOYMENT_EXPOSURE=private ./scripts/docker-onboard-smoke.sh
SMOKE_DETACH=true SMOKE_METADATA_FILE=/tmp/paperclip-smoke.env PAPERCLIPAI_VERSION=latest ./scripts/docker-onboard-smoke.sh
```

注意：

- 持久化数据默认挂载在 `./data/docker-onboard-smoke`。
- 容器运行时用户 ID 默认为你本地的 `id -u`，这样挂载的数据目录保持可写，同时避免 root 运行时。
- 冒烟测试脚本默认使用 `authenticated/private` 模式，以便 `HOST=0.0.0.0` 可以暴露给主机。
- 冒烟测试脚本默认主机端口为 `3131`，以避免与 `3100` 上的本地 Paperclip 冲突。
- 冒烟测试脚本还默认将 `PAPERCLIP_PUBLIC_URL` 设为 `http://localhost:<HOST_PORT>`，以便引导邀请 URL 和认证回调使用可达的主机端口而非容器内部的 `3100`。
- 在认证模式下，冒烟测试脚本默认 `SMOKE_AUTO_BOOTSTRAP=true` 并自动驱动真实的引导路径：注册真实用户，在容器内运行 `paperclipai auth bootstrap-ceo` 铸造真实的引导邀请，通过 HTTP 接受该邀请，并验证董事会会话访问。
- 在前台运行脚本以观看入门流程；验证后使用 `Ctrl+C` 停止。
- 设置 `SMOKE_DETACH=true` 以保持容器运行用于自动化，并可选地将 shell 就绪的元数据写入 `SMOKE_METADATA_FILE`。
- 镜像定义在 `Dockerfile.onboard-smoke` 中。
