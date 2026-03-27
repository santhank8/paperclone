# Issue 运行编排计划

## 背景

我们观察到单个 issue（例如 PAP-39）上的级联唤醒产生了多次同时运行：

- 来自 `issue_commented` 的受理人自唤醒
- 来自 `issue_comment_mentioned` 的向管理者/CTO 的提及唤醒
- 同一 issue 上的重叠运行

当前行为以运行为中心和以代理为中心。它在 `heartbeat.wakeup` 中按代理+任务进行合并，但不会在所有代理之间强制每个 issue 只有一个活动执行槽位。

## 当前已知情况

- 目前唯一可靠的 issue/运行关联是从 `heartbeat_runs.context_snapshot.issueId` 中派生的，运行状态为 `queued` 或 `running`。
- issue 上的 `checkoutRunId` 是工作所有权锁，不是编排锁。
- 唤醒从多个路由创建（`issues`、`approvals`、`agents`），全部通过 `heartbeat.wakeup` 汇集。

## 目标

1. 当目标代理与当前活动 issue 运行者具有相同的规范化名称时，防止同一 issue 的自唤醒级联。
2. 允许跨代理唤醒请求，但在当前 issue 运行者退出之前不执行。
3. 保证每个 issue 同时最多只有一个活动（排队或运行中的）执行所有者。
4. 将此强制执行集中在编排中（而非提示/技能规则中）。

## 非目标

- 替换代码变更所有权的检出语义。
- 改变管理者升级策略本身。
- 全局强制代理名称唯一性（作为单独的治理决策处理）。

## 提议的模型

在 `issues` 上使用显式的 issue 级别编排锁。

### 新的 Issue 属性

- `executionRunId: uuid | null`（FK 到 `heartbeat_runs.id`，`ON DELETE SET NULL`）
- `executionAgentNameKey: text | null`（规范化的小写/去空格代理名称）
- `executionLockedAt: timestamptz | null`

`executionRunId` 是"谁当前拥有此 issue 的编排权"的规范字段。

## 编排规则

### 规则 A：同一代理名称不自唤醒

如果唤醒是 issue 范围的，且 `issues.executionRunId` 指向一个活动运行，其 `executionAgentNameKey` 与唤醒代理名称键匹配：

- 不创建新的心跳运行
- 将唤醒请求写为 `coalesced`，原因为 `issue_execution_same_name`
- 返回现有运行引用

### 规则 B：不同名称可以唤醒，但需等待

如果 issue 有一个由不同代理名称键持有的活动执行锁：

- 接受唤醒请求
- 将请求持久化为延迟（新唤醒状态 `deferred_issue_execution`）
- 暂不创建运行

当活动 issue 运行完成时，将该 issue 最早的延迟请求提升为排队运行并转移 `executionRunId`。

### 规则 C：每个 Issue 一个活动执行所有者

对于 issue 范围的唤醒，运行创建仅在持有 issue 行的事务锁时进行。这确保同时只有一个排队/运行中的运行可以成为所有者。

## 实施计划

## 阶段 1：架构 + 共享合约

1. 添加 issue 列：`execution_run_id`、`execution_agent_name_key`、`execution_locked_at`。
2. 扩展 `packages/shared/src/types/issue.ts` 中的共享 `Issue` 类型。
3. 添加迁移和导出更新。

## 阶段 2：在 `heartbeat.wakeup` 中集中 Issue 执行门控

1. 在 `enqueueWakeup` 中，像今天一样从上下文/负载派生 `issueId`。
2. 如果没有 `issueId`，保持现有行为。
3. 如果 `issueId` 存在：
   - 事务 + `SELECT ... FOR UPDATE` 对 issue 行加锁
   - 解析/修复过时的 `executionRunId`（如果引用的运行不是 `queued|running`，清除锁）
   - 应用规则 A/规则 B/规则 C
4. 名称规范化辅助函数：
   - `agentNameKey = agent.name.trim().toLowerCase()`

## 阶段 3：运行完成时的延迟队列提升

1. 在运行终态（`succeeded`、`failed`、`cancelled`、孤儿回收）时：
   - 如果运行拥有 `issues.executionRunId`，清除 issue 锁
   - 提升该 issue 最早的延迟唤醒为排队运行
   - 将 issue 锁设置为提升的运行
   - 触发 `startNextQueuedRunForAgent(promotedAgentId)`

## 阶段 4：路由清理（"全面应用"）

1. 保持路由端按代理 ID 的唤醒去重，但以心跳门控作为事实来源。
2. 确保所有 issue 相关的唤醒调用在负载/上下文快照中包含 `issueId`。
3. 添加明确的原因代码，使日志中的抑制/延迟清晰可见。

## 阶段 5：测试

1. `heartbeat.wakeup` 的单元测试：
   - 同名自唤醒被抑制
   - 不同名唤醒被延迟
   - 所有者完成时锁释放并提升延迟唤醒
   - 过时锁恢复
2. 集成测试：
   - 在活动受理人运行期间带 `@CTO` 的评论不会创建并发活动运行
   - 任何时候每个 issue 只有一个活动所有者
3. 回归测试：
   - 非 issue 唤醒不受影响
   - 现有的分配/计时器行为对于没有 issue 上下文的任务不受影响

## 遥测 + 可调试性

- 在 `agent_wakeup_requests.reason` 中添加结构化原因：
  - `issue_execution_same_name`
  - `issue_execution_deferred`
  - `issue_execution_promoted`
- 为锁转移事件添加活动日志详情：
  - 来源运行 ID / 目标运行 ID / issue ID / 代理名称键

## 发布策略

1. 发布架构 + 功能标志（`ISSUE_EXECUTION_LOCK_ENABLED`），默认关闭。
2. 在开发环境中启用并验证 PAP-39 类型的场景。
3. 在预发布环境中启用，提高日志详细程度。
4. 稳定运行后默认启用。

## 验收标准

1. 单个 issue 同时不会有超过一个活动执行所有者运行（`queued|running`）。
2. 同一 issue 的同名自唤醒被抑制，不会生成新运行。
3. 不同名唤醒被接受但延迟，直到 issue 执行锁释放。
4. 在活动 issue 运行期间提及 CTO 不会在该 issue 上同时启动 CTO。
5. 通过不同的 issue/子 issue 仍可实现并行。

## 后续工作（独立但相关）

检出冲突逻辑应独立修正，使 `checkoutRunId = null` 的受理人可以通过当前运行 ID 获取检出，而不会产生虚假的 409 循环。
