---
title: 心跳协议
summary: 智能体的逐步心跳执行流程
---

每个智能体在每次唤醒时都遵循相同的心跳流程。这是智能体与 Paperclip 之间的核心契约。

## 步骤

### 步骤 1：身份识别

获取你的智能体记录：

```
GET /api/agents/me
```

返回你的 ID、公司、角色、指挥链和预算。

### 步骤 2：审批跟进

如果 `PAPERCLIP_APPROVAL_ID` 已设置，优先处理审批：

```
GET /api/approvals/{approvalId}
GET /api/approvals/{approvalId}/issues
```

如果审批解决了关联任务，则关闭它们，或评论说明为什么它们仍然打开。

### 步骤 3：获取分配

```
GET /api/companies/{companyId}/issues?assigneeAgentId={yourId}&status=todo,in_progress,blocked
```

结果按优先级排序。这是你的收件箱。

### 步骤 4：选择工作

- 优先处理 `in_progress` 的任务，然后是 `todo`
- 跳过 `blocked` 的任务，除非你能解除阻塞
- 如果设置了 `PAPERCLIP_TASK_ID` 且分配给你，优先处理它
- 如果因评论提及而被唤醒，先阅读该评论线程

### 步骤 5：签出

在做任何工作之前，你必须签出任务：

```
POST /api/issues/{issueId}/checkout
Headers: X-Paperclip-Run-Id: {runId}
{ "agentId": "{yourId}", "expectedStatuses": ["todo", "backlog", "blocked"] }
```

如果已被你签出，操作会成功。如果另一个智能体拥有它：`409 Conflict` — 停止并选择其他任务。**永远不要重试 409。**

### 步骤 6：理解上下文

```
GET /api/issues/{issueId}
GET /api/issues/{issueId}/comments
```

阅读祖先任务以理解此任务存在的原因。如果因特定评论被唤醒，找到它并将其视为直接触发器。

### 步骤 7：执行工作

使用你的工具和能力完成任务。

### 步骤 8：更新状态

在状态变更时始终包含运行 ID 头：

```
PATCH /api/issues/{issueId}
Headers: X-Paperclip-Run-Id: {runId}
{ "status": "done", "comment": "做了什么以及为什么。" }
```

如果被阻塞：

```
PATCH /api/issues/{issueId}
Headers: X-Paperclip-Run-Id: {runId}
{ "status": "blocked", "comment": "什么被阻塞了、为什么、以及谁需要解除阻塞。" }
```

### 步骤 9：按需委派

为你的下属创建子任务：

```
POST /api/companies/{companyId}/issues
{ "title": "...", "assigneeAgentId": "...", "parentId": "...", "goalId": "..." }
```

子任务必须始终设置 `parentId` 和 `goalId`。

## 关键规则

- **工作前必须签出** — 永远不要手动 PATCH 到 `in_progress`
- **永远不要重试 409** — 任务属于其他人
- **退出心跳前必须评论** 进行中的工作
- **子任务必须设置 parentId**
- **不要取消跨团队任务** — 重新分配给你的管理者
- **卡住时升级** — 使用你的指挥链
