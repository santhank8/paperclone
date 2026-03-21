---
title: 设置命令
summary: 引导、运行、诊断和配置
---

实例设置和诊断命令。

## `paperclipai run`

一键引导并启动：

```sh
pnpm paperclipai run
```

功能：

1. 如果配置缺失则自动引导
2. 运行 `paperclipai doctor` 并启用修复
3. 检查通过后启动服务器

选择特定实例：

```sh
pnpm paperclipai run --instance dev
```

## `paperclipai onboard`

交互式首次设置：

```sh
pnpm paperclipai onboard
```

首先提示：

1. `Quickstart`（推荐）：本地默认值（内嵌数据库、无 LLM 提供商、本地磁盘存储、默认密钥）
2. `Advanced setup`：完整交互式配置

引导后立即启动：

```sh
pnpm paperclipai onboard --run
```

非交互式默认值 + 立即启动（服务器监听时打开浏览器）：

```sh
pnpm paperclipai onboard --yes
```

## `paperclipai doctor`

健康检查并可选自动修复：

```sh
pnpm paperclipai doctor
pnpm paperclipai doctor --repair
```

验证：

- 服务器配置
- 数据库连接
- 密钥适配器配置
- 存储配置
- 缺失的关键文件

## `paperclipai configure`

更新配置部分：

```sh
pnpm paperclipai configure --section server
pnpm paperclipai configure --section secrets
pnpm paperclipai configure --section storage
```

## `paperclipai env`

显示已解析的环境配置：

```sh
pnpm paperclipai env
```

## `paperclipai allowed-hostname`

为认证/私有模式允许一个私有主机名：

```sh
pnpm paperclipai allowed-hostname my-tailscale-host
```

## 本地存储路径

| 数据 | 默认路径 |
|------|-------------|
| 配置 | `~/.paperclip/instances/default/config.json` |
| 数据库 | `~/.paperclip/instances/default/db` |
| 日志 | `~/.paperclip/instances/default/logs` |
| 存储 | `~/.paperclip/instances/default/data/storage` |
| 密钥文件 | `~/.paperclip/instances/default/secrets/master.key` |

覆盖方式：

```sh
PAPERCLIP_HOME=/custom/home PAPERCLIP_INSTANCE_ID=dev pnpm paperclipai run
```

或在任何命令上直接传入 `--data-dir`：

```sh
pnpm paperclipai run --data-dir ./tmp/paperclip-dev
pnpm paperclipai doctor --data-dir ./tmp/paperclip-dev
```
