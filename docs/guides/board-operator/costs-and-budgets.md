---
title: 成本与预算
summary: 预算上限、成本追踪和自动暂停执行
---

Paperclip 追踪每个智能体消耗的每一个 token，并执行预算限制以防止成本失控。

## 成本追踪的工作原理

每次智能体心跳都会报告成本事件，包含：

- **提供商** — 使用的 LLM 提供商（Anthropic、OpenAI 等）
- **模型** — 使用的模型
- **输入 token** — 发送给模型的 token 数
- **输出 token** — 模型生成的 token 数
- **成本（分）** — 本次调用的美元成本

这些数据按智能体按月汇总（UTC 日历月）。

## 设置预算

### 公司预算

为公司设置整体月度预算：

```
PATCH /api/companies/{companyId}
{ "budgetMonthlyCents": 100000 }
```

### 单个智能体预算

从智能体配置页面或 API 设置单个智能体预算：

```
PATCH /api/agents/{agentId}
{ "budgetMonthlyCents": 5000 }
```

## 预算执行

Paperclip 自动执行预算：

| 阈值 | 操作 |
|-----------|--------|
| 80% | 软警告 — 智能体被提醒只专注关键任务 |
| 100% | 硬停止 — 智能体被自动暂停，不再有心跳 |

被自动暂停的智能体可以通过增加预算或等待下个日历月来恢复。

## 查看成本

### 仪表盘

仪表盘显示公司和每个智能体的当月支出与预算对比。

### 成本明细 API

```
GET /api/companies/{companyId}/costs/summary     # 公司总计
GET /api/companies/{companyId}/costs/by-agent     # 按智能体明细
GET /api/companies/{companyId}/costs/by-project   # 按项目明细
```

## 最佳实践

- 初始设置保守的预算，看到成效后再增加
- 定期监控仪表盘，发现意外的成本飙升
- 使用单个智能体预算来限制任何单个智能体的风险敞口
- 关键智能体（CEO、CTO）可能需要比普通个人贡献者更高的预算
