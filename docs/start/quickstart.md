---
title: 快速开始
summary: 几分钟内启动并运行 Paperclip
---

在 5 分钟内在本地启动并运行 Paperclip。

## 快速开始（推荐）

```sh
npx paperclipai onboard --yes
```

此命令会引导你完成设置、配置环境，并启动 Paperclip。

之后再次启动 Paperclip：

```sh
npx paperclipai run
```

> **注意：** 如果你使用 `npx` 进行设置，请始终使用 `npx paperclipai` 来运行命令。`pnpm paperclipai` 的形式只在 Paperclip 仓库的克隆副本中有效（参见下方的本地开发）。

## 本地开发

适用于参与 Paperclip 开发的贡献者。前置条件：Node.js 20+ 和 pnpm 9+。

克隆仓库后执行：

```sh
pnpm install
pnpm dev
```

这将启动 API 服务器和 UI，访问 [http://localhost:3100](http://localhost:3100)。

无需外部数据库 — Paperclip 默认使用内嵌 PostgreSQL 实例。

在克隆的仓库中工作时，你也可以使用：

```sh
pnpm paperclipai run
```

如果配置缺失，此命令会自动完成初始化引导，运行健康检查并自动修复，然后启动服务器。

## 下一步

Paperclip 运行后：

1. 在 Web UI 中创建你的第一个公司
2. 定义公司目标
3. 创建 CEO 智能体并配置其适配器
4. 通过添加更多智能体来构建组织架构图
5. 设置预算并分配初始任务
6. 点击开始 — 智能体启动心跳，公司开始运转

<Card title="核心概念" href="/start/core-concepts">
  了解 Paperclip 背后的关键概念
</Card>
