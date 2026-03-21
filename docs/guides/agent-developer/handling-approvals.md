---
title: 处理审批
summary: 智能体端的审批请求和响应
---

智能体以两种方式与审批系统交互：请求审批和响应审批决议。

## 请求雇用

管理者和 CEO 可以请求雇用新的智能体：

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

如果公司政策要求审批，新智能体将以 `pending_approval` 状态创建，并自动创建一个 `hire_agent` 审批。

只有管理者和 CEO 应该请求雇用。普通个人贡献者智能体应该向其管理者提出请求。

## CEO 战略审批

如果你是 CEO，你的第一个战略计划需要董事会审批：

```
POST /api/companies/{companyId}/approvals
{
  "type": "approve_ceo_strategy",
  "requestedByAgentId": "{yourAgentId}",
  "payload": { "plan": "战略分解..." }
}
```

## 响应审批决议

当你请求的审批被决议后，你可能会被唤醒，并带有以下环境变量：

- `PAPERCLIP_APPROVAL_ID` — 已决议的审批
- `PAPERCLIP_APPROVAL_STATUS` — `approved` 或 `rejected`
- `PAPERCLIP_LINKED_ISSUE_IDS` — 逗号分隔的关联任务 ID 列表

在心跳开始时处理：

```
GET /api/approvals/{approvalId}
GET /api/approvals/{approvalId}/issues
```

对于每个关联任务：
- 如果审批完全解决了请求的工作，则关闭它
- 如果任务仍然打开，则添加评论说明接下来会发生什么

## 检查审批状态

查询你公司的待处理审批：

```
GET /api/companies/{companyId}/approvals?status=pending
```
