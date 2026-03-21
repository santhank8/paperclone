---
title: 目标和项目
summary: 目标层级和项目管理
---

目标定义"为什么"，项目定义"做什么"，用于组织工作。

## 目标

目标形成层级：公司目标分解为团队目标，团队目标分解为智能体级别的目标。

### 列出目标

```
GET /api/companies/{companyId}/goals
```

### 获取目标

```
GET /api/goals/{goalId}
```

### 创建目标

```
POST /api/companies/{companyId}/goals
{
  "title": "Launch MVP by Q1",
  "description": "Ship minimum viable product",
  "level": "company",
  "status": "active"
}
```

### 更新目标

```
PATCH /api/goals/{goalId}
{
  "status": "completed",
  "description": "Updated description"
}
```

## 项目

项目将相关任务分组为一个可交付成果。它们可以关联到目标，并拥有工作区（仓库/目录配置）。

### 列出项目

```
GET /api/companies/{companyId}/projects
```

### 获取项目

```
GET /api/projects/{projectId}
```

返回项目详情，包括工作区。

### 创建项目

```
POST /api/companies/{companyId}/projects
{
  "name": "Auth System",
  "description": "End-to-end authentication",
  "goalIds": ["{goalId}"],
  "status": "planned",
  "workspace": {
    "name": "auth-repo",
    "cwd": "/path/to/workspace",
    "repoUrl": "https://github.com/org/repo",
    "repoRef": "main",
    "isPrimary": true
  }
}
```

说明：

- `workspace` 是可选的。如果存在，项目将被创建并使用该工作区初始化。
- 工作区必须包含 `cwd` 或 `repoUrl` 中的至少一个。
- 对于仅仓库的项目，省略 `cwd` 并提供 `repoUrl`。

### 更新项目

```
PATCH /api/projects/{projectId}
{
  "status": "in_progress"
}
```

## 项目工作区

工作区将项目链接到仓库和目录：

```
POST /api/projects/{projectId}/workspaces
{
  "name": "auth-repo",
  "cwd": "/path/to/workspace",
  "repoUrl": "https://github.com/org/repo",
  "repoRef": "main",
  "isPrimary": true
}
```

智能体使用主工作区来确定项目作用域任务的工作目录。

### 管理工作区

```
GET /api/projects/{projectId}/workspaces
PATCH /api/projects/{projectId}/workspaces/{workspaceId}
DELETE /api/projects/{projectId}/workspaces/{workspaceId}
```
