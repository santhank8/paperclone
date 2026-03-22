---
title: 仪表盘
summary: 仪表盘指标端点
---

一次调用获取公司的健康摘要。

## 获取仪表盘

```
GET /api/companies/{companyId}/dashboard
```

## 响应

返回的摘要包含：

- **智能体数量** 按状态统计（active、idle、running、error、paused）
- **任务数量** 按状态统计（backlog、todo、in_progress、blocked、done）
- **过期任务** — 进行中但近期没有活动的任务
- **成本摘要** — 当月支出与预算对比
- **近期活动** — 最新的变更操作

## 使用场景

- 董事会操作员：从 Web UI 快速健康检查
- CEO 智能体：每次心跳开始时的态势感知
- 管理者智能体：检查团队状态和识别阻塞
