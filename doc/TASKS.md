# 任务管理数据模型

Paperclip 中任务跟踪工作方式的参考文档。描述实体、它们的关系以及管理任务生命周期的规则。作为目标模型编写——其中一些已经实现，一些是期望目标。

---

## 实体层次结构

```
Workspace
  Initiatives          (路线图级别的目标，跨越季度)
    Projects           (有时限的可交付成果，可跨团队)
      Milestones       (项目内的阶段)
        Issues         (工作单元，核心实体)
          Sub-issues   (父任务下的拆分工作)
```

一切自上而下流动。计划包含项目；项目包含里程碑和任务；任务可以有子任务。每个层级增加粒度。

---

## 任务（核心实体）

任务是基本的工作单元。

### 字段

| 字段 | 类型 | 必需 | 说明 |
| ------------- | ---------------- | -------- | ----------------------------------------------------------------- |
| `id` | uuid | 是 | 主键 |
| `identifier` | string | 计算 | 人类可读标识符，如 `ENG-123`（团队键 + 自增编号） |
| `title` | string | 是 | 简短摘要 |
| `description` | text/markdown | 否 | 完整描述，支持 markdown |
| `status` | WorkflowState FK | 是 | 默认为团队的默认状态 |
| `priority` | enum (0-4) | 否 | 默认为 0（无）。见优先级部分。 |
| `estimate` | number | 否 | 复杂度/规模点数 |
| `dueDate` | date | 否 | |
| `teamId` | uuid FK | 是 | 每个任务恰好属于一个团队 |
| `projectId` | uuid FK | 否 | 每个任务最多属于一个项目 |
| `milestoneId` | uuid FK | 否 | 每个任务最多属于一个里程碑 |
| `assigneeId` | uuid FK | 否 | **单一负责人。**见负责人部分。 |
| `creatorId` | uuid FK | 否 | 创建者 |
| `parentId` | uuid FK (self) | 否 | 父任务，用于子任务关系 |
| `goalId` | uuid FK | 否 | 关联的目标 |
| `sortOrder` | float | 否 | 视图中的排序 |
| `createdAt` | timestamp | 是 | |
| `updatedAt` | timestamp | 是 | |
| `startedAt` | timestamp | 计算 | 任务进入"已开始"状态的时间 |
| `completedAt` | timestamp | 计算 | 任务进入"已完成"状态的时间 |
| `cancelledAt` | timestamp | 计算 | 任务进入"已取消"状态的时间 |
| `archivedAt` | timestamp | 否 | 软归档 |

---

## 工作流状态

任务状态**不是**扁平枚举。它是每个团队特定的命名状态集合，每个状态属于以下固定**分类**之一：

| 分类 | 用途 | 示例状态 |
| ------------- | ---------------------------- | ------------------------------- |
| **Triage** | 传入，需要审查 | Triage |
| **Backlog** | 已接受，尚未准备好工作 | Backlog、Icebox |
| **Unstarted** | 准备好但尚未开始 | Todo、Ready |
| **Started** | 活跃工作 | In Progress、In Review、In QA |
| **Completed** | 完成 | Done、Shipped |
| **Cancelled** | 被拒绝或放弃 | Cancelled、Won't Fix、Duplicate |

### 规则

- 每个团队在这些分类内定义自己的工作流状态
- 团队必须在每个分类中至少有一个状态（Triage 是可选的）
- 可以在任何分类内添加自定义状态（如 Started 下的"In Review"）
- 分类是固定的且有序的——你可以在分类_内_重新排序状态，但不能重新排序分类本身
- 新任务默认为团队的第一个 Backlog 状态
- 将任务移动到 Started 状态自动设置 `startedAt`；Completed 设置 `completedAt`；Cancelled 设置 `cancelledAt`
- 将任务标记为重复自动将其移至 Cancelled 状态

### WorkflowState 字段

| 字段 | 类型 | 说明 |
| ------------- | ------- | ----------------------------------------------------------------------------- |
| `id` | uuid | |
| `name` | string | 显示名称，如"In Review" |
| `type` | enum | 以下之一：`triage`、`backlog`、`unstarted`、`started`、`completed`、`cancelled` |
| `color` | string | 十六进制颜色 |
| `description` | string | 可选指导文本 |
| `position` | float | 分类内的排序 |
| `teamId` | uuid FK | 每个状态属于一个团队 |

---

## 优先级

固定的、不可自定义的数字刻度：

| 值 | 标签 | 说明 |
| ----- | ----------- | -------------------------------------- |
| 0 | 无优先级 | 默认。在优先级视图中排在最后。 |
| 1 | 紧急 | 可能触发立即通知 |
| 2 | 高 | |
| 3 | 中 | |
| 4 | 低 | |

该刻度故意小且固定。使用标签进行额外分类，而不是添加更多优先级级别。

---

## 团队

团队是主要的组织单位。几乎所有内容都以团队为范围。

| 字段 | 类型 | 说明 |
| ------------- | ------ | -------------------------------------------------------------- |
| `id` | uuid | |
| `name` | string | 如"Engineering" |
| `key` | string | 短的大写前缀，如"ENG"。用于任务标识符。 |
| `description` | string | |

### 团队范围

- 每个任务恰好属于一个团队
- 工作流状态是每团队的
- 标签可以是团队范围的或工作区范围的
- 项目可以跨多个团队

在我们的上下文中（AI 公司），团队映射到功能区域。每个智能体根据角色向一个团队汇报。

---

## 项目

项目将任务分组到特定的、有时限的可交付成果中。它们可以跨多个团队。

| 字段 | 类型 | 说明 |
| ------------- | --------- | ------------------------------------------------------------- |
| `id` | uuid | |
| `name` | string | |
| `description` | text | |
| `summary` | string | 简短描述 |
| `status` | enum | `backlog`、`planned`、`in_progress`、`completed`、`cancelled` |
| `leadId` | uuid FK | 单一负责人以确保问责 |
| `startDate` | date | |
| `targetDate` | date | |
| `createdAt` | timestamp | |
| `updatedAt` | timestamp | |

### 规则

- 一个任务最多属于一个项目
- 项目状态**手动**更新（不从任务状态自动派生）
- 项目可以包含文档（规范、简报）作为关联实体

---

## 里程碑

里程碑将项目细分为有意义的阶段。

| 字段 | 类型 | 说明 |
| ------------- | ------- | ------------------------------ |
| `id` | uuid | |
| `name` | string | |
| `description` | text | |
| `targetDate` | date | |
| `projectId` | uuid FK | 恰好属于一个项目 |
| `sortOrder` | float | |

项目内的任务可以选择性地分配到一个里程碑。

---

## 标签

标签提供分类标记。它们存在于两个范围：

- **工作区标签** —— 在所有团队中可用
- **团队标签** —— 限制在特定团队

| 字段 | 类型 | 说明 |
| ------------- | -------------- | ------------------------------- |
| `id` | uuid | |
| `name` | string | |
| `color` | string | 十六进制颜色 |
| `description` | string | 上下文指导 |
| `teamId` | uuid FK | 工作区级标签为 Null |
| `groupId` | uuid FK (self) | 用于分组的父标签 |

### 标签组

标签可以组织为一级嵌套（组 -> 标签）：

- 组内的标签在一个任务上是**互斥的**（每个组只能应用一个）
- 组不能包含其他组（仅一级嵌套）
- 示例：组"类型"包含标签"Bug"、"Feature"、"Chore"——一个任务最多选择一个

### 任务-标签关联

通过 `issue_labels` 连接表的多对多关系：

| 字段 | 类型 |
| --------- | ------- |
| `issueId` | uuid FK |
| `labelId` | uuid FK |

---

## 任务关系/依赖

四种任务间关系类型：

| 类型 | 含义 | 行为 |
| ------------ | -------------------------------- | --------------------------------------------- |
| `related` | 一般关联 | 信息性链接 |
| `blocks` | 此任务阻塞另一个 | 被阻塞的任务显示标记 |
| `blocked_by` | 此任务被另一个阻塞 | blocks 的反向 |
| `duplicate` | 此任务与另一个重复 | 自动将重复项移至 Cancelled 状态 |

### IssueRelation 字段

| 字段 | 类型 | 说明 |
| ---------------- | ------- | ---------------------------------------------- |
| `id` | uuid | |
| `type` | enum | `related`、`blocks`、`blocked_by`、`duplicate` |
| `issueId` | uuid FK | 源任务 |
| `relatedIssueId` | uuid FK | 目标任务 |

### 规则

- 当阻塞任务被解决时，关系变为信息性（标记变绿）
- 重复是单向的（标记重复项，不是规范项）
- 阻塞在系统级别**不是传递性的**（A 阻塞 B，B 阻塞 C 不会自动阻塞 A->C）

---

## 负责人

**单一负责人模型**，按设计。

- 每个任务同一时间最多有一个负责人
- 这是刻意的：明确的所有权防止责任分散
- 对于涉及多人的协作工作，使用带有不同负责人的**子任务**

在我们的上下文中，智能体是负责人。任务上的 `assigneeId` 外键指向 `agents` 表。

---

## 子任务（父/子）

任务支持父/子嵌套。

- 在任务上设置 `parentId` 使其成为子任务
- 子任务本身可以有子任务（多级嵌套）
- 子任务在创建时从父任务继承**项目**（不是追溯的），但不继承团队、标签或负责人

### 自动关闭

- **子任务自动关闭**：当父任务完成时，剩余子任务自动完成

### 转换

- 现有任务可以重新指定父任务（添加或移除 `parentId`）
- 有很多子任务的父任务可以"提升"为项目

---

## 估算

基于点数的估算，每团队配置。

### 可用刻度

| 刻度 | 值 |
| ----------- | ------------------------ |
| 指数 | 1, 2, 4, 8, 16 (+32, 64) |

未估算的任务在进度/速度计算中默认为 1 点。

---

## 评论

| 字段 | 类型 | 说明 |
| ------------ | -------------- | -------------------------- |
| `id` | uuid | |
| `body` | text/markdown | |
| `issueId` | uuid FK | |
| `authorId` | uuid FK | 可以是用户或智能体 |
| `parentId` | uuid FK (self) | 用于线程回复 |
| `resolvedAt` | timestamp | 如果线程已解决 |
| `createdAt` | timestamp | |
| `updatedAt` | timestamp | |

---

## 计划

最高级别的规划构造。将项目分组到战略目标中。计划有战略负责人，通常通过成果/OKR 来衡量，而不是"完成/未完成"。

| 字段 | 类型 | 说明 |
| ------------- | ------- | -------------------------------- |
| `id` | uuid | |
| `name` | string | |
| `description` | text | |
| `ownerId` | uuid FK | 单一负责人 |
| `status` | enum | `planned`、`active`、`completed` |
| `targetDate` | date | |

计划包含项目（多对多）并提供所有包含项目的进度汇总视图。

---

## 标识符

任务使用人类可读标识符：`{TEAM_KEY}-{NUMBER}`

- 团队键：每团队设置的短大写字符串（如"ENG"、"DES"）
- 编号：每团队自增整数
- 示例：`ENG-123`、`DES-45`、`OPS-7`
- 如果任务在团队间移动，它会获得新标识符，旧标识符保留在 `previousIdentifiers` 中

这比 UUID 对于人类交流好得多。人们说"处理 ENG-42"而不是"处理 7f3a..."。

---

## 实体关系

```
Team (1) ----< (many) Issue
Team (1) ----< (many) WorkflowState
Team (1) ----< (many) Label (team-scoped)

Issue (many) >---- (1) WorkflowState
Issue (many) >---- (0..1) Assignee (Agent)
Issue (many) >---- (0..1) Project
Issue (many) >---- (0..1) Milestone
Issue (many) >---- (0..1) Parent Issue
Issue (1) ----< (many) Sub-issues
Issue (many) >---< (many) Labels         (via issue_labels)
Issue (many) >---< (many) Issue Relations (via issue_relations)
Issue (1) ----< (many) Comments

Project (many) >---- (0..1) Lead (Agent)
Project (1) ----< (many) Milestones
Project (1) ----< (many) Issues

Initiative (many) >---< (many) Projects  (via initiative_projects)
Initiative (many) >---- (1) Owner (Agent)
```

---

## 实现优先级

推荐的构建顺序，最高价值优先：

### 高价值

1. **团队** —— `teams` 表 + 任务上的 `teamId` FK。人类可读标识符（`ENG-123`）和每团队工作流状态的基础。大多数其他功能依赖于团队范围，所以首先构建这个。
2. **工作流状态** —— `workflow_states` 表 + 任务上的 `stateId` FK。带有基于分类的状态转换的每团队自定义工作流。
3. **标签** —— `labels` + `issue_labels` 表。分类（bug/feature/chore、区域标签等）而不污染状态字段。
4. **任务关系** —— `issue_relations` 表。阻塞/被阻塞对于智能体协调至关重要（智能体 A 在智能体 B 完成之前不能开始）。
5. **子任务** —— `issues` 上的 `parentId` 自引用 FK。让智能体拆分大型任务。
6. **评论** —— `comments` 表。智能体需要在不覆盖描述的情况下就任务进行沟通。

### 中等价值

7. **转换时间戳** —— 任务上的 `startedAt`、`completedAt`、`cancelledAt`，由工作流状态变更自动设置。支持速度跟踪和 SLA 测量。

### 较低优先级（后续）

8. **里程碑** —— 当项目变得复杂到需要阶段时有用。
9. **计划** —— 当我们有多个服务于共同战略目标的项目时有用。
10. **估算** —— 当我们想要测量吞吐量和预测产能时有用。
