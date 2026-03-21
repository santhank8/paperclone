# 部署模式

状态：规范性部署和认证模式模型
日期：2026-02-23

## 1. 目的

Paperclip 支持两种运行时模式：

1. `local_trusted`
2. `authenticated`

`authenticated` 支持两种暴露策略：

1. `private`
2. `public`

这保持了单一的认证栈，同时区分了低摩擦的私有网络默认值和面向互联网的加固需求。

## 2. 规范模型

| 运行时模式 | 暴露 | 人类认证 | 主要用途 |
|---|---|---|---|
| `local_trusted` | 不适用 | 无需登录 | 单操作员本地机器工作流 |
| `authenticated` | `private` | 需要登录 | 私有网络访问（例如 Tailscale/VPN/LAN） |
| `authenticated` | `public` | 需要登录 | 面向互联网/云端部署 |

## 3. 安全策略

## `local_trusted`

- 仅绑定回环地址
- 无人类登录流程
- 针对最快的本地启动进行优化

## `authenticated + private`

- 需要登录
- 低摩擦 URL 处理（`auto` 基础 URL 模式）
- 需要私有主机信任策略

## `authenticated + public`

- 需要登录
- 需要显式公共 URL
- 更严格的部署检查，doctor 中出错即失败

## 4. 入门 UX 合约

默认入门保持交互式且无标志位：

```sh
pnpm paperclipai onboard
```

服务端提示行为：

1. 询问模式，默认 `local_trusted`
2. 选项文本：
- `local_trusted`："最简单的本地设置（无需登录，仅 localhost）"
- `authenticated`："需要登录；用于私有网络或公共托管"
3. 如果选择 `authenticated`，询问暴露方式：
- `private`："私有网络访问（例如 Tailscale），更低的设置摩擦"
- `public`："面向互联网的部署，更严格的安全要求"
4. 仅对 `authenticated + public` 询问显式公共 URL

`configure --section server` 遵循相同的交互行为。

## 5. Doctor UX 合约

默认 doctor 保持无标志位：

```sh
pnpm paperclipai doctor
```

Doctor 读取已配置的模式/暴露方式并应用模式感知检查。可选的覆盖标志位是次要的。

## 6. 董事会/用户集成合约

董事会身份必须由真实的数据库用户主体表示，以使基于用户的功能一致工作。

所需集成点：

- 在 `authUsers` 中为董事会身份创建真实用户行
- `instance_user_roles` 条目用于董事会管理员权限
- `company_memberships` 集成用于用户级任务分配和访问

这是必需的，因为用户分配路径会验证 `assigneeUserId` 的活跃成员资格。

## 7. 本地信任 -> 认证模式领取流程

在运行 `authenticated` 模式时，如果唯一的实例管理员是 `local-board`，Paperclip 会发出启动警告并提供一次性高熵领取 URL。

- URL 格式：`/board-claim/<token>?code=<code>`
- 用途：已登录的人类领取董事会所有权
- 领取操作：
  - 将当前已登录用户提升为 `instance_admin`
  - 降级 `local-board` 管理员角色
  - 确保领取用户在现有公司中拥有活跃的所有者成员资格

这防止了用户从长期本地信任使用迁移到认证模式时被锁定。

## 8. 当前代码现状（截至 2026-02-23）

- 运行时值为 `local_trusted | authenticated`
- `authenticated` 使用 Better Auth 会话和引导邀请流程
- `local_trusted` 确保在 `authUsers` 中有一个真实的本地董事会用户主体，并在 `instance_user_roles` 中拥有管理员访问权限
- 公司创建确保创建者在 `company_memberships` 中的成员资格，以使用户分配/访问流程保持一致

## 9. 命名和兼容性策略

- 规范命名为 `local_trusted` 和 `authenticated`，暴露方式为 `private/public`
- 对已弃用的命名变体不提供长期兼容别名层

## 10. 与其他文档的关系

- 实施计划：`doc/plans/deployment-auth-mode-consolidation.md`
- V1 合约：`doc/SPEC-implementation.md`
- 操作员工作流：`doc/DEVELOPING.md` 和 `doc/CLI.md`
