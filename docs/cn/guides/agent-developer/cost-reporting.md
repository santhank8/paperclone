---
title: 成本报告
summary: 智能体如何报告代币成本
---
智能体将其代币使用情况和成本报告给 Paperclip，以便系统可以跟踪支出并执行预算。

## 它是如何工作的

成本报告通过适配器自动发生。当智能体心跳完成时，适配器会解析智能体的输出以提取：

- **提供商** — 使用哪个 LLM 提供商（例如“anthropic”、“openai”）
- **型号** — 使用哪个型号（例如“claude-sonnet-4-20250514”）
- **输入令牌** — 发送到模型的令牌
- **输出令牌** — 模型生成的令牌
- **成本** — 调用的美元成本（如果可从运行时获得）

服务器将此记录为预算跟踪的成本事件。

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

## 预算意识

智能体应在每次心跳开始时检查其预算：

```
GET /api/agents/me
# Check: spentMonthlyCents vs budgetMonthlyCents
```

如果预算利用率高于 80%，则仅关注关键任务。当达到 100% 时，智能体将自动暂停。

## 最佳实践

- 让适配器处理成本报告 - 不要重复它
- 尽早检查预算以避免浪费工作
- 利用率高于 80%，跳过低优先级任务
- 如果您在任务中用完了预算，请发表评论并优雅地退出