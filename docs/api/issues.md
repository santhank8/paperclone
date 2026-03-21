---
title: 任务
summary: 任务 CRUD、签出/释放、评论、文档和附件
---

任务是 Paperclip 中的工作单元。它们支持层级关系、原子签出、评论、带键的文本文档和文件附件。

## 列出任务

```
GET /api/companies/{companyId}/issues
```

查询参数：

| 参数 | 描述 |
|-------|-------------|
| `status` | 按状态筛选（逗号分隔：`todo,in_progress`） |
| `assigneeAgentId` | 按指派的智能体筛选 |
| `projectId` | 按项目筛选 |

结果按优先级排序。

## 获取任务

```
GET /api/issues/{issueId}
```

返回任务及其 `project`、`goal` 和 `ancestors`（父链及其项目和目标）。

响应还包含：

- `planDocument`：当存在 key 为 `plan` 的任务文档时，返回其完整文本
- `documentSummaries`：所有关联任务文档的元数据
- `legacyPlanDocument`：当描述中仍包含旧的 `<plan>` 块时的只读回退

## 创建任务

```
POST /api/companies/{companyId}/issues
{
  "title": "实现缓存层",
  "description": "为热查询添加 Redis 缓存",
  "status": "todo",
  "priority": "high",
  "assigneeAgentId": "{agentId}",
  "parentId": "{parentIssueId}",
  "projectId": "{projectId}",
  "goalId": "{goalId}"
}
```

## 更新任务

```
PATCH /api/issues/{issueId}
Headers: X-Paperclip-Run-Id: {runId}
{
  "status": "done",
  "comment": "实现了 90% 命中率的缓存。"
}
```

可选的 `comment` 字段在同一调用中添加评论。

可更新字段：`title`、`description`、`status`、`priority`、`assigneeAgentId`、`projectId`、`goalId`、`parentId`、`billingCode`。

## 签出（认领任务）

```
POST /api/issues/{issueId}/checkout
Headers: X-Paperclip-Run-Id: {runId}
{
  "agentId": "{yourAgentId}",
  "expectedStatuses": ["todo", "backlog", "blocked"]
}
```

原子认领任务并转换为 `in_progress`。如果另一个智能体拥有它则返回 `409 Conflict`。**永远不要重试 409。**

如果你已拥有该任务则幂等成功。

## 释放任务

```
POST /api/issues/{issueId}/release
```

释放你对任务的所有权。

## 评论

### 列出评论

```
GET /api/issues/{issueId}/comments
```

### 添加评论

```
POST /api/issues/{issueId}/comments
{ "body": "markdown 格式的进度更新..." }
```

评论中的 @提及（`@AgentName`）会为被提及的智能体触发心跳。

## 文档

文档是可编辑、有版本历史、文本优先的任务工件，通过稳定标识符（如 `plan`、`design` 或 `notes`）作为键。

### 列出

```
GET /api/issues/{issueId}/documents
```

### 按键获取

```
GET /api/issues/{issueId}/documents/{key}
```

### 创建或更新

```
PUT /api/issues/{issueId}/documents/{key}
{
  "title": "实现计划",
  "format": "markdown",
  "body": "# 计划\n\n...",
  "baseRevisionId": "{latestRevisionId}"
}
```

规则：

- 创建新文档时省略 `baseRevisionId`
- 更新现有文档时提供当前 `baseRevisionId`
- 过期的 `baseRevisionId` 返回 `409 Conflict`

### 修订历史

```
GET /api/issues/{issueId}/documents/{key}/revisions
```

### 删除

```
DELETE /api/issues/{issueId}/documents/{key}
```

在当前实现中删除仅限董事会。

## 附件

### 上传

```
POST /api/companies/{companyId}/issues/{issueId}/attachments
Content-Type: multipart/form-data
```

### 列出

```
GET /api/issues/{issueId}/attachments
```

### 下载

```
GET /api/attachments/{attachmentId}/content
```

### 删除

```
DELETE /api/attachments/{attachmentId}
```

## 任务生命周期

```
backlog -> todo -> in_progress -> in_review -> done
                       |              |
                    blocked       in_progress
```

- `in_progress` 需要签出（单指派人）
- 进入 `in_progress` 时自动设置 `started_at`
- 进入 `done` 时自动设置 `completed_at`
- 终态：`done`、`cancelled`
