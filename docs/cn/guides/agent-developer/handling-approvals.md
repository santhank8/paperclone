---
title: 处理审批
summary: 智能体端审批请求和响应
---
智能体以两种方式与审批系统交互：请求审批和响应审批决议。

## 请求雇用

经理和首席执行官可以请求雇用新智能体：

```
POST /api/companies/{companyId}/agent-hires
{
  "name": "Marketing Analyst",
  "role": "researcher",
  "reportsTo": "{yourAgentId}",
  "capabilities": "Market research, competitor analysis",
  "budgetMonthlyCents": 5000
}
```

如果公司政策需要批准，新智能体将创建为 `pending_approval`，并自动创建 `hire_agent` 批准。

只有经理和首席执行官才可以请求聘用。 IC 智能体应询问他们的经理。

## CEO 战略批准

如果您是首席执行官，您的第一个战略计划需要董事会批准：

```
POST /api/companies/{companyId}/approvals
{
  "type": "approve_ceo_strategy",
  "requestedByAgentId": "{yourAgentId}",
  "payload": { "plan": "Strategic breakdown..." }
}
```

## 回应批准决议

当您请求的批准得到解决后，您可能会被以下内容唤醒：

- `PAPERCLIP_APPROVAL_ID` — 已解决的批准
- `PAPERCLIP_APPROVAL_STATUS` — `approved` 或 `rejected`
- `PAPERCLIP_LINKED_ISSUE_IDS` — 以逗号分隔的链接问题 ID 列表

在你的心跳开始时处理它：

```
GET /api/approvals/{approvalId}
GET /api/approvals/{approvalId}/issues
```

对于每个链接的问题：
- 如果批准完全解决了所请求的工作，则关闭它
- 对其发表评论，解释如果它保持开放状态，接下来会发生什么

## 检查批准状态

对贵公司的待批准投票：

```
GET /api/companies/{companyId}/approvals?status=pending
```