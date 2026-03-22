---
title: 适配器概览
summary: 什么是适配器以及它们如何将智能体连接到 Paperclip
---

适配器是 Paperclip 编排层和智能体运行时之间的桥梁。每个适配器知道如何调用特定类型的 AI 智能体并捕获其结果。

## 适配器的工作原理

当心跳触发时，Paperclip：

1. 查找智能体的 `adapterType` 和 `adapterConfig`
2. 调用适配器的 `execute()` 函数并传入执行上下文
3. 适配器启动或调用智能体运行时
4. 适配器捕获 stdout，解析用量/成本数据，并返回结构化结果

## 内置适配器

| 适配器 | 类型键 | 描述 |
|---------|----------|-------------|
| [Claude Local](/adapters/claude-local) | `claude_local` | 在本地运行 Claude Code CLI |
| [Codex Local](/adapters/codex-local) | `codex_local` | 在本地运行 OpenAI Codex CLI |
| [Gemini Local](/adapters/gemini-local) | `gemini_local` | 在本地运行 Gemini CLI |
| OpenCode Local | `opencode_local` | 在本地运行 OpenCode CLI（多提供商 `provider/model`） |
| OpenClaw | `openclaw` | 向 OpenClaw webhook 发送唤醒负载 |
| [Process](/adapters/process) | `process` | 执行任意 shell 命令 |
| [HTTP](/adapters/http) | `http` | 向外部智能体发送 webhook |

## 适配器架构

每个适配器是一个包含三个模块的包：

```
packages/adapters/<name>/
  src/
    index.ts            # 共享元数据（类型、标签、模型）
    server/
      execute.ts        # 核心执行逻辑
      parse.ts          # 输出解析
      test.ts           # 环境诊断
    ui/
      parse-stdout.ts   # Stdout -> 运行查看器的转录条目
      build-config.ts   # 表单值 -> adapterConfig JSON
    cli/
      format-event.ts   # `paperclipai run --watch` 的终端输出
```

三个注册表使用这些模块：

| 注册表 | 功能 |
|----------|-------------|
| **服务端** | 执行智能体，捕获结果 |
| **UI** | 渲染运行转录，提供配置表单 |
| **CLI** | 格式化实时监控的终端输出 |

## 选择适配器

- **需要编程智能体？** 使用 `claude_local`、`codex_local`、`gemini_local` 或 `opencode_local`
- **需要运行脚本或命令？** 使用 `process`
- **需要调用外部服务？** 使用 `http`
- **需要自定义？** [创建你自己的适配器](/adapters/creating-an-adapter)
