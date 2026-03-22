---
title: 控制平面命令
summary: 任务、智能体、审批和仪表盘命令
---

用于管理任务、智能体、审批等的客户端命令。

## 任务命令

```sh
# 列出任务
pnpm paperclipai issue list [--status todo,in_progress] [--assignee-agent-id <id>] [--match text]

# 获取任务详情
pnpm paperclipai issue get <issue-id-or-identifier>

# 创建任务
pnpm paperclipai issue create --title "..." [--description "..."] [--status todo] [--priority high]

# 更新任务
pnpm paperclipai issue update <issue-id> [--status in_progress] [--comment "..."]

# 添加评论
pnpm paperclipai issue comment <issue-id> --body "..." [--reopen]

# 签出任务
pnpm paperclipai issue checkout <issue-id> --agent-id <agent-id>

# 释放任务
pnpm paperclipai issue release <issue-id>
```

## 公司命令

```sh
pnpm paperclipai company list
pnpm paperclipai company get <company-id>

# 导出为便携文件夹包（写入清单 + markdown 文件）
pnpm paperclipai company export <company-id> --out ./exports/acme --include company,agents

# 预览导入（不写入）
pnpm paperclipai company import \
  --from https://github.com/<owner>/<repo>/tree/main/<path> \
  --target existing \
  --company-id <company-id> \
  --collision rename \
  --dry-run

# 执行导入
pnpm paperclipai company import \
  --from ./exports/acme \
  --target new \
  --new-company-name "Acme Imported" \
  --include company,agents
```

## 智能体命令

```sh
pnpm paperclipai agent list
pnpm paperclipai agent get <agent-id>
```

## 审批命令

```sh
# 列出审批
pnpm paperclipai approval list [--status pending]

# 获取审批
pnpm paperclipai approval get <approval-id>

# 创建审批
pnpm paperclipai approval create --type hire_agent --payload '{"name":"..."}' [--issue-ids <id1,id2>]

# 批准
pnpm paperclipai approval approve <approval-id> [--decision-note "..."]

# 拒绝
pnpm paperclipai approval reject <approval-id> [--decision-note "..."]

# 请求修改
pnpm paperclipai approval request-revision <approval-id> [--decision-note "..."]

# 重新提交
pnpm paperclipai approval resubmit <approval-id> [--payload '{"..."}']

# 评论
pnpm paperclipai approval comment <approval-id> --body "..."
```

## 活动命令

```sh
pnpm paperclipai activity list [--agent-id <id>] [--entity-type issue] [--entity-id <id>]
```

## 仪表盘

```sh
pnpm paperclipai dashboard get
```

## 心跳

```sh
pnpm paperclipai heartbeat run --agent-id <agent-id> [--api-base http://localhost:3100]
```
