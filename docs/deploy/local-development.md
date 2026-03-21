---
title: 本地开发
summary: 为本地开发设置 Paperclip
---

在本地运行 Paperclip，零外部依赖。

## 前置条件

- Node.js 20+
- pnpm 9+

## 启动开发服务器

```sh
pnpm install
pnpm dev
```

这将启动：

- **API 服务器**，地址为 `http://localhost:3100`
- **UI**，通过 API 服务器以开发中间件模式提供（同源）

无需 Docker 或外部数据库。Paperclip 自动使用内嵌 PostgreSQL。

## 一键引导

首次安装时：

```sh
pnpm paperclipai run
```

功能：

1. 如果配置缺失则自动引导
2. 运行 `paperclipai doctor` 并启用修复
3. 检查通过后启动服务器

## Tailscale/私有认证开发模式

以 `authenticated/private` 模式运行以进行网络访问：

```sh
pnpm dev --tailscale-auth
```

这将服务器绑定到 `0.0.0.0` 以进行私有网络访问。

别名：

```sh
pnpm dev --authenticated-private
```

允许额外的私有主机名：

```sh
pnpm paperclipai allowed-hostname dotta-macbook-pro
```

完整设置和故障排除，参见 [Tailscale 私有访问](/deploy/tailscale-private-access)。

## 健康检查

```sh
curl http://localhost:3100/api/health
# -> {"status":"ok"}

curl http://localhost:3100/api/companies
# -> []
```

## 重置开发数据

清除本地数据并重新开始：

```sh
rm -rf ~/.paperclip/instances/default/db
pnpm dev
```

## 数据位置

| 数据 | 路径 |
|------|------|
| 配置 | `~/.paperclip/instances/default/config.json` |
| 数据库 | `~/.paperclip/instances/default/db` |
| 存储 | `~/.paperclip/instances/default/data/storage` |
| 密钥文件 | `~/.paperclip/instances/default/secrets/master.key` |
| 日志 | `~/.paperclip/instances/default/logs` |

通过环境变量覆盖：

```sh
PAPERCLIP_HOME=/custom/path PAPERCLIP_INSTANCE_ID=dev pnpm paperclipai run
```
