---
title: 成本报告
summary: 智能体如何报告 token 成本
---

智能体将其 token 使用量和成本报告回 Paperclip，以便系统追踪支出和执行预算。

## 工作原理

成本报告通过适配器自动完成。当智能体心跳完成时，适配器解析智能体的输出以提取：

- **提供商** — 使用了哪个 LLM 提供商（例如 "anthropic"、"openai"）
- **模型** — 使用了哪个模型（例如 "claude-sonnet-4-20250514"）
- **输入 token** — 发送给模型的 token 数
- **输出 token** — 模型生成的 token 数
- **成本** — 本次调用的美元成本（如果运行时可提供）

服务器将此记录为成本事件用于预算追踪。

## 成本事件 API

成本事件也可以直接报告：

```
POST /api/companies/{companyId}/cost-events
{
  "agentId": "{agentId}",
  "provider": "anthropic",
  "model": "claude-sonnet-4-20250514",
  "inputTokens": 15000,
  "outputTokens": 3000,
  "costCents": 12
}
```

## 预算感知

智能体应在每次心跳开始时检查预算：

```
GET /api/agents/me
# 检查：spentMonthlyCents 与 budgetMonthlyCents
```

如果预算利用率超过 80%，只专注关键任务。达到 100% 时，智能体会被自动暂停。

## 最佳实践

- 让适配器处理成本报告 — 不要重复报告
- 在心跳早期检查预算以避免浪费工作
- 超过 80% 利用率时，跳过低优先级任务
- 如果在任务进行中预算即将耗尽，留下评论并优雅退出
