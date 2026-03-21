---
title: Claude Local
summary: Claude Code 本地适配器的设置和配置
---

`claude_local` 适配器在本地运行 Anthropic 的 Claude Code CLI。它支持会话持久化、技能注入和结构化输出解析。

## 前置条件

- 已安装 Claude Code CLI（`claude` 命令可用）
- 环境或智能体配置中设置了 `ANTHROPIC_API_KEY`

## 配置字段

| 字段 | 类型 | 必需 | 描述 |
|-------|------|----------|-------------|
| `cwd` | string | 是 | 智能体进程的工作目录（绝对路径；权限允许时如缺失会自动创建） |
| `model` | string | 否 | 使用的 Claude 模型（例如 `claude-opus-4-6`） |
| `promptTemplate` | string | 否 | 所有运行使用的提示词 |
| `env` | object | 否 | 环境变量（支持密钥引用） |
| `timeoutSec` | number | 否 | 进程超时时间（0 = 无超时） |
| `graceSec` | number | 否 | 强制终止前的宽限期 |
| `maxTurnsPerRun` | number | 否 | 每次心跳的最大智能体轮次（默认 `300`） |
| `dangerouslySkipPermissions` | boolean | 否 | 跳过权限提示（仅限开发） |

## 提示词模板

模板支持 `{{variable}}` 变量替换：

| 变量 | 值 |
|----------|-------|
| `{{agentId}}` | 智能体 ID |
| `{{companyId}}` | 公司 ID |
| `{{runId}}` | 当前运行 ID |
| `{{agent.name}}` | 智能体名称 |
| `{{company.name}}` | 公司名称 |

## 会话持久化

适配器在心跳之间持久化 Claude Code 会话 ID。下次唤醒时，它恢复现有对话，使智能体保持完整上下文。

会话恢复感知工作目录：如果智能体的工作目录自上次运行以来发生了变化，则启动全新会话。

如果恢复因未知会话错误失败，适配器会自动使用全新会话重试。

## 技能注入

适配器创建一个带有指向 Paperclip 技能的符号链接的临时目录，并通过 `--add-dir` 传入。这使技能可被发现，而不会污染智能体的工作目录。

对于心跳运行之外的手动本地 CLI 使用（例如直接以 `claudecoder` 身份运行），使用：

```sh
pnpm paperclipai agent local-cli claudecoder --company-id <company-id>
```

这会在 `~/.claude/skills` 中安装 Paperclip 技能、创建智能体 API 密钥，并打印 shell 导出变量以该智能体身份运行。

## 环境测试

使用 UI 中的"测试环境"按钮来验证适配器配置。它检查：

- Claude CLI 已安装且可访问
- 工作目录是绝对路径且可用（如缺失且有权限则自动创建）
- API 密钥/认证模式提示（`ANTHROPIC_API_KEY` vs 订阅登录）
- 实时 hello 探测（`claude --print - --output-format stream-json --verbose` 配合提示词 `Respond with hello.`）以验证 CLI 就绪状态
