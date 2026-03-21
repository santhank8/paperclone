# Paperclip V1 实现规范

状态：第一版（V1）发布的实现合约
日期：2026-02-17
读者：产品、工程和智能体集成作者
输入来源：`GOAL.md`、`PRODUCT.md`、`SPEC.md`、`DATABASE.md`、当前 monorepo 代码

## 1. 文档角色

`SPEC.md` 仍然是长期产品规范。
本文档是具体的、可构建的 V1 合约。
当存在冲突时，`SPEC-implementation.md` 控制 V1 行为。

## 2. V1 目标成果

Paperclip V1 必须为自治智能体提供完整的控制平面循环：

1. 人类董事会创建公司并定义目标。
2. 董事会在组织树中创建和管理智能体。
3. 智能体通过心跳调用接收并执行任务。
4. 所有工作通过任务/评论进行跟踪，具备审计可见性。
5. Token/成本使用被报告，预算限制可以停止工作。
6. 董事会可以在任何地方进行干预（暂停智能体/任务、覆盖决策）。

成功意味着一个运营者可以端到端运行一个小型 AI 原生公司，具有清晰的可见性和控制力。

## 3. 明确的 V1 产品决策

这些决策关闭了 `SPEC.md` 中 V1 的未决问题。

| 主题 | V1 决策 |
|---|---|
| 租户模式 | 单租户部署，多公司数据模型 |
| 公司模型 | 公司是一等实体；所有业务实体都在公司范围内 |
| 董事会 | 每次部署一个人类董事会运营者 |
| 组织图 | 严格树结构（`reports_to` 可为空的根节点）；不支持多管理者汇报 |
| 可见性 | 董事会和同一公司的所有智能体具有完全可见性 |
| 沟通 | 仅限任务 + 评论（无独立聊天系统） |
| 任务归属 | 单一负责人；`in_progress` 转换需要原子签出 |
| 恢复 | 不自动重新分配；工作恢复保持手动/显式 |
| 智能体适配器 | 内置 `process` 和 `http` 适配器 |
| 认证 | 模式相关的人类认证（当前代码中 `local_trusted` 隐式董事会；认证模式使用会话），智能体使用 API 密钥 |
| 预算周期 | 月度 UTC 日历窗口 |
| 预算执行 | 软告警 + 硬限制自动暂停 |
| 部署模式 | 规范模型是 `local_trusted` + `authenticated`，带 `private/public` 暴露策略（参见 `doc/DEPLOYMENT-MODES.md`） |

## 4. 当前基线（仓库快照）

截至 2026-02-17，仓库已包含：

- Node + TypeScript 后端，REST CRUD 用于 `agents`、`projects`、`goals`、`issues`、`activity`
- React UI 页面用于仪表盘/智能体/项目/目标/任务列表
- 通过 Drizzle 的 PostgreSQL 模式，当 `DATABASE_URL` 未设置时使用嵌入式 PostgreSQL 回退

V1 实现将此基线扩展为以公司为中心、治理感知的控制平面。

## 5. V1 范围

## 5.1 范围内

- 公司生命周期（创建/列表/获取/更新/归档）
- 与公司使命关联的目标层次结构
- 具有组织结构和适配器配置的智能体生命周期
- 具有父/子层次结构和评论的任务生命周期
- 原子任务签出和显式任务状态转换
- 招聘和 CEO 战略提案的董事会审批
- 心跳调用、状态跟踪和取消
- 成本事件摄取和汇总（智能体/任务/项目/公司）
- 预算设置和硬停止执行
- 董事会 Web UI 用于仪表盘、组织图、任务、智能体、审批、成本
- 面向智能体的 API 合约（任务读/写、心跳报告、成本报告）
- 所有变更操作的可审计活动日志

## 5.2 范围外（V1）

- 插件框架和第三方扩展 SDK
- 超出模型/Token 成本的收入/费用核算
- 知识库子系统
- 公开市场（ClipHub）
- 多董事会治理或基于角色的人类权限粒度
- 自动自愈编排（自动重新分配/重试规划器）

## 6. 架构

## 6.1 运行时组件

- `server/`：REST API、认证、编排服务
- `ui/`：董事会运营者界面
- `packages/db/`：Drizzle 模式、迁移、数据库客户端（Postgres）
- `packages/shared/`：共享 API 类型、验证器、常量

## 6.2 数据存储

- 主要：PostgreSQL
- 本地默认：嵌入式 PostgreSQL 在 `~/.paperclip/instances/default/db`
- 可选本地生产级：Docker Postgres
- 可选托管：Supabase/Postgres 兼容
- 文件/对象存储：
  - 本地默认：`~/.paperclip/instances/default/data/storage`（`local_disk`）
  - 云：S3 兼容的对象存储（`s3`）

## 6.3 后台处理

服务器进程中的轻量级调度器/工作器处理：

- 心跳触发检查
- 卡住的运行检测
- 预算阈值检查

V1 不需要独立的队列基础设施。

## 7. 规范数据模型（V1）

所有核心表包含 `id`、`created_at`、`updated_at`，除非另有说明。

## 7.0 认证表

人类认证表（`users`、`sessions` 和提供商特定的认证工件）由所选认证库管理。本规范将它们视为必需依赖项，并在需要用户归属时引用 `users.id`。

## 7.1 `companies`

- `id` uuid pk
- `name` text not null
- `description` text null
- `status` enum: `active | paused | archived`

不变量：每条业务记录恰好属于一个公司。

## 7.2 `agents`

- `id` uuid pk
- `company_id` uuid fk `companies.id` not null
- `name` text not null
- `role` text not null
- `title` text null
- `status` enum: `active | paused | idle | running | error | terminated`
- `reports_to` uuid fk `agents.id` null
- `capabilities` text null
- `adapter_type` enum: `process | http`
- `adapter_config` jsonb not null
- `context_mode` enum: `thin | fat` default `thin`
- `budget_monthly_cents` int not null default 0
- `spent_monthly_cents` int not null default 0
- `last_heartbeat_at` timestamptz null

不变量：

- 智能体和管理者必须在同一公司
- 汇报树中不能有循环
- `terminated` 智能体不能被恢复

## 7.3 `agent_api_keys`

- `id` uuid pk
- `agent_id` uuid fk `agents.id` not null
- `company_id` uuid fk `companies.id` not null
- `name` text not null
- `key_hash` text not null
- `last_used_at` timestamptz null
- `revoked_at` timestamptz null

不变量：明文密钥在创建时只显示一次；仅存储哈希值。

## 7.4 `goals`

- `id` uuid pk
- `company_id` uuid fk not null
- `title` text not null
- `description` text null
- `level` enum: `company | team | agent | task`
- `parent_id` uuid fk `goals.id` null
- `owner_agent_id` uuid fk `agents.id` null
- `status` enum: `planned | active | achieved | cancelled`

不变量：每个公司至少有一个根级别的 `company` 目标。

## 7.5 `projects`

- `id` uuid pk
- `company_id` uuid fk not null
- `goal_id` uuid fk `goals.id` null
- `name` text not null
- `description` text null
- `status` enum: `backlog | planned | in_progress | completed | cancelled`
- `lead_agent_id` uuid fk `agents.id` null
- `target_date` date null

## 7.6 `issues`（核心任务实体）

- `id` uuid pk
- `company_id` uuid fk not null
- `project_id` uuid fk `projects.id` null
- `goal_id` uuid fk `goals.id` null
- `parent_id` uuid fk `issues.id` null
- `title` text not null
- `description` text null
- `status` enum: `backlog | todo | in_progress | in_review | done | blocked | cancelled`
- `priority` enum: `critical | high | medium | low`
- `assignee_agent_id` uuid fk `agents.id` null
- `created_by_agent_id` uuid fk `agents.id` null
- `created_by_user_id` uuid fk `users.id` null
- `request_depth` int not null default 0
- `billing_code` text null
- `started_at` timestamptz null
- `completed_at` timestamptz null
- `cancelled_at` timestamptz null

不变量：

- 仅单一负责人
- 任务必须通过 `goal_id`、`parent_id` 或项目-目标关联追溯到公司目标链
- `in_progress` 需要负责人
- 终态：`done`、`cancelled`

## 7.7 `issue_comments`

- `id` uuid pk
- `company_id` uuid fk not null
- `issue_id` uuid fk `issues.id` not null
- `author_agent_id` uuid fk `agents.id` null
- `author_user_id` uuid fk `users.id` null
- `body` text not null

## 7.8 `heartbeat_runs`

- `id` uuid pk
- `company_id` uuid fk not null
- `agent_id` uuid fk not null
- `invocation_source` enum: `scheduler | manual | callback`
- `status` enum: `queued | running | succeeded | failed | cancelled | timed_out`
- `started_at` timestamptz null
- `finished_at` timestamptz null
- `error` text null
- `external_run_id` text null
- `context_snapshot` jsonb null

## 7.9 `cost_events`

- `id` uuid pk
- `company_id` uuid fk not null
- `agent_id` uuid fk `agents.id` not null
- `issue_id` uuid fk `issues.id` null
- `project_id` uuid fk `projects.id` null
- `goal_id` uuid fk `goals.id` null
- `billing_code` text null
- `provider` text not null
- `model` text not null
- `input_tokens` int not null default 0
- `output_tokens` int not null default 0
- `cost_cents` int not null
- `occurred_at` timestamptz not null

不变量：每个事件必须关联到智能体和公司；汇总是聚合结果，不可手动编辑。

## 7.10 `approvals`

- `id` uuid pk
- `company_id` uuid fk not null
- `type` enum: `hire_agent | approve_ceo_strategy`
- `requested_by_agent_id` uuid fk `agents.id` null
- `requested_by_user_id` uuid fk `users.id` null
- `status` enum: `pending | approved | rejected | cancelled`
- `payload` jsonb not null
- `decision_note` text null
- `decided_by_user_id` uuid fk `users.id` null
- `decided_at` timestamptz null

## 7.11 `activity_log`

- `id` uuid pk
- `company_id` uuid fk not null
- `actor_type` enum: `agent | user | system`
- `actor_id` uuid/text not null
- `action` text not null
- `entity_type` text not null
- `entity_id` uuid/text not null
- `details` jsonb null
- `created_at` timestamptz not null default now()

## 7.12 `company_secrets` + `company_secret_versions`

- 密钥值不内联存储在 `agents.adapter_config.env` 中。
- 智能体环境条目应为敏感值使用密钥引用。
- `company_secrets` 按公司跟踪身份/提供商元数据。
- `company_secret_versions` 按版本存储加密/引用材料。
- 本地部署的默认提供商：`local_encrypted`。

运营策略：

- 配置读取 API 需脱敏处理敏感明文值。
- 活动和审批负载中不得持久化原始敏感值。
- 配置修订可包含脱敏占位符；此类修订的脱敏字段不可恢复。

## 7.13 必需索引

- `agents(company_id, status)`
- `agents(company_id, reports_to)`
- `issues(company_id, status)`
- `issues(company_id, assignee_agent_id, status)`
- `issues(company_id, parent_id)`
- `issues(company_id, project_id)`
- `cost_events(company_id, occurred_at)`
- `cost_events(company_id, agent_id, occurred_at)`
- `heartbeat_runs(company_id, agent_id, started_at desc)`
- `approvals(company_id, status, type)`
- `activity_log(company_id, created_at desc)`
- `assets(company_id, created_at desc)`
- `assets(company_id, object_key)` unique
- `issue_attachments(company_id, issue_id)`
- `company_secrets(company_id, name)` unique
- `company_secret_versions(secret_id, version)` unique

## 7.14 `assets` + `issue_attachments`

- `assets` 存储提供商支持的对象元数据（不是内联字节）：
  - `id` uuid pk
  - `company_id` uuid fk not null
  - `provider` enum/text (`local_disk | s3`)
  - `object_key` text not null
  - `content_type` text not null
  - `byte_size` int not null
  - `sha256` text not null
  - `original_filename` text null
  - `created_by_agent_id` uuid fk null
  - `created_by_user_id` uuid/text fk null
- `issue_attachments` 将资产关联到任务/评论：
  - `id` uuid pk
  - `company_id` uuid fk not null
  - `issue_id` uuid fk not null
  - `asset_id` uuid fk not null
  - `issue_comment_id` uuid fk null

## 7.15 `documents` + `document_revisions` + `issue_documents`

- `documents` 存储可编辑的文本优先文档：
  - `id` uuid pk
  - `company_id` uuid fk not null
  - `title` text null
  - `format` text not null (`markdown`)
  - `latest_body` text not null
  - `latest_revision_id` uuid null
  - `latest_revision_number` int not null
  - `created_by_agent_id` uuid fk null
  - `created_by_user_id` uuid/text fk null
  - `updated_by_agent_id` uuid fk null
  - `updated_by_user_id` uuid/text fk null
- `document_revisions` 存储仅追加的历史记录：
  - `id` uuid pk
  - `company_id` uuid fk not null
  - `document_id` uuid fk not null
  - `revision_number` int not null
  - `body` text not null
  - `change_summary` text null
- `issue_documents` 通过稳定的工作流键将文档关联到任务：
  - `id` uuid pk
  - `company_id` uuid fk not null
  - `issue_id` uuid fk not null
  - `document_id` uuid fk not null
  - `key` text not null (`plan`、`design`、`notes` 等)

## 8. 状态机

## 8.1 智能体状态

允许的转换：

- `idle -> running`
- `running -> idle`
- `running -> error`
- `error -> idle`
- `idle -> paused`
- `running -> paused`（需要取消流程）
- `paused -> idle`
- `* -> terminated`（仅董事会，不可逆）

## 8.2 任务状态

允许的转换：

- `backlog -> todo | cancelled`
- `todo -> in_progress | blocked | cancelled`
- `in_progress -> in_review | blocked | done | cancelled`
- `in_review -> in_progress | done | cancelled`
- `blocked -> todo | in_progress | cancelled`
- 终态：`done`、`cancelled`

副作用：

- 进入 `in_progress` 时如果为空则设置 `started_at`
- 进入 `done` 时设置 `completed_at`
- 进入 `cancelled` 时设置 `cancelled_at`

## 8.3 审批状态

- `pending -> approved | rejected | cancelled`
- 决策后为终态

## 9. 认证和权限

## 9.1 董事会认证

- 人类运营者的基于会话的认证
- 董事会对部署中所有公司具有完全读/写权限
- 每次董事会变更写入 `activity_log`

## 9.2 智能体认证

- Bearer API 密钥映射到一个智能体和一个公司
- 智能体密钥范围：
  - 读取本公司的组织/任务/公司上下文
  - 读/写自己分配的任务和评论
  - 为委派创建任务/评论
  - 报告心跳状态
  - 报告成本事件
- 智能体不能：
  - 绕过审批门
  - 直接修改公司级预算
  - 修改认证/密钥

## 9.3 权限矩阵（V1）

| 操作 | 董事会 | 智能体 |
|---|---|---|
| 创建公司 | 是 | 否 |
| 招聘/创建智能体 | 是（直接） | 通过审批请求 |
| 暂停/恢复智能体 | 是 | 否 |
| 创建/更新任务 | 是 | 是 |
| 强制重新分配任务 | 是 | 有限 |
| 审批战略/招聘请求 | 是 | 否 |
| 报告成本 | 是 | 是 |
| 设置公司预算 | 是 | 否 |
| 设置下属预算 | 是 | 是（仅管理者子树） |

## 10. API 合约（REST）

所有端点在 `/api` 下并返回 JSON。

## 10.1 公司

- `GET /companies`
- `POST /companies`
- `GET /companies/:companyId`
- `PATCH /companies/:companyId`
- `PATCH /companies/:companyId/branding`
- `POST /companies/:companyId/archive`

## 10.2 目标

- `GET /companies/:companyId/goals`
- `POST /companies/:companyId/goals`
- `GET /goals/:goalId`
- `PATCH /goals/:goalId`
- `DELETE /goals/:goalId`（可选软删除，硬删除仅董事会）

## 10.3 智能体

- `GET /companies/:companyId/agents`
- `POST /companies/:companyId/agents`
- `GET /agents/:agentId`
- `PATCH /agents/:agentId`
- `POST /agents/:agentId/pause`
- `POST /agents/:agentId/resume`
- `POST /agents/:agentId/terminate`
- `POST /agents/:agentId/keys`（创建 API 密钥）
- `POST /agents/:agentId/heartbeat/invoke`

## 10.4 任务（Issues）

- `GET /companies/:companyId/issues`
- `POST /companies/:companyId/issues`
- `GET /issues/:issueId`
- `PATCH /issues/:issueId`
- `GET /issues/:issueId/documents`
- `GET /issues/:issueId/documents/:key`
- `PUT /issues/:issueId/documents/:key`
- `GET /issues/:issueId/documents/:key/revisions`
- `DELETE /issues/:issueId/documents/:key`
- `POST /issues/:issueId/checkout`
- `POST /issues/:issueId/release`
- `POST /issues/:issueId/comments`
- `GET /issues/:issueId/comments`
- `POST /companies/:companyId/issues/:issueId/attachments`（多部分上传）
- `GET /issues/:issueId/attachments`
- `GET /attachments/:attachmentId/content`
- `DELETE /attachments/:attachmentId`

### 10.4.1 原子签出合约

`POST /issues/:issueId/checkout` 请求：

```json
{
  "agentId": "uuid",
  "expectedStatuses": ["todo", "backlog", "blocked"]
}
```

服务器行为：

1. 单个 SQL 更新，带 `WHERE id = ? AND status IN (?) AND (assignee_agent_id IS NULL OR assignee_agent_id = :agentId)`
2. 如果更新行数为 0，返回 `409` 及当前所有者/状态
3. 成功签出设置 `assignee_agent_id`、`status = in_progress` 和 `started_at`

## 10.5 项目

- `GET /companies/:companyId/projects`
- `POST /companies/:companyId/projects`
- `GET /projects/:projectId`
- `PATCH /projects/:projectId`

## 10.6 审批

- `GET /companies/:companyId/approvals?status=pending`
- `POST /companies/:companyId/approvals`
- `POST /approvals/:approvalId/approve`
- `POST /approvals/:approvalId/reject`

## 10.7 成本和预算

- `POST /companies/:companyId/cost-events`
- `GET /companies/:companyId/costs/summary`
- `GET /companies/:companyId/costs/by-agent`
- `GET /companies/:companyId/costs/by-project`
- `PATCH /companies/:companyId/budgets`
- `PATCH /agents/:agentId/budgets`

## 10.8 活动和仪表盘

- `GET /companies/:companyId/activity`
- `GET /companies/:companyId/dashboard`

仪表盘负载必须包含：

- 活跃/运行/暂停/错误智能体计数
- 打开/进行中/阻塞/完成任务计数
- 月初至今支出和预算使用率
- 待处理审批计数

## 10.9 错误语义

- `400` 验证错误
- `401` 未认证
- `403` 未授权
- `404` 未找到
- `409` 状态冲突（签出冲突、无效转换）
- `422` 语义规则违反
- `500` 服务器错误

## 11. 心跳和适配器合约

## 11.1 适配器接口

```ts
interface AgentAdapter {
  invoke(agent: Agent, context: InvocationContext): Promise<InvokeResult>;
  status(run: HeartbeatRun): Promise<RunStatus>;
  cancel(run: HeartbeatRun): Promise<void>;
}
```

## 11.2 进程适配器

配置形状：

```json
{
  "command": "string",
  "args": ["string"],
  "cwd": "string",
  "env": {"KEY": "VALUE"},
  "timeoutSec": 900,
  "graceSec": 15
}
```

行为：

- 生成子进程
- 将 stdout/stderr 流式传输到运行日志
- 在退出码/超时时标记运行状态
- 取消先发送 SIGTERM 然后在宽限期后 SIGKILL

## 11.3 HTTP 适配器

配置形状：

```json
{
  "url": "https://...",
  "method": "POST",
  "headers": {"Authorization": "Bearer ..."},
  "timeoutMs": 15000,
  "payloadTemplate": {"agentId": "{{agent.id}}", "runId": "{{run.id}}"}
}
```

行为：

- 通过出站 HTTP 请求调用
- 2xx 表示已接受
- 非 2xx 标记调用失败
- 可选回调端点允许异步完成更新

## 11.4 上下文传递

- `thin`：仅发送 ID 和指针；智能体通过 API 获取上下文
- `fat`：包含当前分配、目标摘要、预算快照和最近评论

## 11.5 调度器规则

`adapter_config` 中的每智能体调度字段：

- `enabled` boolean
- `intervalSec` integer（最小 30）
- `maxConcurrentRuns` V1 固定为 `1`

调度器在以下情况下必须跳过调用：

- 智能体被暂停/终止
- 已有活跃运行
- 硬预算限制已达到

## 12. 治理和审批流程

## 12.1 招聘

1. 智能体或董事会创建 `approval(type=hire_agent, status=pending, payload=agent draft)`。
2. 董事会批准或拒绝。
3. 批准后，服务器创建智能体行和初始 API 密钥（可选）。
4. 决策记录在 `activity_log` 中。

董事会可以绕过请求流程直接通过 UI 创建智能体；直接创建仍然作为治理操作被记录。

## 12.2 CEO 战略审批

1. CEO 发布战略提案为 `approval(type=approve_ceo_strategy)`。
2. 董事会审查负载（计划文本、初始结构、高级任务）。
3. 审批解锁 CEO 创建的委派工作的执行状态。

在首次战略审批之前，CEO 只能起草任务，不能将它们转换为活跃执行状态。

## 12.3 董事会覆盖

董事会可以在任何时候：

- 暂停/恢复/终止任何智能体
- 重新分配或取消任何任务
- 编辑预算和限制
- 批准/拒绝/取消待处理的审批

## 13. 成本和预算系统

## 13.1 预算层级

- 公司月度预算
- 智能体月度预算
- 可选项目预算（如果配置）

## 13.2 执行规则

- 软告警默认阈值：80%
- 硬限制：在 100% 时触发：
  - 将智能体状态设为 `paused`
  - 阻止该智能体的新签出/调用
  - 发出高优先级活动事件

董事会可以通过提高预算或显式恢复智能体来覆盖。

## 13.3 成本事件摄取

`POST /companies/:companyId/cost-events` 请求体：

```json
{
  "agentId": "uuid",
  "issueId": "uuid",
  "provider": "openai",
  "model": "gpt-5",
  "inputTokens": 1234,
  "outputTokens": 567,
  "costCents": 89,
  "occurredAt": "2026-02-17T20:25:00Z",
  "billingCode": "optional"
}
```

验证：

- 非负 Token 计数
- `costCents >= 0`
- 所有关联实体的公司所有权检查

## 13.4 汇总

V1 可接受读取时聚合查询。
如果查询延迟超过目标，可后续添加物化汇总。

## 14. UI 需求（董事会应用）

V1 UI 路由：

- `/` 仪表盘
- `/companies` 公司列表/创建
- `/companies/:id/org` 组织图和智能体状态
- `/companies/:id/tasks` 任务列表/看板
- `/companies/:id/agents/:agentId` 智能体详情
- `/companies/:id/costs` 成本和预算仪表盘
- `/companies/:id/approvals` 待处理/历史审批
- `/companies/:id/activity` 审计/事件流

必需的 UX 行为：

- 全局公司选择器
- 快速操作：暂停/恢复智能体、创建任务、批准/拒绝请求
- 原子签出失败时的冲突提示
- 无静默后台失败；每次失败的运行在 UI 中可见

## 15. 运维需求

## 15.1 环境

- Node 20+
- `DATABASE_URL` 可选
- 如果未设置，自动使用 PGlite 并推送模式

## 15.2 迁移

- Drizzle 迁移是事实来源
- V1 升级路径中没有破坏性就地迁移
- 提供从现有最小表到公司范围模式的迁移脚本

## 15.3 日志和审计

- 结构化日志（生产环境中为 JSON）
- 每个 API 调用的请求 ID
- 每次变更写入 `activity_log`

## 15.4 可靠性目标

- 在 1k 任务/公司时标准 CRUD 的 API p95 延迟低于 250 ms
- 进程适配器的心跳调用确认低于 2 秒
- 不丢失审批决策（事务性写入）

## 16. 安全需求

- 仅存储哈希的智能体 API 密钥
- 日志中脱敏密钥（`adapter_config`、认证头、环境变量）
- 董事会会话端点的 CSRF 保护
- 认证和密钥管理端点的速率限制
- 每次实体获取/变更时严格的公司边界检查

## 17. 测试策略

## 17.1 单元测试

- 状态转换守卫（智能体、任务、审批）
- 预算执行规则
- 适配器调用/取消语义

## 17.2 集成测试

- 原子签出冲突行为
- 审批到智能体创建流程
- 成本摄取和汇总正确性
- 运行活跃时暂停（优雅取消然后强制终止）

## 17.3 端到端测试

- 董事会创建公司 -> 招聘 CEO -> 批准战略 -> CEO 接收工作
- 智能体报告成本 -> 预算阈值达到 -> 自动暂停发生
- 跨团队任务委派，请求深度递增

## 17.4 最低回归套件

除非这些通过，否则发布候选被阻止：

1. 认证边界测试
2. 签出竞争测试
3. 硬预算停止测试
4. 智能体暂停/恢复测试
5. 仪表盘摘要一致性测试

## 18. 交付计划

## 里程碑 1：公司核心和认证

- 向现有实体添加 `companies` 和公司范围
- 添加董事会会话认证和智能体 API 密钥
- 将现有 API 路由迁移到公司感知路径

## 里程碑 2：任务和治理语义

- 实现原子签出端点
- 实现任务评论和生命周期守卫
- 实现审批表和招聘/战略工作流

## 里程碑 3：心跳和适配器运行时

- 实现适配器接口
- 交付带有取消语义的 `process` 适配器
- 交付带有超时/错误处理的 `http` 适配器
- 持久化心跳运行和状态

## 里程碑 4：成本和预算控制

- 实现成本事件摄取
- 实现月度汇总和仪表盘
- 执行硬限制自动暂停

## 里程碑 5：董事会 UI 完成

- 添加公司选择器和组织图视图
- 添加审批和成本页面

## 里程碑 6：加固和发布

- 完整的集成/端到端套件
- 用于本地测试的种子/演示公司模板
- 发布检查清单和文档更新

## 19. 验收标准（发布门控）

V1 仅在所有标准为真时才算完成：

1. 董事会用户可以创建多个公司并在它们之间切换。
2. 一个公司可以运行至少一个启用心跳的活跃智能体。
3. 任务签出在并发争夺时是冲突安全的，返回 `409`。
4. 智能体可以仅使用 API 密钥更新任务/评论并报告成本。
5. 董事会可以在 UI 中批准/拒绝招聘和 CEO 战略请求。
6. 预算硬限制自动暂停智能体并阻止新调用。
7. 仪表盘从实时数据库数据显示准确的计数/支出。
8. 每次变更在活动日志中可审计。
9. 应用默认使用嵌入式 PostgreSQL 运行，通过 `DATABASE_URL` 使用外部 Postgres。

## 20. V1 后待办（明确延期）

- 插件架构
- 更丰富的每团队工作流状态自定义
- 超出 V1 最低要求的里程碑/标签/依赖图深度
- 实时传输优化（SSE/WebSockets）
- 公共模板市场集成（ClipHub）

## 21. 公司可移植包（V1 附录）

V1 支持使用可移植包合约的公司导入/导出：

- 以 `COMPANY.md` 为根的 markdown 优先包
- 按约定的隐式文件夹发现
- `.paperclip.yaml` 附加文件用于 Paperclip 特定保真度
- 规范基础包是厂商中立的，与 `docs/companies/companies-spec.md` 对齐
- 通用约定：
  - `agents/<slug>/AGENTS.md`
  - `teams/<slug>/TEAM.md`
  - `projects/<slug>/PROJECT.md`
  - `projects/<slug>/tasks/<slug>/TASK.md`
  - `tasks/<slug>/TASK.md`
  - `skills/<slug>/SKILL.md`

V1 中的导出/导入行为：

- 导出生成干净的厂商中立 markdown 包加 `.paperclip.yaml`
- 项目和启动任务是可选的导出内容，而非默认包内容
- 导出移除环境特定路径（`cwd`、本地指令文件路径、内联提示重复）
- 导出永远不包含密钥值；环境输入被报告为可移植声明
- 导入支持目标模式：
  - 创建新公司
  - 导入到现有公司
- 导入支持冲突策略：`rename`、`skip`、`replace`
- 导入支持预览（模拟运行）后再应用
- GitHub 导入对未固定的引用发出警告而非阻止
