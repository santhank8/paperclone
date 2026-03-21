---
title: Codex Local
summary: OpenAI Codex 本地适配器的设置和配置
---

`codex_local` 适配器在本地运行 OpenAI 的 Codex CLI。它支持通过 `previous_response_id` 链接的会话持久化，以及通过全局 Codex 技能目录进行的技能注入。

## 前置条件

- 已安装 Codex CLI（`codex` 命令可用）
- 环境或智能体配置中设置了 `OPENAI_API_KEY`

## 配置字段

| 字段 | 类型 | 必需 | 描述 |
|-------|------|----------|-------------|
| `cwd` | string | 是 | 智能体进程的工作目录（绝对路径；权限允许时如缺失会自动创建） |
| `model` | string | 否 | 使用的模型 |
| `promptTemplate` | string | 否 | 所有运行使用的提示词 |
| `env` | object | 否 | 环境变量（支持密钥引用） |
| `timeoutSec` | number | 否 | 进程超时时间（0 = 无超时） |
| `graceSec` | number | 否 | 强制终止前的宽限期 |
| `dangerouslyBypassApprovalsAndSandbox` | boolean | 否 | 跳过安全检查（仅限开发） |

## 会话持久化

Codex 使用 `previous_response_id` 实现会话连续性。适配器在心跳之间序列化和恢复此值，允许智能体维持对话上下文。

## 技能注入

适配器将 Paperclip 技能符号链接到全局 Codex 技能目录（`~/.codex/skills`）。现有用户技能不会被覆盖。

当 Paperclip 运行在托管的 worktree 实例中（`PAPERCLIP_IN_WORKTREE=true`），适配器改为使用 Paperclip 实例下隔离的 worktree `CODEX_HOME`，这样 Codex 技能、会话、日志和其他运行时状态不会在不同签出之间泄漏。它从用户的主 Codex home 为该隔离 home 设置种子，以保持共享的认证/配置连续性。

对于心跳运行之外的手动本地 CLI 使用（例如直接以 `codexcoder` 身份运行），使用：

```sh
pnpm paperclipai agent local-cli codexcoder --company-id <company-id>
```

这会安装缺失的技能、创建智能体 API 密钥，并打印 shell 导出变量以该智能体身份运行。

## 环境测试

环境测试检查：

- Codex CLI 已安装且可访问
- 工作目录是绝对路径且可用（如缺失且有权限则自动创建）
- 认证信号（`OPENAI_API_KEY` 存在）
- 实时 hello 探测（`codex exec --json -` 配合提示词 `Respond with hello.`）以验证 CLI 能否实际运行
