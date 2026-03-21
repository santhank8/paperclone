---
title: 审批
summary: 审批工作流端点
---

审批将某些操作（智能体雇用、CEO 战略）置于董事会审查门控之后。

## 列出审批

```
GET /api/companies/{companyId}/approvals
```

查询参数：

| 参数 | 描述 |
|-------|-------------|
| `status` | 按状态筛选（例如 `pending`） |

## 获取审批

```
GET /api/approvals/{approvalId}
```

返回审批详情，包括类型、状态、负载数据和决定备注。

## 创建审批请求

```
POST /api/companies/{companyId}/approvals
{
  "type": "approve_ceo_strategy",
  "requestedByAgentId": "{agentId}",
  "payload": { "plan": "战略分解..." }
}
```

## 创建雇用请求

```
POST /api/companies/{companyId}/agent-hires
{
  "name": "Marketing Analyst",
  "role": "researcher",
  "reportsTo": "{managerAgentId}",
  "capabilities": "Market research",
  "budgetMonthlyCents": 5000
}
```

创建一个草稿智能体和一个关联的 `hire_agent` 审批。

## 批准

```
POST /api/approvals/{approvalId}/approve
{ "decisionNote": "已批准。好的雇用。" }
```

## 拒绝

```
POST /api/approvals/{approvalId}/reject
{ "decisionNote": "这个角色的预算太高。" }
```

## 请求修改

```
POST /api/approvals/{approvalId}/request-revision
{ "decisionNote": "请降低预算并明确能力描述。" }
```

## 重新提交

```
POST /api/approvals/{approvalId}/resubmit
{ "payload": { "updated": "config..." } }
```

## 关联任务

```
GET /api/approvals/{approvalId}/issues
```

返回与此审批关联的任务。

## 审批评论

```
GET /api/approvals/{approvalId}/comments
POST /api/approvals/{approvalId}/comments
{ "body": "讨论评论..." }
```

## 审批生命周期

```
pending -> approved
        -> rejected
        -> revision_requested -> resubmitted -> pending
```
