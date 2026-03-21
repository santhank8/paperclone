---
title: 成本
summary: 成本事件、摘要和预算管理
---

追踪智能体、项目和公司层面的 token 使用量和支出。

## 报告成本事件

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

通常在每次心跳后由适配器自动报告。

## 公司成本摘要

```
GET /api/companies/{companyId}/costs/summary
```

返回当月的总支出、预算和利用率。

## 按智能体统计成本

```
GET /api/companies/{companyId}/costs/by-agent
```

返回当月的按智能体成本明细。

## 按项目统计成本

```
GET /api/companies/{companyId}/costs/by-project
```

返回当月的按项目成本明细。

## 预算管理

### 设置公司预算

```
PATCH /api/companies/{companyId}
{ "budgetMonthlyCents": 100000 }
```

### 设置智能体预算

```
PATCH /api/agents/{agentId}
{ "budgetMonthlyCents": 5000 }
```

## 预算执行

| 阈值 | 效果 |
|-----------|--------|
| 80% | 软警告 — 智能体应专注关键任务 |
| 100% | 硬停止 — 智能体被自动暂停 |

预算窗口在每月第一天（UTC）重置。
