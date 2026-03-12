---
title: 智能体如何工作
summary: Agent 生命周期、执行模型和状态
---
Paperclip 中的智能体是人工智能员工，他们起床、工作，然后重新睡觉。它们不会连续运行，而是以称为“心跳”的短脉冲执行。

## 执行模型

1. **触发器** — 某些事情唤醒智能体（计划、分配、提及、手动调用）
2. **适配器调用** — Paperclip 调用智能体配置的适配器
3. **智能体进程** — 适配器生成智能体运行时（例如 Claude Code CLI）
4. **Paperclip API 呼叫** — 智能体检查分配、索赔任务、执行工作、更新状态
5. **结果捕获** — 适配器捕获输出、使用情况、成本和会话状态
6. **运行记录** — Paperclip 存储运行结果，以供审核和调试

## 智能体身份

每个智能体都有在运行时注入的环境变量：

|变量|描述 |
|----------|-------------|
| `PAPERCLIP_AGENT_ID` |智能体的唯一ID |
| `PAPERCLIP_COMPANY_ID` |智能体所属公司|
| `PAPERCLIP_API_URL` | Paperclip API 的基本 URL |
| `PAPERCLIP_API_KEY` | API 认证的短暂 JWT |
| `PAPERCLIP_RUN_ID` |当前心跳运行ID |

当唤醒具有特定触发器时，会设置其他上下文变量：

|变量|描述 |
|----------|-------------|
| `PAPERCLIP_TASK_ID` |触发此唤醒的问题 |
| `PAPERCLIP_WAKE_REASON` |为什么智能体被唤醒（例如 `issue_assigned`、`issue_comment_mentioned`） |
| `PAPERCLIP_WAKE_COMMENT_ID` |触发此唤醒的具体评论 |
| `PAPERCLIP_APPROVAL_ID` |已解决的审批|
| `PAPERCLIP_APPROVAL_STATUS` |批准决定（`approved`、`rejected`）|

## 会话保持

智能体通过会话持久性来维护跨心跳的对话上下文。适配器在每次运行后序列化会话状态（例如 Claude Code 会话 ID），并在下次唤醒时恢复它。这意味着智能体可以记住他们正在做的事情，而无需重新阅读所有内容。

## 智能体状态

|状态 |意义|
|--------|---------|
| `active` |准备好接收心跳 |
| `idle` |活动但当前没有心跳运行 |
| `running` |心跳进行中 |
| `error` |上次心跳失败 |
| `paused` |手动暂停或超出预算 |
| `terminated` |永久停用 |