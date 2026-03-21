# 任务文档计划

状态：草稿
负责人：后端 + UI + 智能体协议
日期：2026-03-13
主要任务：`PAP-448`

## 摘要

为 Paperclip 添加一流的**文档**支持，作为可编辑、有版本历史、公司作用域的文本工件，可链接到任务。

第一个必需的约定是 key 为 `plan` 的文档。

这解决了 `PAP-448` 中的即时工作流问题：

- 计划不应再以 `<plan>` 块的形式存在于任务描述中
- 智能体和董事会用户应能直接创建/更新任务文档
- `GET /api/issues/:id` 应包含完整的 `plan` 文档并暴露其他可用文档
- 任务详情应在描述下渲染文档

这应作为更广泛工件系统的**文本文档切片**来构建，而不是附件/资源的替代品。

## 推荐的产品形态

### 文档 vs 附件 vs 工件

- **文档**：具有稳定键和修订历史的可编辑文本内容。
- **附件**：由存储（`assets` + `issue_attachments`）支撑的上传/生成的不透明文件。
- **工件**：后续的伞形/读取模型，可统一文档、附件、预览和工作区文件。

建议：

- 现在实现**任务文档**
- 保持现有附件不变
- 推迟完整工件统一，直到有第二个真正的消费者（超出任务文档 + 附件）

这使 `PAP-448` 保持聚焦，同时仍符合更大的工件方向。

## 目标

1. 给任务一流的带键文档，从 `plan` 开始。
2. 使文档可由董事会用户和同公司有任务访问权的智能体编辑。
3. 通过仅追加的修订保留变更历史。
4. 使 `plan` 文档在智能体/心跳使用的正常任务获取中自动可用。
5. 替换当前技能/文档中的 `<plan>` 描述内约定。
6. 保持设计与未来工件/交付物层兼容。

## 非目标

- 完整的协作文档编辑
- 二进制文件版本历史
- 浏览器 IDE 或工作区编辑器
- 在同一变更中完成完整工件系统实现
- 第一天就为每种实体类型实现通用多态关系

## 产品决策

### 1. 带键的任务文档

每个任务可以有多个文档。每个文档关系有一个稳定的键：

- `plan`
- `design`
- `notes`
- `report`
- 后续的自定义键

键规则：

- 每个任务唯一，不区分大小写
- 规范化为小写 slug 形式
- 面向机器且稳定
- 标题是独立的面向用户的字段

`plan` 键是约定的，由 Paperclip 工作流/文档保留。

### 2. 文本优先 v1

V1 文档应是文本优先的，而非任意 blob。

推荐支持的格式：

- `markdown`
- `plain_text`
- `json`
- `html`

建议：

- 为 `markdown` 优化 UI
- 为其他格式允许原始编辑
- 将 PDF/图片/CSV 等保持为附件/工件，而非可编辑文档

### 3. 修订模型

每次文档更新创建一个新的不可变修订。

当前文档行存储最新快照以加速读取。

### 4. 并发模型

不使用静默的最后写入获胜。

更新应包含 `baseRevisionId`：

- 创建：不需要基础修订
- 更新：`baseRevisionId` 必须与当前最新修订匹配
- 不匹配：返回 `409 Conflict`

这很重要，因为董事会用户和智能体都可能编辑同一文档。

### 5. 任务获取行为

`GET /api/issues/:id` 应包含：

- 当 `plan` 文档存在时的完整 `planDocument`
- 所有关联文档的 `documentSummaries`

不应默认内联每个文档正文。

这使任务获取对智能体有用，同时不让每个任务负载变得无界。

### 6. 旧版 `<plan>` 兼容性

如果任务没有 `plan` 文档但描述中包含旧版 `<plan>` 块：

- 在 API/UI 中将其作为旧版只读回退暴露
- 标记为旧版/合成的
- 两者都存在时优先使用真正的 `plan` 文档

建议：

- 在首次推出中不自动重写旧任务描述
- 后续提供显式的导入/迁移路径

## 建议的数据模型

建议：使文档成为一流实体，但通过联接表保持任务链接显式。

这今天保留了外键，并为未来的 `project_documents` 或 `company_documents` 表提供了干净的路径。

## 表

### `documents`

权威文本文档记录。

建议的列：

- `id`
- `company_id`
- `title`
- `format`
- `latest_body`
- `latest_revision_id`
- `latest_revision_number`
- `created_by_agent_id`
- `created_by_user_id`
- `updated_by_agent_id`
- `updated_by_user_id`
- `created_at`
- `updated_at`

### `document_revisions`

仅追加的历史。

建议的列：

- `id`
- `company_id`
- `document_id`
- `revision_number`
- `body`
- `change_summary`
- `created_by_agent_id`
- `created_by_user_id`
- `created_at`

约束：

- `(document_id, revision_number)` 唯一

### `issue_documents`

任务关系 + 工作流键。

建议的列：

- `id`
- `company_id`
- `issue_id`
- `document_id`
- `key`
- `created_at`
- `updated_at`

约束：

- `(company_id, issue_id, key)` 唯一
- `(document_id)` 唯一，以在 v1 中保持每个文档一个任务关系

## 为什么不使用 `assets`？

因为 `assets` 解决的是 blob 存储，而不是：

- 像 `plan` 这样的稳定带键语义
- 内联文本编辑
- 修订历史
- 乐观并发
- 在 `GET /issues/:id` 中的廉价包含

文档和附件应保持为独立的原语，然后在交付物/工件读取模型中汇合。

## 共享类型和 API 契约

## 新共享类型

添加：

- `DocumentFormat`
- `IssueDocument`
- `IssueDocumentSummary`
- `DocumentRevision`

推荐的 `IssueDocument` 形状：

```ts
type DocumentFormat = "markdown" | "plain_text" | "json" | "html";

interface IssueDocument {
  id: string;
  companyId: string;
  issueId: string;
  key: string;
  title: string | null;
  format: DocumentFormat;
  body: string;
  latestRevisionId: string;
  latestRevisionNumber: number;
  createdByAgentId: string | null;
  createdByUserId: string | null;
  updatedByAgentId: string | null;
  updatedByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
}
```

推荐的 `IssueDocumentSummary` 形状：

```ts
interface IssueDocumentSummary {
  id: string;
  key: string;
  title: string | null;
  format: DocumentFormat;
  latestRevisionId: string;
  latestRevisionNumber: number;
  updatedAt: Date;
}
```

## 任务类型扩展

用以下扩展 `Issue`：

```ts
interface Issue {
  ...
  planDocument?: IssueDocument | null;
  documentSummaries?: IssueDocumentSummary[];
  legacyPlanDocument?: {
    key: "plan";
    body: string;
    source: "issue_description";
  } | null;
}
```

这直接满足 `PAP-448` 对心跳/API 任务获取的要求。

## API 端点

推荐的端点：

- `GET /api/issues/:issueId/documents`
- `GET /api/issues/:issueId/documents/:key`
- `PUT /api/issues/:issueId/documents/:key`
- `GET /api/issues/:issueId/documents/:key/revisions`
- `DELETE /api/issues/:issueId/documents/:key` 在 v1 中可选仅限董事会

推荐的 `PUT` 请求体：

```ts
{
  title?: string | null;
  format: "markdown" | "plain_text" | "json" | "html";
  body: string;
  changeSummary?: string | null;
  baseRevisionId?: string | null;
}
```

行为：

- 文档缺失 + 无 `baseRevisionId`：创建
- 文档存在 + 匹配的 `baseRevisionId`：更新
- 文档存在 + 过期的 `baseRevisionId`：`409`

## 授权和不变量

- 所有文档记录都是公司作用域的
- 任务关系必须属于同一公司
- 董事会访问遵循现有任务访问规则
- 智能体访问遵循现有同公司任务访问规则
- 每个变更操作都写入活动日志条目

v1 推荐的删除规则：

- 董事会可以删除文档
- 智能体可以创建/更新，但不能删除

这防止自动化系统过于轻易地删除权威文档。

## UI 计划

## 任务详情

在任务描述正下方添加新的**文档**区域。

推荐的行为：

- 存在时首先显示 `plan`
- 其他文档显示在下方
- 渲染类 gist 的头部：
  - 键
  - 标题
  - 上次更新元数据
  - 修订号
- 支持内联编辑
- 支持按键创建新文档
- 支持修订历史抽屉或面板

推荐的展示顺序：

1. 描述
2. 文档
3. 附件
4. 评论/活动/子任务

这符合文档在描述下方的请求，同时仍保留附件可用。

## 编辑体验

建议：

- 对 markdown 文档使用 markdown 预览 + 原始编辑切换
- v1 中对非 markdown 文档使用原始文本区域编辑器
- `409` 时显示明确的保存冲突
- 显示清晰的空状态："暂无文档"

## 旧版计划渲染

如果没有存储的 `plan` 文档但存在旧版 `<plan>`：

- 在文档区域显示
- 标记为 `来自描述的旧版计划`
- 在后续版本中提供创建/导入功能

## 智能体协议和技能

更新 Paperclip 智能体工作流，使计划不再编辑任务描述。

需要的变更：

- 更新 `skills/paperclip/SKILL.md`
- 用文档创建/更新指令替换 `<plan>` 指令
- 在 `docs/api/issues.md` 中记录新端点
- 更新仍在教授内联 `<plan>` 块的任何内部计划文档

新规则：

- 当被要求为任务制定计划时，创建或更新 key 为 `plan` 的任务文档
- 留下评论说明计划文档已创建/更新
- 不要将任务标记为完成

## 与工件计划的关系

这项工作应明确服务于更广泛的工件/交付物方向。

建议：

- 在此变更中将文档保持为独立的原语
- 在未来的 `ArtifactKind` 中添加 `document`
- 后续构建一个交付物读取模型来聚合：
  - 任务文档
  - 任务附件
  - 预览 URL
  - 工作区文件引用

工件提案目前没有显式的 `document` 类型。它应该有。

推荐的未来形状：

```ts
type ArtifactKind =
  | "document"
  | "attachment"
  | "workspace_file"
  | "preview"
  | "report_link";
```

## 实现阶段

## 第一阶段：共享契约和数据模型

文件：

- `packages/db/src/schema/documents.ts`
- `packages/db/src/schema/document_revisions.ts`
- `packages/db/src/schema/issue_documents.ts`
- `packages/db/src/schema/index.ts`
- `packages/db/src/migrations/*`
- `packages/shared/src/types/issue.ts`
- `packages/shared/src/validators/issue.ts` 或新的文档验证器文件
- `packages/shared/src/index.ts`

验收：

- 数据模型强制每个任务一个键
- 修订是仅追加的
- 共享类型在任务获取中暴露计划/文档字段

## 第二阶段：服务端服务和路由

文件：

- `server/src/services/issues.ts` 或 `server/src/services/documents.ts`
- `server/src/routes/issues.ts`
- `server/src/services/activity.ts` 调用点

行为：

- 列出/获取/更新/删除文档
- 修订列表
- `GET /issues/:id` 返回 `planDocument` + `documentSummaries`
- 公司边界检查与任务路由匹配

验收：

- 智能体和董事会可以获取/更新同公司任务文档
- 过期编辑返回 `409`
- 活动时间线显示文档变更

## 第三阶段：UI 任务文档界面

文件：

- `ui/src/api/issues.ts`
- `ui/src/lib/queryKeys.ts`
- `ui/src/pages/IssueDetail.tsx`
- 如需要的话新建可复用文档 UI 组件

行为：

- 在描述下渲染计划 + 文档
- 按键创建/更新
- 打开修订历史
- 清晰显示冲突/错误

验收：

- 董事会可以从任务详情创建 `plan` 文档
- 更新的计划立即显示
- 任务详情不再依赖描述中嵌入的 `<plan>`

## 第四阶段：技能/文档迁移

文件：

- `skills/paperclip/SKILL.md`
- `docs/api/issues.md`
- `doc/SPEC-implementation.md`
- 提到 `<plan>` 的相关计划/文档

验收：

- 计划指导引用任务文档，而非内联任务描述标签
- API 文档描述新的文档端点和任务负载新增

## 第五阶段：旧版兼容性和后续

行为：

- 读取旧版 `<plan>` 块作为回退
- 可选在后续添加显式导入/迁移命令

后续工作，首次合并不需要：

- 交付物/工件读取模型
- 项目/公司文档
- 评论关联文档
- 修订间差异视图

## 测试计划

### 服务端

- 文档创建/读取/更新/删除生命周期
- 修订编号
- `baseRevisionId` 冲突处理
- 公司边界强制执行
- 智能体 vs 董事会授权
- 任务获取包含 `planDocument` 和文档摘要
- 旧版 `<plan>` 回退行为
- 活动日志变更覆盖

### UI

- 任务详情显示计划文档
- 创建/更新流程正确使查询失效
- 冲突和验证错误被展示
- 旧版计划回退正确渲染

### 验证

在宣布实现完成之前运行：

```sh
pnpm -r typecheck
pnpm test:run
pnpm build
```

## 未决问题

1. v1 文档应该只支持 markdown，将 `json/html/plain_text` 推迟吗？
   建议：在 API 中允许全部四种，仅为 markdown 优化 UI。

2. 智能体应该被允许创建任意键，还是只能使用约定键？
   建议：允许带有规范化验证的任意键；仅为 `plan` 保留特殊行为。

3. v1 应该有删除功能吗？
   建议：有，但仅限董事会。

4. 旧版 `<plan>` 块是否应该被自动迁移？
   建议：首次推出中不自动变更。

5. 文档应该出现在未来的交付物区域中，还是保持为任务的顶层区域？
   建议：现在保持专用的文档区域；如果后续添加聚合工件视图，也在交付物中暴露它们。

## 最终建议

现在将**任务文档**作为聚焦的、文本优先的原语发布。

不要在同一实现中尝试解决完整的工件统一。

使用：

- 一流的文档表
- 任务级带键链接
- 仅追加的修订
- 正常任务获取中嵌入的 `planDocument`
- 旧版 `<plan>` 回退
- 技能/文档从描述嵌入计划迁移出来

这立即解决了真正的计划工作流问题，并为工件系统留下了干净的增长空间。
