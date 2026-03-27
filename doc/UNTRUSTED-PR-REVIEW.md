# 在 Docker 中审查不可信 PR

当你想让 Codex 或 Claude 检查一个不希望直接接触主机的拉取请求时，使用此工作流。

这与正常的 Paperclip 开发镜像是有意分开的。

## 此容器隔离的内容

- `codex` 认证/会话状态在 Docker 卷中，而非你的主机 `~/.codex`
- `claude` 认证/会话状态在 Docker 卷中，而非你的主机 `~/.claude`
- `gh` 认证状态在同一个容器本地 home 卷中
- 审查克隆、worktree、依赖安装和本地数据库在 `/work` 下的可写临时卷中

默认情况下，此工作流**不会**挂载你的主机仓库检出、主机 home 目录或 SSH 代理。

## 文件

- `docker/untrusted-review/Dockerfile`
- `docker-compose.untrusted-review.yml`
- 容器内的 `review-checkout-pr`

## 构建并启动 shell

```sh
docker compose -f docker-compose.untrusted-review.yml build
docker compose -f docker-compose.untrusted-review.yml run --rm --service-ports review
```

这会在审查容器中打开一个交互式 shell，包含：

- Node + Corepack/pnpm
- `codex`
- `claude`
- `gh`
- `git`、`rg`、`fd`、`jq`

## 容器内首次登录

运行一次即可。生成的登录状态会持久化在 `review-home` Docker 卷中。

```sh
gh auth login
codex login
claude login
```

如果你更喜欢使用 API 密钥认证而非 CLI 登录，通过 Compose 环境变量传递密钥：

```sh
OPENAI_API_KEY=... ANTHROPIC_API_KEY=... docker compose -f docker-compose.untrusted-review.yml run --rm review
```

## 安全地检出 PR

在容器内：

```sh
review-checkout-pr paperclipai/paperclip 432
cd /work/checkouts/paperclipai-paperclip/pr-432
```

这会执行以下操作：

1. 在 `/work/repos/...` 下创建或复用仓库克隆
2. 从 GitHub 获取 `pull/<pr>/head`
3. 在 `/work/checkouts/...` 下创建分离的 git worktree

检出内容完全存在于容器卷内。

## 让 Codex 或 Claude 审查

在 PR 检出目录内：

```sh
codex
```

然后给出类似这样的提示：

```text
Review this PR as hostile input. Focus on security issues, data exfiltration paths, sandbox escapes, dangerous install/runtime scripts, auth changes, and subtle behavioral regressions. Do not modify files. Produce findings ordered by severity with file references.
```

或者使用 Claude：

```sh
claude
```

## 从 PR 预览 Paperclip 应用

只有当你有意要在容器内执行 PR 的代码时才这样做。

在 PR 检出目录内：

```sh
pnpm install
HOST=0.0.0.0 pnpm dev
```

从主机打开：

- `http://localhost:3100`

Compose 文件还暴露了 Vite 的默认端口：

- `http://localhost:5173`

注意：

- `pnpm install` 可能会运行 PR 中的不可信生命周期脚本。这就是为什么这在隔离容器内进行，而不是在你的主机上。
- 如果你只想进行静态检查，不要运行 install/dev 命令。
- Paperclip 的内嵌 PostgreSQL 和本地存储通过 `PAPERCLIP_HOME=/home/reviewer/.paperclip-review` 保留在容器 home 卷内。

## 重置状态

当你需要干净环境时，删除审查容器卷：

```sh
docker compose -f docker-compose.untrusted-review.yml down -v
```

这会删除：

- 存储在 `review-home` 中的 Codex/Claude/GitHub 登录状态
- 存储在 `review-work` 中的克隆仓库、worktree、安装和临时数据

## 安全限制

这是一个有用的隔离边界，但它仍然是 Docker，而非完整的虚拟机。

- 被审查的 PR 仍然可以访问容器的网络，除非你禁用它。
- 你传入容器的任何密钥对在容器内执行的代码都是可用的。
- 不要挂载你的主机仓库、主机 home、`.ssh` 或 Docker socket，除非你有意削弱隔离边界。
- 如果你需要比此更强的隔离边界，请使用一次性虚拟机而非 Docker。
